/**
 * 乱数生成ユーティリティのテスト
 */

import { describe, expect, it } from 'vitest';
import { SeededRandom, createRandom, generateProblemId } from './random';

describe('SeededRandom', () => {
  it('同じシードで同じ乱数列を生成する', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('異なるシードで異なる乱数列を生成する', () => {
    const rng1 = new SeededRandom(1);
    const rng2 = new SeededRandom(2);

    // 最初の値が異なることを確認
    expect(rng1.next()).not.toBe(rng2.next());
  });

  it('next() は 0以上1未満の値を返す', () => {
    const rng = new SeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int() は指定範囲内の整数を返す', () => {
    const rng = new SeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(1, 10);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('int() は min > max でも正しく動作する', () => {
    const rng = new SeededRandom(123);
    for (let i = 0; i < 100; i++) {
      const value = rng.int(10, 1);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it('pick() は配列から要素を選ぶ', () => {
    const rng = new SeededRandom(123);
    const array = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      const value = rng.pick(array);
      expect(array).toContain(value);
    }
  });

  it('pick() は空配列でエラー', () => {
    const rng = new SeededRandom(123);
    expect(() => rng.pick([])).toThrow();
  });

  it('pickMultiple() は重複なく選ぶ', () => {
    const rng = new SeededRandom(123);
    const array = [1, 2, 3, 4, 5];
    const picked = rng.pickMultiple(array, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it('shuffle() は配列をシャッフルする', () => {
    const rng = new SeededRandom(123);
    const array = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(array);
    expect(shuffled).toHaveLength(array.length);
    expect([...shuffled].sort()).toEqual([...array].sort());
  });

  it('setSeed() でシードを変更できる', () => {
    const rng = new SeededRandom(42);
    const first = rng.next();
    rng.setSeed(42);
    const second = rng.next();
    expect(first).toBe(second);
  });
});

describe('createRandom', () => {
  it('シード付きで生成できる', () => {
    const rng = createRandom(42);
    expect(rng).toBeInstanceOf(SeededRandom);
  });

  it('シードなしでも生成できる', () => {
    const rng = createRandom();
    expect(rng).toBeInstanceOf(SeededRandom);
  });
});

describe('generateProblemId', () => {
  it('一意なIDを生成する', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = generateProblemId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });

  it('IDが空でない', () => {
    const id = generateProblemId();
    expect(id.length).toBeGreaterThan(0);
  });
});