/**
 * 数の性質ユーティリティ
 * 約数・倍数・素数・最大公約数・最小公倍数の計算
 * 小学6年生の学習範囲内で使用可能な関数群
 */

/**
 * 素数かどうか判定する
 * 1は素数ではない
 */
export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * 約数をすべて取得する (昇順)
 */
export function getDivisors(n: number): number[] {
  if (n <= 0) return [];
  const divisors: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      divisors.push(i);
      if (i !== n / i) {
        divisors.push(n / i);
      }
    }
  }
  return divisors.sort((a, b) => a - b);
}

/**
 * nの約数の個数を取得する
 */
export function countDivisors(n: number): number {
  return getDivisors(n).length;
}

/**
 * 指定した範囲内の素数をすべて取得する
 */
export function getPrimesInRange(min: number, max: number): number[] {
  const primes: number[] = [];
  for (let i = Math.max(2, min); i <= max; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }
  }
  return primes;
}

/**
 * 素因数分解を行う
 * 結果は [素因数, 指数] の配列として返す
 * 例: 60 = 2^2 * 3 * 5 -> [[2, 2], [3, 1], [5, 1]]
 */
export function primeFactorization(n: number): [number, number][] {
  if (n <= 1) return [];
  const factors: [number, number][] = [];
  let remaining = n;

  for (let p = 2; p * p <= remaining; p++) {
    if (remaining % p === 0) {
      let count = 0;
      while (remaining % p === 0) {
        remaining /= p;
        count++;
      }
      factors.push([p, count]);
    }
  }
  if (remaining > 1) {
    factors.push([remaining, 1]);
  }
  return factors;
}

/**
 * 公約数を取得する
 */
export function getCommonDivisors(a: number, b: number): number[] {
  const divisorsA = getDivisors(a);
  const divisorsB = new Set(getDivisors(b));
  return divisorsA.filter((d) => divisorsB.has(d));
}

/**
 * 指定した個数の公倍数を取得する
 */
export function getCommonMultiples(a: number, b: number, count: number): number[] {
  const lcmValue = lcm(a, b);
  if (lcmValue === 0) return [];
  const multiples: number[] = [];
  for (let i = 1; i <= count; i++) {
    multiples.push(lcmValue * i);
  }
  return multiples;
}

/**
 * 最大公約数 (GCD) - ユークリッドの互除法
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
  if (a === 0 || b === 0) return 0;
  return (Math.abs(a) / gcd(a, b)) * Math.abs(b);
}

/**
 * 3つ以上の数の最大公約数
 */
export function gcdMultiple(...numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((acc, n) => gcd(acc, n));
}

/**
 * 3つ以上の数の最小公倍数
 */
export function lcmMultiple(...numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((acc, n) => lcm(acc, n));
}

/**
 * 互いに素かどうか判定する
 */
export function areCoprime(a: number, b: number): boolean {
  return gcd(a, b) === 1;
}

/**
 * 指定した数の倍数を指定個数取得する
 */
export function getMultiples(n: number, count: number): number[] {
  if (n === 0) return Array(count).fill(0);
  const multiples: number[] = [];
  for (let i = 1; i <= count; i++) {
    multiples.push(n * i);
  }
  return multiples;
}

/**
 * 約数のペアを取得する
 * 例: 12 -> [[1,12], [2,6], [3,4]]
 */
export function getDivisorPairs(n: number): [number, number][] {
  if (n <= 0) return [];
  const pairs: [number, number][] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      pairs.push([i, n / i]);
    }
  }
  return pairs;
}

/**
 * 指定した範囲内で、指定した数の約数を持つ数を取得する
 * 例: 約数に3を持つ数 -> 3, 6, 9, 12, ...
 */
export function getNumbersWithDivisor(divisor: number, min: number, max: number): number[] {
  const result: number[] = [];
  for (let i = min; i <= max; i++) {
    if (i % divisor === 0) {
      result.push(i);
    }
  }
  return result;
}

/**
 * 指定した最大値以下の合成数を取得する
 */
export function getCompositeNumbers(max: number): number[] {
  const composites: number[] = [];
  for (let i = 4; i <= max; i++) {
    if (!isPrime(i)) {
      composites.push(i);
    }
  }
  return composites;
}

/**
 * 約数の和を計算する
 */
export function sumOfDivisors(n: number): number {
  return getDivisors(n).reduce((sum, d) => sum + d, 0);
}
