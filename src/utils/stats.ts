/**
 * 学習統計の集計ユーティリティ
 */

import type {
  AnswerRecord,
  CategoryStats,
  DifficultyStats,
  LearningStats,
} from '../types/history';
import { countSolvedRecords, isSolvedRecord } from './solvedCount';

/**
 * 解答速度の平均 (秒)。時間切れの記録は除外する。
 *
 * 時間切れは「制限時間を使い切り解答できなかった」記録で、answerTimeSec が
 * 制限時間 (最大300秒) に張り付く。これを平均に含めると、時間切れが1件あるだけで
 * 実際の解答速度より数倍〜十数倍に膨らんだ「平均解答時間」になり、
 * 学習状況の把握 (どの分野が速い/遅い) を歪めてしまう。
 * 解答速度は「時間内に解答した問題」の実態を表すべきなので、solvedCount と同じ
 * 「時間切れは解いた問題ではない」原則を平均にも適用する。
 * (正答率・出題数の分母に時間切れを含める既存仕様は変えない。)
 *
 * 時間切れしか無い場合は 0 を返す (分母を割らない)。
 */
function averageSolvedTimeSec(records: AnswerRecord[]): number {
  const solved = records.filter(isSolvedRecord);
  if (solved.length === 0) return 0;
  return solved.reduce((sum, r) => sum + r.answerTimeSec, 0) / solved.length;
}

/**
 * 学習履歴から統計を集計する
 */
export function calculateStats(records: AnswerRecord[]): LearningStats {
  const totalCount = records.length;
  const solvedCount = countSolvedRecords(records);
  const correctCount = records.filter((r) => r.isCorrect).length;
  // 正答率は既存仕様どおり時間切れ (誤答) を分母 (totalCount) に含める
  const accuracyRate = totalCount > 0 ? correctCount / totalCount : 0;
  // 平均解答時間は時間切れを除外する (解答速度の実態を表すため)
  const averageTimeSec = averageSolvedTimeSec(records);

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
      solvedCount: countSolvedRecords(list),
      correctCount: list.filter((r) => r.isCorrect).length,
      averageTimeSec: averageSolvedTimeSec(list),
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
      solvedCount: countSolvedRecords(list),
      correctCount: list.filter((r) => r.isCorrect).length,
      averageTimeSec: averageSolvedTimeSec(list),
    }));

  return {
    totalCount,
    solvedCount,
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
  realWorld: 'くらしの中の算数',
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
