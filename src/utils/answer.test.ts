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

describe('checkUserAnswer', () => {
  it('整数の入力', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(checkUserAnswer('42', answer)).toBe(true);
    expect(checkUserAnswer('43', answer)).toBe(false);
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