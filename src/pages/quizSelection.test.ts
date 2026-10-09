/**
 * セレクター組み立て (createQuizSelector) のテスト
 *
 * 通常モードと管理者モードの分岐が、型と実装の両方で
 * 狙いどおりになっていることを確認する。
 */

import { describe, expect, it } from 'vitest';
import {
  createQuizSelector,
  toDifficultyLevel,
  LegacyQuestionSelectorAdapter,
} from './quizSelection';
import { FullRandomSelector } from '../engine/selector/fullRandomSelector';
import { FilteredSelector } from '../engine/selector/filteredSelector';
import { RandomSelector } from '../engine/selector/randomSelector';
import { WeakSelector } from '../engine/selector/weakSelector';
import { AdaptiveSelector } from '../engine/selector/adaptiveSelector';

describe('createQuizSelector: 通常モード', () => {
  it('full-random は FullRandomSelector (全母集団からランダム)', () => {
    const s = createQuizSelector({
      studyMode: { kind: 'full-random' },
      category: null,
      difficulty: 2,
      filter: null,
    });
    expect(s).toBeInstanceOf(FullRandomSelector);
  });

  it('filter が無くても category が null なら完全ランダムになる', () => {
    const s = createQuizSelector({ category: null, difficulty: 2 });
    expect(s).toBeInstanceOf(FullRandomSelector);
  });

  it('難易度・分野を指定しても full-random は指定を使わない', () => {
    const s = createQuizSelector({
      studyMode: { kind: 'full-random' },
      category: 'fraction',
      difficulty: 5,
      filter: { category: 'fraction' },
    });
    expect(s).toBeInstanceOf(FullRandomSelector);
  });
});

describe('createQuizSelector: 管理者モード', () => {
  it('filtered は FilteredSelector', () => {
    const s = createQuizSelector({
      studyMode: { kind: 'filtered', filter: { category: 'fraction', difficulty: 3 } },
      category: 'fraction',
      difficulty: 3,
      filter: { category: 'fraction', difficulty: 3 },
    });
    expect(s).toBeInstanceOf(FilteredSelector);
  });

  it('filter だけの指定があれば FilteredSelector', () => {
    const s = createQuizSelector({
      category: null,
      difficulty: 2,
      filter: { grade: 6 },
    });
    expect(s).toBeInstanceOf(FilteredSelector);
  });

  it('旧モード (weak / random / category) も従来セレクターに接続する', () => {
    expect(
      createQuizSelector({
        studyMode: { kind: 'weak', types: [] },
        category: null,
        difficulty: 2,
      }),
    ).toBeInstanceOf(WeakSelector);

    expect(
      createQuizSelector({ studyMode: { kind: 'random' }, category: null, difficulty: 2 }),
    ).toBeInstanceOf(RandomSelector);

    expect(
      createQuizSelector({
        studyMode: { kind: 'category', category: 'fraction' },
        category: 'fraction',
        difficulty: 2,
      }),
    ).toBeInstanceOf(LegacyQuestionSelectorAdapter);
  });
});

describe('createQuizSelector: 通常モード (分野別・適応難易度)', () => {
  it('adaptive は AdaptiveSelector (分野固定で毎回難易度を決める)', () => {
    const s = createQuizSelector({
      studyMode: { kind: 'adaptive', area: '図形' },
      category: null,
      difficulty: 2,
      filter: null,
    });
    expect(s).toBeInstanceOf(AdaptiveSelector);
  });

  it('全モード (adaptive) を指定したときのみ AdaptiveSelector になる', () => {
    expect(
      createQuizSelector({ studyMode: { kind: 'full-random' }, category: null, difficulty: 2 }),
    ).not.toBeInstanceOf(AdaptiveSelector);
    expect(createQuizSelector({ category: null, difficulty: 2 })).not.toBeInstanceOf(
      AdaptiveSelector,
    );
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
