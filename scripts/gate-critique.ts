/**
 * gate-critique.ts — 学習価値ゲート (learning-quality.ts) 自体の逆検証
 *
 * 「0違反だから安全」ではなく、
 *   (1) 明らかな悪問を確実に reject できるか
 *   (2) 明らかに良い問題を誤って reject してないか (false positive)
 * を直接確かめる。
 *
 * 実行: npx vite-node scripts/gate-critique.ts
 */

import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import {
  findLearningQualityIssues,
  isRoundingNoOp,
  isReductionAnswerLeaked,
} from '../src/quality/learning-quality';
import type { DifficultyLevel, Problem } from '../src/types/problem';

function mk(p: Partial<Problem> & { type: string }): Problem {
  return {
    id: 'x',
    category: 'decimal',
    difficulty: {
      level: 2,
      components: {
        calculationComplexity: 2, numberComplexity: 2, reasoningComplexity: 1, readingComplexity: 1,
      },
    },
    question: '問題文',
    answer: { kind: 'integer', value: 1 },
    parameters: {},
    ...p,
  } as Problem;
}

const results: Record<string, unknown> = {};

// ===== (1) 悪問が確実に reject されるか =====
const mustReject: { name: string; problem: Problem; expectRule: string }[] = [
  {
    name: '丸めても変わらない問題',
    expectRule: 'rounding-noop',
    problem: mk({
      type: 'decimal_round',
      question: '316.2を、小数第3位まで四捨五入しなさい',
      answer: { kind: 'decimal', value: 316.2 },
      parameters: { value: 316.2, rounded: 316.2, roundTo: 3 },
    }),
  },
  {
    name: '問題文に答えが泄漏した約分問題',
    expectRule: 'reduction-answer-leak',
    problem: mk({
      type: 'fraction_reduce',
      category: 'fraction',
      question: '2分の1（分子4、分母8）を約分しなさい',
      answer: { kind: 'fraction', numerator: 1, denominator: 2 },
      parameters: { numerator: 4, denominator: 8, answerNumerator: 1, answerDenominator: 2 },
    }),
  },
  {
    name: '答えが0の退化問題',
    expectRule: 'degenerate-zero',
    problem: mk({
      type: 'integer_subtraction',
      category: 'integer',
      question: '7 − 7 を計算しなさい',
      answer: { kind: 'integer', value: 0 },
      parameters: { a: 7, b: 7 },
    }),
  },
  {
    name: '小数桁数が多すぎる答え',
    expectRule: 'too-many-decimal-digits',
    problem: mk({
      type: 'decimal_mul_decimal',
      question: '1.25 × 2.5 はいくつですか',
      answer: { kind: 'decimal', value: 1.2345 },
      parameters: { a: 1.25, b: 2.5 },
    }),
  },
  {
    name: '空の問題文',
    expectRule: 'empty-question',
    problem: mk({ type: 'integer_addition', question: '   ' }),
  },
  {
    name: '答えが有限値でない',
    expectRule: 'non-finite-answer',
    problem: mk({
      type: 'integer_division',
      category: 'integer',
      question: '1 ÷ 0',
      answer: { kind: 'integer', value: Number.POSITIVE_INFINITY },
      parameters: {},
    }),
  },
  {
    name: '分母が0の分数',
    expectRule: 'zero-denominator',
    problem: mk({
      type: 'fraction_reduce',
      category: 'fraction',
      question: '3分の3を約分しなさい',
      answer: { kind: 'fraction', numerator: 1, denominator: 0 },
      parameters: {},
    }),
  },
  {
    name: '計算量だけが過大な問題 (小数×小数)',
    expectRule: 'scale-over-budget',
    problem: mk({
      type: 'decimal_mul_decimal',
      question: '8928.8に45.1をかけるといくつになりますか',
      answer: { kind: 'decimal', value: 402787.28 },
      explanation: '8928.8×45.1＝402787.28です。',
      parameters: { a: 8928.8, b: 45.1 },
    }),
  },
];

results.mustReject = mustReject.map((c) => {
  const rules = findLearningQualityIssues(c.problem).map((i) => i.rule);
  return { name: c.name, expect: c.expectRule, fired: rules, ok: rules.includes(c.expectRule) };
});

