/**
 * 出題母集団 (QuestionPool) のテスト
 *
 * 中心仕様: 母集団は「登録されている全 generator」であり、
 * generator を追加・削除してもその母集団から外れないこと。
 */

import { describe, expect, it } from 'vitest';
import {
  buildQuestionPool,
  filterQuestionPool,
  EmptyQuestionPoolError,
  type QuestionPoolEntry,
} from './questionPool';
import { getAllGenerators, getCategories } from './generatorRegistry';
import { getTypeSupportedLevels } from '../diversity/metadata';

describe('buildQuestionPool', () => {
  it('登録済みの全 generator が母集団に入る', () => {
    const pool = buildQuestionPool();
    const registryTypes = getAllGenerators().map((g) => g.type).sort();
    expect(pool.map((e) => e.type).sort()).toEqual(registryTypes);
    expect(pool.length).toBe(getAllGenerators().length);
  });

  it('全分野 (カテゴリ) が母集団に含まれる', () => {
    const pool = buildQuestionPool();
    const inPool = new Set(pool.map((e) => e.category));
    for (const category of getCategories()) {
      expect(inPool.has(category), `${category} が母集団にない`).toBe(true);
    }
  });

  it('各要素 DifficultyLevel と対応する', () => {
    for (const entry of buildQuestionPool()) {
      expect(entry.supportedLevels, entry.type).toEqual(getTypeSupportedLevels(entry.type));
      expect(entry.description.length, entry.type).toBeGreaterThan(0);
    }
  });

  it('学年が判明する型には1〜6年の学年が入っている (範囲外の学年を出さない)', () => {
    for (const entry of buildQuestionPool()) {
      if (entry.grade === undefined) continue;
      expect([1, 2, 3, 4, 5, 6, 'jhs1']).toContain(entry.grade);
    }
  });

  it('外部から渡した generator 一覧でも構築できる (テスト用)', () => {
    const subset = getAllGenerators().slice(0, 3);
    const pool = buildQuestionPool(subset);
    expect(pool.length).toBe(3);
  });
});

describe('filterQuestionPool', () => {
  const pool = buildQuestionPool();

  it('条件なしなら全件 (通常モードの母集団)', () => {
    expect(filterQuestionPool(null, pool).length).toBe(pool.length);
    expect(filterQuestionPool(undefined, pool).length).toBe(pool.length);
    expect(filterQuestionPool({}, pool).length).toBe(pool.length);
  });

  it('分野を指定するとその分野だけになる', () => {
    const filtered = filterQuestionPool({ category: 'fraction' }, pool);
    expect(filtered.length).toBeGreaterThan(0);
    for (const entry of filtered) expect(entry.category).toBe('fraction');
  });

  it('学年を指定するとその学年の型だけになる', () => {
    const filtered = filterQuestionPool({ grade: 6 }, pool);
    expect(filtered.length).toBeGreaterThan(0);
    for (const entry of filtered) expect(entry.grade).toBe(6);
  });

  it('問題タイプを指定するとその型1件になる', () => {
    const target = pool.find((e) => e.type === 'fraction_reduce') as QuestionPoolEntry;
    const filtered = filterQuestionPool({ type: target.type }, pool);
    expect(filtered.map((e) => e.type)).toEqual([target.type]);
  });

  it('難易度を指定するとその難易度を生成できる型だけになる', () => {
    const filtered = filterQuestionPool({ difficulty: 1 }, pool);
    expect(filtered.length).toBeGreaterThan(0);
    for (const entry of filtered) {
      expect(entry.supportedLevels, entry.type).toContain(1);
    }
  });

  it('条件の積では共通部分の型だけになる', () => {
    const filtered = filterQuestionPool(
      { category: 'fraction', difficulty: 2 },
      pool,
    );
    for (const entry of filtered) {
      expect(entry.category).toBe('fraction');
      expect(entry.supportedLevels).toContain(2);
    }
  });

  it('矛盾する条件では空になる (例外は EmptyQuestionPoolError)', () => {
    const filtered = filterQuestionPool({ category: 'fraction', grade: 1 }, pool);
    expect(filtered.length).toBe(0);
    // 空の母集団になったとき投げられるエラーのメッセージに条件が入っている
    const error = new EmptyQuestionPoolError({ category: 'fraction', grade: 1 });
    expect(error.message).toContain('category=fraction');
    expect(error.message).toContain('grade=1');
  });
});
