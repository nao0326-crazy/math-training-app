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
 * 最も高いものをそのまま総合難易度とする (最大値基準)。
 *
 * 各ジェネレータは指定難易度を主成分 (多くの場合 calculationComplexity) に
 * 反映してパラメータを変化させているため、最大値基準で一貫させることで
 * 「指定難易度 = 実際の難易度」が全問題タイプで成立する。
 * (例: calculationComplexity=2 / 他=1 の問題は、2段階計算のレベル2問題)
 */
export function calculateDifficultyLevel(components: DifficultyComponents): DifficultyLevel {
  const values = [
    components.calculationComplexity,
    components.numberComplexity,
    components.reasoningComplexity,
    components.readingComplexity,
  ];
  return Math.max(...values) as DifficultyLevel;
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