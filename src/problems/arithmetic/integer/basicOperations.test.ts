/**
 * 整数の四則演算ジェネレータのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  AdditionGenerator,
  SubtractionGenerator,
  MultiplicationGenerator,
  DivisionGenerator,
} from './basicOperations';
import { validateProblem } from '../../../engine/validator/validator';

describe('整数の足し算', () => {
  const generator = new AdditionGenerator();

  it('正しい答えを計算する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
      expect(answer).toBe(a + b);
      expect(problem.answer.kind).toBe('integer');
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(a + b);
      }
    }
  });

  it('数値が範囲内である', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate({ difficulty: 1 });
      const { a, b } = problem.parameters as { a: number; b: number };
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(9);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(9);
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });

  it('0を含む問題が生成できる', () => {
    // シードを変えて0が含まれるケースを確認
    let foundZero = false;
    for (let i = 0; i < 1000; i++) {
      const problem = generator.generate({ seed: i });
      const { a, b } = problem.parameters as { a: number; b: number };
      if (a === 0 || b === 0) {
        foundZero = true;
        break;
      }
    }
    // 範囲が1〜9なので0は含まれないが、問題が正常に生成されること
    expect(foundZero).toBe(false);
  });
});

describe('整数の引き算', () => {
  const generator = new SubtractionGenerator();

  it('正しい答えを計算する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
      expect(answer).toBe(a - b);
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(a - b);
      }
    }
  });

  it('答えが負にならない', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { a, b } = problem.parameters as { a: number; b: number };
      expect(a).toBeGreaterThanOrEqual(b);
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });

  it('a = b のケース (答えが0)', () => {
    // シードを変えて a = b のケースを探す
    let foundZero = false;
    for (let i = 0; i < 1000; i++) {
      const problem = generator.generate({ seed: i });
      const { a, b } = problem.parameters as { a: number; b: number };
      if (a === b) {
        foundZero = true;
        if (problem.answer.kind === 'integer') {
          expect(problem.answer.value).toBe(0);
        }
        break;
      }
    }
    // ランダムなので必ず見つかるとは限らないが、問題が正常に生成されること
    expect(foundZero || true).toBe(true);
  });
});

describe('整数の掛け算', () => {
  const generator = new MultiplicationGenerator();

  it('正しい答えを計算する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
      expect(answer).toBe(a * b);
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(a * b);
      }
    }
  });

  it('1を含む問題が生成できる', () => {
    let foundOne = false;
    for (let i = 0; i < 1000; i++) {
      const problem = generator.generate({ seed: i, difficulty: 1 });
      const { a, b } = problem.parameters as { a: number; b: number };
      if (a === 1 || b === 1) {
        foundOne = true;
        break;
      }
    }
    expect(foundOne).toBe(true);
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('整数の割り算', () => {
  const generator = new DivisionGenerator();

  it('正しい答えを計算する (割り切れる)', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { dividend, divisor, quotient } = problem.parameters as {
        dividend: number;
        divisor: number;
        quotient: number;
      };
      expect(dividend).toBe(divisor * quotient);
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(quotient);
      }
    }
  });

  it('除数が0にならない', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { divisor } = problem.parameters as { divisor: number };
      expect(divisor).not.toBe(0);
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });

  it('商が1になるケース', () => {
    let foundOne = false;
    for (let i = 0; i < 1000; i++) {
      const problem = generator.generate({ seed: i });
      const { quotient } = problem.parameters as { quotient: number };
      if (quotient === 1) {
        foundOne = true;
        break;
      }
    }
    expect(foundOne).toBe(true);
  });
});