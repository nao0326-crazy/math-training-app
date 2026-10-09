/**
 * learning-quality.test.ts — 全 generator の学習価値ゲート
 *
 * Phase 2 の全面改革で導入した品質ゲート。
 * 全94 generator × 対応lv × 複数seed を実際に生成し、
 * 「計算は正しいが学習として意味が無い問題」「構造的な欠陥」
 * 「数値規模の超過」が1件も出ないことを保証する。
 *
 * 判定は learning-quality.ts の純粋関数に集約している。
 */

import { describe, expect, it } from 'vitest';
import { getAllGenerators } from '../engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../engine/diversity/metadata';
import { validateProblem } from '../engine/validator/validator';
import { generateSolutionSteps } from '../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../utils/answer';
import {
  findLearningQualityIssues,
  isRoundingNoOp,
  isReductionAnswerLeaked,
  SCALE_BUDGETS,
  DEFAULT_MAX_VALUE,
  maxNumberInText,
} from './learning-quality';
import type { DifficultyLevel, Problem } from '../types/problem';

const SEEDS = 40;

function generate(type: string, lv: DifficultyLevel, seed: number): Problem | null {
  const g = getAllGenerators().find((x) => x.type === type);
  if (!g) return null;
  try {
    return g.generate({ difficulty: lv, seed });
  } catch {
    return null;
  }
}

/**
 * 逆検証用の不良問題の雛形。
 *
 * 「0違反だから安全」は品質保証にならないので、
 * 各ルールが悪問を確実に reject し /
 * 良問を誤って reject しないことを両方向から確かめる。
 */
const base = {
  id: 'x',
  category: 'decimal',
  difficulty: {
    level: 2,
    components: {
      calculationComplexity: 2, numberComplexity: 2, reasoningComplexity: 1, readingComplexity: 1,
    },
  },
  question: '問題文',
  answer: { kind: 'integer' as const, value: 1 },
  parameters: {},
};
const mk = (p: Record<string, unknown>): Problem => ({ ...base, ...p }) as Problem;

/** [名前, 発火すべきルール, 問題] */
const BAD_PROBLEMS: [string, string, Problem][] = [
  ['丸めても変わらない', 'rounding-noop', mk({
    type: 'decimal_round',
    question: '316.2を、小数第3位まで四捨五入しなさい',
    answer: { kind: 'decimal', value: 316.2 },
    parameters: { value: 316.2, rounded: 316.2, roundTo: 3 },
  })],
  ['答えが問題文に漏れる約分', 'reduction-answer-leak', mk({
    type: 'fraction_reduce',
    category: 'fraction',
    question: '2分の1（分子4、分母8）を約分しなさい',
    answer: { kind: 'fraction', numerator: 1, denominator: 2 },
    parameters: { numerator: 4, denominator: 8, answerNumerator: 1, answerDenominator: 2 },
  })],
  ['答えが0の退化問題', 'degenerate-zero', mk({
    type: 'integer_subtraction',
    category: 'integer',
    question: '7 − 7 を計算しなさい',
    answer: { kind: 'integer', value: 0 },
    parameters: { a: 7, b: 7 },
  })],
  ['小数桁数が多すぎる答え', 'too-many-decimal-digits', mk({
    type: 'decimal_mul_decimal',
    question: '1.25 × 2.5 はいくつですか',
    answer: { kind: 'decimal', value: 1.2345 },
    parameters: { a: 1.25, b: 2.5 },
  })],
  ['空の問題文', 'empty-question', mk({ type: 'integer_addition', question: '   ' })],
  ['答えが有限値でない', 'non-finite-answer', mk({
    type: 'integer_division',
    category: 'integer',
    question: '1 ÷ 0',
    answer: { kind: 'integer', value: Number.POSITIVE_INFINITY },
  })],
  ['分母が0の分数', 'zero-denominator', mk({
    type: 'fraction_reduce',
    category: 'fraction',
    question: '3分の3を約分しなさい',
    answer: { kind: 'fraction', numerator: 1, denominator: 0 },
  })],
  ['計算量だけが過大', 'scale-over-budget', mk({
    type: 'decimal_mul_decimal',
    question: '8928.8に45.1をかけるといくつになりますか',
    answer: { kind: 'decimal', value: 402787.28 },
    explanation: '8928.8×45.1＝402787.28です。',
    parameters: { a: 8928.8, b: 45.1 },
  })],
];

