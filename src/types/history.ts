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
  /** 問題文 */
  question: string;
  /** ユーザーの解答 (実際に入力された元の値) */
  userAnswer: string;
  /** 正解 */
  correctAnswer: string;
}

/**
 * 出題済みの問題の記録 (重複防止・多様性制御用)
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
  /**
   * 問題の構造メタデータ (任意・多様性制御に使用)
   * 旧レコードでは欠落している可能性があり、その場合は
   * problemType から復元する
   */
  metadata?: import('../engine/diversity/metadata').ProblemMetadata;
  /** 同一問題検出用フィンガープリント (任意) */
  fingerprint?: string;
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
