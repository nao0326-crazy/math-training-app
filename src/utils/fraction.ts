/**
 * 分数計算ユーティリティ
 * 問題生成エンジンで分数の問題を生成・検証するための基盤
 */

/**
 * 最大公約数 (GCD)
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * 最小公倍数 (LCM)
 */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return (Math.abs(a) / gcd(a, b)) * Math.abs(b);
}

/**
 * 通分 (共通分母への変換) の結果
 */
export interface CommonDenominatorResult {
  /** 共通分母 (= lcm(d1, d2)。必ず最小公倍数を使用し、分母の積は使用しない) */
  commonDenominator: number;
  /** 通分後の分子 [1つ目の分数, 2つ目の分数] */
  numerators: [number, number];
}

/**
 * 2つの分数を共通分母へ通分する
 *
 * 共通分母は分母の最小公倍数 (LCM) を使用する。
 * 分母の積 (d1 * d2) を共通分母として使用することは禁止。
 * 分子は common / d の倍率を分子に掛けて求める。
 *
 * 例: commonDenominatorForm(3, 4, 2, 5)
 *   → LCM(4, 5) = 20, { commonDenominator: 20, numerators: [15, 8] }
 * 例: commonDenominatorForm(2, 3, 1, 6)
 *   → LCM(3, 6) = 6,  { commonDenominator: 6,  numerators: [4, 1] } (18ではない)
 */
export function commonDenominatorForm(
  n1: number,
  d1: number,
  n2: number,
  d2: number,
): CommonDenominatorResult {
  if (d1 === 0 || d2 === 0) {
    throw new Error('Denominator cannot be zero');
  }
  const common = lcm(d1, d2);
  return {
    commonDenominator: common,
    numerators: [n1 * (common / d1), n2 * (common / d2)],
  };
}

/**
 * 分数を約分する
 */
export function reduceFraction(numerator: number, denominator: number): { numerator: number; denominator: number } {
  if (denominator === 0) {
    throw new Error('Denominator cannot be zero');
  }
  const divisor = gcd(numerator, denominator);
  let n = numerator / divisor;
  let d = denominator / divisor;
  // 分母を常に正にする
  if (d < 0) {
    n = -n;
    d = -d;
  }
  return { numerator: n, denominator: d };
}

/**
 * 分数の足し算
 */
export function addFractions(
  n1: number, d1: number,
  n2: number, d2: number,
): { numerator: number; denominator: number } {
  const commonDenominator = lcm(d1, d2);
  const factor1 = commonDenominator / d1;
  const factor2 = commonDenominator / d2;
  return reduceFraction(n1 * factor1 + n2 * factor2, commonDenominator);
}

/**
 * 分数の引き算
 */
export function subtractFractions(
  n1: number, d1: number,
  n2: number, d2: number,
): { numerator: number; denominator: number } {
  const commonDenominator = lcm(d1, d2);
  const factor1 = commonDenominator / d1;
  const factor2 = commonDenominator / d2;
  return reduceFraction(n1 * factor1 - n2 * factor2, commonDenominator);
}

/**
 * 分数の掛け算
 */
export function multiplyFractions(
  n1: number, d1: number,
  n2: number, d2: number,
): { numerator: number; denominator: number } {
  return reduceFraction(n1 * n2, d1 * d2);
}

/**
 * 分数の割り算
 */
export function divideFractions(
  n1: number, d1: number,
  n2: number, d2: number,
): { numerator: number; denominator: number } {
  if (n2 === 0) {
    throw new Error('Cannot divide by zero');
  }
  return multiplyFractions(n1, d1, d2, n2);
}

/**
 * 分数が整数になるか
 */
export function isFractionInteger(numerator: number, denominator: number): boolean {
  return numerator % denominator === 0;
}

/**
 * 仮分数を帯分数に変換
 */
export function toMixedNumber(
  numerator: number,
  denominator: number,
): { whole: number; numerator: number; denominator: number } {
  if (denominator === 0) {
    throw new Error('Denominator cannot be zero');
  }
  const whole = Math.floor(Math.abs(numerator) / Math.abs(denominator)) * Math.sign(numerator) * Math.sign(denominator);
  const rem = reduceFraction(Math.abs(numerator) % Math.abs(denominator), Math.abs(denominator));
  return { whole, numerator: rem.numerator, denominator: rem.denominator };
}

/**
 * 分数を文字列に変換 (帯分数形式)
 */
export function formatFraction(numerator: number, denominator: number): string {
  const r = reduceFraction(numerator, denominator);
  if (r.denominator === 1) {
    return `${r.numerator}`;
  }
  const mixed = toMixedNumber(r.numerator, r.denominator);
  if (mixed.whole !== 0) {
    if (mixed.numerator === 0) {
      return `${mixed.whole}`;
    }
    return `${mixed.whole}と${mixed.numerator}/${mixed.denominator}`;
  }
  return `${r.numerator}/${r.denominator}`;
}

/**
 * 分子・分母を日本語の分数表記に変換
 * 例: 3/4 -> 4分の3
 */
export function formatFractionJapanese(numerator: number, denominator: number): string {
  const r = reduceFraction(numerator, denominator);
  if (r.denominator === 1) {
    return `${r.numerator}`;
  }
  return `${r.denominator}分の${r.numerator}`;
}

/**
 * 分数が正規の分数か (約分済み・分母正)
 */
export function isValidFraction(numerator: number, denominator: number): boolean {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    return false;
  }
  if (denominator === 0) {
    return false;
  }
  if (denominator < 0) {
    return false;
  }
  if (gcd(numerator, denominator) !== 1) {
    return false;
  }
  return true;
}

/**
 * 分数の数値を計算する
 */
export function fractionToDecimal(numerator: number, denominator: number): number {
  return numerator / denominator;
}