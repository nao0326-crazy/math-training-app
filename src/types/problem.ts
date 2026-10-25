// Type definitions for difficulty levels
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

/** 難易度範囲 (管理者画面などで使用) */
export type DifficultyRange = {
  min: DifficultyLevel;
  max: DifficultyLevel;
};

// Difficulty components
export interface DifficultyComponents {
  calculationComplexity: DifficultyLevel;
  numberComplexity: DifficultyLevel;
  reasoningComplexity: DifficultyLevel;
  readingComplexity: DifficultyLevel;
}

// Difficulty level type
export interface Difficulty {
  level: DifficultyLevel;
  components: DifficultyComponents;
}

// Category type
export type Category =
  | 'integer'
  | 'decimal'
  | 'fraction'
  | 'ratio'
  | 'speed'
  | 'geometry'
  | 'data'
  | 'numberTheory'
  | 'expression'
  | 'combinatorics'
  | 'realWorld';

// Answer input type
export type AnswerInputType =
  | 'integer'
  | 'decimal'
  | 'fraction'
  | 'mixed'
  | 'fraction-list'
  | 'ratio'
  | 'expression'
  | 'choice'
  | 'list'
  | 'yesno'
  | 'string';

// Figure types
export interface FigurePoint {
  x: number;
  y: number;
}

export interface FigureSegment {
  from: FigurePoint;
  to: FigurePoint;
  label?: string;
}

export interface FigureLabel {
  at: FigurePoint;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
}

export interface FigurePointLabel {
  at: FigurePoint;
  label: string;
}

export interface Figure {
  kind: string;
  vertices: FigurePoint[];
  caption?: string;
  fill?: string;
  segments?: FigureSegment[];
  points?: FigurePointLabel[];
  labels?: FigureLabel[];
}

export interface FigureSpec {
  figures: Figure[];
  note?: string;
}

// Image spec
export interface ImageSpec {
  src: string;
  altText: string;
  caption?: string;
  credit?: string;
  photoFacts?: string[];
  supplementalText?: string[];
}

// Answer type
export type Answer =
  | { kind: 'integer'; value: number }
  | { kind: 'decimal'; value: number; decimalPlaces?: number }
  | { kind: 'fraction'; numerator: number; denominator: number }
  | { kind: 'fractions'; values: { numerator: number; denominator: number }[]; value?: number }
  | { kind: 'mixed'; whole: number; numerator: number; denominator: number }
  | { kind: 'string'; value: string };

// Solution step
export interface SolutionStep {
  expression?: string;
  explanation?: string;
  [key: string]: unknown;
}

// Problem type
export interface Problem {
  id: string;
  category: Category;
  type: string;
  difficulty: Difficulty;
  question: string;
  answer: Answer;
  explanation?: string;
  parameters: Record<string, unknown>;
  solutionSteps?: SolutionStep[];
  inputType?: AnswerInputType;
  choices?: string[];
  figure?: FigureSpec;
  image?: ImageSpec;
}

// Generation config
export interface GenerationConfig {
  category?: Category;
  type?: string;
  difficulty?: DifficultyLevel;
  seed?: number;
}

// Problem generator
export interface ProblemGenerator {
  readonly type: string;
  readonly category: Category;
  readonly description: string;
  generate(config?: GenerationConfig): Problem;
  validate(problem: Problem): ValidationResult;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Calculation type
export type CalculationType =
  | 'addition_1_1'
  | 'addition_2_1'
  | 'addition_2_2'
  | 'subtraction_1_1'
  | 'subtraction_2_1'
  | 'subtraction_2_2'
  | 'multiplication_1_1'
  | 'multiplication_2_1'
  | 'multiplication_2_2'
  | 'division_2_1';
