/**
 * 乱数生成ユーティリティ
 * 問題生成エンジンで使用する。完全ランダムではなく、
 * 教育的に妥当な条件を満たす値だけを生成するための補助関数群。
 */

/**
 * シード付き乱数生成器 (線形合同法)
 * テストで再現可能な問題生成を可能にする
 */
export class SeededRandom {
  private seedValue: number;

  constructor(seed?: number) {
    this.seedValue = (seed ?? Date.now()) >>> 0;
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