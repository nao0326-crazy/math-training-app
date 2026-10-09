/**
 * 小数の加算・減算を誤差なく扱うためのヘルパー群
 *
 * 浮動小数点数でそのまま足し引きすると
 * 0.1 + 0.2 = 0.30000000000000004 のような誤差が出るため、
 * 必ず「整数に持ち上げてから整数演算し、最後に小数に戻す」方式を使う。
 */

/** 小数点以下の桁数 (指数表記と非有限値は 0 扱い) */
export function decimalPlaces(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const s = String(n);
  if (s.includes('e') || s.includes('E')) return 0;
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/** 小数を整数に持ち上げる (places 桁の小数として扱う) */
export function toScaledInt(n: number, places: number): number {
  return Math.round(n * Math.pow(10, places));
}

/** 整数 (places 桁スケール) を小数に戻す */
export function fromScaledInt(intValue: number, places: number): number {
  return intValue / Math.pow(10, places);
}

/** 浮動小数点誤差なく小数を加算する */
export function addDecimalExact(a: number, b: number): number {
  const places = Math.max(decimalPlaces(a), decimalPlaces(b));
  const scale = Math.pow(10, places);
  return (toScaledInt(a, places) + toScaledInt(b, places)) / scale;
}

/** 浮動小数点誤差なく小数を減算する */
export function subDecimalExact(a: number, b: number): number {
  const places = Math.max(decimalPlaces(a), decimalPlaces(b));
  const scale = Math.pow(10, places);
  return (toScaledInt(a, places) - toScaledInt(b, places)) / scale;
}

/**
 * 小数の筆算で繰り上がりが起きた「位置」を返す
 *
 * 位置の定義: 0 = 1 の位、1 = 小数第1位、2 = 小数第2位、...
 * 小数点をそろえた筆算を行うので、小数部分は整数部分と区別しない。
 */
export function analyzeDecimalCarries(a: number, b: number): number[] {
  const places = Math.max(decimalPlaces(a), decimalPlaces(b));
  let intA = toScaledInt(a, places);
  let intB = toScaledInt(b, places);

  const positions: number[] = [];
  let carry = 0;
  let position = 0;
  const maxDigits = String(Math.abs(intA)).length + 1;

  for (let i = 0; i < maxDigits; i++) {
    const digitA = (intA % 10) + carry;
    const digitB = intB % 10;
    if (digitA + digitB >= 10) {
      // 繰り上がりは「繰り上がった先の桁」で起きる
      positions.push(position + 1);
      carry = 1;
    } else {
      carry = 0;
    }
    intA = Math.floor(intA / 10);
    intB = Math.floor(intB / 10);
    position++;
  }
  return positions;
}

/**
 * 小数の筆算で繰り下がりが起きた「位置」を返す
 *
 * 位置の定義は analyzeDecimalCarries と同じ (0 = 1 の位)。
 */
export function analyzeDecimalBorrows(a: number, b: number): number[] {
  const places = Math.max(decimalPlaces(a), decimalPlaces(b));
  let intA = toScaledInt(a, places);
  let intB = toScaledInt(b, places);

  const positions: number[] = [];
  let borrow = 0;
  let position = 0;
  const maxDigits = String(Math.abs(intA)).length + 1;

  for (let i = 0; i < maxDigits; i++) {
    const digitA = (intA % 10) - borrow;
    const digitB = intB % 10;
    if (digitA < digitB) {
      positions.push(position);
      borrow = 1;
    } else {
      borrow = 0;
    }
    intA = Math.floor(intA / 10);
    intB = Math.floor(intB / 10);
    position++;
  }
  return positions;
}

/** 繰り上がり/繰り下がりの「連続する桁数」を数える */
export function longestCarryRun(positions: number[]): number {
  if (positions.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === positions[i - 1] + 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

/** 小数を整数文字列 + 小数点以下の桁数に分解する (解説生成用) */
export function splitDecimal(n: number): { intPart: string; fracPart: string } {
  const places = decimalPlaces(n);
  const scaled = toScaledInt(n, places);
  const negative = scaled < 0;
  const abs = Math.abs(scaled);
  const s = String(abs).padStart(places + 1, '0');
  const intPart = places === 0 ? s : s.slice(0, s.length - places);
  const fracPart = places === 0 ? '' : s.slice(s.length - places);
  return { intPart: negative ? '-' + intPart : intPart, fracPart };
}