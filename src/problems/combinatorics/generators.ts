/**
 * 場合の数の問題ジェネレータ
 * 小学6年生の学習範囲:
 * - 並べ方・組み合わせ
 * - 樹形図・表による整理
 * - 条件付きの場合の数
 * - 重複を除く
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../types/problem';
import { createRandom, generateProblemId } from '../../utils/random';
import {
  createDifficulty,
  numberSizeToComplexity,
  calculationStepsToComplexity,
} from '../../engine/difficulty/difficulty';

function createCombDifficulty(
  level: DifficultyLevel,
  value: number,
  reasoningLevel: DifficultyLevel = 1,
  readingLevel: DifficultyLevel = 1,
) {
  return createDifficulty({
    calculationComplexity: calculationStepsToComplexity(level),
    numberComplexity: numberSizeToComplexity(value),
    reasoningComplexity: reasoningLevel,
    readingComplexity: readingLevel,
  });
}

/** 順列を数える nPr = n! / (n-r)! (小6なので小さい値のみ) */
function permutation(n: number, r: number): number {
  let result = 1;
  for (let i = 0; i < r; i++) {
    result *= n - i;
  }
  return result;
}

/** 組合せの数え上げ nCr */
function combination(n: number, r: number): number {
  if (r === 0) return 1;
  if (r > n) return 0;
  return permutation(n, r) / factorial(r);
}

/** 階乗 */
function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * 並べ方
 * 例: 3人から2人を並べる
 */
export class ArrangeSimpleGenerator implements ProblemGenerator {
  readonly type = 'arrange_simple';
  readonly category = 'combinatorics' as const;
  readonly description = '並べ方';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const n = rng.int(3, lv === 1 ? 4 : 5);
    const r = rng.int(2, n);
    const ans = permutation(n, r);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, n, 3, 1),
      question:
        n + '人から' + r + '人を選んで1列に並べます。並べ方は全部で何通りありますか',
      answer: { kind: 'integer', value: ans },
      explanation:
        n + '人から' + r + '人を選んで並べる並べ方は、' + ans + '通りです。',
      parameters: { n, r, answer: ans, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, r, answer } = problem.parameters as { n: number; r: number; answer: number };
    const expected = permutation(n, r);
    if (answer !== expected) errors.push('並べ方の数が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 組み合わせ
 * 例: 5人から2人を選ぶ
 */
export class CombineSimpleGenerator implements ProblemGenerator {
  readonly type = 'combine_simple';
  readonly category = 'combinatorics' as const;
  readonly description = '組み合わせ';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const n = rng.int(3, lv === 1 ? 5 : 7);
    const r = rng.int(2, lv === 1 ? 2 : 3);
    const ans = combination(n, r);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, n, 3, 1),
      question:
        n + '人の中から' + r + '人を選びます。選び方は何通りありますか',
      answer: { kind: 'integer', value: ans },
      explanation:
        n + '人から' + r + '人を選ぶ組み合わせは' + ans + '通りです。',
      parameters: { n, r, answer: ans, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, r, answer } = problem.parameters as { n: number; r: number; answer: number };
    const expected = combination(n, r);
    if (answer !== expected) errors.push('組み合わせの数が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 樹形図を利用する問題
 */
export class TreeDiagramGenerator implements ProblemGenerator {
  readonly type = 'arrange_tree';
  readonly category = 'combinatorics' as const;
  readonly description = '樹形図の利用';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const n = rng.int(3, 4);
    const ans = factorial(n);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, n, 3, 2),
      question:
        'A、B、C、Dの' + n + '個の文字をすべて1回ずつ使って、並べ方は何通りありますか',
      answer: { kind: 'integer', value: ans },
      explanation:
        '樹形図をかくと' + n + '×' + (n - 1) + '×...×1＝' + ans + '通りです。',
      parameters: { n, answer: ans, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, answer } = problem.parameters as { n: number; answer: number };
    if (answer !== factorial(n)) errors.push('並べ方の数が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 表を使った整理
 * 例: 4チームの総当たり戦
 */
export class CombineTableGenerator implements ProblemGenerator {
  readonly type = 'combine_table';
  readonly category = 'combinatorics' as const;
  readonly description = '表を使った組み合わせ';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const n = rng.int(4, lv === 1 ? 5 : 6);
    const ans = combination(n, 2);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, n, 3, 2),
      question:
        n + 'チームのサッカー大会で、どのチームとも1回ずつ試合をします。試合の数は何試合になりますか',
      answer: { kind: 'integer', value: ans },
      explanation:
        '表を使って数えると、' + n + '×(1つ分計算)＝' + ans + '試合です。',
      parameters: { n, answer: ans, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, answer } = problem.parameters as { n: number; answer: number };
    const expected = combination(n, 2);
    if (answer !== expected) errors.push('試合数の計算が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 重複を除く問題
 * 例: 同じ文字が入る並び順
 */
export class DuplicateRemovalGenerator implements ProblemGenerator {
  readonly type = 'duplicate_removal';
  readonly category = 'combinatorics' as const;
  readonly description = '重複を除く';

  generate(config?: GenerationConfig): Problem {
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // AAB のような順列
    // A, A, B → 3通り
    const ans = 3;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, 3, 3, 2),
      question: 'A、A、Bの3枚のカードをすべて使って並べます。何通りありますか',
      answer: { kind: 'integer', value: ans },
      explanation:
        'Aは2回で使い回すので、AAB, ABA, BAA の3通りです。',
      parameters: { letters: 'AAB', answer: ans, difficultyLevel: lv, duplicateCount: 2 },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { answer } = problem.parameters as { answer: number };
    if (answer !== 3) errors.push('重複を除いた並べ方が誤っています');
    return { valid: errors.length === 0, errors };
  }
}