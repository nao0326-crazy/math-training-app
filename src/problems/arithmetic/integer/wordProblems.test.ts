/**
 * 整数の文章題ジェネレータのテスト
 */

import { describe, expect, it } from 'vitest';
import { IntegerWordProblemGenerator } from './wordProblems';
import { validateProblem } from '../../../engine/validator/validator';

describe('整数の文章題', () => {
  const generator = new IntegerWordProblemGenerator();

  it('正しい答えを計算する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { a, b, operator, answer } = problem.parameters as {
        a: number;
        b: number;
        operator: string;
        answer: number;
      };

      let expected: number;
      switch (operator) {
        case '+':
          expected = a + b;
          break;
        case '-':
          expected = a - b;
          break;
        case '×':
          expected = a * b;
          break;
        case '÷':
          expected = a / b;
          break;
        default:
          throw new Error(`不明な演算子: ${operator}`);
      }

      expect(answer).toBe(expected);
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(expected);
      }
    }
  });

  it('問題文が文章形式になっている', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      // 問題文が長く、日本語の文章になっている
      expect(problem.question.length).toBeGreaterThan(10);
      expect(problem.question).toContain('。');
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });

  it('答えが正の整数である', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBeGreaterThan(0);
      }
    }
  });

  it('割り算の文章題は割り切れる', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate({ seed: i });
      const { a, b, operator } = problem.parameters as {
        a: number;
        b: number;
        operator: string;
      };
      if (operator === '÷') {
        expect(a % b).toBe(0);
      }
    }
  });
});