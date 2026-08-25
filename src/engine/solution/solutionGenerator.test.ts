/**
 * 解法 (途中式) 生成のテスト
 *
 * 最重要の保証:
 *   問題生成 → solutionSteps 生成 → 最終ステップ ↔ 正解 (answer)
 *   がすべての問題タイプで一致すること。
 */

import { describe, expect, it } from 'vitest';
import type { Problem } from '../../types/problem';
import { formatAnswer, answerToNumber, checkUserAnswer } from '../../utils/answer';
import { getAllGenerators, generateProblem } from '../selector/generatorRegistry';
import { attachSolutionSteps, generateSolutionSteps } from './solutionGenerator';

const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
const SEEDS = Array.from({ length: 10 }, (_, i) => i);

/** テスト用に最小の Problem を組み立てる */
function makeProblem(
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

/** 文字列から「数値 / 分数 / 帯分数」をすべて数値として抽出する */
function extractAnswerLikeValues(text: string): number[] {
  const values: number[] = [];
  // 帯分数: 7と1/2
  for (const m of text.matchAll(/(-?\d+)と(\d+)\/(\d+)/g)) {
    values.push(Number(m[1]) + Number(m[2]) / Number(m[3]));
  }
  // 分数: 3/4 (帯分数の一部と重ならないよう先に消す)
  const withoutMixed = text.replace(/(-?\d+)と(\d+)\/(\d+)/g, '');
  for (const m of withoutMixed.matchAll(/(?<![\d/])(\d+)\/(\d+)(?![\d/])/g)) {
    const d = Number(m[2]);
    if (d !== 0) values.push(Number(m[1]) / d);
  }
  // 数値
  for (const m of text.matchAll(/-?\d+(?:\.\d+)?/g)) {
    values.push(Number(m[0]));
  }
  return values;
}

describe('全問題タイプでの途中式と正解の整合性', () => {
  it('すべてのジェネレータ×難易度×シードで、途中式が生成され最終ステップが答えと一致する', () => {
    let checked = 0;
    const missingSteps: string[] = [];

    for (const generator of getAllGenerators()) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          let problem: Problem;
          try {
            problem = generator.generate({ difficulty, seed });
          } catch {
            continue; // そのシードでは生成不可能な組合せはスキップ
          }

          const steps = generateSolutionSteps(problem);
          if (steps.length === 0) {
            missingSteps.push(`${generator.type} (lv=${difficulty}, seed=${seed})`);
            continue;
          }

          const last = steps[steps.length - 1];
          const lastText = `${last.explanation ?? ''} ${last.expression ?? ''}`;
          const expected = formatAnswer(problem.answer);

          // 最終ステップには必ず答え (表示形式) が含まれる
          expect(
            lastText.includes(expected),
            `${generator.type} lv=${difficulty} seed=${seed}: 最終ステップ "${lastText}" に答え "${expected}" が含まれません`,
          ).toBe(true);

          // 数値回答の場合、最終ステップ内の値のひとつが正解と一致する
          if (problem.answer.kind !== 'string') {
            const candidates = extractAnswerLikeValues(lastText);
            const expectedNum = answerToNumber(problem.answer) as number;
            const matched = candidates.some(
              (v) => Math.abs(v - expectedNum) < 1e-9,
            );
            expect(
              matched,
              `${generator.type} lv=${difficulty} seed=${seed}: 最終ステップ "${lastText}" に正解 ${expectedNum} と一致する値がありません (${JSON.stringify(candidates)})`,
            ).toBe(true);
          }
          checked++;
        }
      }
    }

    expect(missingSteps, `途中式が生成されないタイプ: ${missingSteps.join(', ')}`).toEqual([]);
    expect(checked).toBeGreaterThan(1500);
  });

  it('attachSolutionSteps を通した問題には solutionSteps が付加される', () => {
    for (const generator of getAllGenerators()) {
      for (let i = 0; i < 20; i++) {
        const problem = generator.generate({ seed: i });
        const attached = attachSolutionSteps(problem);
        expect(
          attached.solutionSteps,
          `${generator.type}: solutionSteps が付加されていません`,
        ).toBeDefined();
        expect(attached.solutionSteps!.length).toBeGreaterThan(0);
      }
    }
  });

  it('generateProblem (出題パイプライン経路) でも solutionSteps が付加される', () => {
    for (let i = 0; i < 50; i++) {
      const problem = generateProblem({ seed: i });
      expect(problem.solutionSteps).toBeDefined();
      expect(problem.solutionSteps!.length).toBeGreaterThan(0);
    }
  });
});

