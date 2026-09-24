
/**
 * 日次学習カウントのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  DAILY_GOAL,
  countAnswersOnDate,
  countTodayAnswers,
  getStudyDateKey,
} from './dailyCount';
import type { AnswerRecord } from '../types/history';

/** テスト用の解答記録を作成する */
function createRecord(
  answeredAt: string,
  overrides: Partial<AnswerRecord> = {},
): AnswerRecord {
  return {
    problemId: 'p1',
    problemType: 'integer_addition',
    category: 'integer',
    isCorrect: true,
    answerTimeSec: 10,
    answeredAt,
    difficultyLevel: 2,
    question: '5 + 3 = □',
    userAnswer: '5',
    correctAnswer: '5',
    ...overrides,
  };
}

describe('getStudyDateKey', () => {
  it('日本時間の日付キーを返す', () => {
    // 2026-09-23 23:59:59 JST
    expect(getStudyDateKey(new Date('2026-09-23T14:59:59.999Z'))).toBe('2026-09-23');
    // 2026-09-24 00:00:00 JST
    expect(getStudyDateKey(new Date('2026-09-23T15:00:00.000Z'))).toBe('2026-09-24');
  });

  it('1桁の月と日はゼロ埋めする', () => {
    expect(getStudyDateKey(new Date('2026-01-05T00:00:00.000Z'))).toBe('2026-01-05');
  });
});

describe('countAnswersOnDate', () => {
  it('指定日の回答数をカウントする', () => {
    const today = new Date('2026-09-23T12:00:00.000Z');
    const yesterday = new Date('2026-09-22T14:59:59.999Z');
    const tomorrow = new Date('2026-09-24T14:59:59.999Z');

    const records = [
      createRecord(today.toISOString()),
      createRecord(today.toISOString()),
      createRecord(yesterday.toISOString()),
      createRecord(tomorrow.toISOString()),
    ];

    expect(countAnswersOnDate(records, today)).toBe(2);
  });

  it('空の履歴は0を返す', () => {
    expect(countAnswersOnDate([], new Date())).toBe(0);
  });

  it('過去日の回答はカウントしない', () => {
    const today = new Date('2026-09-23T12:00:00.000Z');
    const past = new Date('2026-09-22T12:00:00.000Z');
    const records = [
      createRecord(past.toISOString()),
      createRecord(past.toISOString()),
    ];

    expect(countAnswersOnDate(records, today)).toBe(0);
  });
});

describe('countTodayAnswers', () => {
  it('今日の回答数をカウントする', () => {
    const now = new Date();
    const records = [
      createRecord(now.toISOString()),
      createRecord(now.toISOString()),
    ];

    expect(countTodayAnswers(records)).toBe(2);
  });

  it('過去日の回答は今日に加算しない', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const records = [
      createRecord(now.toISOString()),
      createRecord(yesterday.toISOString()),
    ];

    expect(countTodayAnswers(records)).toBe(1);
  });

  it('1000問未満では未達', () => {
    const now = new Date();
    const records = Array.from({ length: 999 }, () =>
      createRecord(now.toISOString()),
    );

    expect(countTodayAnswers(records)).toBe(999);
    expect(countTodayAnswers(records) < DAILY_GOAL).toBe(true);
  });

  it('1000問で達成', () => {
    const now = new Date();
    const records = Array.from({ length: DAILY_GOAL }, () =>
      createRecord(now.toISOString()),
    );

    expect(countTodayAnswers(records)).toBe(DAILY_GOAL);
    expect(countTodayAnswers(records) >= DAILY_GOAL).toBe(true);
  });

  it('1001問以上でも達成状態が維持される', () => {
    const now = new Date();
    const records = Array.from({ length: DAILY_GOAL + 1 }, () =>
      createRecord(now.toISOString()),
    );

    expect(countTodayAnswers(records)).toBe(DAILY_GOAL + 1);
    expect(countTodayAnswers(records) >= DAILY_GOAL).toBe(true);
  });
});
