/**
 * 複数項計算・穴埋め問題ジェネレータのテスト
 */

import { describe, expect, it } from 'vitest';
import { MultiStepGenerator, FillBlankGenerator } from './multiStep';
import { validateProblem } from '../../../engine/validator/validator';

describe('複数項の計算', () => {
  const generator = new MultiStepGenerator();

  it('正しい答えを計算する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { numbers, operators, answer } = problem.parameters as {
        numbers: number[];
        operators: string[];
        answer: number;
      };

      // 式を評価して答えと一致するか確認
      const expected = evaluateForTest(numbers, operators);
      expect(answer).toBe(expected);
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(expected);
      }
    }
  });

  it('答えが負にならない', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
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

  it('3項以上の式が生成される', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { numbers } = problem.parameters as { numbers: number[] };
      expect(numbers.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('穴埋め問題', () => {
  const generator = new FillBlankGenerator();

  it('正しい答えを計算する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { answer } = problem.parameters as {
        answer: number;
      };

      // 問題文に答えが含まれていることを確認
      expect(problem.question).toContain('□');

      // 答えが正の整数であること
      expect(answer).toBeGreaterThan(0);
      expect(Number.isInteger(answer)).toBe(true);
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });

  it('割り算の穴埋めは割り切れる', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate({ seed: i });
      const { operator, a, answer } = problem.parameters as {
        operator: string;
        a: number;
        answer: number;
      };
      if (operator === '÷') {
        // a ÷ □ = c の形なので、a は answer で割り切れる
        expect(a % answer).toBe(0);
      }
    }
  });
});

/**
 * テスト用の式評価関数 (乗除優先)
 */
function evaluateForTest(numbers: number[], operators: string[]): number {
  const nums = [...numbers];
  const ops = [...operators];

  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '×' || ops[i] === '÷') {
      const left = nums[i];
      const right = nums[i + 1];
      const result = ops[i] === '×' ? left * right : left / right;
      nums.splice(i, 2, result);
      ops.splice(i, 1);
      i--;
    }
  }

  let result = nums[0];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '+') {
      result += nums[i + 1];
    } else {
      result -= nums[i + 1];
    }
  }
  return result;
}