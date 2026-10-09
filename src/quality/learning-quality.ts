/**
 * learning-quality.ts — 「学習価値が無い問題」の自動検出ルール
 *
 * 既存の quality-rules.ts は「答えが0」「小数桁数」「variety」を判定する。
 * ここでは Phase 2 で全94 generatorを再監査した結果を受けて、
 * 実際に検出された「計算は正しいが学習として意味が無い問題」をルール化した。
 * すべて metadata (family) や parameters で駆動するため、新しい generator が
 * 同じ種類の問題を作っても自動的に検出される。
 *
 * 判定は純粋関数。テスト (learning-quality.test.ts) から
 * 全 generator を大量生成して違反がないことを保証する。
 */

import type { Problem } from '../types/problem';
import { deriveMetadata } from '../engine/diversity/metadata';
import { decimalDigits, isDegenerateZeroAnswer } from './quality-rules';

/** 検出された問題 */
export interface LearningQualityIssue {
  /** ルール名 */
  rule: string;
  /** 人が読める説明 */
  detail: string;
}

/** 問題文 (と解説) に現れる数値の最大絶対値を求める */
export function maxNumberInText(text: string): number {
  let max = 0;
  for (const m of text.match(/-?\d+(?:\.\d+)?/g) ?? []) {
    const v = Math.abs(Number(m));
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max;
}

/** 答えに含まれる数値がすべて有限かどうか */
function answerIsFinite(answer: Problem['answer']): boolean {
  switch (answer.kind) {
    case 'integer':
    case 'decimal':
      return Number.isFinite(answer.value);
    case 'fraction':
    case 'mixed':
      return Number.isFinite(answer.numerator) && Number.isFinite(answer.denominator);
    case 'fractions':
      return answer.values.every(
        (v) => Number.isFinite(v.numerator) && Number.isFinite(v.denominator),
      );
    case 'string':
      return !/NaN|Infinity|undefined/.test(answer.value);
  }
}

/**
 * 「丸めても値が変わりません」問題かどうか。
 *
 * 四捨五入問題は、入力と答えが同一だと何も練習にならない
 * (例: 316.2 を小数第3位まで四捨五入 → 316.2)。
 * family 'rounding' の型にだけ適用し parameters の value/rounded を見る。
 */
export function isRoundingNoOp(problem: Problem): boolean {
  if (deriveMetadata(problem).family !== 'rounding') return false;
  const params = problem.parameters as { value?: number; rounded?: number };
  if (typeof params.value !== 'number' || typeof params.rounded !== 'number') return false;
  return params.value === params.rounded;
}

/**
 * 「約分問題で、問題文の分数がすでに答えになっている」かどうか。
 *
 * 例: 4/8 の約分を問うのに問題文が「2分の1（分子4、分母8）」と書かれると、
 * 答えが問題文に露出している。family 'reduction' の型にだけ適用する。
 */
export function isReductionAnswerLeaked(problem: Problem): boolean {
  if (deriveMetadata(problem).family !== 'reduction') return false;
  const params = problem.parameters as {
    answerNumerator?: number;
    answerDenominator?: number;
  };
  const { answerNumerator, answerDenominator } = params;
  if (typeof answerNumerator !== 'number' || typeof answerDenominator !== 'number') {
    return false;
  }
  // 答えを日本語の分数表記にして、問題文にそのまま入っているかを調べる。
  // 旧実装の「2分の1（分子4、分母8）を約分しなさい」は答えは 1/2 なので
  // 問題文に「2分の1」が現れ、漏洩として検出される。
  const answerText =
    answerDenominator === 1
      ? String(answerNumerator)
      : `${answerDenominator}分の${answerNumerator}`;
  return problem.question.includes(answerText);
}

/**
 * 数値規模の予算 (問題文・解説に現れる数値の絶対値の上限)。
 *
 * 「その generator が練習したい技能」に対する上限だけを列挙する。
 * ここに無い型は DEFAULT_MAX_VALUE が使われる (既存の validator が
 * 1,000,000 以下を要求しているのと同水準)。
 */
export const DEFAULT_MAX_VALUE = 1000000;

/** 型ごとの上限と理由 */
export const SCALE_BUDGETS: Record<string, { max: number; reason: string }> = {
  decimal_mul_decimal: {
    max: 1000,
    reason: '小数×小数で練習するのは桁の移動。2桁整数部×1桁整数部 (答え3桁) が上限',
  },
  decimal_mul_integer: {
    max: 5000,
    reason: '小数×整数は2桁整数部×2桁整数 (答え4桁) が小5 の実用上限',
  },
  decimal_div_decimal: { max: 1000, reason: '小数÷小数は2項の筆算で扱える範囲' },
  decimal_div_integer: { max: 1000, reason: '小数÷整数は2項の筆算で扱える範囲' },
  decimal_round: { max: 1000, reason: '丸める桁は小数第2位まで。整数部も3桁まで' },
  rectangle_area: { max: 1000, reason: '面積は2桁×2桁で答えが3桁まで' },
  // 単位変換 variant は 1 m2 = 10000 cm2 という関係そのものが答えなので、
  // 桁数が大きくなるのは構造的。別の予算を持たせる。
  'rectangle_area:unit_convert': {
    max: 250000,
    reason: '1辺2〜5m をcm2 に直すため 10000 の倍数が答えになる',
  },
  trapezoid_area: { max: 1000, reason: '3項の乗除算なので答えは4桁まで' },
  // 底辺と高さで答えが3〜4桁になる範囲が小5 の実用上限
  parallelogram_area: { max: 10000, reason: '底辺×高さで答えが4桁まで' },
  triangle_area: { max: 10000, reason: '底辺×高さ÷2で答えが4桁まで' },
  integer_multi_step: { max: 10000, reason: '計算順序の学習。答え5桁は暗算困難' },
  speed_unit_conversion: {
    max: 400000,
    reason: '時速360km まで。解説で「1時間に360000m」と現れるためその分を含める',
  },
  area_unit_conversion: { max: 100000, reason: '単位換算の答え。1 ha = 10000 m2 が上限' },
  volume_unit: { max: 100000, reason: '1 L = 1000 cm3 なので 100 L が上限' },
  // 長さの換算は 1 km = 1000000 mm まで理屈上は伸びるが、
  // 小3 で扱うのは「1km を cm に直す」程度まで。解説にも
  // 「1km は 1000000mm です」のような関係値が出るため、
  // 問題文だけでなく解説の数値も対象にする以上、
  // 関係の値そのものが上限となる予算を置く。
  unit_conversion_basic: {
    max: 1000000,
    reason: '基本単位への換算。関係の値 1 km = 1000000 mm が上限',
  },
  estimate_product: { max: 1000000, reason: '概算は桁を落とすので大きな概数答も可' },
};

/**
 * 1問に対して学習価値の欠陥を検出する。
 *
 * 違反があれば配列を、空なら空配列を返す。
 */
export function findLearningQualityIssues(problem: Problem): LearningQualityIssue[] {
  const issues: LearningQualityIssue[] = [];

  // 1) 構造的な欠陥
  if (problem.question.trim() === '') {
    issues.push({ rule: 'empty-question', detail: '問題文が空です' });
  }
  if (!answerIsFinite(problem.answer)) {
    issues.push({ rule: 'non-finite-answer', detail: '答えが有限値ではありません' });
  }
  if (problem.answer.kind === 'string' && problem.answer.value.trim() === '') {
    issues.push({ rule: 'empty-answer', detail: '答えが空文字列です' });
  }
  if (problem.answer.kind === 'fraction' && problem.answer.denominator === 0) {
    issues.push({ rule: 'zero-denominator', detail: '分母が0です' });
  }
  if (problem.answer.kind === 'decimal' && decimalDigits(problem.answer.value) > 2) {
    issues.push({
      rule: 'too-many-decimal-digits',
      detail: '答えの小数桁数が2桁を超えています',
    });
  }
  if (isDegenerateZeroAnswer(problem)) {
    issues.push({ rule: 'degenerate-zero', detail: '答えが0です' });
  }

  // 2) 無意味問題 (計算は正しいが練習にならない)
  if (isRoundingNoOp(problem)) {
    issues.push({ rule: 'rounding-noop', detail: '丸めても値が変わらない問題です' });
  }
  if (isReductionAnswerLeaked(problem)) {
    issues.push({
      rule: 'reduction-answer-leak',
      detail: '問題文の分数がすでに答えになっています',
    });
  }

  // 3) 数値規模
  // variant 単位の予算 (「type:variant」キー) があればそれを優先する
  const variant = (problem.parameters as { variant?: string }).variant;
  const budget =
    (variant ? SCALE_BUDGETS[`${problem.type}:${variant}`] : undefined) ??
    SCALE_BUDGETS[problem.type];
  const limit = budget ? budget.max : DEFAULT_MAX_VALUE;
  const largest = Math.max(
    maxNumberInText(problem.question),
    maxNumberInText(problem.explanation ?? ''),
  );
  if (largest > limit) {
    issues.push({
      rule: 'scale-over-budget',
      detail:
        `問題文の最大値 ${largest} が上限 ${limit} を超えています ` +
        `(${budget?.reason ?? '既定上限'})`,
    });
  }

  return issues;
}

