/** 成長記録画面で使用する型定義 */

/** 1日分の集計結果 */
export interface DailyGrowth {
  /** 日本時間の日付キー (YYYY-MM-DD) */
  dateKey: string;
  /** 通常問題の回答数 (時間切れを含む採点対象数) */
  questionCount: number;
  /** 通常問題の正解数 */
  correctCount: number;
  /** 正答率 (0〜100) */
  accuracyRate: number;
  /** 平均回答時間 (秒、時間切れは除外) */
  averageTimeSec: number;
  /** 学習したか (0件の日は未学習として扱わない) */
  hasLearned: boolean;
}

/** 朝の100問の1日分の結果 */
export interface SpeedGateDailyResult {
  /** 日本時間の日付キー (YYYY-MM-DD) */
  dateKey: string;
  /** 正解数 */
  correctCount: number;
  /** 総問題数 (100問) */
  totalCount: number;
  /** 正答率 (0〜100) */
  accuracyRate: number;
  /** 総所要時間 (ミリ秒) */
  totalMs: number;
  /** 平均回答時間 (ミリ秒) */
  averageMs: number;
  /** 完了済みか */
  completed: boolean;
}

/** 問題タイプ別の正答率 */
export interface ProblemTypeAccuracy {
  problemType: string;
  label: string;
  totalCount: number;
  correctCount: number;
  accuracyRate: number;
}

/** 期間比較結果 */
export interface PeriodComparison {
  /** 前期間の正答率 (0〜100, データなしなら null) */
  prevAccuracyRate: number | null;
  /** 直近期間の正答率 (0〜100, データなしなら null) */
  recentAccuracyRate: number | null;
  /** 前期間の平均回答時間 (秒, データなしなら null) */
  prevAverageTimeSec: number | null;
  /** 直近期間の平均回答時間 (秒, データなしなら null) */
  recentAverageTimeSec: number | null;
  /** 前期間の問題数 */
  prevQuestionCount: number;
  /** 直近期間の問題数 */
  recentQuestionCount: number;
}

/** 成長記録画面で表示するすべてのデータ */
export interface GrowthData {
  /** 今日の通常問題統計 */
  today: DailyGrowth | null;
  /** 今日の朝100問統計 */
  todaySpeedGate: SpeedGateDailyResult | null;
  /** 日別の通常問題集計 (期間内, 学習日のみ) */
  dailyGrowth: DailyGrowth[];
  /** 日別の朝100問集計 (期間内, 完了日のみ) */
  dailySpeedGate: SpeedGateDailyResult[];
  /** 問題タイプ別正答率 */
  byProblemType: ProblemTypeAccuracy[];
  /** 期間比較 */
  comparison: PeriodComparison;
  /** 期間内の総問題数 (通常問題) */
  totalQuestionCount: number;
  /** 期間内の総正解数 (通常問題) */
  totalCorrectCount: number;
  /** 期間内の平均回答時間 (秒) */
  totalAverageTimeSec: number;
  /** データが存在するか */
  hasData: boolean;
}

/** 期間選択肢 */
export type GrowthPeriod = 7 | 30 | 90;

export const GROWTH_PERIOD_LABELS: Record<GrowthPeriod, string> = {
  7: '7日間',
  30: '30日間',
  90: '90日間',
};