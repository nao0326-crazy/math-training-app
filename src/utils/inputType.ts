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
  | 'fraction-list' // 複数分数入力 (通分など: 分数ごとに分子・分母)
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
    case 'fractions':
      // 複数分数 (通分など): 分数ごとに分子・分母を別々に入力する専用UI
      return 'fraction-list';
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
 * 複数分数入力を文字列に変換
 * [{numerator:"1", denominator:"2"}, {numerator:"3", denominator:"4"}] → "1/2 と 3/4"
 *
 * judgeUserAnswer は "1/2 と 3/4" の形式をパースして各分数を比較する
 */
export function fractionListToString(
  fractions: { numerator: string; denominator: string }[],
): string {
  const parts: string[] = [];
  for (const f of fractions) {
    const n = f.numerator.trim();
    const d = f.denominator.trim();
    if (!n || !d) return '';
    parts.push(`${n}/${d}`);
  }
  return parts.join(' と ');
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
    fractionList?: { numerator: string; denominator: string }[];
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
      // どの入力欄が不足しているのか具体的に案内する
      const hasNumerator = Boolean(params.fraction.numerator);
      const hasDenominator = Boolean(params.fraction.denominator);
      if (!hasNumerator && !hasDenominator) {
        return '分子と分母を入力してください。';
      }
      if (!hasNumerator) {
        return '分子を入力してください。';
      }
      if (!hasDenominator) {
        return '分母を入力してください。';
      }
      const den = parseInt(params.fraction.denominator, 10);
      if (den === 0) {
        return '分母に0を入力できません。';
      }
      return null;
    }
    case 'fraction-list': {
      if (!params.fractionList || params.fractionList.length === 0) {
        return '分数を入力してください。';
      }
      // 前から順に、完成していない(または不正な)分数を検出して案内する
      for (let i = 0; i < params.fractionList.length; i++) {
        const f = params.fractionList[i];
        if (!f) break;
        const n = f.numerator?.trim() ?? '';
        const d = f.denominator?.trim() ?? '';
        if (!n && !d) {
          return `${i + 1}つ目の分数の分子と分母を入力してください。`;
        }
        if (!n) {
          return `${i + 1}つ目の分数の分子を入力してください。`;
        }
        if (!d) {
          return `${i + 1}つ目の分数の分母を入力してください。`;
        }
        if (!/^\d+$/.test(n) || !/^\d+$/.test(d)) {
          return `${i + 1}つ目の分数は半角の整数で入力してください。`;
        }
        if (parseInt(d, 10) === 0) {
          return `${i + 1}つ目の分数の分母に0を入力できません。`;
        }
      }
      // すべての分数 (ここにある分) が完成していれば有効
      return null;
    }
    case 'mixed': {
      if (!params.mixed) return '答えを入力してください。';
      // 整数部だけでなく分子・分母の不足も具体的に案内する
      const hasNumerator = Boolean(params.mixed.numerator);
      const hasDenominator = Boolean(params.mixed.denominator);
      if (!hasNumerator && !hasDenominator) {
        return '分子と分母を入力してください。';
      }
      if (!hasNumerator) {
        return '分子を入力してください。';
      }
      if (!hasDenominator) {
        return '分母を入力してください。';
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
    fractionList?: { numerator: string; denominator: string }[];
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
    fractionList?: { numerator: string; denominator: string }[];
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
    case 'fraction-list':
      return params.fractionList ? fractionListToString(params.fractionList) : '';
    case 'mixed':
      return params.mixed
        ? mixedInputToString(params.mixed.whole, params.mixed.numerator, params.mixed.denominator)
        : '';
  }
}
