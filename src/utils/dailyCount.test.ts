/**
 * 日次学習カウントのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  DAILY_GOAL,
  countAnswersOnDate,
  countTodayAnswers,
  getLocalDateKey,
} from './dailyCount';
import type { AnswerRecord } from '../types/history';

/**
 * テスト用の解答記録を作成する
 */
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

describe('getLocalDateKey', () => {
  it('ローカル日付キーを返す', () => {
    // ローカルタイムゾーンで 2026-08-18 を表す Date を作成
    const date = new Date(2026, 7, 18); // 月は0始まりなので 7 = 8月
    expect(getLocalDateKey(date)).toBe('2026-08-18');
  });

  it('1桁の月と日はゼロ埋めする', () => {
    const date = new Date(2026, 0, 5); // 1月5日
    expect(getLocalDateKey(date)).toBe('2026-01-05');
  });
});

describe('countAnswersOnDate', () => {
  it('指定日の回答数をカウントする', () => {
    const today = new Date(2026, 7, 18, 10, 30, 0); // 2026-08-18 10:30
    const todayISO = today.toISOString();
    const yesterday = new Date(2026, 7, 17, 23, 59, 59);
    const yesterdayISO = yesterday.toISOString();
    const tomorrow = new Date(2026, 7, 19, 0, 0, 1);
    const tomorrowISO = tomorrow.toISOString();

    const records = [
      createRecord(todayISO),
      createRecord(todayISO),
      createRecord(yesterdayISO),
      createRecord(tomorrowISO),
    ];

    expect(countAnswersOnDate(records, today)).toBe(2);
  });

  it('空の履歴は0を返す', () => {
    expect(countAnswersOnDate([], new Date())).toBe(0);
  });

  it('過去日の回答はカウントしない', () => {
    const today = new Date(2026, 7, 18, 12, 0, 0);
    const past = new Date(2026, 7, 17, 12, 0, 0);
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
    // 昨日の日付を作成
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

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