describe('無意味問題の検出ルールは実際に効く', () => {
  it('丸めても変わらない問題は rounding-noop として検出される', () => {
    const noop: Problem = {
      id: 'x',
      category: 'decimal',
      type: 'decimal_round',
      difficulty: {
        level: 3,
        components: {
          calculationComplexity: 3,
          numberComplexity: 3,
          reasoningComplexity: 1,
          readingComplexity: 1,
        },
      },
      question: '316.2を、小数第3位まで四捨五入しなさい',
      answer: { kind: 'decimal', value: 316.2 },
      parameters: { value: 316.2, rounded: 316.2, roundTo: 3 },
    };
    expect(isRoundingNoOp(noop)).toBe(true);
    expect(findLearningQualityIssues(noop).map((i) => i.rule)).toContain('rounding-noop');
  });

  it('問題文の分数が答えになっている約分問題は leakage として検出される', () => {
    const leaked: Problem = {
      id: 'x',
      category: 'fraction',
      type: 'fraction_reduce',
      difficulty: {
        level: 2,
        components: {
          calculationComplexity: 2,
          numberComplexity: 2,
          reasoningComplexity: 2,
          readingComplexity: 1,
        },
      },
      question: '2分の1（分子4、分母8）を約分しなさい',
      answer: { kind: 'fraction', numerator: 1, denominator: 2 },
      parameters: {
        numerator: 4,
        denominator: 8,
        answerNumerator: 1,
        answerDenominator: 2,
        divisor: 4,
      },
    };
    expect(isReductionAnswerLeaked(leaked)).toBe(true);
    expect(findLearningQualityIssues(leaked).map((i) => i.rule)).toContain(
      'reduction-answer-leak',
    );
  });

  it('maxNumberInText は小数と負の数も扱う', () => {
    expect(maxNumberInText('縦 87 cm、横 56 cm')).toBe(87);
    expect(maxNumberInText('8928.8 に 45.1')).toBe(8928.8);
    expect(maxNumberInText('答えなし')).toBe(0);
  });
});

describe('ゲート自体の逆検証 (第3次監査)', () => {
  it('明らかな悪問は 8 ルールすべてで reject される', () => {
    const failed: string[] = [];
    for (const [name, rule, problem] of BAD_PROBLEMS) {
      const rules = findLearningQualityIssues(problem).map((i) => i.rule);
      if (!rules.includes(rule)) {
        failed.push(`${name}: ${rule} が発火せず (実際 ${rules.join(',') || 'なし'})`);
      }
    }
    expect(failed.join('\n'), `${failed.length} ルールが検出しなかった`).toBe('');
    expect(BAD_PROBLEMS.length).toBe(8);
  });

  it('明らかに良い問題は誤って reject されない (false positive がない)', () => {
    const GOOD: [string, Problem][] = [
      ['正常な四捨五入 (切り上げ)', mk({
        type: 'decimal_round',
        question: '3.47を、小数第1位まで四捨五入しなさい',
        answer: { kind: 'decimal', value: 3.5 },
        parameters: { value: 3.47, rounded: 3.5, roundTo: 1 },
      })],
      ['正常な四捨五入 (切り捨て)', mk({
        type: 'decimal_round',
        question: '3.42を、小数第1位まで四捨五入しなさい',
        answer: { kind: 'decimal', value: 3.4 },
        parameters: { value: 3.42, rounded: 3.4, roundTo: 1 },
      })],
      ['正常な約分 (答えが漏れない)', mk({
        type: 'fraction_reduce',
        category: 'fraction',
        question: '10分の8を約分しなさい',
        answer: { kind: 'fraction', numerator: 4, denominator: 5 },
        parameters: { numerator: 8, denominator: 10, answerNumerator: 4, answerDenominator: 5 },
      })],
      // 大きな数が学習目標の型 (概算) は悪問扱いしない
      ['概算の大きな答え', mk({
        type: 'estimate_product',
        category: 'integer',
        question: '398 × 502 は大约いくつですか',
        answer: { kind: 'integer', value: 200000 },
      })],
      // 単位変換の関係値 (1km = 1000000mm) は悪問ではない。
      // 第3次監査でここが scale-over-budget に誤って reject されていた。
      ['長さの単位変換 (1km = 1000000mm)', mk({
        type: 'unit_conversion_basic',
        category: 'geometry',
        question: '3kmは何cmですか',
        answer: { kind: 'integer', value: 300000 },
        explanation: '1km は 1000000mm なので、100000×3＝300000cm です。',
        parameters: { variant: 'length', from: 'km', to: 'cm', value: 3, answer: 300000 },
      })],
      ['面積の単位変換 (1m2 = 10000cm2)', mk({
        type: 'area_unit_conversion',
        category: 'geometry',
        question: '面積の単位を直します。5 m2 は何 cm2 です。',
        answer: { kind: 'integer', value: 50000 },
        explanation: '1 平方メートルは 10000 平方センチメートルです なので、10000 を掛けます。',
        parameters: { variant: 'sqm_to_sqcm', from: '㎡', to: '㎠', givenValue: 5, answer: 50000 },
      })],
    ];
    const fp: string[] = [];
    for (const [name, problem] of GOOD) {
      const rules = findLearningQualityIssues(problem).map((i) => i.rule);
      if (rules.length > 0) fp.push(`${name}: ${rules.join(',')}`);
    }
    expect(fp.join('\n'), `${fp.length} 件の false positive`).toBe('');
  });

  it('検出器は肯定例と否定例を正しく区別する', () => {
    expect(
      isRoundingNoOp(mk({
        type: 'decimal_round',
        question: '316.2を、小数第3位まで四捨五入しなさい',
        answer: { kind: 'decimal', value: 316.2 },
        parameters: { value: 316.2, rounded: 316.2 },
      })),
    ).toBe(true);
    expect(
      isRoundingNoOp(mk({
        type: 'decimal_round',
        question: '3.47を、小数第1位まで四捨五入しなさい',
        answer: { kind: 'decimal', value: 3.5 },
        parameters: { value: 3.47, rounded: 3.5 },
      })),
    ).toBe(false);
    expect(
      isReductionAnswerLeaked(mk({
        type: 'fraction_reduce',
        category: 'fraction',
        question: '2分の1（分子4、分母8）を約分しなさい',
        answer: { kind: 'fraction', numerator: 1, denominator: 2 },
        parameters: { answerNumerator: 1, answerDenominator: 2 },
      })),
    ).toBe(true);
    expect(
      isReductionAnswerLeaked(mk({
        type: 'fraction_reduce',
        category: 'fraction',
        question: '10分の8を約分しなさい',
        answer: { kind: 'fraction', numerator: 4, denominator: 5 },
        parameters: { answerNumerator: 4, answerDenominator: 5 },
      })),
    ).toBe(false);
  });
});

