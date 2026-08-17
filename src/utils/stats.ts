/**
 * 学習統計の集計ユーティリティ
 */

import type {
  AnswerRecord,
  CategoryStats,
  DifficultyStats,
  LearningStats,
} from '../types/history';

/**
 * 学習履歴から統計を集計する
 */
export function calculateStats(records: AnswerRecord[]): LearningStats {
  const totalCount = records.length;
  const correctCount = records.filter((r) => r.isCorrect).length;
  const accuracyRate = totalCount > 0 ? correctCount / totalCount : 0;
  const averageTimeSec =
    totalCount > 0
      ? records.reduce((sum, r) => sum + r.answerTimeSec, 0) / totalCount
      : 0;

  // カテゴリ別
  const byCategoryMap = new Map<string, AnswerRecord[]>();
  for (const record of records) {
    const list = byCategoryMap.get(record.category) ?? [];
    list.push(record);
    byCategoryMap.set(record.category, list);
  }
  const byCategory: CategoryStats[] = [...byCategoryMap.entries()].map(
    ([category, list]) => ({
      category,
      totalCount: list.length,
      correctCount: list.filter((r) => r.isCorrect).length,
      averageTimeSec:
        list.length > 0
          ? list.reduce((sum, r) => sum + r.answerTimeSec, 0) / list.length
          : 0,
    }),
  );

  // 難易度別
  const byDifficultyMap = new Map<number, AnswerRecord[]>();
  for (const record of records) {
    const list = byDifficultyMap.get(record.difficultyLevel) ?? [];
    list.push(record);
    byDifficultyMap.set(record.difficultyLevel, list);
  }
  const byDifficulty: DifficultyStats[] = [...byDifficultyMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, list]) => ({
      level,
      totalCount: list.length,
      correctCount: list.filter((r) => r.isCorrect).length,
      averageTimeSec:
        list.length > 0
          ? list.reduce((sum, r) => sum + r.answerTimeSec, 0) / list.length
          : 0,
    }));

  return {
    totalCount,
    correctCount,
    accuracyRate,
    averageTimeSec,
    byCategory,
    byDifficulty,
  };
}

/**
 * カテゴリの日本語名
 */
export const CATEGORY_LABELS: Record<string, string> = {
  integer: '整数',
  decimal: '小数',
  fraction: '分数',
  ratio: '割合',
  speed: '速さ',
  geometry: '図形',
  data: 'データ',
  numberTheory: '数の性質',
  expression: '文字と式',
  combinatorics: '場合の数',
};

/**
 * カテゴリ名を日本語に変換する
 */
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * 正答率をパーセント表示用にフォーマットする
 */
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * 秒数を「X分Y秒」形式にフォーマットする
 */
export function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) {
    return `${s}秒`;
  }
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  return rest > 0 ? `${minutes}分${rest}秒` : `${minutes}分`;
}
