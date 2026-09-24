/**
 * 問題の難易度を表す型
 * 単純なランダム値ではなく、複数の独立した要素から構成される
 */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

/**
 * 難易度を構成する独立した要素
 */
export interface DifficultyComponents {
  /** 計算の複雑さ (桁数、計算ステップ数など) */
  calculationComplexity: DifficultyLevel;
  /** 数値の大きさ・複雑さ */
  numberComplexity: DifficultyLevel;
  /** 思考・推論の複雑さ */
  reasoningComplexity: DifficultyLevel;
  /** 文章読解の複雑さ */
  readingComplexity: DifficultyLevel;
}

/**
 * 総合難易度
 */
export interface Difficulty {
  level: DifficultyLevel;
  components: DifficultyComponents;
}

/**
 * 解答の型
 * 数値・分数・文字列など、問題タイプに応じて異なる
 */
export type Answer =
  | { kind: 'integer'; value: number }
  | { kind: 'decimal'; value: number }
  | { kind: 'fraction'; numerator: number; denominator: number }
  | { kind: 'string'; value: string }
  | { kind: 'mixed'; whole: number; numerator: number; denominator: number }
  /**
   * 複数分数の解答 (通分など)。
   * 文字列として "15/20 と 8/20" を保存する代わりに、数学的構造を保持する。
   * values は標準形 (通分後の分子・共通分母) をこの順で格納する。
   */
  | { kind: 'fractions'; values: { numerator: number; denominator: number }[] };

/**
 * 問題のカテゴリ
 * 小学6年生の学習範囲に対応
 */
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
  | 'combinatorics';

/**
 * 解法の1ステップ (途中式)
 * expression には計算過程の式、explanation にはそのステップの説明を入れる。
 * どちらか片方だけでもよい (説明だけのステップも許容する)。
 */
export interface SolutionStep {
  /** 計算式など、途中の式・値 (例: "24 × 3/8 = 9") */
  expression?: string;
  /** このステップで何をするかの説明 (例: "使ったりんごの数をもとめます") */
  explanation?: string;
}

/**
 * 入力UIの種類
 *
 * 問題が「どのような構造の回答を要求するか」を answer.kind とは独立に示す。
 * answer.kind === "string" でも ratio / expression / choice / list など、
 * 問題タイプに応じた専用UIへ明示的に振り分けるために使う。
 */
export type AnswerInputType =
  | 'integer' // 整数入力 (数字のみ)
  | 'decimal' // 小数入力 (数字 + 小数点)
  | 'fraction' // 分数入力 (分子・分母)
  | 'mixed' // 帯分数入力 (整数部・分子・分母)
  | 'fraction-list' // 複数分数入力 (通分など: 分数ごとに分子・分母)
  | 'ratio' // 比入力 (左:右を分離)
  | 'expression' // 文字式入力 (x・×・÷・= など)
  | 'choice' // 選択式入力 (choices から選ぶ)
  | 'list' // 複数値リスト入力 (約数・倍数などカンマ区切り)
  | 'yesno' // はい/いいえ選択
  | 'string'; // その他のテキスト入力

/**
 * 問題の基本構造
 * 問題文だけでなく、生成条件 (parameters) を保持する
 */
export interface Problem {
  id: string;
  category: Category;
  type: string;
  difficulty: Difficulty;
  question: string;
  answer: Answer;
  explanation?: string;
  /** この問題がどのような数学的条件から生成されたか */
  parameters: Record<string, unknown>;
  /**
   * 答えに至る途中式 (答えを開示したときに表示する)
   * 問題生成と同じパラメータから生成されるため、常に正解と一致する
   */
  solutionSteps?: SolutionStep[];
  /**
   * 入力UIの種類 (任意)。省略時は answer.kind と問題タイプから推定される。
   * 問題タイプ単位で専用UI (比・文字式・選択・リスト) を明示するために使う。
   */
  inputType?: AnswerInputType;
  /**
   * choice (選択式) 問題の選択肢。fraction_big_small やデータ比較などで
   * 問題文の文字列検索に頼らずに選択ボタンを出すための明示的な選択肢。
   */
  choices?: string[];
}

/**
 * 問題生成の設定
 */
export interface GenerationConfig {
  category?: Category;
  type?: string;
  difficulty?: DifficultyLevel;
  /** 問題生成のシード値 (テスト用) */
  seed?: number;
}

/**
 * 問題生成ルールの定義
 * 各問題タイプはこのインターフェースを実装する
 */
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
