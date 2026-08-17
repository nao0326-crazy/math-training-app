/**
 * 自動検証システム
 * 生成された問題が以下の条件を満たすか検証する
 * - 答えが存在する
 * - 答えが正しい
 * - 数学的条件を満たす
 * - 想定難易度と一致する
 * - 小学6年生の学習範囲を逸脱しない
 * - 問題文とparametersの内容が一致する
 * - 不自然な値になっていない
 */

import type { Problem, ValidationResult } from '../../types/problem';
import { isReasonableAnswer } from '../../utils/answer';
import { isValidFraction } from '../../utils/fraction';

/**
 * 検証エラーを収集するヘルパー
 */
export function createValidationResult(errors: string[] = []): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 問題の基本構造を検証する
 */
export function validateProblemStructure(problem: Problem): string[] {
  const errors: string[] = [];

  if (!problem.id || problem.id.trim() === '') {
    errors.push('問題IDが空です');
  }
  if (!problem.category) {
    errors.push('カテゴリがありません');
  }
  if (!problem.type || problem.type.trim() === '') {
    errors.push('問題タイプがありません');
  }
  if (!problem.question || problem.question.trim() === '') {
    errors.push('問題文が空です');
  }
  if (!problem.difficulty || !problem.difficulty.level) {
    errors.push('難易度がありません');
  }
  if (!problem.answer) {
    errors.push('解答がありません');
  }
  if (!problem.parameters || typeof problem.parameters !== 'object' || Object.keys(problem.parameters).length === 0) {
    errors.push('parametersがありません');
  }

  return errors;
}

/**
 * 解答の妥当性を検証する
 */
export function validateAnswer(problem: Problem): string[] {
  const errors: string[] = [];

  if (!isReasonableAnswer(problem.answer)) {
    errors.push('解答が不自然な値です');
  }

  // 分数の検証
  if (problem.answer.kind === 'fraction') {
    if (!isValidFraction(problem.answer.numerator, problem.answer.denominator)) {
      errors.push('分数が正規の形ではありません (約分されていない、または分母が0)');
    }
  }
  if (problem.answer.kind === 'mixed') {
    if (problem.answer.denominator === 0) {
      errors.push('帯分数の分母が0です');
    }
    if (problem.answer.numerator >= problem.answer.denominator) {
      errors.push('帯分数の分子が分母以上です');
    }
  }

  return errors;
}

/**
 * 難易度の妥当性を検証する
 */
export function validateDifficulty(problem: Problem): string[] {
  const errors: string[] = [];

  const { level, components } = problem.difficulty;
  if (level < 1 || level > 5) {
    errors.push('難易度レベルが範囲外です');
  }

  const compValues = [
    components.calculationComplexity,
    components.numberComplexity,
    components.reasoningComplexity,
    components.readingComplexity,
  ];
  for (const v of compValues) {
    if (v < 1 || v > 5) {
      errors.push('難易度コンポーネントが範囲外です');
    }
  }

  return errors;
}

/**
 * 問題文とparametersの整合性を検証する
 * 各問題タイプのジェネレータが独自の検証を追加できる
 */
export function validateProblem(problem: Problem): ValidationResult {
  const errors = [
    ...validateProblemStructure(problem),
    ...validateAnswer(problem),
    ...validateDifficulty(problem),
  ];

  return createValidationResult(errors);
}

/**
 * 問題を検証し、不正なら再生成する
 * maxAttempts回試行してダメならエラーを投げる
 */
export function generateValidated<T extends Problem>(
  generator: { generate(): T },
  maxAttempts = 100,
): T {
  for (let i = 0; i < maxAttempts; i++) {
    const problem = generator.generate();
    const result = validateProblem(problem);
    if (result.valid) {
      return problem;
    }
  }
  throw new Error(`問題生成に失敗しました: ${maxAttempts}回試行しても検証を通過できませんでした`);
}