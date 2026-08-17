/**
 * 難易度システム
 * calculationComplexity / numberComplexity / reasoningComplexity / readingComplexity の
 * 4つの独立した要素から総合難易度を決定する
 */

import type {
  Difficulty,
  DifficultyComponents,
  DifficultyLevel,
} from '../../types/problem';

/**
 * 難易度コンポーネントから総合レベルを計算する
 *
 * 計算ステップ数・数値の大きさ・推論量・読解量のうち、
 * いずれかが高ければその問題はそれに応じて難しいと判定する。
 * 最大値が3以上ならその最大値を総合難易度に採用する。
 */
export function calculateDifficultyLevel(components: DifficultyComponents): DifficultyLevel {
  const values = [
    components.calculationComplexity,
    components.numberComplexity,
    components.reasoningComplexity,
    components.readingComplexity,
  ];
  const max = Math.max(...values);

  // 最大値が3以上なら最大値を総合難易度とする
  // (計算ステップ数・桁数・推論量・読解量のいずれかが高ければ、その問題はそれに応じて難しい)
  if (max >= 3) {
    return max as DifficultyLevel;
  }

  // 最大値が2の場合: 複数の要素が2以上なら「ふつう」、1つだけなら「かんたん」
  if (max === 2) {
    const countHigher = values.filter((v) => v >= 2).length;
    return (countHigher >= 2 ? 2 : 1) as DifficultyLevel;
  }

  // すべて1なら「かんたん」
  return 1 as DifficultyLevel;
}

/**
 * 難易度を作成する
 */
export function createDifficulty(components: DifficultyComponents): Difficulty {
  return {
    level: calculateDifficultyLevel(components),
    components,
  };
}

/**
 * コンポーネントの値をクランプする
 */
export function clampLevel(value: number): DifficultyLevel {
  return Math.max(1, Math.min(5, Math.round(value))) as DifficultyLevel;
}

/**
 * 数値の桁数から数値の複雑さを推定する
 * 1桁: 1, 2桁: 2, 3桁: 3, 4桁以上: 4-5
 */
export function numberSizeToComplexity(value: number): DifficultyLevel {
  const abs = Math.abs(value);
  if (abs < 10) return 1;
  if (abs < 100) return 2;
  if (abs < 1000) return 3;
  if (abs < 10000) return 4;
  return 5;
}

/**
 * 計算ステップ数から計算の複雑さを推定する
 */
export function calculationStepsToComplexity(steps: number): DifficultyLevel {
  if (steps <= 1) return 1;
  if (steps === 2) return 2;
  if (steps === 3) return 3;
  if (steps === 4) return 4;
  return 5;
}

/**
 * 難易度レベルを日本語表記に変換
 */
export function difficultyLabel(level: DifficultyLevel): string {
  switch (level) {
    case 1:
      return 'かんたん';
    case 2:
      return 'ふつう';
    case 3:
      return 'ややむずかしい';
    case 4:
      return 'むずかしい';
    case 5:
      return 'チャレンジ';
  }
}