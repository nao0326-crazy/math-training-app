/**
 * 難易度システムのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDifficultyLevel,
  createDifficulty,
  clampLevel,
  numberSizeToComplexity,
  calculationStepsToComplexity,
  difficultyLabel,
} from './difficulty';

describe('calculateDifficultyLevel', () => {
  it('全コンポーネントが低い場合は1', () => {
    const level = calculateDifficultyLevel({
      calculationComplexity: 1,
      numberComplexity: 1,
      reasoningComplexity: 1,
      readingComplexity: 1,
    });
    expect(level).toBe(1);
  });

  it('主成分が2のみの場合は2になる (単一成分による降格なし)', () => {
    const level = calculateDifficultyLevel({
      calculationComplexity: 2,
      numberComplexity: 1,
      reasoningComplexity: 1,
      readingComplexity: 1,
    });
    expect(level).toBe(2);
  });

  it('全コンポーネントが中程度の場合は2〜3', () => {
    const level = calculateDifficultyLevel({
      calculationComplexity: 2,
      numberComplexity: 2,
      reasoningComplexity: 2,
      readingComplexity: 2,
    });
    expect(level).toBe(2);
  });

  it('最大値が4以上の場合は最大値基準', () => {
    const level = calculateDifficultyLevel({
      calculationComplexity: 4,
      numberComplexity: 1,
      reasoningComplexity: 1,
      readingComplexity: 1,
    });
    expect(level).toBe(4);
  });

  it('最大値が5の場合は5', () => {
    const level = calculateDifficultyLevel({
      calculationComplexity: 5,
      numberComplexity: 5,
      reasoningComplexity: 5,
      readingComplexity: 5,
    });
    expect(level).toBe(5);
  });

  it('平均が3以上の場合は3', () => {
    const level = calculateDifficultyLevel({
      calculationComplexity: 3,
      numberComplexity: 3,
      reasoningComplexity: 3,
      readingComplexity: 3,
    });
    expect(level).toBe(3);
  });
});

describe('createDifficulty', () => {
  it('難易度を作成する', () => {
    const difficulty = createDifficulty({
      calculationComplexity: 2,
      numberComplexity: 3,
      reasoningComplexity: 1,
      readingComplexity: 1,
    });
    expect(difficulty.level).toBeGreaterThanOrEqual(1);
    expect(difficulty.level).toBeLessThanOrEqual(5);
    expect(difficulty.components.calculationComplexity).toBe(2);
    expect(difficulty.components.numberComplexity).toBe(3);
  });
});

describe('clampLevel', () => {
  it('範囲内の値はそのまま', () => {
    expect(clampLevel(1)).toBe(1);
    expect(clampLevel(3)).toBe(3);
    expect(clampLevel(5)).toBe(5);
  });

  it('範囲外の値はクランプされる', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(6)).toBe(5);
    expect(clampLevel(-1)).toBe(1);
  });

  it('小数は四捨五入される', () => {
    expect(clampLevel(2.4)).toBe(2);
    expect(clampLevel(2.5)).toBe(3);
  });
});

describe('numberSizeToComplexity', () => {
  it('桁数に応じた複雑さを返す', () => {
    expect(numberSizeToComplexity(5)).toBe(1);
    expect(numberSizeToComplexity(50)).toBe(2);
    expect(numberSizeToComplexity(500)).toBe(3);
    expect(numberSizeToComplexity(5000)).toBe(4);
    expect(numberSizeToComplexity(50000)).toBe(5);
  });

  it('負の数も絶対値で判定する', () => {
    expect(numberSizeToComplexity(-5)).toBe(1);
    expect(numberSizeToComplexity(-500)).toBe(3);
  });
});

describe('calculationStepsToComplexity', () => {
  it('ステップ数に応じた複雑さを返す', () => {
    expect(calculationStepsToComplexity(1)).toBe(1);
    expect(calculationStepsToComplexity(2)).toBe(2);
    expect(calculationStepsToComplexity(3)).toBe(3);
    expect(calculationStepsToComplexity(4)).toBe(4);
    expect(calculationStepsToComplexity(5)).toBe(5);
  });
});

describe('difficultyLabel', () => {
  it('日本語のラベルを返す', () => {
    expect(difficultyLabel(1)).toBe('かんたん');
    expect(difficultyLabel(2)).toBe('ふつう');
    expect(difficultyLabel(3)).toBe('ややむずかしい');
    expect(difficultyLabel(4)).toBe('むずかしい');
    expect(difficultyLabel(5)).toBe('チャレンジ');
  });
});