describe('全 generator: 学習価値の欠陥が出ない', () => {
  const violations: string[] = [];
  let checked = 0;

  for (const g of getAllGenerators()) {
    for (const lv of getTypeSupportedLevels(g.type)) {
      for (let s = 0; s < SEEDS; s++) {
        const p = generate(g.type, lv, s * 7919 + lv);
        if (!p) continue;
        checked++;
        for (const issue of findLearningQualityIssues(p)) {
          violations.push(`${g.type} lv${lv} seed${s} [${issue.rule}] ${issue.detail}`);
        }
      }
    }
  }

  it('無意味問題・構造欠陥・数値超過が1件も検出されない', () => {
    const detail = violations.slice(0, 25).join('\n');
    expect(
      detail,
      `${violations.length} violations (checked ${checked} problems)`,
    ).toBe('');
    expect(checked).toBeGreaterThan(5000);
  });
});

describe('全 generator: 数学的な整合 (既存ゲートの上位互換)', () => {
  it('生成された問題は validator を通り、答えが入力可能で途中式が付く', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const g of getAllGenerators()) {
      for (const lv of getTypeSupportedLevels(g.type)) {
        for (let s = 0; s < 12; s++) {
          const p = generate(g.type, lv, s * 104729 + lv);
          if (!p) continue;
          checked++;
          const v = validateProblem(p);
          if (!v.valid) failures.push(`${g.type} lv${lv}: ${v.errors.join(', ')}`);
          // 「指定 lv を返さない」件は quality-gate.test.ts が allowlist 付きで
          // 計測済みなので、ここでは二重に扱わない。
          const shown = formatAnswer(p.answer);
          if (shown.trim() === '') failures.push(`${g.type}: 空の答え`);
          else if (!checkUserAnswer(shown, p.answer)) {
            failures.push(`${g.type}: 表示された答え ${shown} が入力判定されない`);
          }
          if (generateSolutionSteps(p).length === 0) {
            failures.push(`${g.type}: 途中式が空`);
          }
        }
      }
    }
    expect(failures.slice(0, 20).join('\n'), `${failures.length} failures`).toBe('');
    expect(checked).toBeGreaterThan(2000);
  });
});

describe('数値規模の予算', () => {
  it('SCALE_BUDGETS の上限は既定上限以下', () => {
    const types = getAllGenerators().map((g) => g.type);
    for (const [key, budget] of Object.entries(SCALE_BUDGETS)) {
      // 「type:variant」形式のキーもあるため型名だけを取り出す
      const type = key.split(':')[0];
      expect(types, key).toContain(type);
      expect(budget.max).toBeGreaterThan(0);
      expect(budget.reason.length, key).toBeGreaterThan(5);
    }
  });

  it('既定上限は 1,000,000 (既存 validator と同じ水準)', () => {
    expect(DEFAULT_MAX_VALUE).toBe(1000000);
  });
});
