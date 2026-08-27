/**
 * 解答のユーティリティ
 * 解答のフォーマット・比較・検証を行う
 */

import type { Answer } from '../types/problem';
import { formatFraction, reduceFraction } from './fraction';

// ===== 入力正規化 =====

/**
 * 全角文字を半角に変換する (数字・記号)
 */
function toHalfWidth(input: string): string {
  return input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .replace(/，/g, ',')
    .replace(/／/g, '/')
    .replace(/－/g, '-')
    .replace(/（/g, '(')
    .replace(/）/g, ')');
}

/**
 * Unicode上の類似したマイナス記号を半角ハイフンに変換する
 * 対象: − (U+2212), ‐ (U+2010), ‑ (U+2011), – (U+2013), — (U+2014), ﹣ (U+FE63)
 */
const MINUS_SIGN_PATTERN = /[\u2212\u2010\u2011\u2013\u2014\ufe63]/g;

function normalizeMinusSigns(input: string): string {
  return input.replace(MINUS_SIGN_PATTERN, '-');
}

/**
 * 数値中の桁区切りとして妥当なカンマだけを削除する
 *
 * 例:
 * - "1,000" → "1000"
 * - "12,000" → "12000"
 * - "1,234,567" → "1234567"
 * - "1,2" → "1,2" (削除しない)
 * - "1, 2, 3" → "1, 2, 3" (削除しない)
 */
function removeThousandsSeparators(input: string): string {
  return input.replace(/(\d),(?=(\d{3})+(?!\d))/g, '$1');
}

/**
 * ユーザー入力の回答を正規化する
 *
 * - 前後の空白を除去
 * - 全角数字 → 半角数字
 * - 全角小数点 → 半角 "."
 * - 全角カンマ → 半角 ","
 * - 全角マイナス → 半角 "-"
 * - Unicode上の類似したマイナス記号 → 半角 "-"
 * - 桁区切りとして妥当なカンマのみ削除
 */
export function normalizeAnswerInput(input: string): string {
  let normalized = input.trim();
  normalized = toHalfWidth(normalized);
  normalized = normalizeMinusSigns(normalized);
  normalized = removeThousandsSeparators(normalized);
  return normalized;
}

/**
 * 掛け算の表記揺れをすべて '*' に正規化する対象。
 * 対象: × (U+00D7)・✕・✖・＊ (U+FF0A)・*・· (U+00B7)・⋅ (U+22C5)・・ (U+30FB)
 */
const MULTIPLY_SYMBOL_PATTERN = /[\u00d7\u2715\u2716\uff0a*\u00b7\u22c5\u30fb]/g;

/**
 * 変数 x の表記を小文字 'x' に正規化する対象。
 * 対象: 半角 x/X・全角 ｘ (U+FF58)・Ｘ (U+FF38)
 */
const VARIABLE_X_PATTERN = /[xX\uff58\uff38]/g;

/**
 * 式を表す文字列の正規化 (正誤判定用の内部表現と比較用)。
 *
 * - ×・＊・*・・等の乗算記号を '*' に統一 (内部表現を統一する)
 * - 変数 x の表記揺れ (全角 ｘ/Ｘ・大文字 X) を小文字 'x' に統一
 * - 係数の乗算省略 "5x" を "5*x" に正規化
 * - 空白を除去
 *
 * 例:
 *   "3×4"   -> "3*4"
 *   "3＊4"  -> "3*4"
 *   "3*4"   -> "3*4"
 *   "5×x"   -> "5*x"
 *   "5x"    -> "5*x"
 *   "5ｘ"   -> "5*x"
 *
 * 表示はユーザーにとって自然な「×」を維持するため、この関数は
 * 正誤判定の比較にのみ適用し、入力の画面表示・解答表示を書き換えない。
 */
export function canonicalizeExpressionString(input: string): string {
  let s = normalizeAnswerInput(input);
  s = s.replace(MULTIPLY_SYMBOL_PATTERN, '*');
  s = s.replace(VARIABLE_X_PATTERN, 'x');
  // 数値と変数の間の乗算省略を補完: "5x" → "5*x" (2桁以上の数にも対応)
  s = s.replace(/(\d+)(x)/g, '$1*$2');
  s = s.replace(/\s+/g, '');
  return s;
}

/**
 * 解答を文字列に変換する
 *
 * kind: 'fractions' は通分後の標準形をそのまま表示する。
 * 例: { numerator: 15, denominator: 20 } → "15/20"
 * 通分の答えは約分した形で表示してはならないため、formatFraction は使わない。
 */
export function formatAnswer(answer: Answer): string {
  switch (answer.kind) {
    case 'integer':
      return String(answer.value);
    case 'decimal':
      return String(answer.value);
    case 'fraction':
      return formatFraction(answer.numerator, answer.denominator);
    case 'mixed':
      return formatFraction(
        answer.whole * answer.denominator + answer.numerator,
        answer.denominator,
      );
    case 'string':
      return answer.value;
    case 'fractions':
      return answer.values
        .map((v) => `${v.numerator}/${v.denominator}`)
        .join(' と ');
  }
}

