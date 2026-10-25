/** 朝のハイスピード計算ゲート: 問題生成・採点・結果集計 */

import type {
  SpeedGateOperation,
  SpeedGateProblem,
  SpeedGateAnswer,
  SpeedGateResult,
  SpeedGateOperationStats,
} from '../types/speedGate';

const OPERATION_ORDER: SpeedGateOperation[] = ['add', 'subtract', 'multiply', 'divide'];
const COUNT_PER_OPERATION = 25;

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function makeProblem(index: number, operation: SpeedGateOperation, a: number, b: number): SpeedGateProblem {
  const answer =
    operation === 'add'
      ? a + b
      : operation === 'subtract'
        ? a - b
        : operation === 'multiply'
          ? a * b
          : a / b;
  const symbol =
    operation === 'add'
      ? '+'
      : operation === 'subtract'
        ? '−'
        : operation === 'multiply'
          ? '×'
          : '÷';
  return {
    id: `${operation}-${index}`,
    index,
    operation,
    a,
    b,
    answer,
    question: `${a} ${symbol} ${b}`,
  };
}

function generateAdd(rng: () => number, start: number): SpeedGateProblem[] {
  const out: SpeedGateProblem[] = [];
  for (let i = 0; i < COUNT_PER_OPERATION; i++) {
    const a = randomInt(rng, 10, 99);
    const b = randomInt(rng, 10, 99);
    out.push(makeProblem(start + i, 'add', a, b));
  }
  return out;
}

function generateSubtract(rng: () => number, start: number): SpeedGateProblem[] {
  const out: SpeedGateProblem[] = [];
  for (let i = 0; i < COUNT_PER_OPERATION; i++) {
    let a = randomInt(rng, 10, 99);
    let b = randomInt(rng, 10, 99);
    if (a < b) [a, b] = [b, a];
    out.push(makeProblem(start + i, 'subtract', a, b));
  }
  return out;
}

function generateMultiply(rng: () => number, start: number): SpeedGateProblem[] {
  const out: SpeedGateProblem[] = [];
  for (let i = 0; i < COUNT_PER_OPERATION; i++) {
    const a = randomInt(rng, 2, 99);
    const b = randomInt(rng, 2, 99);
    out.push(makeProblem(start + i, 'multiply', a, b));
  }
  return out;
}

function generateDivide(rng: () => number, start: number): SpeedGateProblem[] {
  const out: SpeedGateProblem[] = [];
  for (let i = 0; i < COUNT_PER_OPERATION; i++) {
    // divisor 2..99, quotient so dividend <= 99 and divisible
    let divisor = randomInt(rng, 2, 99);
    let quotient = randomInt(rng, 1, Math.floor(99 / divisor));
    if (quotient < 1) quotient = 1;
    let dividend = divisor * quotient;
    if (dividend < 2) {
      divisor = 2;
      quotient = 1;
      dividend = 2;
    }
    // ensure two digits max
    if (dividend > 99) {
      quotient = Math.floor(99 / divisor);
      if (quotient < 1) quotient = 1;
      dividend = divisor * quotient;
    }
    out.push(makeProblem(start + i, 'divide', dividend, divisor));
  }
  return out;
}

export function generateSpeedGateProblems(dateKey: string): SpeedGateProblem[] {
  const rng = createRng(hashSeed(dateKey));
  const add = generateAdd(rng, 0);
  const sub = generateSubtract(rng, 25);
  const mul = generateMultiply(rng, 50);
  const div = generateDivide(rng, 75);
  // interleave? Spec says each 25; order can be grouped. Use grouped blocks.
  return [...add, ...sub, ...mul, ...div].map((p, i) => ({ ...p, index: i }));
}

export function createEmptyAnswers(count: number): (SpeedGateAnswer | null)[] {
  return Array.from({ length: count }, () => null);
}

export function judgeSpeedGateAnswer(problem: SpeedGateProblem, userAnswer: string | number): boolean {
  const normalized = String(userAnswer).trim();
  if (normalized === '') return false;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return false;
  return num === problem.answer;
}

export function computeSpeedGateResult(
  dateKey: string,
  problems: SpeedGateProblem[],
  answers: (SpeedGateAnswer | null)[],
  startedAt: string,
  completedAt: string,
): SpeedGateResult {
  const totalMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const opStats = Object.fromEntries(
    OPERATION_ORDER.map((op) => [
      op,
      { operation: op, total: 0, correct: 0, totalMs: 0, averageMs: 0, accuracy: 0 },
    ]),
  ) as Record<SpeedGateOperation, SpeedGateOperationStats>;

  let correctCount = 0;
  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    const answer = answers[i];
    const op = problem.operation;
    opStats[op].total += 1;
    if (answer?.isCorrect) {
      correctCount += 1;
      opStats[op].correct += 1;
    }
    opStats[op].totalMs += answer?.elapsedMs ?? 0;
  }

  for (const op of OPERATION_ORDER) {
    const s = opStats[op];
    s.averageMs = s.total > 0 ? Math.round(s.totalMs / s.total) : 0;
    s.accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0;
  }

  const totalCount = problems.length;
  const incorrectCount = totalCount - correctCount;
  const averageMs = totalCount > 0 ? Math.round(totalMs / totalCount) : 0;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 1000) / 10 : 0;

  return {
    dateKey,
    totalCount,
    correctCount,
    incorrectCount,
    accuracy,
    totalMs,
    averageMs,
    byOperation: opStats,
  };
}

export { OPERATION_ORDER, COUNT_PER_OPERATION };
