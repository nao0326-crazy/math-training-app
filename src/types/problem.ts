/**
 * 問題の難易度を表す型
 * 単純なランダム値ではなく、複数の独立した要素から構成される
 */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface DifficultyRange {
  min: DifficultyLevel;
  max: DifficultyLevel;
}

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
  | 'combinatorics'
  /**
   * 現実連動 (写真・画像から情報を読み取って解く教材)。
   * 学習履歴の category は文字列なので、この追加は既存レコードと互換。
   */
  | 'realWorld';

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
 * 図形の表示仕様 (FigureSpec)
 *
 * generator 側は「数学的な座標」で図形を保持し、画面上の px は持たない。
 * 表示座標への変換は FigureRenderer の責務とすることで、
 * 将来の回転・反転・平行移動・拡大縮小にも同じ仕組みが使える。
 *
 * 座標系は通常の数学の座標系 (右が +x、上が +y) とし、
 * レンダラ側で画面座標 (下方向が +y) に変換する。
 */

/** 図形上の点 (数学座標系) */
export interface FigurePoint {
  x: number;
  y: number;
}

/** 図形の種別 */
export type FigureKind = 'triangle' | 'rectangle' | 'parallelogram' | 'polygon';

/** 点を丸く描き、名前を表示する指定 */
export interface FigurePointMark {
  /** 点の位置 */
  at: FigurePoint;
  /** 点の名前 (A, B, C など) */
  label?: string;
}

/** 線分と、その寸法表示 */
export interface FigureSegment {
  from: FigurePoint;
  to: FigurePoint;
  /** 線分の中点に表示する寸法 (例: '6cm') */
  label?: string;
}

/** ラベル (角度・注記など) */
export interface FigureLabel {
  at: FigurePoint;
  text: string;
  /** テキストの揃え */
  anchor?: 'start' | 'middle' | 'end';
}

/** 図形 1 つぶんの表示仕様 */
export interface Figure {
  /**
   * 頂点列。三角形・四角形・平行四辺形は 3点 / 4点、
   * polygon は任意の点数 (3点以上) を頂点順に並べる。
   */
  vertices: FigurePoint[];
  /** 図形の種別 (描画の補助情報。判定には vertices を使う) */
  kind: FigureKind;
  /** 図の見出し (例: '図A') */
  caption?: string;
  /** 塗り色 (未指定なら塗りなし) */
  fill?: string;
  /** 頂点の点と名前 */
  points?: FigurePointMark[];
  /** 追加の線分と寸法表示 */
  segments?: FigureSegment[];
  /** 追加のラベル (角度・注記など) */
  labels?: FigureLabel[];
}

/**
 * 問題に表示する図形の仕様。
 * 1つの問題に複数の図 (例: 合同判定の図Aと図B) を持てるよう figures を配列にする。
 */
export interface FigureSpec {
  /** 表示する図 (左から順に並べる) */
  figures: Figure[];
  /** 図形の注記 (例: '図は概略です') */
  note?: string;
}

/**
 * 現実連動教材の「写真」表示仕様 (ImageSpec)
 *
 * 写真を単なる装飾ではなく、「情報を読み取る教材」として扱うための構造。
 * - src は配布環境でも確実に表示できるよう、public/ からのルート相対パス
 *   (例: '/images/supermarket-shelf.svg') を用いる (外部サイトへの直リンクはしない)。
 * - altText は写真が表示できない環境でも解答に必要な情報 (商品名・価格など) を
 *   読み取れるように、内容を含めた代替テキストとする (後方互換・破綻防止)。
 * - photoFacts / supplementalText で「写真に写っている情報」と
 *   「問題文で補足する情報」を区別して保持する。
 *
 * 未設定 (image === undefined) のときは写真を表示せず、従来どおり
 * 問題文と解答UIのみを表示する (既存の全問題は image を持たないため挙動は変わらない)。
 */
export interface ImageSpec {
  /** 画像の参照先 (public/ からのルート相対パス。外部直リンクはしない) */
  src: string;
  /** 写真が表示できない環境でも解答できる代替テキスト (価格等の情報を含む) */
  altText: string;
  /** 写真の見出し (例: 'スーパーのお菓子コーナー') */
  caption?: string;
  /** 写真の出典・利用条件 (例: '本プロジェクト作成のオリジナル画像') */
  credit?: string;
  /** 写真に実際に写っている情報 (読み取りの対象。問題文に書かない) */
  photoFacts?: string[];
  /** 問題文で補足する情報 (写真には写っていない条件) */
  supplementalText?: string[];
}

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
  /**
   * この問題に付随する図形 (任意)。
   * 未設定のときは図形を表示せず、従来どおり問題文と解答UIのみを表示する。
   * (既存の生成器は figure を設定しないため、挙動は変わらない)
   */
  figure?: FigureSpec;
  /**
   * この問題に付随する現実連動の写真 (任意)。
   * 未設定のときは写真を表示せず、従来どおり問題文と解答UIのみを表示する。
   * 画像の読み込みに失敗しても解答・学習記録は破綻しない (altText に必要情報を含める)。
   * (既存の生成器は image を設定しないため、挙動は変わらない)
   */
  image?: ImageSpec;
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
