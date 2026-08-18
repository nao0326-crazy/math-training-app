/**
 * 解答ユーティリティのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  formatAnswer,
  toAnswerKey,
  answersEqual,
  answerToNumber,
  checkUserAnswer,
  isReasonableAnswer,
  normalizeAnswerInput,
} from './answer';
import type { Answer } from '../types/problem';

describe('formatAnswer', () => {
  it('整数をフォーマットする', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(formatAnswer(answer)).toBe('42');
  });

  it('小数をフォーマットする', () => {
    const answer: Answer = { kind: 'decimal', value: 3.14 };
    expect(formatAnswer(answer)).toBe('3.14');
  });

  it('分数をフォーマットする', () => {
    const answer: Answer = { kind: 'fraction', numerator: 3, denominator: 4 };
    expect(formatAnswer(answer)).toBe('3/4');
  });

  it('帯分数をフォーマットする', () => {
    const answer: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    expect(formatAnswer(answer)).toBe('1と1/2');
  });

  it('文字列をフォーマットする', () => {
    const answer: Answer = { kind: 'string', value: 'はい' };
    expect(formatAnswer(answer)).toBe('はい');
  });
});

describe('toAnswerKey', () => {
  it('分数を約分してキーに変換する', () => {
    const answer: Answer = { kind: 'fraction', numerator: 2, denominator: 4 };
    expect(toAnswerKey(answer)).toBe('1/2');
  });

  it('帯分数を仮分数に変換してキーにする', () => {
    const answer: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    expect(toAnswerKey(answer)).toBe('3/2');
  });
});

describe('answersEqual', () => {
  it('同じ値の分数は等しい', () => {
    const a: Answer = { kind: 'fraction', numerator: 1, denominator: 2 };
    const b: Answer = { kind: 'fraction', numerator: 2, denominator: 4 };
    expect(answersEqual(a, b)).toBe(true);
  });

  it('整数と小数は数値的に比較できる', () => {
    const a: Answer = { kind: 'integer', value: 5 };
    const b: Answer = { kind: 'decimal', value: 5.0 };
    expect(answersEqual(a, b)).toBe(true);
  });

  it('異なる値は等しくない', () => {
    const a: Answer = { kind: 'integer', value: 5 };
    const b: Answer = { kind: 'integer', value: 6 };
    expect(answersEqual(a, b)).toBe(false);
  });

  it('帯分数と仮分数は等しい', () => {
    const a: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    const b: Answer = { kind: 'fraction', numerator: 3, denominator: 2 };
    expect(answersEqual(a, b)).toBe(true);
  });
});

describe('answerToNumber', () => {
  it('数値に変換する', () => {
    expect(answerToNumber({ kind: 'integer', value: 5 })).toBe(5);
    expect(answerToNumber({ kind: 'decimal', value: 2.5 })).toBe(2.5);
    expect(answerToNumber({ kind: 'fraction', numerator: 1, denominator: 2 })).toBe(0.5);
    expect(answerToNumber({ kind: 'mixed', whole: 1, numerator: 1, denominator: 2 })).toBe(1.5);
  });

  it('文字列は数値に変換できる場合のみ変換する', () => {
    expect(answerToNumber({ kind: 'string', value: '42' })).toBe(42);
    expect(answerToNumber({ kind: 'string', value: 'abc' })).toBeNull();
  });
});

describe('normalizeAnswerInput', () => {
  it('全角数字を半角に変換する', () => {
    expect(normalizeAnswerInput('３１')).toBe('31');
    expect(normalizeAnswerInput('１２３４５')).toBe('12345');
  });

  it('全角小数点を半角に変換する', () => {
    expect(normalizeAnswerInput('１．５')).toBe('1.5');
  });

  it('全角カンマを半角に変換してから桁区切りを処理する', () => {
    expect(normalizeAnswerInput('１，０００')).toBe('1000');
  });

  it('桁区切りとして妥当なカンマを削除する', () => {
    expect(normalizeAnswerInput('1,000')).toBe('1000');
    expect(normalizeAnswerInput('12,000')).toBe('12000');
    expect(normalizeAnswerInput('1,234,567')).toBe('1234567');
    expect(normalizeAnswerInput('1000')).toBe('1000');
  });

  it('桁区切りとして妥当でないカンマは削除しない', () => {
    // 1,2 は123としては扱わない (削除されない)
    expect(normalizeAnswerInput('1,2')).toBe('1,2');
    // リスト「1, 2, 3」も削除されない
    expect(normalizeAnswerInput('1, 2, 3')).toBe('1, 2, 3');
  });

  it('全角マイナスを半角に変換する', () => {
    expect(normalizeAnswerInput('－３')).toBe('-3');
  });

  it('Unicode上の類似したマイナス記号を半角に変換する', () => {
    // U+2212 MINUS SIGN
    expect(normalizeAnswerInput('\u22123')).toBe('-3');
    // U+2010 HYPHEN
    expect(normalizeAnswerInput('\u20103')).toBe('-3');
    // U+2013 EN DASH
    expect(normalizeAnswerInput('\u20133')).toBe('-3');
    // U+2014 EM DASH
    expect(normalizeAnswerInput('\u20143')).toBe('-3');
  });

  it('前後の空白を除去する', () => {
    expect(normalizeAnswerInput('31')).toBe('31');
    expect(normalizeAnswerInput(' 31')).toBe('31');
    expect(normalizeAnswerInput('31 ')).toBe('31');
    expect(normalizeAnswerInput(' 31 ')).toBe('31');
  });

  it('全角スラッシュを半角に変換する', () => {
    expect(normalizeAnswerInput('３／４')).toBe('3/4');
  });

  it('不正な入力をそのまま返す', () => {
    expect(normalizeAnswerInput('31abc')).toBe('31abc');
    expect(normalizeAnswerInput('abc')).toBe('abc');
  });
});

describe('checkUserAnswer', () => {
  it('整数の入力', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(checkUserAnswer('42', answer)).toBe(true);
    expect(checkUserAnswer('43', answer)).toBe(false);
  });

  it('全角数字の入力は正解として判定される', () => {
    const answer: Answer = { kind: 'integer', value: 31 };
    expect(checkUserAnswer('３１', answer)).toBe(true);
  });

  it('桁区切りカンマ付きの入力は正解として判定される', () => {
    const answer: Answer = { kind: 'integer', value: 1000 };
    expect(checkUserAnswer('1,000', answer)).toBe(true);
    expect(checkUserAnswer('１,０００', answer)).toBe(true);
  });

  it('全角小数の入力は正解として判定される', () => {
    const answer: Answer = { kind: 'decimal', value: 1.5 };
    expect(checkUserAnswer('１.５', answer)).toBe(true);
  });

  it('マイナス記号の表記揺れは正解として判定される', () => {
    const answer: Answer = { kind: 'integer', value: -3 };
    expect(checkUserAnswer('−３', answer)).toBe(true);
    expect(checkUserAnswer('－３', answer)).toBe(true);
    expect(checkUserAnswer('\u22123', answer)).toBe(true);
  });

  it('前後の空白は無視される', () => {
    const answer: Answer = { kind: 'integer', value: 31 };
    expect(checkUserAnswer(' 31 ', answer)).toBe(true);
    expect(checkUserAnswer('  31', answer)).toBe(true);
    expect(checkUserAnswer('31  ', answer)).toBe(true);
  });

  it('明確な誤答は不正解のまま', () => {
    const answer: Answer = { kind: 'integer', value: 31 };
    expect(checkUserAnswer('32', answer)).toBe(false);
  });

  it('正規化で誤答を正答にしない', () => {
    const answer: Answer = { kind: 'integer', value: 1000 };
    expect(checkUserAnswer('100', answer)).toBe(false);
  });

  it('31abc のような入力は不正解のまま', () => {
    const answer: Answer = { kind: 'integer', value: 31 };
    expect(checkUserAnswer('31abc', answer)).toBe(false);
  });

  it('1,2 のような入力は123として扱わない', () => {
    const answer: Answer = { kind: 'integer', value: 123 };
    expect(checkUserAnswer('1,2', answer)).toBe(false);
  });

  it('分数の全角入力も正解として判定される', () => {
    const answer: Answer = { kind: 'fraction', numerator: 3, denominator: 4 };
    expect(checkUserAnswer('３／４', answer)).toBe(true);
  });

  it('小数の入力', () => {
    const answer: Answer = { kind: 'decimal', value: 3.5 };
    expect(checkUserAnswer('3.5', answer)).toBe(true);
    expect(checkUserAnswer('3.50', answer)).toBe(true);
  });

  it('分数の入力', () => {
    const answer: Answer = { kind: 'fraction', numerator: 3, denominator: 4 };
    expect(checkUserAnswer('3/4', answer)).toBe(true);
    expect(checkUserAnswer('6/8', answer)).toBe(true); // 約分して一致
    expect(checkUserAnswer('0.75', answer)).toBe(true); // 小数でも一致
    expect(checkUserAnswer('1/2', answer)).toBe(false);
  });

  it('帯分数の入力', () => {
    const answer: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    expect(checkUserAnswer('1と1/2', answer)).toBe(true);
    expect(checkUserAnswer('3/2', answer)).toBe(true);
    expect(checkUserAnswer('1.5', answer)).toBe(true);
  });

  it('空文字は不正解', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(checkUserAnswer('', answer)).toBe(false);
    expect(checkUserAnswer('   ', answer)).toBe(false);
  });

  it('不正な入力は不正解', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(checkUserAnswer('abc', answer)).toBe(false);
    expect(checkUserAnswer('1/0', answer)).toBe(false);
  });
});

describe('isReasonableAnswer', () => {
  it('正常な解答はtrue', () => {
    expect(isReasonableAnswer({ kind: 'integer', value: 42 })).toBe(true);
    expect(isReasonableAnswer({ kind: 'decimal', value: 3.14 })).toBe(true);
    expect(isReasonableAnswer({ kind: 'fraction', numerator: 1, denominator: 2 })).toBe(true);
    expect(isReasonableAnswer({ kind: 'string', value: 'はい' })).toBe(true);
  });

  it('異常な解答はfalse', () => {
    expect(isReasonableAnswer({ kind: 'fraction', numerator: 1, denominator: 0 })).toBe(false);
    expect(isReasonableAnswer({ kind: 'integer', value: Infinity })).toBe(false);
    expect(isReasonableAnswer({ kind: 'integer', value: NaN })).toBe(false);
    expect(isReasonableAnswer({ kind: 'integer', value: 1_000_001 })).toBe(false);
  });
});