/**
 * 入力タイプのユーティリティ
 * 問題の解答種類に応じて適切な入力UIを選択し、入力値を正規化する
 */

import type { Answer } from '../types/problem';

/**
 * 入力UIの種類
 */
export type AnswerInputType =
  | 'integer' // 整数入力 (数字のみ)
  | 'decimal' // 小数入力 (数字 + 小数点)
  | 'fraction' // 分数入力 (分子・分母)
  | 'mixed' // 帯分数入力 (整数部・分子・分母)
  | 'yesno' // はい/いいえ選択
  | 'string'; // テキスト入力 (式・リスト等)

/**
 * 解答の種類から入力UIの種類を判定する
 * 問題文も参照して yes/no 問題を検出する
 */
export function getAnswerInputType(
  answer: Answer,
  question: string,
): AnswerInputType {
  switch (answer.kind) {
    case 'integer':
      return 'integer';
    case 'decimal':
      return 'decimal';
    case 'fraction':
      return 'fraction';
    case 'mixed':
      return 'mixed';
    case 'string':
      // はい/いいえ問題: 問題文に「はい」または「いいえ」が含まれる
      if (question.includes('はい') || question.includes('いいえ')) {
        return 'yesno';
      }
      return 'string';
  }
}

/**
 * 分数入力を文字列に変換
 * numerator="1", denominator="2" → "1/2"
 *
 * checkUserAnswer は "1/2" の形式をパースして分数として比較するため、
 * この文字列形式で十分である
 */
export function fractionInputToString(
  numerator: string,
  denominator: string,
): string {
  const n = numerator.trim();
  const d = denominator.trim();
  if (!n || !d) return '';
  return `${n}/${d}`;
}

/**
 * 帯分数入力を文字列に変換
 * whole="1", numerator="2", denominator="3" → "1と2/3"
 * whole が空の場合は "0" として扱う (checkUserAnswer は "0と2/3" を 2/3 として処理)
 *
 * checkUserAnswer は "1と2/3" の形式をパースして帯分数として比較する
 */
export function mixedInputToString(
  whole: string,
  numerator: string,
  denominator: string,
): string {
  const w = whole.trim();
  const n = numerator.trim();
  const d = denominator.trim();
  if (!n || !d) return '';
  const wholePart = w === '' ? '0' : w;
  return `${wholePart}と${n}/${d}`;
}

/**
 * 入力値のバリデーション
 * 無効な場合はエラーメッセージを返す、有効な場合は null を返す
 */
export function validateAnswerInput(
  inputType: AnswerInputType,
  params: {
    text?: string;
    fraction?: { numerator: string; denominator: string };
    mixed?: { whole: string; numerator: string; denominator: string };
  },
): string | null {
  switch (inputType) {
    case 'integer':
    case 'decimal':
    case 'string':
      if (!params.text || !params.text.trim()) {
        return '答えを入力してください。';
      }
      // 整数・小数は数字以外が混入していないか検査する
      // (PC キーボードからの予期しない文字入力への防御)
      if (inputType === 'integer') {
        if (!/^\d+$/.test(params.text.trim())) {
          return '半角の整数を入力してください。';
        }
      }
      if (inputType === 'decimal') {
        const t = params.text.trim();
        if (!/^(\d+\.\d*|\.\d+|\d+)$/.test(t)) {
          return '正しい小数を入力してください。';
        }
      }
      return null;
    case 'yesno':
      if (!params.text) {
        return 'はいまたはいいえを選んでください。';
      }
      return null;
    case 'fraction': {
      if (!params.fraction) return '答えを入力してください。';
      if (!params.fraction.numerator || !params.fraction.denominator) {
        return '分子と分母を入力してください。';
      }
      const den = parseInt(params.fraction.denominator, 10);
      if (den === 0) {
        return '分母に0を入力できません。';
      }
      return null;
    }
    case 'mixed': {
      if (!params.mixed) return '答えを入力してください。';
      if (!params.mixed.numerator || !params.mixed.denominator) {
        return '分子と分母を入力してください。';
      }
      const den = parseInt(params.mixed.denominator, 10);
      if (den === 0) {
        return '分母に0を入力できません。';
      }
      return null;
    }
  }
}

/**
 * 入力値が有効かどうか判定
 */
export function isAnswerInputValid(
  inputType: AnswerInputType,
  params: {
    text?: string;
    fraction?: { numerator: string; denominator: string };
    mixed?: { whole: string; numerator: string; denominator: string };
  },
): boolean {
  return validateAnswerInput(inputType, params) === null;
}

/**
 * 入力状態から正規化された回答文字列を取得する
 * この文字列は checkUserAnswer に渡すことができる
 */
export function getNormalizedAnswer(
  inputType: AnswerInputType,
  params: {
    text?: string;
    fraction?: { numerator: string; denominator: string };
    mixed?: { whole: string; numerator: string; denominator: string };
  },
): string {
  switch (inputType) {
    case 'integer':
    case 'decimal':
    case 'string':
    case 'yesno':
      return params.text ?? '';
    case 'fraction':
      return params.fraction
        ? fractionInputToString(params.fraction.numerator, params.fraction.denominator)
        : '';
    case 'mixed':
      return params.mixed
        ? mixedInputToString(params.mixed.whole, params.mixed.numerator, params.mixed.denominator)
        : '';
  }
}
