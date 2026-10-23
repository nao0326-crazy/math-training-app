// Type definitions for difficulty levels
export enum DifficultyLevel {
  Easy,
  Normal,
  Hard,
}

/** 難易度範囲 (管理者画面などで使用) */
export type DifficultyRange = {
  min: DifficultyLevel;
  max: DifficultyLevel;
};

// Difficulty level type
type Difficulty = {
  level: DifficultyLevel;
  seed?: number;
}

// Category type
export interface Category {
  name: string;
  color: string;
}

// Answer input type
export interface AnswerInputType {
  type: string;
  value: string | number;
}

// Answer type
export interface Answer {
  value: number;
  correct: boolean;
}

// Answer input type
export interface Problem {
  id: string;
  category: Category;
  type: string;
  difficulty: { level: DifficultyLevel; components: { calculationComplexity: number; numberComplexity: number; reasoningComplexity: number; readingComplexity: number } };
  question: string;
  answer: { kind: string; value: number };
  explanation: string;
  inputType: string;
  parameters: {
    type: string;
    a: number;
  };
}

// Figure types
interface FigureType {
  width: number;
  height: number;
  url: string;
}
type FigureSizes = 'small' | 'medium' | 'large';

/** 単純計算の問題タイプ */
export type CalculationType =
  | "addition_1_1"
  | "addition_2_1"
  | "addition_2_2"
  | "subtraction_1_1"
  | "subtraction_2_1"
  | "subtraction_2_2"
  | "multiplication_1_1"
  | "multiplication_2_1"
  | "multiplication_2_2"
  | "division_2_1";

/** 問題生成の設定 */
export interface GenerationConfig {
  category?: Category;
  type?: string;
  difficulty?: DifficultyLevel;
  /** 問題生成のシード値 (テスト用) */
  seed?: number;
}

/** 問題生成ルールの定義 */
export interface ProblemGenerator {
  /** 問題タイプの識別子 */
  readonly type: string;
  /** カテゴリ */
  readonly category: Category;
  /** 問題タイプの説明 */
  readonly description: string;
  /** 問題を生成する */
  generate(config?: GenerationConfig): Problem;
  /** 生成された問題を検証する */
  validate(problem: Problem): ValidationResult;
}

/**
 * 検証結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
