/**
 * 日次学習カウントのユーティリティ
 */

import type { AnswerRecord } from '../types/history';

/** 1日の目標問題数 */
export const DAILY_GOAL = 1000;

/** 学習記録の日付は常に日本時間で判定する */
export const DAILY_TIME_ZONE = 'Asia/Tokyo';

/** 回答記録イベント名 (回答送信時に発火) */
export const ANSWER_RECORDED_EVENT = 'answer-recorded';

const dailyDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DAILY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * 日本時間の日付キーを取得する (例: '2026-08-18')
 *
 * 端末のローカルタイムゾーンに依存しないため、ブラウザーの Faro 設定が
 * 日本時間以外でも同じ日付で集計できる。
 */
export function getStudyDateKey(date: Date = new Date()): string {
  const parts = dailyDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('日本時間の日付を取得できませんでした');
  }

  return `${year}-${month}-${day}`;
}

/**
 * 指定日の回答数をカウントする
 * 空回答は履歴に保存されないため、履歴に存在する回答のみがカウントされる
 */
export function countAnswersOnDate(
  records: AnswerRecord[],
  date: Date = new Date(),
): number {
  const targetKey = getStudyDateKey(date);
  return records.filter((record) => {
    const recordDate = new Date(record.answeredAt);
    return getStudyDateKey(recordDate) === targetKey;
  }).length;
}

/**
 * 今日の回答数をカウントする
 */
export function countTodayAnswers(records: AnswerRecord[]): number {
  return countAnswersOnDate(records, new Date());
}
