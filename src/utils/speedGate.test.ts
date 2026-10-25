import { describe, expect, it } from 'vitest';
import {
  generateSpeedGateProblems,
  judgeSpeedGateAnswer,
  computeSpeedGateResult,
  createEmptyAnswers,
} from './speedGate';

describe('speedGate generation', () => {
  it('100問ちょうど、各計算25問ずつ', () => {
    const problems = generateSpeedGateProblems('2026-10-25');
    expect(problems).toHaveLength(100);
    const counts = problems.reduce<Record<string, number>>((acc, p) => {
      acc[p.operation] = (acc[p.operation] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.add).toBe(25);
    expect(counts.subtract).toBe(25);
    expect(counts.multiply).toBe(25);
    expect(counts.divide).toBe(25);
  });

  it('すべての計算結果が正しい', () => {
    const problems = generateSpeedGateProblems('2026-10-25');
    for (const p of problems) {
      const expected =
        p.operation === 'add'
          ? p.a + p.b
          : p.operation === 'subtract'
            ? p.a - p.b
            : p.operation === 'multiply'
              ? p.a * p.b
              : p.a / p.b;
      expect(p.answer).toBe(expected);
    }
  });

  it('数値範囲が仕様を満たす', () => {
    const problems = generateSpeedGateProblems('2026-10-25');
    for (const p of problems) {
      if (p.operation === 'add' || p.operation === 'subtract') {
        expect(p.a).toBeGreaterThanOrEqual(10);
        expect(p.a).toBeLessThanOrEqual(99);
        expect(p.b).toBeGreaterThanOrEqual(10);
        expect(p.b).toBeLessThanOrEqual(99);
      }
      if (p.operation === 'subtract') {
        expect(p.answer).toBeGreaterThanOrEqual(0);
      }
      if (p.operation === 'multiply') {
        expect(p.a).toBeGreaterThanOrEqual(2);
        expect(p.a).toBeLessThanOrEqual(99);
        expect(p.b).toBeGreaterThanOrEqual(2);
        expect(p.b).toBeLessThanOrEqual(99);
      }
      if (p.operation === 'divide') {
        expect(p.a).toBeGreaterThanOrEqual(2);
        expect(p.a).toBeLessThanOrEqual(99);
        expect(p.b).toBeGreaterThanOrEqual(2);
        expect(p.b).toBeLessThanOrEqual(99);
        expect(p.a % p.b).toBe(0);
      }
    }
  });

  it('同日再読み込みで問題セットが変わらない', () => {
    const a = generateSpeedGateProblems('2026-10-25');
    const b = generateSpeedGateProblems('2026-10-25');
    expect(a).toEqual(b);
  });

  it('空欄を正解扱いしない', () => {
    const problems = generateSpeedGateProblems('2026-10-25');
    expect(judgeSpeedGateAnswer(problems[0], '')).toBe(false);
    expect(judgeSpeedGateAnswer(problems[0], '   ')).toBe(false);
  });

  it('最終問題採点後に完了結果を計算できる', () => {
    const problems = generateSpeedGateProblems('2026-10-25');
    const answers = createEmptyAnswers(problems.length);
    answers[0] = {
      index: 0,
      userAnswer: String(problems[0].answer),
      correctAnswer: problems[0].answer,
      isCorrect: true,
      elapsedMs: 100,
      answeredAt: new Date().toISOString(),
    };
    const result = computeSpeedGateResult(
      '2026-10-25',
      problems,
      answers,
      new Date(Date.now() - 1000).toISOString(),
      new Date().toISOString(),
    );
    expect(result.totalCount).toBe(100);
    expect(result.correctCount).toBe(1);
  });
});
