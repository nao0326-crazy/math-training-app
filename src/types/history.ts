/**
 * 1回の問題回答の記録
 */
export interface AnswerRecord {
  /** 問題ID */
  problemId: string;
  /** 問題タイプ */
  problemType: string;
  /** カテゴリ */
  category: string;
  /** 正誤 */
  isCorrect: boolean;
  /** 解答時間 (秒) */
  answerTimeSec: number;
  /** 出題日時 */
  answeredAt: string;
  /** 難易度 */
  difficultyLevel: number;
  /** ユーザーの解答 */
  userAnswer: string;
  /** 正解 */
  correctAnswer: string;
}

/**
 * 出題済みの問題の記録 (重複防止用)
 */
export interface QuestionHistory {
  /** 問題ID */
  problemId: string;
  /** 問題タイプ */
  problemType: string;
  /** 生成パラメータ */
  parameters: Record<string, unknown>;
  /** 出題日時 */
  askedAt: string;
}

/**
 * 分野別の統計
 */
export interface CategoryStats {
  category: string;
  totalCount: number;
  correctCount: number;
  averageTimeSec: number;
}

/**
 * 難易度別の統計
 */
export interface DifficultyStats {
  level: number;
  totalCount: number;
  correctCount: number;
  averageTimeSec: number;
}

/**
 * 学習履歴の集計結果
 */
export interface LearningStats {
  totalCount: number;
  correctCount: number;
  accuracyRate: number;
  averageTimeSec: number;
  byCategory: CategoryStats[];
  byDifficulty: DifficultyStats[];
}

/**
 * 学習設定
 */
export interface StudySettings {
  /** IndexedDB のキー */
  key: string;
  difficultyLevel: number;
  category: string | null;
  questionCount: number;
}
