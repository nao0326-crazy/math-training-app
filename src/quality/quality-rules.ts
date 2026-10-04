/**
 * quality-rules.ts — 問題品質の判定ルール (Phase 1-A)
 *
 * 既存の audit-helpers.ts / deep-audit-helpers.ts は「検出したら console.log する」
 * だけで失敗を assertion に繋げていなかったため、品質ゲートとして機能していない。
 * ここでは判定だけを純粋関数として切り出し、テストから意味のある assertion で
 * 参照できるようにする。
 *
 * ルールは根拠があれば採用・無ければ採用しない方針で追加する。
 */

import type { Problem } from '../types/problem';

/**
 * 小数の答えとして許容する小数部の最大桁数。
 *
 * 小6で学ぶ小数は「小数第1位まで」「小数第2位まで」が中心で、学習者は
 * キーボードでそのまま書き写せる。3桁を超えると (a) 画面上で意味が分からず
 * (b) 丸め指示が無い限り数学的に一意でなくなるため、入力も判定も成立しない。
 */
export const MAX_DECIMAL_DIGITS = 2;

/** 小数でも整数でも、浮動小数点の計算結果を一定の桁数に丸める (誤差の排除) */
export function roundTo(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/**
 * 小数点以下の桁数を数える。指数表記と非有限値は 999 (違反扱い) を返す。
 */
export function decimalDigits(value: number): number {
  if (!Number.isFinite(value)) return 999;
  if (Number.isInteger(value)) return 0;
  const s = String(value);
  if (s.includes('e') || s.includes('E')) return 999;
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/**
 * 小数の答えが学習者の入力可能な範囲 (有限小数かつ桁数制限内) に収まっているか。
 * 小数以外の解答は対象外なので true を返す。
 */
export function isAnswerableDecimal(
  problem: Problem,
  maxDigits: number = MAX_DECIMAL_DIGITS,
): boolean {
  if (problem.answer.kind !== 'decimal') return true;
  return decimalDigits(problem.answer.value) <= maxDigits;
}

/**
 * 意図しない退化問題かどうか。
 *
 * 「a - a = 0」のように、計算としては成立しても学習価値が無い問題を指す。
 * 0 を学習対象として意図的に出す問題タイプが今後増えた場合は、
 * この関数に type の allowlist を足す (Phase 2)。
 */
export function isDegenerateZeroAnswer(problem: Problem): boolean {
  return problem.answer.kind === 'integer' && problem.answer.value === 0;
}

/**
 * 問題のバリエーション (異なる問題文の割合) が低すぎないかを見るための補助。
 * 同じ問題文が繰り返す状態は学習が成立しない。
 * Phase 1 は検出までで、variety の拡大自体は Phase 2 の範囲。
 */
export function varietyRatio(questions: Set<string>, total: number): number {
  if (total <= 0) return 1;
  return questions.size / total;
}