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