/**
 * 解答のユーティリティ
 * 解答のフォーマット・比較・検証を行う
 */

import type { Answer } from '../types/problem';
import { formatFraction, reduceFraction } from './fraction';

/**
 * 解答を文字列に変換する
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
  }
}

/**
 * 解答が等しいか比較する
 * 分数は約分して比較する
 */
export function answersEqual(a: Answer, b: Answer): boolean {
  // 文字列同士
  if (a.kind === 'string' && b.kind === 'string') {
    return a.value === b.value;
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
  }
}

/**
 * ユーザー入力文字列を解答に変換して比較する
 * 分数の入力形式: 「3/4」「1と2/3」
 */
export function checkUserAnswer(userInput: string, correctAnswer: Answer): boolean {
  const trimmed = userInput.trim();
  if (trimmed === '') {
    return false;
  }

  // 正解が文字列型 (約数リスト「1, 2, 3」など) の場合は、単純な文字列比較を行う
  if (correctAnswer.kind === 'string') {
    return trimmed === correctAnswer.value;
  }

  // 帯分数形式のパース: 「1と2/3」
  const mixedMatch = trimmed.match(/^(-?\d+)と(\d+)\/(\d+)$/);
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
  const fractionMatch = trimmed.match(/^(-?\d+)\/(\d+)$/);
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
  const numeric = Number(trimmed.replace(/,/g, ''));
  if (Number.isNaN(numeric)) {
    return false;
  }
  const userAnswer: Answer = { kind: 'decimal', value: numeric };
  return answersEqual(userAnswer, correctAnswer);
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
