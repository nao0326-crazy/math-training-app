/**
 * 整数問題生成の共通ヘルパー
 */

import type { DifficultyLevel } from '../../../types/problem';
import {
  createDifficulty,
  numberSizeToComplexity,
  calculationStepsToComplexity,
  clampLevel,
} from '../../../engine/difficulty/difficulty';
import type { SeededRandom } from '../../../utils/random';

/**
 * 難易度レベルに応じた数値範囲を取得する
 */
export function getNumberRange(level: DifficultyLevel): { min: number; max: number } {
  switch (level) {
    case 1:
      return { min: 1, max: 9 };
    case 2:
      return { min: 2, max: 20 };
    case 3:
      return { min: 10, max: 99 };
    case 4:
      return { min: 100, max: 999 };
    case 5:
      return { min: 100, max: 9999 };
  }
}

/**
 * 見積り問題専用の難易度を作成する
 *
 * 見積り問題では、**絶対的な計算結果の大きさではなく「丸める位（精度の粗さ）」が
 * 学習上の負荷になる**。そこで numberComplexity には numberSizeToComplexity に
 * 「丸める位」を渡した値を入れる（十の位 -> 2、百の位 -> 3、千の位 -> 4）。
 *
 * numberSizeToComplexity 自体は変更していない。通常の生成器は従来どおり絶対値で
 * 評価し、このヘルパーは見積り問題からのみ呼び出す。
 */
export function createEstimateDifficulty(options: {
  /** 要求された難易度レベル */
  level: DifficultyLevel;
  /** 丸める位 (10 = 十の位, 100 = 百の位)。複数ある場合は最も粗いものを渡す。 */
  roundPlace: number;
  /** 思考の負荷 (丸める手順数・判断の要否など) */
  reasoningLevel?: DifficultyLevel;
  /** 文章読解の負荷 */
  readingLevel?: DifficultyLevel;
}) {
  return createDifficulty({
    // 要求レベルを calculation に対応させる (既存の area generator と同じ方針)
    calculationComplexity: calculationStepsToComplexity(options.level),
    // 絶対値ではなく丸める位数 (精度の粗さ) で評価する
    numberComplexity: numberSizeToComplexity(options.roundPlace),
    // 他は要求レベルを超えないようにする
    reasoningComplexity: Math.min(options.level, options.reasoningLevel ?? 1) as DifficultyLevel,
    readingComplexity: Math.min(options.level, options.readingLevel ?? 1) as DifficultyLevel,
  });
}

/**
 * 難易度レベルに応じた加算の数値範囲
 * 答えが大きくなりすぎないように制御する
 */
export function getAdditionRange(level: DifficultyLevel): { min: number; max: number } {
  switch (level) {
    case 1:
      return { min: 1, max: 9 };
    case 2:
      return { min: 2, max: 20 };
    case 3:
      return { min: 10, max: 50 };
    case 4:
      return { min: 20, max: 100 };
    case 5:
      return { min: 50, max: 200 };
  }
}

/**
 * 難易度レベルに応じた乗算の数値範囲
 */
export function getMultiplicationRange(level: DifficultyLevel): { min: number; max: number } {
  switch (level) {
    case 1:
      return { min: 1, max: 9 };
    case 2:
      return { min: 2, max: 9 };
    case 3:
      return { min: 2, max: 12 };
    case 4:
      return { min: 3, max: 20 };
    case 5:
      return { min: 5, max: 30 };
  }
}

/**
 * 難易度レベルに応じた除算の数値範囲
 * 割り切れる問題のみ生成する
 */
export function getDivisionRange(level: DifficultyLevel): { min: number; max: number } {
  switch (level) {
    case 1:
      return { min: 1, max: 9 };
    case 2:
      return { min: 2, max: 12 };
    case 3:
      return { min: 2, max: 20 };
    case 4:
      return { min: 3, max: 30 };
    case 5:
      return { min: 5, max: 50 };
  }
}

/**
 * 割り切れる除算問題を生成する
 * 除数 × 商 = 被除数 の形で生成する
 */
export function generateDivision(
  rng: SeededRandom,
  level: DifficultyLevel,
): { dividend: number; divisor: number; quotient: number } {
  const range = getDivisionRange(level);
  const divisor = rng.int(range.min, range.max);
  const quotient = rng.int(range.min, range.max);
  const dividend = divisor * quotient;
  return { dividend, divisor, quotient };
}

/**
 * 難易度に応じた問題の難易度コンポーネントを作成する
 */
export function createIntegerDifficulty(
  level: DifficultyLevel,
  a: number,
  b: number,
  reasoningLevel: DifficultyLevel = level >= 2 ? 2 : 1,
  readingLevel: DifficultyLevel = level >= 3 ? 2 : 1,
) {
  const calcLevel = clampLevel(level);
  const numLevel = clampLevel(Math.max(numberSizeToComplexity(a), numberSizeToComplexity(b)));
  return createDifficulty({
    calculationComplexity: calcLevel,
    numberComplexity: numLevel,
    reasoningComplexity: reasoningLevel,
    readingComplexity: readingLevel,
  });
}

/**
 * 複数項計算の難易度を作成する
 * level を指定すると計算の複雑さをそのレベルに合わせる
 */
export function createMultiStepDifficulty(
  stepCount: number,
  maxNumber: number,
  reasoningLevel: DifficultyLevel = 1,
  readingLevel: DifficultyLevel = 1,
  level?: DifficultyLevel,
) {
  return createDifficulty({
    calculationComplexity: level ?? calculationStepsToComplexity(stepCount),
    numberComplexity: numberSizeToComplexity(maxNumber),
    reasoningComplexity: reasoningLevel,
    readingComplexity: readingLevel,
  });
}

/**
 * 演算子の日本語表記
 */
export const OPERATOR_JAPANESE: Record<string, string> = {
  '+': '＋',
  '-': '−',
  '×': '×',
  '÷': '÷',
};

/**
 * 計算式を日本語の文章に変換する
 * 例: 12 + 5 = ? -> 12に5をたすといくつになりますか
 */
export function expressionToJapanese(a: number, op: string, b: number): string {
  switch (op) {
    case '+':
      return `${a}に${b}をたすといくつになりますか`;
    case '-':
      return `${a}から${b}をひくといくつになりますか`;
    case '×':
      return `${a}に${b}をかけるといくつになりますか`;
    case '÷':
      return `${a}を${b}でわると、商はいくつになりますか`;
    default:
      return `${a} ${op} ${b} はいくつですか`;
  }
}