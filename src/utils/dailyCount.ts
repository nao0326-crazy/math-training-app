/**
 * 日次学習カウントのユーティリティ
 */

import type { AnswerRecord } from '../types/history';

/** 1日の目標問題数 */
export const DAILY_GOAL = 1000;

/** 回答記録イベント名 (回答送信時に発火) */
export const ANSWER_RECORDED_EVENT = 'answer-recorded';

/**
 * ローカル日付のキーを取得する (例: '2026-08-18')
 * 日付判定はユーザーのローカル日付を基準にする
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 指定日の回答数をカウントする
 * 空回答は履歴に保存されないため、履歴に存在する回答のみがカウントされる
 */
export function countAnswersOnDate(
  records: AnswerRecord[],
  date: Date = new Date(),
): number {
  const targetKey = getLocalDateKey(date);
  return records.filter((r) => {
    const recordDate = new Date(r.answeredAt);
    return getLocalDateKey(recordDate) === targetKey;
  }).length;
}

/**
 * 今日の回答数をカウントする
 */
export function countTodayAnswers(records: AnswerRecord[]): number {
  return countAnswersOnDate(records, new Date());
}