/**
 * セレクター組み立て (createQuizSelector) のテスト
 *
 * すべての学習で FilteredSelector を使用し、管理者が設定した
 * 出題範囲を厳密に適用することを確認する。
 */

import { describe, expect, it } from 'vitest';
import { createQuizSelector, toDifficultyLevel } from './quizSelection';
import { FilteredSelector } from '../engine/selector/filteredSelector';
import type { StudyMode } from '../engine/selector/types';

describe('createQuizSelector', () => {
  it('filtered モードで FilteredSelector を返す', () => {
    const s = createQuizSelector({
      studyMode: { kind: 'filtered', filter: {} },
      difficulty: 2,
      filter: null,
    });
    expect(s).toBeInstanceOf(FilteredSelector);
  });

  it('filter があれば FilteredSelector に渡す', () => {
    const s = createQuizSelector({
      studyMode: { kind: 'filtered', filter: { category: 'fraction', difficulty: 3 } },
      difficulty: 3,
      filter: { category: 'fraction', difficulty: 3 },
    });
    expect(s).toBeInstanceOf(FilteredSelector);
  });

  it('未対応の学習モードはエラーを投げる', () => {
    expect(() =>
      createQuizSelector({
        studyMode: { kind: 'full-random' } as StudyMode,
        difficulty: 2,
        filter: null,
      }),
    ).toThrow('未対応の学習モード');
  });
});

describe('toDifficultyLevel', () => {
  it('1〜5 に収める', () => {
    expect(toDifficultyLevel(0)).toBe(1);
    expect(toDifficultyLevel(1)).toBe(1);
    expect(toDifficultyLevel(3)).toBe(3);
    expect(toDifficultyLevel(5)).toBe(5);
    expect(toDifficultyLevel(99)).toBe(5);
  });

  it('端数は丸める', () => {
    expect(toDifficultyLevel(2.4)).toBe(2);
    expect(toDifficultyLevel(2.6)).toBe(3);
  });
});
