/**
 * UI 状態遷移のテスト
 *
 * HomePage で選んだ「学習方法」と「カテゴリ」が矛盾せず、
 * 正しい StudyMode と category が QuizPage へ渡ることを確認する。
 */

import { describe, expect, it } from 'vitest';
import { resolveStudyMode } from './studyMode';
import { QuestionSelector } from '../engine/selector/questionSelector';
import { RandomSelector } from '../engine/selector/randomSelector';
import { WeakSelector, NoWeakTargetError } from '../engine/selector/weakSelector';
import type { Category, DifficultyLevel } from '../types/problem';

type Selector = QuestionSelector | RandomSelector | WeakSelector;
type Resolved = ReturnType<typeof resolveStudyMode>;

/** QuizPage の createSelector と同じ優先順位でセレクターを選ぶ */
function createSelector(
  studyMode: Resolved['studyMode'] | undefined,
  category: Category | null,
): Selector {
  if (studyMode?.kind === 'weak') return new WeakSelector();
  if (studyMode?.kind === 'random') return new RandomSelector();
  if (studyMode?.kind === 'category') return new QuestionSelector();
  return category === null ? new RandomSelector() : new QuestionSelector();
}

describe('学習方法とカテゴリの解決', () => {
  it('「すべての問題」+ カテゴリなし -> random / null (RandomSelector)', () => {
    const r = resolveStudyMode('all', null);
    expect(r.studyMode).toEqual({ kind: 'random' });
    expect(r.category).toBeNull();
  });

  it('「すべての問題」+ カテゴリ指定 -> category / そのカテゴリ (QuestionSelector)', () => {
    const r = resolveStudyMode('all', 'fraction');
    expect(r.studyMode).toEqual({ kind: 'category', category: 'fraction' });
    expect(r.category).toBe('fraction');
  });

  it('「苦手復習」-> weak / null (カテゴリを勝手に指定しない)', () => {
    const r = resolveStudyMode('weak', null);
    expect(r.studyMode).toEqual({ kind: 'weak', types: [] });
    expect(r.category).toBeNull();
  });

  it('「苦手復習」+ カテゴリが残っていても null に落とす (矛盾しない)', () => {
    const r = resolveStudyMode('weak', 'fraction');
    expect(r.studyMode.kind).toBe('weak');
    expect(r.category).toBeNull();
  });

  it('全カテゴリで矛盾しない (weak は常に null)', () => {
    const categories: (Category | null)[] = [
      null, 'integer', 'numberTheory', 'fraction', 'decimal',
      'speed', 'geometry', 'ratio', 'expression', 'combinatorics', 'data',
    ];
    for (const category of categories) {
      const all = resolveStudyMode('all', category);
      if (category === null) {
        expect(all.studyMode.kind, `${category}`).toBe('random');
        expect(all.category).toBeNull();
      } else {
        expect(all.studyMode.kind, `${category}`).toBe('category');
        expect(all.category).toBe(category);
      }
      const weak = resolveStudyMode('weak', category);
      expect(weak.studyMode.kind).toBe('weak');
      expect(weak.category).toBeNull();
    }
  });
});

describe('studyMode に応じたセレクターの選択', () => {
  it('weak -> WeakSelector', () => {
    const r = resolveStudyMode('weak', null);
    expect(createSelector(r.studyMode, r.category)).toBeInstanceOf(WeakSelector);
  });

  it('random -> RandomSelector', () => {
    const r = resolveStudyMode('all', null);
    expect(createSelector(r.studyMode, r.category)).toBeInstanceOf(RandomSelector);
  });

  it('category -> QuestionSelector', () => {
    const r = resolveStudyMode('all', 'fraction');
    expect(createSelector(r.studyMode, r.category)).toBeInstanceOf(QuestionSelector);
  });

  it('studyMode 未指定でも既存挙動を維持する', () => {
    expect(createSelector(undefined, null)).toBeInstanceOf(RandomSelector);
    expect(createSelector(undefined, 'integer')).toBeInstanceOf(QuestionSelector);
  });
});

describe('実フローの再現 (コードレベル)', () => {
  it('A. すべて -> RandomSelector -> 問題が出題される', () => {
    resolveStudyMode('all', null);
    const selector = new RandomSelector();
    for (let i = 0; i < 10; i++) {
      const problem = selector.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 2,
      });
      expect(problem.question.length).toBeGreaterThan(0);
      expect(problem.difficulty.level).toBe(2);
    }
  });

  it('B. 苦手復習 -> 履歴があれば WeakSelector が問題を返す', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      problemId: `p${i}`,
      problemType: 'fraction_div_integer',
      category: 'fraction',
      isCorrect: i < 3,
      answerTimeSec: 20,
      answeredAt: new Date('2026-01-01T00:00:00Z').toISOString(),
      difficultyLevel: 2,
      question: 'q',
      userAnswer: '1',
      correctAnswer: '2',
    }));
    const r = resolveStudyMode('weak', null);
    const selector = new WeakSelector();
    const problem = selector.selectNextQuestion(records, [], {
      mode: r.studyMode,
      difficulty: 2 as DifficultyLevel,
    });
    expect(problem.type).toBe('fraction_div_integer');
    expect(problem.difficulty.level).toBe(2);
  });

  it('C. カテゴリ -> QuestionSelector -> 指定カテゴリのみ', () => {
    const r = resolveStudyMode('all', 'fraction');
    const selector = new QuestionSelector();
    for (let i = 0; i < 10; i++) {
      const problem = selector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: r.category,
      });
      expect(problem.category).toBe('fraction');
    }
  });

  it('D. 苦手なし -> NoWeakTargetError (QuizPage が setError する)', () => {
    const r = resolveStudyMode('weak', null);
    const selector = new WeakSelector();
    expect(() =>
      selector.selectNextQuestion([], [], { mode: r.studyMode, difficulty: 2 }),
    ).toThrow(NoWeakTargetError);
  });
});