/**
 * 解答をユーザー入力用のキー文字列に変換する
 * 分数は「3/4」のような形式にする
 */
export function toAnswerKey(answer: Answer): string {
  switch (answer.kind) {
    case 'integer':
      return String(answer.value);
    case 'decimal':
      return String(answer.value);
    case 'fraction': {
      const r = reduceFraction(answer.numerator, answer.denominator);
      return `${r.numerator}/${r.denominator}`;
    }
    case 'mixed': {
      const totalNumerator = answer.whole * answer.denominator + answer.numerator;
      const r = reduceFraction(totalNumerator, answer.denominator);
      return `${r.numerator}/${r.denominator}`;
    }
    case 'string':
      return answer.value;
    case 'fractions':
      return answer.values.map((v) => toAnswerKey({ kind: 'fraction', ...v })).join('|');
  }
}

/**
 * 解答が等しいか比較する
 * 分数は約分して比較する (数学的な等価性)
 */
export function answersEqual(a: Answer, b: Answer): boolean {
  // 文字列同士
  if (a.kind === 'string' && b.kind === 'string') {
    return a.value === b.value;
  }

  // 複数分数同士は位置ごとに数学的等価性を比較する
  if (a.kind === 'fractions' || b.kind === 'fractions') {
    if (a.kind !== 'fractions' || b.kind !== 'fractions') {
      return false;
    }
    if (a.values.length !== b.values.length) {
      return false;
    }
    return a.values.every((va, i) => {
      const vb = b.values[i];
      // 交差乗算で等価判定 (a1/b1 === a2/b2 ⟺ a1*b2 === a2*b1)
      return va.numerator * vb.denominator === vb.numerator * va.denominator;
    });
  }

  // 数値的な比較
  const numA = answerToNumber(a);
  const numB = answerToNumber(b);
  if (numA !== null && numB !== null) {
    return Math.abs(numA - numB) < 1e-9;
  }

  // 数値に変換できない場合はキーで比較
  return toAnswerKey(a) === toAnswerKey(b);
}

/**
 * 解答を数値に変換する (変換できない場合は null)
 * 複数分数 (kind: 'fractions') は単一の数値にならないため常に null
 */
export function answerToNumber(answer: Answer): number | null {
  switch (answer.kind) {
    case 'integer':
    case 'decimal':
      return answer.value;
    case 'fraction':
      return answer.numerator / answer.denominator;
    case 'mixed':
      return answer.whole + answer.numerator / answer.denominator;
    case 'string': {
      const n = Number(answer.value);
      return Number.isNaN(n) ? null : n;
    }
    case 'fractions':
      return null;
  }
}

/**
 * ユーザー入力文字列を解答に変換して比較する
 * 分数の入力形式: 「3/4」「1と2/3」
 *
 * 入力値は正規化 (全角→半角、マイナス記号、桁区切りカンマ、前後空白) 後に判定する。
 */
