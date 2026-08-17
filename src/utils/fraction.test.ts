/**
 * 分数計算ユーティリティのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  gcd,
  lcm,
  reduceFraction,
  addFractions,
  subtractFractions,
  multiplyFractions,
  divideFractions,
  isFractionInteger,
  toMixedNumber,
  formatFraction,
  formatFractionJapanese,
  isValidFraction,
} from './fraction';

describe('gcd', () => {
  it('最大公約数を計算する', () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(5, 0)).toBe(5);
    expect(gcd(0, 0)).toBe(0);
    expect(gcd(-12, 18)).toBe(6);
  });
});

describe('lcm', () => {
  it('最小公倍数を計算する', () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 5)).toBe(15);
    expect(lcm(0, 5)).toBe(0);
    expect(lcm(5, 0)).toBe(0);
  });
});

describe('reduceFraction', () => {
  it('約分する', () => {
    expect(reduceFraction(4, 8)).toEqual({ numerator: 1, denominator: 2 });
    expect(reduceFraction(6, 9)).toEqual({ numerator: 2, denominator: 3 });
    expect(reduceFraction(12, 4)).toEqual({ numerator: 3, denominator: 1 });
  });

  it('分母を正にする', () => {
    expect(reduceFraction(1, -2)).toEqual({ numerator: -1, denominator: 2 });
    expect(reduceFraction(-1, -2)).toEqual({ numerator: 1, denominator: 2 });
  });

  it('分母が0の場合はエラー', () => {
    expect(() => reduceFraction(1, 0)).toThrow();
  });
});

describe('分数の四則演算', () => {
  it('足し算', () => {
    expect(addFractions(1, 2, 1, 3)).toEqual({ numerator: 5, denominator: 6 });
    expect(addFractions(1, 4, 1, 4)).toEqual({ numerator: 1, denominator: 2 });
    expect(addFractions(1, 2, 1, 2)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('引き算', () => {
    expect(subtractFractions(1, 2, 1, 3)).toEqual({ numerator: 1, denominator: 6 });
    expect(subtractFractions(3, 4, 1, 4)).toEqual({ numerator: 1, denominator: 2 });
    expect(subtractFractions(1, 2, 1, 2)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('掛け算', () => {
    expect(multiplyFractions(1, 2, 2, 3)).toEqual({ numerator: 1, denominator: 3 });
    expect(multiplyFractions(2, 3, 3, 4)).toEqual({ numerator: 1, denominator: 2 });
    expect(multiplyFractions(0, 1, 1, 2)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('割り算', () => {
    expect(divideFractions(1, 2, 1, 4)).toEqual({ numerator: 2, denominator: 1 });
    expect(divideFractions(2, 3, 4, 3)).toEqual({ numerator: 1, denominator: 2 });
  });

  it('0で割るとエラー', () => {
    expect(() => divideFractions(1, 2, 0, 3)).toThrow();
  });
});

describe('isFractionInteger', () => {
  it('整数になる分数を判定する', () => {
    expect(isFractionInteger(4, 2)).toBe(true);
    expect(isFractionInteger(6, 3)).toBe(true);
    expect(isFractionInteger(1, 2)).toBe(false);
    expect(isFractionInteger(3, 4)).toBe(false);
  });
});

describe('toMixedNumber', () => {
  it('仮分数を帯分数に変換する', () => {
    expect(toMixedNumber(5, 2)).toEqual({ whole: 2, numerator: 1, denominator: 2 });
    expect(toMixedNumber(7, 3)).toEqual({ whole: 2, numerator: 1, denominator: 3 });
    expect(toMixedNumber(4, 2)).toEqual({ whole: 2, numerator: 0, denominator: 1 });
  });
});

describe('formatFraction', () => {
  it('分数を文字列に変換する', () => {
    expect(formatFraction(1, 2)).toBe('1/2');
    expect(formatFraction(4, 2)).toBe('2');
    expect(formatFraction(5, 2)).toBe('2と1/2');
    expect(formatFraction(0, 3)).toBe('0');
  });
});

describe('formatFractionJapanese', () => {
  it('日本語の分数表記に変換する', () => {
    expect(formatFractionJapanese(3, 4)).toBe('4分の3');
    expect(formatFractionJapanese(1, 2)).toBe('2分の1');
    expect(formatFractionJapanese(4, 2)).toBe('2');
  });
});

describe('isValidFraction', () => {
  it('正規の分数を判定する', () => {
    expect(isValidFraction(1, 2)).toBe(true);
    expect(isValidFraction(2, 4)).toBe(false); // 約分されていない
    expect(isValidFraction(1, 0)).toBe(false); // 分母0
    expect(isValidFraction(1, -2)).toBe(false); // 分母負
    expect(isValidFraction(1.5, 2)).toBe(false); // 整数でない
  });
});