import { describe, expect, it } from 'vitest';
import type { Problem } from '../types/problem';
import { generateSolutionSteps } from '../engine/solution/solutionGenerator';
import { UnitConversionBasicGenerator, VolumeUnitGenerator } from '../problems/geometry/generators';
import { GcdLcmWordGenerator } from '../problems/numberTheory/generators';

// makeProblem は solutionGenerator.test.ts からエクスポートされていないため、
// ここではローカルに同等のヘルパーを定義する。
function makeProblemLocal(
  type: string,
  category: Problem['category'],
  parameters: Record<string, unknown>,
  answer: Problem['answer'],
): Problem {
  return {
    id: `test_${type}`,
    category,
    type,
    difficulty: {
      level: 2,
      components: {
        calculationComplexity: 2,
        numberComplexity: 2,
        reasoningComplexity: 2,
        readingComplexity: 2,
      },
    },
    question: '(テスト用の問題文)',
    answer,
    parameters,
  };
}

describe('問題品質の回帰テスト', () => {
  it('単位換算の問題タイプは図形カテゴリではない', () => {
    const basic = new UnitConversionBasicGenerator();
    const volume = new VolumeUnitGenerator();
    expect(basic.category).toBe('integer');
    expect(volume.category).toBe('integer');

    const p1 = basic.generate({ difficulty: 2, seed: 1 });
    const p2 = volume.generate({ difficulty: 2, seed: 1 });
    expect(p1.category).toBe('integer');
    expect(p2.category).toBe('integer');
  });

  it('場合の数 (並べる) の途中式に「2通りです」という誤った段数が出ない', () => {
    const problem = makeProblemLocal(
      'arrange_simple',
      'combinatorics',
      { n: 3, r: 2, variant: 'pick_only' },
      { kind: 'integer', value: 6 },
    );
    const steps = generateSolutionSteps(problem);
    const explanations = steps.map((s) => s.explanation ?? '').join('\n');
    expect(explanations).not.toContain('2通りです');
    expect(explanations).toContain('3通りです');
  });

  it('場合の数 (すべて並べる) の途中式に同じ説明が重複しない', () => {
    const problem = makeProblemLocal(
      'arrange_tree',
      'combinatorics',
      { n: 3, variant: 'all' },
      { kind: 'integer', value: 6 },
    );
    const steps = generateSolutionSteps(problem);
    const explanations = steps.map((s) => s.explanation).filter(Boolean) as string[];
    expect(new Set(explanations).size).toBe(explanations.length);
  });

  it('組み合わせ (組合せ) の途中式で割り算と掛け算の優先順位が曖昧にならない', () => {
    const problem = makeProblemLocal(
      'combine_simple',
      'combinatorics',
      { n: 7, r: 4, variant: 'pick_only' },
      { kind: 'integer', value: 35 },
    );
    const steps = generateSolutionSteps(problem);
    const expressions = steps.map((s) => s.expression ?? '').join('\n');
    expect(expressions).toContain('÷ (');
  });

  it('約数・倍数の文章題 (周期) の問題文と正解が一致する', () => {
    const g = new GcdLcmWordGenerator();
    // period テンプレートが出るまでシードを探索する
    let found = false;
    for (let seed = 0; seed < 200; seed++) {
      const p = g.generate({ difficulty: 3, seed });
      if (String(p.question).includes('同じ数になる')) {
        expect(String(p.question)).not.toContain('何箱ずつ');
        expect(p.answer.kind).toBe('integer');
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
  it('合同判定 (線対称) の途中式・解説が0°回転を主張しない', () => {
    const problem = makeProblemLocal(
      'judge_same',
      'geometry',
      { rotationDeg: 0, transform: 'reflect' },
      { kind: 'string', value: 'はい' },
    );
    problem.explanation =
      '図Bは図Aを線対称移動（鏡映）し、平行移動した図形です。' +
      '線対称移動と平行移動では辺の長さと角の大きさが変わらないので、' +
      '図Aと図Bは合同です。';
    const steps = generateSolutionSteps(problem);
    const text = [
      problem.explanation ?? '',
      ...steps.map((s) => `${s.expression ?? ''} ${s.explanation ?? ''}`),
    ].join('\n');
    expect(text).not.toContain('0°回転');
    expect(text).toContain('線対称移動');
  });
});
