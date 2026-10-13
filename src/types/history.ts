/**
 * 1回の問題回答の記録
 */
export interface AnswerRecord {
  /** IndexedDB の自動採番キー（既存履歴との互換用に任意） */
  id?: number;
  /** サーバー同期用の冪等な送信ID（回答確定後に保存） */
  submissionId?: string;
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
  /**
   * 時間切れで解答受付を打ち切ったか (任意フィールド)。
   * true のときは必ず isCorrect=false (ユーザー入力を正答として扱わない)。
   * 旧レコードには無いため undefined (= 通常どおり時間内で解答)。
   * 通常の誤答との区別にのみ使い、既存の正答率・統計 (isCorrect 集計) は変えない。
   */
  isTimedOut?: boolean;
  /**
   * その問題に与えられた制限時間 (秒) (任意フィールド)。
   * 旧レコードには無いため undefined。時間切れ・所要時間の解釈に使う。
   */
  timeLimitSec?: number;
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
  /** 解いた問題数 (時間切れを除く) */
  solvedCount: number;
  correctCount: number;
  averageTimeSec: number;
}

/**
 * 難易度別の統計
 */
export interface DifficultyStats {
  level: number;
  totalCount: number;
  /** 解いた問題数 (時間切れを除く) */
  solvedCount: number;
  correctCount: number;
  averageTimeSec: number;
}

/**
 * 学習履歴の集計結果
 */
export interface LearningStats {
  totalCount: number;
  /** 解いた問題数 (時間切れを除く)。画面表示の「問題数」はこちらを使う。 */
  solvedCount: number;
  correctCount: number;
  /** 正答率 (分母 totalCount。時間切れを誤答として含める既存仕様を維持) */
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
