/**
 * 自動検証システムのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  validateProblem,
  validateProblemStructure,
  validateAnswer,
  validateDifficulty,
  createValidationResult,
} from './validator';
import type { Problem } from '../../types/problem';

/**
 * テスト用の有効な問題を作成する
 */
function createValidProblem(): Problem {
  return {
    id: 'test-1',
    category: 'integer',
    type: 'integer_addition',
    difficulty: {
      level: 2,
      components: {
        calculationComplexity: 2,
        numberComplexity: 2,
        reasoningComplexity: 1,
        readingComplexity: 1,
      },
    },
    question: '3に4をたすといくつになりますか',
    answer: { kind: 'integer', value: 7 },
    explanation: '3＋4＝7 です。',
    parameters: { a: 3, b: 4, operator: '+', answer: 7, difficultyLevel: 2 },
  };
}

describe('validateProblemStructure', () => {
  it('有効な問題はエラーなし', () => {
    const errors = validateProblemStructure(createValidProblem());
    expect(errors).toEqual([]);
  });

  it('IDが空の場合はエラー', () => {
    const problem = createValidProblem();
    problem.id = '';
    const errors = validateProblemStructure(problem);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('問題文が空の場合はエラー', () => {
    const problem = createValidProblem();
    problem.question = '';
    const errors = validateProblemStructure(problem);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('カテゴリがない場合はエラー', () => {
    const problem = createValidProblem();
    problem.category = '' as never;
    const errors = validateProblemStructure(problem);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('parametersがない場合はエラー', () => {
    const problem = createValidProblem();
    problem.parameters = {} as never;
    const errors = validateProblemStructure(problem);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateAnswer', () => {
  it('有効な解答はエラーなし', () => {
    const errors = validateAnswer(createValidProblem());
    expect(errors).toEqual([]);
  });

  it('約分されていない分数はエラー', () => {
    const problem = createValidProblem();
    problem.answer = { kind: 'fraction', numerator: 2, denominator: 4 };
    const errors = validateAnswer(problem);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('分母が0の分数はエラー', () => {
    const problem = createValidProblem();
    problem.answer = { kind: 'fraction', numerator: 1, denominator: 0 };
    const errors = validateAnswer(problem);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('帯分数の分子が分母以上はエラー', () => {
    const problem = createValidProblem();
    problem.answer = { kind: 'mixed', whole: 1, numerator: 3, denominator: 2 };
    const errors = validateAnswer(problem);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('極端に大きい値はエラー', () => {
    const problem = createValidProblem();
    problem.answer = { kind: 'integer', value: 1_000_001 };
    const errors = validateAnswer(problem);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateDifficulty', () => {
  it('有効な難易度はエラーなし', () => {
    const errors = validateDifficulty(createValidProblem());
    expect(errors).toEqual([]);
  });

  it('範囲外の難易度レベルはエラー', () => {
    const problem = createValidProblem();
    problem.difficulty.level = 6 as never;
    const errors = validateDifficulty(problem);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('範囲外のコンポーネントはエラー', () => {
    const problem = createValidProblem();
    problem.difficulty.components.calculationComplexity = 0 as never;
    const errors = validateDifficulty(problem);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateProblem', () => {
  it('有効な問題はvalid', () => {
    const result = validateProblem(createValidProblem());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('無効な問題はinvalid', () => {
    const problem = createValidProblem();
    problem.question = '';
    const result = validateProblem(problem);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('createValidationResult', () => {
  it('エラーなしはvalid', () => {
    const result = createValidationResult();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('エラーありはinvalid', () => {
    const result = createValidationResult(['エラー1']);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['エラー1']);
  });
});