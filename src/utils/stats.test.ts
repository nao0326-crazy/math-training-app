/**
 * 学習統計のテスト
 */

import { describe, expect, it } from 'vitest';
import { calculateStats, categoryLabel, formatPercent, formatTime } from './stats';
import type { AnswerRecord } from '../types/history';

/**
 * テスト用の解答記録を作成する
 */
function createRecord(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    problemId: 'p1',
    problemType: 'integer_addition',
    category: 'integer',
    isCorrect: true,
    answerTimeSec: 10,
    answeredAt: new Date().toISOString(),
    difficultyLevel: 2,
    question: '5 + 3 = □',
    userAnswer: '5',
    correctAnswer: '5',
    ...overrides,
  };
}

describe('calculateStats', () => {
  it('空の履歴はゼロ統計', () => {
    const stats = calculateStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.correctCount).toBe(0);
    expect(stats.accuracyRate).toBe(0);
    expect(stats.averageTimeSec).toBe(0);
    expect(stats.byCategory).toEqual([]);
    expect(stats.byDifficulty).toEqual([]);
  });

  it('正答率を計算する', () => {
    const records = [
      createRecord({ isCorrect: true }),
      createRecord({ isCorrect: true }),
      createRecord({ isCorrect: false }),
    ];
    const stats = calculateStats(records);
    expect(stats.totalCount).toBe(3);
    expect(stats.correctCount).toBe(2);
    expect(stats.accuracyRate).toBeCloseTo(2 / 3);
  });

  it('平均解答時間を計算する', () => {
    const records = [
      createRecord({ answerTimeSec: 10 }),
      createRecord({ answerTimeSec: 20 }),
      createRecord({ answerTimeSec: 30 }),
    ];
    const stats = calculateStats(records);
    expect(stats.averageTimeSec).toBe(20);
  });

  it('カテゴリ別に集計する', () => {
    const records = [
      createRecord({ category: 'integer', isCorrect: true }),
      createRecord({ category: 'integer', isCorrect: false }),
      createRecord({ category: 'fraction', isCorrect: true }),
    ];
    const stats = calculateStats(records);
    expect(stats.byCategory).toHaveLength(2);

    const integer = stats.byCategory.find((c) => c.category === 'integer');
    expect(integer?.totalCount).toBe(2);
    expect(integer?.correctCount).toBe(1);
  });

  it('難易度別に集計する', () => {
    const records = [
      createRecord({ difficultyLevel: 1, isCorrect: true }),
      createRecord({ difficultyLevel: 1, isCorrect: false }),
      createRecord({ difficultyLevel: 3, isCorrect: true }),
    ];
    const stats = calculateStats(records);
    expect(stats.byDifficulty).toHaveLength(2);

    const level1 = stats.byDifficulty.find((d) => d.level === 1);
    expect(level1?.totalCount).toBe(2);
    expect(level1?.correctCount).toBe(1);
  });
});

describe('categoryLabel', () => {
  it('日本語のラベルを返す', () => {
    expect(categoryLabel('integer')).toBe('整数');
    expect(categoryLabel('decimal')).toBe('小数');
    expect(categoryLabel('fraction')).toBe('分数');
    expect(categoryLabel('ratio')).toBe('割合');
    expect(categoryLabel('speed')).toBe('速さ');
    expect(categoryLabel('geometry')).toBe('図形');
    expect(categoryLabel('data')).toBe('データ');
  });

  it('不明なカテゴリはそのまま返す', () => {
    expect(categoryLabel('unknown')).toBe('unknown');
  });
});

describe('formatPercent', () => {
  it('パーセント表示にフォーマットする', () => {
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.333)).toBe('33%');
  });
});

describe('formatTime', () => {
  it('秒をフォーマットする', () => {
    expect(formatTime(5)).toBe('5秒');
    expect(formatTime(59)).toBe('59秒');
    expect(formatTime(60)).toBe('1分');
    expect(formatTime(90)).toBe('1分30秒');
    expect(formatTime(120)).toBe('2分');
  });
});

describe('解いた問題数 (solvedCount)', () => {
  it('時間内の解答のみ数え、時間切れは含めない', () => {
    const records = [
      createRecord({ isCorrect: true }),
      createRecord({ isCorrect: false }),
      createRecord({ isCorrect: false, isTimedOut: true }),
    ];
    const stats = calculateStats(records);
    expect(stats.solvedCount).toBe(2);
    // 出題数・正答率の分母は時間切れを含む (既存仕様を維持)
    expect(stats.totalCount).toBe(3);
    expect(stats.correctCount).toBe(1);
    expect(stats.accuracyRate).toBeCloseTo(1 / 3);
  });

  it('分野別・難易度別にも solvedCount を集計する', () => {
    const records = [
      createRecord({ category: 'integer', difficultyLevel: 1, isCorrect: true }),
      createRecord({ category: 'integer', difficultyLevel: 1, isCorrect: false, isTimedOut: true }),
    ];
    const stats = calculateStats(records);
    const cat = stats.byCategory.find((c) => c.category === 'integer');
    const diff = stats.byDifficulty.find((d) => d.level === 1);
    expect(cat?.solvedCount).toBe(1);
    expect(cat?.totalCount).toBe(2);
    expect(diff?.solvedCount).toBe(1);
    expect(diff?.totalCount).toBe(2);
  });
});

describe('平均解答時間 (averageTimeSec) と時間切れ', () => {
  it('時間切れを除外して平均解答時間を計算する', () => {
    // 実態は 10/12/8 秒で速く解けているが、時間切れ (300秒=制限時間) が1件ある。
    // 時間切れを平均に含めると 82.5秒 (実態の約8倍) に歪むため除外する。
    const records = [
      createRecord({ answerTimeSec: 10 }),
      createRecord({ answerTimeSec: 12 }),
      createRecord({ answerTimeSec: 8 }),
      createRecord({ isCorrect: false, isTimedOut: true, answerTimeSec: 300, timeLimitSec: 300 }),
    ];
    const stats = calculateStats(records);
    // 解答速度の実態 (時間内の3問) の平均 10 秒を返す
    expect(stats.averageTimeSec).toBe(10);
    // 出題数・正答率は時間切れを含む既存仕様を維持 (歪めない)
    expect(stats.totalCount).toBe(4);
    expect(stats.accuracyRate).toBeCloseTo(3 / 4);
  });

  it('時間切れしか無い場合の平均解答時間は 0 (分母を割らない)', () => {
    const records = [
      createRecord({ isCorrect: false, isTimedOut: true, answerTimeSec: 120, timeLimitSec: 120 }),
      createRecord({ isCorrect: false, isTimedOut: true, answerTimeSec: 90, timeLimitSec: 90 }),
    ];
    const stats = calculateStats(records);
    expect(stats.averageTimeSec).toBe(0);
  });

  it('分野別・難易度別の平均解答時間も時間切れを除外する', () => {
    const records = [
      createRecord({ category: 'integer', difficultyLevel: 2, answerTimeSec: 10 }),
      createRecord({ category: 'integer', difficultyLevel: 2, isCorrect: false, isTimedOut: true, answerTimeSec: 300, timeLimitSec: 300 }),
    ];
    const stats = calculateStats(records);
    const cat = stats.byCategory.find((c) => c.category === 'integer');
    const diff = stats.byDifficulty.find((d) => d.level === 2);
    // 時間内の1問 (10秒) のみで平均を取る
    expect(cat?.averageTimeSec).toBe(10);
    expect(diff?.averageTimeSec).toBe(10);
  });
});