// ===== (2) 明らかに良い問題を誤って reject していないか =====
const mustAccept: { name: string; problem: Problem }[] = [
  {
    name: '正常な四捨五入 (切り上げ側)',
    problem: mk({
      type: 'decimal_round',
      question: '3.47を、小数第1位まで四捨五入しなさい',
      answer: { kind: 'decimal', value: 3.5 },
      parameters: { value: 3.47, rounded: 3.5, roundTo: 1 },
    }),
  },
  {
    name: '正常な四捨五入 (切り捨て側)',
    problem: mk({
      type: 'decimal_round',
      question: '3.42を、小数第1位まで四捨五入しなさい',
      answer: { kind: 'decimal', value: 3.4 },
      parameters: { value: 3.42, rounded: 3.4, roundTo: 1 },
    }),
  },
  {
    name: '正常な約分問題 (答えが問題文に現れない)',
    problem: mk({
      type: 'fraction_reduce',
      category: 'fraction',
      question: '10分の8を約分しなさい',
      answer: { kind: 'fraction', numerator: 4, denominator: 5 },
      parameters: { numerator: 8, denominator: 10, answerNumerator: 4, answerDenominator: 5 },
    }),
  },
  {
    name: '大きな数が学習目標の型 (概算) は許容される',
    problem: mk({
      type: 'estimate_product',
      category: 'integer',
      question: '398 × 502 は大约いくつですか',
      answer: { kind: 'integer', value: 200000 },
      parameters: {},
    }),
  },
  {
    name: '単位変換で 1km=100000cm を使うのは正常',
    problem: mk({
      type: 'unit_conversion_basic',
      category: 'geometry',
      question: '3kmは何cmですか',
      answer: { kind: 'integer', value: 300000 },
      explanation: '1km は 100000cm なので、100000×3＝300000cm です。',
      parameters: { variant: 'length', from: 'km', to: 'cm', value: 3, answer: 300000 },
    }),
  },
  {
    name: '面積の単位変換 (1m2 = 10000cm2) は正常',
    problem: mk({
      type: 'area_unit_conversion',
      category: 'geometry',
      question: '面積の単位を直します。5 m2 は何 cm2 です。',
      answer: { kind: 'integer', value: 50000 },
      explanation:
        '1 平方メートルは 10000 平方センチメートルです なので、10000 を掛けます。5 × 10000 = 50000 cm2 です。',
      parameters: { variant: 'sqm_to_sqcm', from: '㎡', to: '㎠', givenValue: 5, answer: 50000 },
    }),
  },
  {
    name: '答えが 0 でないので退化していない',
    problem: mk({
      type: 'integer_subtraction',
      category: 'integer',
      question: '15 − 7 を計算しなさい',
      answer: { kind: 'integer', value: 8 },
      parameters: { a: 15, b: 7 },
    }),
  },
];

results.mustAccept = mustAccept.map((c) => {
  const issues = findLearningQualityIssues(c.problem);
  return { name: c.name, issues: issues.map((i) => i.rule), ok: issues.length === 0 };
});

// ===== (3) 実データでの誤判定 (false positive) =====
let realTotal = 0;
let realRejected = 0;
const fpSamples: string[] = [];
for (const g of getAllGenerators()) {
  for (const lv of getTypeSupportedLevels(g.type)) {
    for (let s = 0; s < 25; s++) {
      let p: Problem;
      try {
        p = g.generate({ difficulty: lv as DifficultyLevel, seed: s * 104729 + lv });
      } catch {
        continue;
      }
      realTotal++;
      const issues = findLearningQualityIssues(p);
      if (issues.length > 0) {
        realRejected++;
        if (fpSamples.length < 20) {
          fpSamples.push(`${g.type} [${issues.map((i) => i.rule).join(',')}] ${p.question}`);
        }
      }
    }
  }
}
results.realData = { total: realTotal, rejected: realRejected, samples: fpSamples };

// ===== (4) 単体検出器の肯定/否定テスト =====
results.detectors = {
  detectsRoundingNoOp: isRoundingNoOp(
    mk({
      type: 'decimal_round',
      question: '316.2を、小数第3位まで四捨五入しなさい',
      answer: { kind: 'decimal', value: 316.2 },
      parameters: { value: 316.2, rounded: 316.2 },
    }),
  ),
  passesRealRounding: !isRoundingNoOp(
    mk({
      type: 'decimal_round',
      question: '3.47を、小数第1位まで四捨五入しなさい',
      answer: { kind: 'decimal', value: 3.5 },
      parameters: { value: 3.47, rounded: 3.5 },
    }),
  ),
  detectsReductionLeak: isReductionAnswerLeaked(
    mk({
      type: 'fraction_reduce',
      category: 'fraction',
      question: '2分の1（分子4、分母8）を約分しなさい',
      answer: { kind: 'fraction', numerator: 1, denominator: 2 },
      parameters: { answerNumerator: 1, answerDenominator: 2 },
    }),
  ),
  passesCleanReduction: !isReductionAnswerLeaked(
    mk({
      type: 'fraction_reduce',
      category: 'fraction',
      question: '10分の8を約分しなさい',
      answer: { kind: 'fraction', numerator: 4, denominator: 5 },
      parameters: { answerNumerator: 4, answerDenominator: 5 },
    }),
  ),
};

console.log(JSON.stringify(results, null, 2));