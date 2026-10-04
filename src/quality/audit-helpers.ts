import type { Problem } from '../types/problem';

export function inspectProblem(problem: Problem): string[] {
  const issues: string[] = [];

  if (problem.answer.kind === 'integer') {
    if (!Number.isInteger(problem.answer.value)) {
      issues.push(`整数問題の答えが整数ではない: ${problem.answer.value}`);
    }
    if (Math.abs(problem.answer.value) > 1000000) {
      issues.push(`正解が巨大すぎる: ${problem.answer.value}`);
    }
  }

  if (problem.answer.kind === 'fraction') {
    if (problem.answer.denominator === 0) {
      issues.push('分数の分母が0');
    }
    if (problem.answer.denominator < 0) {
      issues.push('分数の分母が負数');
    }
    if (!Number.isInteger(problem.answer.numerator) || !Number.isInteger(problem.answer.denominator)) {
      issues.push('分数の分子・分母が整数ではない');
    }
  }

  if (problem.answer.kind === 'mixed') {
    if (problem.answer.denominator === 0) {
      issues.push('帯分数の分母が0');
    }
    if (problem.answer.denominator < 0) {
      issues.push('帯分数の分母が負数');
    }
  }

  if (problem.answer.kind === 'fractions') {
    for (const frac of problem.answer.values) {
      if (frac.denominator === 0) {
        issues.push('複数分数の分母が0');
      }
      if (frac.denominator < 0) {
        issues.push('複数分数の分母が負数');
      }
    }
  }

  if (!problem.question || problem.question.length < 5) {
    issues.push('問題文が短すぎる');
  }

  if (problem.answer.kind === 'string' && problem.answer.value === '') {
    issues.push('正解が空文字列');
  }

  if (problem.answer.kind === 'decimal') {
    if (!Number.isFinite(problem.answer.value)) {
      issues.push('小数の答えが有限ではない');
    }
    if (Math.abs(problem.answer.value) > 1000000) {
      issues.push(`小数の答えが巨大すぎる: ${problem.answer.value}`);
    }
  }

  if (problem.difficulty.level < 1 || problem.difficulty.level > 5) {
    issues.push(`難易度が範囲外: ${problem.difficulty.level}`);
  }

  if (!problem.category) {
    issues.push('カテゴリが未設定');
  }
  if (!problem.type) {
    issues.push('タイプが未設定');
  }

  return issues;
}

export function inspectJapanese(problem: Problem): string[] {
  const issues: string[] = [];
  const question = problem.question;

  if (!question.includes('問') && !question.includes('求め') && !question.includes('答え') &&
      !question.includes('計算') && !question.includes('考え') && !question.includes('ひき') &&
      !question.includes('たし') && !question.includes('かけ') && !question.includes('わり') &&
      !question.includes('表') && !question.includes('比べ') && !question.includes('分け') &&
      !question.includes('買') && !question.includes('作') && !question.includes('使') &&
      !question.includes('残') && !question.includes('運') && !question.includes('塗') &&
      !question.includes('体積') && !question.includes('面積') && !question.includes('周') &&
      !question.includes('簡単') && !question.includes('同じ')) {
    if (question.length < 10) {
      issues.push('問題文の指示が不明確');
    }
  }

  return issues;
}

export function inspectEducation(problem: Problem): string[] {
  const issues: string[] = [];

  if (problem.answer.kind === 'integer' && Math.abs(problem.answer.value) > 100000) {
    issues.push('小学6年生として計算結果が大きすぎる');
  }

  return issues;
}