/**
 * 乱数生成ユーティリティ
 * 問題生成エンジンで使用する。完全ランダムではなく、
 * 教育的に妥当な条件を満たす値だけを生成するための補助関数群。
 */

/** 自動シード採番用カウンタ (同一ミリ秒内でも異なるシードになるようにする) */
let autoSeedCounter = 0;

/** 32bit整数をよく分散させるミックス関数 (splitmix系) */
export function mix32(x: number): number {
  let v = x >>> 0;
  v ^= v >>> 16;
  v = Math.imul(v, 0x21f0aaad);
  v ^= v >>> 15;
  v = Math.imul(v, 0x735a2d97);
  v ^= v >>> 15;
  return v >>> 0;
}

/**
 * 明示的なシードが与えられない場合に使う自動シード。
 * Date.now() だけだと同一ミリ秒内の連続生成が同じシードになり問題が固定するため、
 * 高分解能時計とカウンタを混ぜて常に異なる値を返す。
 */
export function nextAutoSeed(): number {
  autoSeedCounter = (autoSeedCounter + 1) % 0x7fffffff;
  const t = Date.now() >>> 0;
  const hiRes =
    typeof performance !== 'undefined'
      ? Math.floor(performance.now() * 1024) >>> 0
      : 0;
  return (
    mix32(t ^ mix32(hiRes) ^ Math.imul(autoSeedCounter, 0x9e3779b1)) || 1
  );
}

/**
 * ベースシードから試行番号に対応する子シードを導出する。
 * リトライ時に毎回違う数列になる一方、(base, attempt) が同じなら常に同じ値を返すため
 * テストの再現性を壊さない。
 */
export function deriveSeed(base: number, attempt: number): number {
  const b = base >>> 0;
  const a = (attempt + 1) >>> 0;
  return mix32(mix32(b) ^ Math.imul(a, 0x85ebca6b)) || 1;
}

/**
 * 自動シードカウンタをリセットする (テスト専用)。
 * 「同じミリ秒内でも連続生成が同じ問題にならない」ことを決定論的に
 * テストするために使う。プロダクトコードからは呼ばないこと。
 */
export function resetAutoSeedCounterForTest(next = 0): void {
  autoSeedCounter = next;
}

/**
 * シード付き乱数生成器 (線形合同法)
 * テストで再現可能な問題生成を可能にする
 */
export class SeededRandom {
  private seedValue: number;

  constructor(seed?: number) {
    // シード未指定時は自動シード (同一ミリ秒内でも衝突しない)
    this.seedValue = (seed ?? nextAutoSeed()) >>> 0;
    if (this.seedValue === 0) {
      this.seedValue = 0x2f6e2b1;
    }
  }

  /** 現在のシード値を取得 */
  get seed(): number {
    return this.seedValue;
  }

  /** シード値を設定 */
  setSeed(seed: number): void {
    this.seedValue = seed >>> 0;
    if (this.seedValue === 0) {
      this.seedValue = 0x2f6e2b1;
    }
  }

  /** 0以上1未満の乱数 */
  next(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    this.seedValue = (a * this.seedValue + c) % m;
    return this.seedValue / m;
  }

  /** min以上max以下の整数乱数 */
  int(min: number, max: number): number {
    if (min > max) {
      [min, max] = [max, min];
    }
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** 配列から1つランダムに選ぶ */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return array[this.int(0, array.length - 1)];
  }

  /** 配列から複数ランダムに選ぶ (重複なし) */
  pickMultiple<T>(array: readonly T[], count: number): T[] {
    if (count > array.length) {
      throw new Error('Cannot pick more items than available');
    }
    const pool = [...array];
    const result: T[] = [];
    for (let i = 0; i < count; i++) {
      const idx = this.int(0, pool.length - 1);
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }

  /** 配列をシャッフルする */
  shuffle<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * デフォルトのランダム生成器
 */
export function createRandom(seed?: number): SeededRandom {
  return new SeededRandom(seed);
}

/**
 * ランダムな問題IDを生成する
 * 時間ベース + ランダムで実質一意にする
 */
export function generateProblemId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `prob_${timestamp}_${randomPart}`;
}