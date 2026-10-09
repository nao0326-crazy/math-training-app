/**
 * 小数の加算・減算ジェネレータ
 *
 * 既存の decimal ジェネレータと同じ形式 (readonly type / category / description /
 * generate / validate) で実装した。
 * 浮動小数点誤差は addDecimalExact / subDecimalExact (整数演算) で防ぐ。
 *
 * 難易度設計 (学年ではなく計算構造の段階):
 *   lv1: 小数第1位まで。繰り上がり/繰り下がりなし
 *   lv2: 小数第1位まで。繰り上がり/繰り下がりあり
 *   lv3: 小数第2位まで。両方の小数部が同じ桁数
 *   lv4: 小数第1位と第2位で桁数が異なる (桁をそろえる必要あり)
 *   lv5: 小数第2位まで。複数桁での繰り上がり/繰り下がり
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../types/problem';
import { createRandom, generateProblemId } from '../../utils/random';
import {
  createDifficulty,
  numberSizeToComplexity,
  calculationStepsToComplexity,
} from '../../engine/difficulty/difficulty';
import {
  addDecimalExact,
  subDecimalExact,
  analyzeDecimalCarries,
  analyzeDecimalBorrows,
  longestCarryRun,
} from './decimalArithmetic';

function createDecimalDifficulty(
  level: DifficultyLevel,
  value: number,
  reasoningLevel: DifficultyLevel = 1,
  readingLevel: DifficultyLevel = 1,
) {
  return createDifficulty({
    calculationComplexity: calculationStepsToComplexity(level),
    numberComplexity: numberSizeToComplexity(value),
    reasoningComplexity: reasoningLevel,
    readingComplexity: readingLevel,
  });
}

/** 小数を安定的に文字列化する */
export function fmtDecimalValue(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

/** 繰り上がり/繰り下がりの位置の説明 (0 = 1の位, 1 = 小数第1位, ...) */
const PLACE_NAME: Record<number, string> = {
  0: '1の位',
  1: '小数第1位',
  2: '小数第2位',
  3: '小数第3位',
};

/** 各レベルの構造仕様 */
interface DecimalLevelSpec {
  /** 繰り上がり (加算) / 繰り下がり (減算) の最小回数 */
  minCarry: number;
  maxCarry: number;
  /** 連続する繰り上がり/繰り下がりの最小桁数 */
  minCarryRun: number;
  /** a の小数桁数の候補 */
  aPlaces: number[];
  /** b の小数桁数の候補 */
  bPlaces: number[];
  /** a の整数部分の最大値 */
  maxIntA: number;
  /** b の整数部分の最大値 */
  maxIntB: number;
  attempts: number;
}

const DECIMAL_ADDITION_SPECS: Record<DifficultyLevel, DecimalLevelSpec> = {
  1: { minCarry: 0, maxCarry: 0, minCarryRun: 0, aPlaces: [1], bPlaces: [1], maxIntA: 9, maxIntB: 9, attempts: 1 },
  2: { minCarry: 1, maxCarry: 1, minCarryRun: 1, aPlaces: [1], bPlaces: [1], maxIntA: 9, maxIntB: 9, attempts: 300 },
  3: { minCarry: 0, maxCarry: 2, minCarryRun: 0, aPlaces: [2], bPlaces: [2], maxIntA: 9, maxIntB: 9, attempts: 200 },
  4: { minCarry: 0, maxCarry: 2, minCarryRun: 0, aPlaces: [1, 2], bPlaces: [2, 1], maxIntA: 9, maxIntB: 9, attempts: 300 },
  5: { minCarry: 1, maxCarry: 3, minCarryRun: 1, aPlaces: [2], bPlaces: [2], maxIntA: 99, maxIntB: 99, attempts: 400 },
};

const DECIMAL_SUBTRACTION_SPECS: Record<DifficultyLevel, DecimalLevelSpec> = {
  1: { minCarry: 0, maxCarry: 0, minCarryRun: 0, aPlaces: [1], bPlaces: [1], maxIntA: 9, maxIntB: 9, attempts: 1 },
  2: { minCarry: 1, maxCarry: 1, minCarryRun: 1, aPlaces: [1], bPlaces: [1], maxIntA: 9, maxIntB: 9, attempts: 300 },
  3: { minCarry: 0, maxCarry: 2, minCarryRun: 0, aPlaces: [2], bPlaces: [2], maxIntA: 9, maxIntB: 9, attempts: 200 },
  4: { minCarry: 0, maxCarry: 2, minCarryRun: 0, aPlaces: [1, 2], bPlaces: [2, 1], maxIntA: 9, maxIntB: 9, attempts: 300 },
  5: { minCarry: 1, maxCarry: 3, minCarryRun: 1, aPlaces: [2], bPlaces: [2], maxIntA: 99, maxIntB: 99, attempts: 400 },
};

/** 小数を指定桁数で生成する (0.0 のような表記を避けるため小数部分は必ず 1 以上) */
function makeDecimal(rng: ReturnType<typeof createRandom>, maxInt: number, places: number): number {
  const intPart = rng.int(1, Math.max(1, maxInt));
  const maxFrac = Math.pow(10, places) - 1;
  const fracPart = rng.int(1, Math.max(1, maxFrac));
  return Number(`${intPart}.${String(fracPart).padStart(places, '0')}`);
}

/** 加法用の (a, b) を生成する */
function buildAdditionPair(
  rng: ReturnType<typeof createRandom>,
  spec: DecimalLevelSpec,
): { a: number; b: number } {
  const aPlaces = spec.aPlaces[rng.int(0, spec.aPlaces.length - 1)];
  const bPlaces = spec.bPlaces[rng.int(0, spec.bPlaces.length - 1)];
  return {
    a: makeDecimal(rng, spec.maxIntA, aPlaces),
    b: makeDecimal(rng, spec.maxIntB, bPlaces),
  };
}

/** 減法用の (a, b) を生成する。a > b を保証する (答えが負にならないため) */
function buildSubtractionPair(
  rng: ReturnType<typeof createRandom>,
  spec: DecimalLevelSpec,
): { a: number; b: number } | null {
  const aPlaces = spec.aPlaces[rng.int(0, spec.aPlaces.length - 1)];
  const bPlaces = spec.bPlaces[rng.int(0, spec.bPlaces.length - 1)];
  const a = makeDecimal(rng, spec.maxIntA, aPlaces);
  const b = makeDecimal(rng, spec.maxIntB, bPlaces);
  // b > a なら入れ替える
  if (b > a) return { a: b, b: a };
  // 同じ値は答え 0 になるので避ける
  if (b === a) return null;
  return { a, b };
}

/** 繰り上がり位置を文字列で説明する */
function describeCarryPositions(positions: number[]): string {
  const names = positions.map((p) => PLACE_NAME[p] ?? `位置${p}`);
  return `${names.join('、')}で繰り上がりました。`;
}

/** 繰り下がり位置を文字列で説明する */
function describeBorrowPositions(positions: number[]): string {
  const names = positions.map((p) => PLACE_NAME[p] ?? `位置${p}`);
  return `${names.join('、')}で繰り下げました。`;
}

/** 加算の解説を作る (小数点をそろえる筆算であることを示す) */
function buildAdditionExplanation(
  a: number,
  b: number,
  answer: number,
  carryPositions: number[],
): string {
  let text = `小数点の位置をそろえて ${fmtDecimalValue(a)}+${fmtDecimalValue(b)} を計算します。`;
  if (carryPositions.length > 0) text += describeCarryPositions(carryPositions);
  text += `答えは ${fmtDecimalValue(answer)} です。`;
  return text;
}

/** 減算の解説を作る */
function buildSubtractionExplanation(
  a: number,
  b: number,
  answer: number,
  borrowPositions: number[],
): string {
  let text = `小数点の位置をそろえて ${fmtDecimalValue(a)}−${fmtDecimalValue(b)} を計算します。`;
  if (borrowPositions.length > 0) text += describeBorrowPositions(borrowPositions);
  text += `答えは ${fmtDecimalValue(answer)} です。`;
  return text;
}

/**
 * 小数の加算
 * 例: 1.2 + 0.3 = ?
 */
export class DecimalAdditionGenerator implements ProblemGenerator {
  readonly type = 'decimal_addition';
  readonly category = 'decimal' as const;
  readonly description = '小数の加算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const spec = DECIMAL_ADDITION_SPECS[lv];

    let a = 0;
    let b = 0;
    let answer = 0;
    let carryPositions: number[] = [];

    for (let attempt = 0; attempt < spec.attempts; attempt++) {
      const candidate = buildAdditionPair(rng, spec);
      const positions = analyzeDecimalCarries(candidate.a, candidate.b);
      if (positions.length < spec.minCarry || positions.length > spec.maxCarry) continue;
      if (longestCarryRun(positions) < spec.minCarryRun) continue;

      a = candidate.a;
      b = candidate.b;
      carryPositions = positions;
      answer = addDecimalExact(a, b);
      break;
    }

    if (a === 0 && b === 0) {
      // 条件を満たす組が出なかった場合の保険 (範囲内の安全な値で確定させる)
      a = 1.2;
      b = 0.3;
      answer = addDecimalExact(a, b);
      carryPositions = analyzeDecimalCarries(a, b);
    }

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, Math.max(a, b, answer), 1, 1),
      question: `${fmtDecimalValue(a)}に${fmtDecimalValue(b)}をたすといくつになりますか`,
      answer: { kind: 'decimal', value: answer },
      explanation: buildAdditionExplanation(a, b, answer, carryPositions),
      parameters: {
        a,
        b,
        answer,
        carryCount: carryPositions.length,
        carryPositions,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
    if (Math.abs(addDecimalExact(a, b) - answer) > 1e-12) {
      errors.push('小数の加算の答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 小数の減算
 * 例: 2.5 - 1.3 = ?
 */
export class DecimalSubtractionGenerator implements ProblemGenerator {
  readonly type = 'decimal_subtraction';
  readonly category = 'decimal' as const;
  readonly description = '小数の減算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const spec = DECIMAL_SUBTRACTION_SPECS[lv];

    let a = 0;
    let b = 0;
    let answer = 0;
    let borrowPositions: number[] = [];

    for (let attempt = 0; attempt < spec.attempts; attempt++) {
      const candidate = buildSubtractionPair(rng, spec);
      if (!candidate) continue;
      const positions = analyzeDecimalBorrows(candidate.a, candidate.b);
      if (positions.length < spec.minCarry || positions.length > spec.maxCarry) continue;
      if (longestCarryRun(positions) < spec.minCarryRun) continue;

      a = candidate.a;
      b = candidate.b;
      borrowPositions = positions;
      answer = subDecimalExact(a, b);
      break;
    }

    if (a === 0 && b === 0) {
      // 条件を満たす組が出なかった場合の保険
      a = 2.5;
      b = 1.3;
      answer = subDecimalExact(a, b);
      borrowPositions = analyzeDecimalBorrows(a, b);
    }

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, Math.max(a, b, answer), 1, 1),
      question: `${fmtDecimalValue(a)}から${fmtDecimalValue(b)}をひくといくつになりますか`,
      answer: { kind: 'decimal', value: answer },
      explanation: buildSubtractionExplanation(a, b, answer, borrowPositions),
      parameters: {
        a,
        b,
        answer,
        borrowCount: borrowPositions.length,
        borrowPositions,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
    if (Math.abs(subDecimalExact(a, b) - answer) > 1e-12) {
      errors.push('小数の減算の答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}