/**
 * 問題生成エンジンの大量生成テスト
 * 10000問生成して全問題を検証する
 */

import { describe, expect, it } from 'vitest';
import { generateProblem, getAllGenerators } from './generatorRegistry';
import { validateProblem } from '../validator/validator';
import { checkUserAnswer, formatAnswer } from '../../utils/answer';

describe('問題生成エンジン', () => {
  it('10000問生成して全問題が検証を通過する', () => {
    const generators = getAllGenerators();
    expect(generators.length).toBeGreaterThan(0);

    let totalGenerated = 0;
    const errors: string[] = [];

    for (let i = 0; i < 10000; i++) {
      const problem = generateProblem();
      const result = validateProblem(problem);

      if (!result.valid) {
        errors.push(
          `問題 ${problem.type} (ID: ${problem.id}): ${result.errors.join(', ')}`,
        );
        if (errors.length >= 10) break;
      }

      // 解答が正しくフォーマットできること
      const formatted = formatAnswer(problem.answer);
      expect(formatted.length).toBeGreaterThan(0);

      // 正解が自分自身と一致すること
      expect(checkUserAnswer(formatted, problem.answer)).toBe(true);

      totalGenerated++;
    }

    expect(errors).toEqual([]);
    expect(totalGenerated).toBe(10000);
  });

  it('全ジェネレータが個別に100問ずつ生成して検証を通過する', () => {
    const generators = getAllGenerators();

    for (const generator of generators) {
      for (let i = 0; i < 100; i++) {
        const problem = generator.generate();
        const result = validateProblem(problem);
        expect(result.valid, `${generator.type}: ${result.errors.join(', ')}`).toBe(true);
      }
    }
  });

  it('カテゴリ指定で生成できる', () => {
    const problem = generateProblem({ category: 'integer' });
    expect(problem.category).toBe('integer');
    const result = validateProblem(problem);
    expect(result.valid).toBe(true);
  });

  it('タイプ指定で生成できる', () => {
    const problem = generateProblem({ type: 'integer_addition' });
    expect(problem.type).toBe('integer_addition');
    const result = validateProblem(problem);
    expect(result.valid).toBe(true);
  });

  it('難易度指定で生成できる', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const problem = generateProblem({ difficulty: level });
      expect(problem.difficulty.level).toBeGreaterThanOrEqual(1);
      expect(problem.difficulty.level).toBeLessThanOrEqual(5);
      const result = validateProblem(problem);
      expect(result.valid).toBe(true);
    }
  });

  it('生成された問題のparametersが問題文と整合している', () => {
    for (let i = 0; i < 1000; i++) {
      const problem = generateProblem();
      const params = problem.parameters;

      // 問題文にパラメータの数値が含まれていること
      // templateIndex は内部インデックスなので除外
      for (const [key, value] of Object.entries(params)) {
        if (
          typeof value === 'number' &&
          key !== 'answer' &&
          key !== 'difficultyLevel' &&
          key !== 'templateIndex' &&
          key !== 'readingLevel' &&
          key !== 'reasoningLevel' &&
          key !== 'blankPosition' &&
          key !== 'termCount'
        ) {
          // 数値パラメータは問題文に含まれるか、説明に含まれる
          const questionContains = problem.question.includes(String(value));
          const explanationContains = problem.explanation?.includes(String(value)) ?? false;
          expect(
            questionContains || explanationContains,
            `${problem.type}: パラメータ ${key}=${value} が問題文・解説に含まれていません`,
          ).toBe(true);
        }
      }
    }
  });
});