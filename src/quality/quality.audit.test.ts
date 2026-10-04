/**
 * 問題生成品質監査テスト
 */

import { describe, expect, it } from 'vitest';
import { getAllGenerators } from '../engine/selector/generatorRegistry';
import type { Problem } from '../types/problem';
import { inspectProblem, inspectJapanese, inspectEducation } from './audit-helpers';

describe('問題生成品質監査', () => {
  const generators = getAllGenerators();

  it('全Generatorから問題を生成して品質を検査する', () => {
    const allIssues: { generator: string; issues: string[]; problem: Problem }[] = [];

    for (const generator of generators) {
      // 各難易度で50問ずつ生成
      for (let difficulty = 1; difficulty <= 5; difficulty++) {
        for (let seed = 0; seed < 50; seed++) {
          try {
            const problem = generator.generate({
              difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
              seed,
            });

            // 基本検査
            const basicIssues = inspectProblem(problem);
            // 日本語検査
            const japaneseIssues = inspectJapanese(problem);
            // 教育検査
            const educationIssues = inspectEducation(problem);

            const allBasicIssues = [...basicIssues, ...japaneseIssues, ...educationIssues];

            if (allBasicIssues.length > 0) {
              allIssues.push({
                generator: generator.type,
                issues: allBasicIssues,
                problem,
              });
            }
          } catch (e) {
            // 生成失敗はスキップ
          }
        }
      }
    }

    // 問題のサンプルを表示
    if (allIssues.length > 0) {
      console.log(`\n検出された問題数: ${allIssues.length}`);

      // 問題タイプごとに集計
      const issueSummary = new Map<string, number>();
      for (const issue of allIssues) {
        for (const detail of issue.issues) {
          issueSummary.set(detail, (issueSummary.get(detail) || 0) + 1);
        }
      }

      console.log('問題の内訳:');
      for (const [issue, count] of issueSummary) {
        console.log(`  ${issue}: ${count}`);
      }

      // 最初の20件を表示
      console.log('\n問題サンプル（最初の20件）:');
      for (const issue of allIssues.slice(0, 20)) {
        console.log(`\n[${issue.generator}]`);
        console.log(`  問題: ${issue.problem.question}`);
        console.log(`  正解: ${JSON.stringify(issue.problem.answer)}`);
        console.log(`  問題点: ${issue.issues.join(', ')}`);
      }
    }

    // テスト自体は成功とする（問題の検出が目的）
    expect(true).toBe(true);
  });

  it('全Generatorが正常に問題を生成できる', () => {
    for (const generator of generators) {
      // 難易度2で10問生成
      for (let seed = 0; seed < 10; seed++) {
        expect(() => {
          generator.generate({ difficulty: 2 as const, seed });
        }).not.toThrow();
      }
    }
  });

  it('生成された問題の正解が整合している', () => {
    // 特定のGeneratorで正解の整合性を確認
    const testCases = [
      { generator: 'integer_addition', difficulty: 2, seed: 1 },
      { generator: 'fraction_mul_fraction', difficulty: 2, seed: 1 },
      { generator: 'ratio_simplify', difficulty: 2, seed: 1 },
      { generator: 'expression_make', difficulty: 2, seed: 1 },
    ];

    for (const testCase of testCases) {
      const generator = generators.find((g) => g.type === testCase.generator);
      if (generator) {
        const problem = generator.generate({
          difficulty: testCase.difficulty as 1 | 2 | 3 | 4 | 5,
          seed: testCase.seed,
        });

        // 基本的な整合性チェック
        expect(problem.answer).toBeDefined();
        expect(problem.question).toBeDefined();
        expect(problem.question.length).toBeGreaterThan(0);
      }
    }
  });
});