describe('代表ケース: 途中式の内容検証', () => {
  it('ケース1 単純計算: 36 ÷ 4 = 9', () => {
    const p = makeProblem(
      'integer_division',
      'integer',
      { dividend: 36, divisor: 4, quotient: 9, operator: '÷', answer: 9 },
      { kind: 'integer', value: 9 },
    );
    const steps = generateSolutionSteps(p);
    expect(steps[0].expression).toBe('36 ÷ 4 = 9');
  });

  it('ケース2 複数段階: 12 × 3 + 5 → ①12×3=36 ②36+5=41', () => {
    const p = makeProblem(
      'integer_multi_step',
      'integer',
      {
        numbers: [12, 3, 5],
        operators: ['×', '+'],
        expression: '12 × 3 + 5',
        answer: 41,
        termCount: 3,
      },
      { kind: 'integer', value: 41 },
    );
    const steps = generateSolutionSteps(p);
    expect(steps.map((s) => s.expression)).toEqual(['12 × 3 = 36', '36 + 5 = 41']);
  });

  it('ケース3 分数の通分: 1/2 と 1/3 → 3/6 と 2/6', () => {
    const p = makeProblem(
      'fraction_common_denominator',
      'fraction',
      { n1: 1, d1: 2, n2: 1, d2: 3, common: 6, newN1: 3, newN2: 2 },
      { kind: 'string', value: '3/6 と 2/6' },
    );
    const steps = generateSolutionSteps(p);
    const expressions = steps.map((s) => s.expression ?? '');
    expect(expressions.some((e) => e.includes('= 3/6'))).toBe(true);
    expect(expressions.some((e) => e.includes('= 2/6'))).toBe(true);
    expect(expressions[expressions.length - 1]).toBe('3/6 と 2/6');
  });

  it('ケース4 分数×整数: 2/3 × 4 = 8/3 = 2と2/3 (帯分数へ)', () => {
    const p = makeProblem(
      'fraction_mul_integer',
      'fraction',
      {
        numerator: 2,
        denominator: 3,
        integer: 4,
        answerNumerator: 8,
        answerDenominator: 3,
        requiresReduction: false,
        isImproper: true,
      },
      { kind: 'mixed', whole: 2, numerator: 2, denominator: 3 },
    );
    const steps = generateSolutionSteps(p);
    expect(steps[0].expression).toContain('2/3 × 4 = 8/3');
    expect(steps[steps.length - 1].expression).toBe('2と2/3');
  });

  it('ケース5 小数: 1.2 × 3 = 3.6 (浮動小数点誤差が表示されない)', () => {
    const p = makeProblem(
      'decimal_mul_integer',
      'decimal',
      { a: 1.2, b: 3, answer: 3.6 },
      { kind: 'decimal', value: 3.6 },
    );
    const steps = generateSolutionSteps(p);
    expect(steps[0].expression).toBe('1.2 × 3 = 3.6');
  });

  it('ケース6 文章題: りんご24個から15個使う → 残り9個', () => {
    const p = makeProblem(
      'integer_word_problem',
      'integer',
      { a: 24, b: 15, operator: '-', answer: 9 },
      { kind: 'integer', value: 9 },
    );
    const steps = generateSolutionSteps(p);
    expect(steps[0].expression).toBe('24 - 15 = 9');
    expect(steps[0].explanation).toBeTruthy();
  });

  it('ケース7 周期: 赤青白の12番目 → 白 (あまり0は3番目と同じ)', () => {
    const p = makeProblem(
      'period_repetition',
      'numberTheory',
      { pattern: ['赤', '青', '白'], period: 3, n: 12, answer: '白', remainder: 0 },
      { kind: 'string', value: '白' },
    );
    const steps = generateSolutionSteps(p);
    expect(steps.some((s) => s.expression === '12 ÷ 3 = 4 あまり 0')).toBe(true);
    expect(steps[steps.length - 1].expression).toContain('白');
  });

  it('ケース8 単位つき: 22kmを2時間 → 速さ11km (単位が説明に入る)', () => {
    const p = makeProblem(
      'speed_calculation',
      'speed',
      { distance: 22, time: 2, timeUnit: '時間', distUnit: 'km', answer: 11 },
      { kind: 'decimal', value: 11 },
    );
    const steps = generateSolutionSteps(p);
    expect(steps[0].expression).toBe('22 ÷ 2 = 11');
    expect(steps[0].explanation).toContain('km');
    expect(steps[0].explanation).toContain('時間');
  });
});

describe('回答判定機能の回帰 (正規化が壊れていないこと)', () => {
  it('全角数字・桁区切りカンマ・分数入力が従来どおり判定できる', () => {
    // 全角数字
    expect(checkUserAnswer('３６', { kind: 'integer', value: 36 })).toBe(true);
    // 桁区切りカンマ
    expect(checkUserAnswer('１，２００', { kind: 'integer', value: 1200 })).toBe(true);
    // 半角分数
    expect(checkUserAnswer('3/4', { kind: 'fraction', numerator: 6, denominator: 8 })).toBe(true);
    // 帯分数
    expect(checkUserAnswer('1と2/3', { kind: 'mixed', whole: 1, numerator: 2, denominator: 3 })).toBe(true);
    // 不正解は false のまま
    expect(checkUserAnswer('35', { kind: 'integer', value: 36 })).toBe(false);
  });
});

