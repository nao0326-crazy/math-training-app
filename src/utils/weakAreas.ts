/**
 * 苦手分野の判定ユーティリティ
 *
 * 学習履歴 (AnswerRecord) から「苦手な分野」を抽出する。
 * 判定基準はこのモジュールの定数で一元管理する。
 *
 * 注意: 問題生成・正解判定には一切関与しない (履歴集計のみ)。
 */

import type { AnswerRecord } from '../types/history';
import { calculateStats } from './stats';
import { isSolvedRecord } from './solvedCount';

/** 苦手判定の対象となる最低回答数 (これ未満の分野は判定しない) */
export const MIN_ATTEMPTS_FOR_WEAKNESS = 5;

/** 苦手判定の正答率しきい値 (この値未満なら苦手) */
export const WEAKNESS_ACCURACY_THRESHOLD = 0.7;

/** 復習で出題する問題数 */
export const REVIEW_QUESTION_COUNT = 5;

/** 履歴がない場合などに使う既定の難易度 */
export const DEFAULT_DIFFICULTY_LEVEL = 2;

/**
 * 苦手分野の情報
 */
export interface WeakArea {
  category: string;
  totalCount: number;
  correctCount: number;
  /** 0〜1 の正答率 */
  accuracyRate: number;
}

/**
 * 学習履歴から苦手分野を抽出する
 *
 * 条件: 制限時間内に解答できた数 (時間切れを除く) が MIN_ATTEMPTS_FOR_WEAKNESS 以上 かつ
 *       その正答率が WEAKNESS_ACCURACY_THRESHOLD 未満
 *
 * 【時間切れの扱い】時間切れ (isTimedOut) は「解けなかった」のではなく
 * 「時間が足りなかった」だけで理解度とは別問題。正答率の母集団から除外し
 * (solvedCount と同じ解釈)、制限時間内に実際に解答した問題だけで判定する。
 * これにより「時間に余裕がなくても正しく解ける」分野が誤って苦手とされるのを防ぐ。
 *
 * 並び順: 正答率が低い順 (同率の場合は回答数が多い順)
 * ※回答数の集計には calculateStats を使うが、正答率と苦手判定の母集団は
 *   時間切れを除いた制限時間内の解答に限定する。
 */
export function findWeakAreas(records: AnswerRecord[]): WeakArea[] {
  const byCategory = calculateStats(records).byCategory;

  // 分野ごとに「時間切れを除いた制限時間内の解答」だけで正答率を再計算する。
  const solvedByCategory = new Map<string, AnswerRecord[]>();
  for (const record of records) {
    if (!isSolvedRecord(record)) continue;
    const list = solvedByCategory.get(record.category) ?? [];
    list.push(record);
    solvedByCategory.set(record.category, list);
  }

  return byCategory
    .map((cat) => {
      const solved = solvedByCategory.get(cat.category) ?? [];
      const totalCount = solved.length;
      const correctCount = solved.filter((r) => r.isCorrect).length;
      return {
        category: cat.category,
        totalCount,
        correctCount,
        accuracyRate: totalCount > 0 ? correctCount / totalCount : 0,
      };
    })
    .filter(
      (area) =>
        area.totalCount >= MIN_ATTEMPTS_FOR_WEAKNESS &&
        area.accuracyRate < WEAKNESS_ACCURACY_THRESHOLD,
    )
    .sort((a, b) => {
      if (a.accuracyRate !== b.accuracyRate) {
        return a.accuracyRate - b.accuracyRate;
      }
      return b.totalCount - a.totalCount;
    });
}

/**
 * 直近 (最も新しい回答) で使用していた難易度を取得する
 * 苦手分野の復習では、この難易度を既存の問題生成システムにそのまま渡す
 */
export function getMostRecentDifficultyLevel(records: AnswerRecord[]): number {
  let latest: AnswerRecord | null = null;
  for (const record of records) {
    if (
      latest === null ||
      new Date(record.answeredAt).getTime() > new Date(latest.answeredAt).getTime()
    ) {
      latest = record;
    }
  }
  return latest?.difficultyLevel ?? DEFAULT_DIFFICULTY_LEVEL;
}
