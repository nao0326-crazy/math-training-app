/**
 * 重点監査テスト
 * SpeedWordGenerator, DecimalDivDecimalGenerator, FractionBigSmallGenerator, RatioSimplifyGenerator
 */

import type { Problem } from '../types/problem';

// 問題を評価する関数
export function evaluateProblem(problem: Problem): { issues: string[]; examples: string[] } {
  const issues: string[] = [];
  const examples: string[] = [];

  // ① 数学的に正しいか
  if (problem.answer.kind === 'integer' && !Number.isInteger(problem.answer.value)) {
    issues.push(`整数問題の答えが整数ではない: ${problem.answer.value}`);
  }
  if (problem.answer.kind === 'fraction' && problem.answer.denominator === 0) {
    issues.push('分数の分母が0');
  }

  // ② 問題として成立しているか
  if (!problem.question || problem.question.length < 5) {
    issues.push('問題文が短すぎる');
  }
  if (problem.answer.kind === 'string' && problem.answer.value === '') {
    issues.push('正解が空文字列');
  }

  // ③ 小学6年生向けとして適切か
  if (problem.answer.kind === 'integer' && Math.abs(problem.answer.value) > 100000) {
    issues.push('小学6年生として計算結果が大きすぎる');
  }

  // ④ 日本語として自然か
  if (problem.question.includes('倍速')) {
    issues.push('「倍速」という表現が不自然（「2倍の速さ」が自然）');
  }

  // 小数の丸め指示チェック
  if (problem.category === 'decimal' && problem.type === 'decimal_div_decimal') {
    if (!problem.question.includes('四捨五入') && !problem.question.includes('丸め')) {
      issues.push('小数÷小数の問題に丸め方の指示がない');
    }
  }

  examples.push(`問題: ${problem.question}`);
  examples.push(`正解: ${JSON.stringify(problem.answer)}`);
  examples.push(`解説: ${problem.explanation}`);

  return { issues, examples };
}