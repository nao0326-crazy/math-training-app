/**
 * 単純計算 (division_2_1) の回帰テスト
 */

import { describe, expect, it } from 'vitest';
import { CalculationGenerator } from './generators';
import type { DifficultyLevel } from '../../types/problem';
import { validateProblem } from '../../engine/validator/validator';

describe('単純計算 division_2_1', () => {
  const generator = new CalculationGenerator(1, ['division_2_1']);

  it('除数がゼロにならない', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const problem = generator.generate({ difficulty: 3, seed });
      const { b } = problem.parameters as { a: number; b: number };
      expect(b).not.toBe(0);
    }
  });

  it('被除数が除数で割り切れる', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const problem = generator.generate({ difficulty: 3, seed });
      const { a, b } = problem.parameters as { a: number; b: number };
      expect(a % b).toBe(0);
    }
  });

  it('計算結果と正解値が一致する', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const problem = generator.generate({ difficulty: 3, seed });
      const { a, b } = problem.parameters as { a: number; b: number };
      expect(problem.answer.kind).toBe('integer');
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(a / b);
      }
    }
  });

  it('parameters と問題文の数値が一致する', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const problem = generator.generate({ difficulty: 3, seed });
      const { a, b } = problem.parameters as { a: number; b: number };
      expect(problem.question).toContain(`${a} ÷ ${b}`);
    }
  });

  it('複数回生成しても不正な問題が生成されない', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const problem = generator.generate({ difficulty: ((seed % 5) + 1) as DifficultyLevel, seed });
      const { a, b } = problem.parameters as { a: number; b: number };
      expect(b).not.toBe(0);
      expect(a % b).toBe(0);
      expect(problem.answer.kind).toBe('integer');
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(a / b);
      }
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});