export function checkUserAnswer(userInput: string, correctAnswer: Answer): boolean {
  // 複数分数の正解は judgeUserAnswer (標準形と等価性を区別) に委譲する
  if (correctAnswer.kind === 'fractions') {
    return judgeUserAnswer(userInput, correctAnswer).status === 'correct';
  }

  // 入力値を正規化する
  const normalized = normalizeAnswerInput(userInput);
  if (normalized === '') {
    return false;
  }

  // 正解が文字列型 (約数リスト「1, 2, 3」や文字と式の「5x」「5×x」など) の場合、
  // 乗算記号 (×・＊・*) や変数 x の表記揺れを正規化して比較する
  // (例: "5×x" と "5x"、全角「５ｘ」はどちらも等価として扱う)
  if (correctAnswer.kind === 'string') {
    return (
      canonicalizeExpressionString(userInput) ===
      canonicalizeExpressionString(correctAnswer.value)
    );
  }

  // 帯分数形式のパース: 「1と2/3」
  const mixedMatch = normalized.match(/^(-?\d+)と(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    if (denominator === 0) {
      return false;
    }
    const totalNumerator = whole * denominator + numerator;
    const userAnswer: Answer = {
      kind: 'fraction',
      numerator: totalNumerator,
      denominator,
    };
    return answersEqual(userAnswer, correctAnswer);
  }

  // 分数形式のパース: 「3/4」
  const fractionMatch = normalized.match(/^(-?\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    if (denominator === 0) {
      return false;
    }
    const userAnswer: Answer = {
      kind: 'fraction',
      numerator,
      denominator,
    };
    return answersEqual(userAnswer, correctAnswer);
  }

  // 小数・整数のパース
  // 桁区切りカンマは正規化済みのため、そのまま数値に変換する
  const numeric = Number(normalized);
  if (Number.isNaN(numeric)) {
    return false;
  }
  const userAnswer: Answer = { kind: 'decimal', value: numeric };
  return answersEqual(userAnswer, correctAnswer);
}

// ===== 複数分数 (通分) の判定 =====

/** 分数リスト入力の区切り文字 (と・読点・カンマ・空白) */
const FRACTION_LIST_SEPARATOR = /(?:と|、|,|\s)+/;

/**
 * ユーザー入力を複数分数としてパースする
 * 「15/20 と 8/20」「15/20、8/20」「15/20,8/20」などを扱う
 * パースできない場合は null を返す
 */
export function parseFractionListInput(
  userInput: string,
): { numerator: number; denominator: number }[] | null {
  const normalized = normalizeAnswerInput(userInput);
  if (normalized === '') {
    return null;
  }
  const tokens = normalized.split(FRACTION_LIST_SEPARATOR).filter((t) => t !== '');
  // 単一の分数・帯分数はリストとして扱わない (既存の判定ロジックに任せる)
  if (tokens.length < 2) {
    return null;
  }
  const fractions: { numerator: number; denominator: number }[] = [];
  for (const token of tokens) {
    const m = token.match(/^(-?\d+)\/(\d+)$/);
    if (!m) {
      return null;
    }
    const denominator = parseInt(m[2], 10);
    if (denominator === 0) {
      return null;
    }
    fractions.push({ numerator: parseInt(m[1], 10), denominator });
  }
  return fractions;
}

/**
 * 回答判定の詳細結果
 *
 * - correct: 正解 (教育上の標準形にも一致)
 * - equivalent-not-canonical: 数学的には等価だが標準形ではない
 *   (例: 通分の答えとして「30/40 と 16/40」= 最小公倍数以外の共通分母)
 * - incorrect: 誤答
 */
export type AnswerJudgement =
  | { status: 'correct' }
  | { status: 'equivalent-not-canonical'; message: string }
  | { status: 'incorrect' };

/**
 * ユーザーの回答を詳細に判定する
 *
 * 教育方針:
 * - 通分問題の正解は分母の最小公倍数による標準形のみ
 * - ただし最小公倍数以外の共通分母で正しく通分された回答は、
 *   数学的には等価であるため単純な誤答とは区別する
 */
export function judgeUserAnswer(userInput: string, correctAnswer: Answer): AnswerJudgement {
  if (correctAnswer.kind === 'fractions') {
    const parsed = parseFractionListInput(userInput);
    if (!parsed || parsed.length !== correctAnswer.values.length) {
      return { status: 'incorrect' };
    }

    const expected = correctAnswer.values;
    // 標準形そのものとの一致
    const allCanonical = parsed.every(
      (f, i) => f.numerator === expected[i].numerator && f.denominator === expected[i].denominator,
    );
    if (allCanonical) {
      return { status: 'correct' };
    }

    // 数学的な等価性 (交差乗算) と「通分できているか」(全分母が同一か) を確認
    const allEquivalent = parsed.every((f, i) =>
      f.numerator * expected[i].denominator === expected[i].numerator * f.denominator,
    );
    const allDenominatorsEqual = parsed.every((f) => f.denominator === parsed[0].denominator);

    if (allEquivalent && allDenominatorsEqual) {
      return {
        status: 'equivalent-not-canonical',
        message:
          '計算は合っています。ただし通分では、分母を最小公倍数にそろえます。' +
          `正解は ${formatAnswer(correctAnswer)} です。`,
      };
    }

    return { status: 'incorrect' };
  }

  return checkUserAnswer(userInput, correctAnswer)
    ? { status: 'correct' }
    : { status: 'incorrect' };
}

/**
 * 解答が自然な値かチェックする
 * - 有限の値であること
 * - 極端に大きくないこと
 * - ゼロ除算などがないこと
 */
export function isReasonableAnswer(answer: Answer): boolean {
  // 文字列はそのまま true (数値変換できない文字列も許容)
  if (answer.kind === 'string') {
    return answer.value.length > 0;
  }

  // 複数分数は各要素を検査する (単一の数値にはならないため先に処理する)
  if (answer.kind === 'fractions') {
    if (!Array.isArray(answer.values) || answer.values.length === 0) {
      return false;
    }
    for (const v of answer.values) {
      if (
        !Number.isInteger(v.numerator) ||
        !Number.isInteger(v.denominator) ||
        v.denominator === 0 ||
        !Number.isFinite(v.numerator / v.denominator) ||
        Math.abs(v.numerator / v.denominator) > 1_000_000
      ) {
        return false;
      }
    }
    return true;
  }

  const num = answerToNumber(answer);
  if (num === null || !Number.isFinite(num)) {
    return false;
  }
  // 小学6年生の範囲で扱う数値は十分小さい
  if (Math.abs(num) > 1_000_000) {
    return false;
  }
  switch (answer.kind) {
    case 'fraction':
      return answer.denominator !== 0 && Number.isInteger(answer.numerator) && Number.isInteger(answer.denominator);
    case 'mixed':
      return answer.denominator !== 0 && Number.isInteger(answer.whole) &&
        Number.isInteger(answer.numerator) && Number.isInteger(answer.denominator);
    case 'integer':
    case 'decimal':
      return true;
  }
}