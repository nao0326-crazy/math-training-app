/** 単元別ヒートマップ用の型定義 */

/** 単元ごとの習熟状態 */
export type MasteryLevel =
  | 'mastered'      // 習熟候補
  | 'improvable'    // 改善の余地
  | 'needsReview'   // 重点復習
  | 'insufficient'  // 判定中（回答数1〜4）
  | 'untaught';     // 未学習（回答数0）

/** 単元別の統計情報 */
export interface UnitStats {
  category: string;        // カテゴリキー (CATEGORY_LABELS のキー)
  label: string;           // 表示用単元名
  totalCount: number;      // 回答総数（タイムアウト含む）
  correctCount: number;    // 正解数
  accuracyRate: number;    // 正答率（0〜100）
  masteryLevel: MasteryLevel;
}

/** 習熟状態ごとの色・ラベル設定 */
export interface MasteryStyle {
  color: string;
  label: string;
}

export const MASTERY_STYLES: Record<MasteryLevel, MasteryStyle> = {
  mastered: { color: '#4caf50', label: '習熟候補' },
  improvable: { color: '#ff9800', label: '改善の余地' },
  needsReview: { color: '#f44336', label: '重点復習' },
  insufficient: { color: '#9e9e9e', label: '判定中' },
  untaught: { color: '#e0e0e0', label: '未学習' },
};

/** 判定に必要な最低回答数 (weakAreas.ts の MIN_ATTEMPTS_FOR_WEAKNESS と整合) */
export const MIN_ATTEMPTS_FOR_MASTERY = 5;

/** 習熟候補となる正答率の下限 */
export const MASTERED_ACCURACY_THRESHOLD = 0.8;

/** 改善の余地となる正答率の下限 */
export const IMPROVABLE_ACCURACY_THRESHOLD = 0.7;

/** 重点復習となる正答率の上限 (未満) */
export const NEEDS_REVIEW_ACCURACY_THRESHOLD = 0.7;
