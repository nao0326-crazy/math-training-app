/**
 * 問題類似度スコアリング
 *
 * 2つの問題メタデータの「数学的構造の似てそうさ」を数値化する。
 * 重みは要件#8に基づき、family と subtype を最も重視する。
 *
 * 閾値 HIGH_SIMILARITY_THRESHOLD 以上なら「直近問題とかなり似ている」と判定する。
 */

import type { ProblemMetadata } from './metadata';

/** 各次元の重み ( family > subtype > operation/numberPattern > ... ) */
export const SIMILARITY_WEIGHTS = {
  unit: 1,
  family: 4,
  subtype: 3,
  operation: 2,
  numberPattern: 2,
  steps: 1,
  context: 1,
} as const;

/** 「かなり似ている」と判定する類似度閾値 */
export const HIGH_SIMILARITY_THRESHOLD = 7;

/**
 * 2つのメタデータの類似度スコアを計算する
 * (両方に値がある場合のみ加点)
 */
export function similarityScore(a: ProblemMetadata, b: ProblemMetadata): number {
  let score = 0;
  if (a.unit === b.unit && a.unit !== 'unknown') {
    score += SIMILARITY_WEIGHTS.unit;
  }
  if (a.family === b.family) {
    score += SIMILARITY_WEIGHTS.family;
  }
  if (a.subtype && b.subtype && a.subtype === b.subtype) {
    score += SIMILARITY_WEIGHTS.subtype;
  }
  if (a.operation && b.operation && a.operation === b.operation) {
    score += SIMILARITY_WEIGHTS.operation;
  }
  if (
    a.numberPattern &&
    b.numberPattern &&
    a.numberPattern === b.numberPattern
  ) {
    score += SIMILARITY_WEIGHTS.numberPattern;
  }
  if (a.steps && b.steps && a.steps === b.steps) {
    score += SIMILARITY_WEIGHTS.steps;
  }
  if (a.context && b.context && a.context === b.context) {
    score += SIMILARITY_WEIGHTS.context;
  }
  return score;
}
