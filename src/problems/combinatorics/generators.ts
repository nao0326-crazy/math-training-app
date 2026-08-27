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

    // 難易度に応じて人数と選ぶ人数を変化させる
    const n = lv <= 1 ? rng.int(3, 4) : lv === 2 ? rng.int(3, 5) : lv === 3 ? rng.int(4, 6) : lv === 4 ? rng.int(5, 7) : rng.int(6, 8);
    const r = lv <= 1 ? rng.int(2, Math.min(3, n)) : lv === 2 ? rng.int(2, n) : lv === 3 ? rng.int(2, n) : lv === 4 ? rng.int(3, n) : rng.int(3, n);
    const ans = permutation(n, r);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, n, Math.min(3, lv) as DifficultyLevel, 1),
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

    // 難易度に応じて人数と選ぶ人数を変化させる
    const n = lv <= 1 ? rng.int(3, 5) : lv === 2 ? rng.int(3, 7) : lv === 3 ? rng.int(4, 8) : lv === 4 ? rng.int(5, 9) : rng.int(6, 10);
    const r = lv <= 1 ? rng.int(2, 2) : lv === 2 ? rng.int(2, 3) : lv === 3 ? rng.int(2, 3) : lv === 4 ? rng.int(3, 4) : rng.int(3, 4);
    const ans = combination(n, r);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, n, Math.min(3, lv) as DifficultyLevel, 1),
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

    // 難易度に応じて文字数を変化させる
    // (レベル1でも3人/4人の2通りを用意し、問題が固定しないようにする)
    const n = lv <= 1 ? rng.int(3, 4) : lv === 2 ? rng.int(4, 5) : lv === 3 ? rng.int(4, 5) : lv === 4 ? rng.int(5, 6) : rng.int(5, 6);
    const ans = factorial(n);
    // 文字リストは個数 n に合わせて作る (固定の4文字だと n≠4 のとき問題文が不成立になる)
    const LETTERS = 'ABCDEFGH'.split('');
    const letters = LETTERS.slice(0, n).join('、');

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, n, Math.min(3, lv) as DifficultyLevel, Math.min(2, lv) as DifficultyLevel),
      question:
        letters + 'の' + n + '個の文字をすべて1回ずつ使って、並べ方は何通りありますか',
      answer: { kind: 'integer', value: ans },
      explanation:
        '樹形図をかくと' + n + '×' + (n - 1) + '×...×1＝' + ans + '通りです。',
      parameters: { n, letters, answer: ans, difficultyLevel: lv },
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

    // 難易度に応じてチーム数を変化させる
    const n = lv <= 1 ? rng.int(4, 5) : lv === 2 ? rng.int(4, 6) : lv === 3 ? rng.int(5, 7) : lv === 4 ? rng.int(6, 8) : rng.int(7, 9);
    const ans = combination(n, 2);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(lv, n, Math.min(3, lv) as DifficultyLevel, Math.min(2, lv) as DifficultyLevel),
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
/**
 * 重複を除く問題
 * 例: 同じ文字が入る並び順
 * 難易度に応じて文字カードの構成を変え、答えが常に同じにならないようにする。
 * 答えは異なる並びを全列挙して数えるため、検証と必ず一致する。
 */

/** 重複あり順列の異なる並び方の数を数える (小6範囲なので全列挙でよい) */
function countDistinctArrangements(cards: string[]): number {
  const seen = new Set<string>();
  const permute = (current: string[], remaining: string[]): void => {
    if (remaining.length === 0) {
      seen.add(current.join(''));
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i]);
      permute(current, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
      current.pop();
    }
  };
  permute([], cards);
  return seen.size;
}

/** 難易度ごとのカード構成候補 (すべて重複を含む) */
const DUPLICATE_CARD_PATTERNS: Record<DifficultyLevel, string[][]> = {
  1: [['A', 'A', 'B'], ['A', 'B', 'B'], ['A', 'A', 'C']],
  2: [
    ['A', 'A', 'B'],
    ['A', 'B', 'B'],
    ['A', 'A', 'B', 'B'],
    ['A', 'A', 'A', 'B'],
  ],
  3: [
    ['A', 'A', 'B', 'B'],
    ['A', 'A', 'A', 'B'],
    ['A', 'A', 'B', 'C'],
    ['A', 'B', 'B', 'C'],
  ],
  4: [
    ['A', 'A', 'B', 'B', 'C'],
    ['A', 'A', 'A', 'B', 'C'],
    ['A', 'A', 'B', 'C', 'D'],
    ['A', 'A', 'A', 'B', 'B'],
  ],
  5: [
    ['A', 'A', 'A', 'B', 'B', 'C'],
    ['A', 'A', 'B', 'B', 'C', 'C'],
    ['A', 'A', 'A', 'B', 'C', 'D'],
    ['A', 'A', 'B', 'B', 'B', 'C'],
  ],
};

export class DuplicateRemovalGenerator implements ProblemGenerator {
  readonly type = 'duplicate_removal';
  readonly category = 'combinatorics' as const;
  readonly description = '重複を除く';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度ごとの候補から1つ選び、答えは全列挙で確定させる
    const pool = DUPLICATE_CARD_PATTERNS[lv];
    const cards = rng.pick(pool);
    const ans = countDistinctArrangements(cards);
    const cardText = cards.join('、');
    // 重複している文字の説明用
    const counts = new Map<string, number>();
    for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
    const duplicatedLetters = [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .map(([c]) => c);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(
        lv,
        cards.length,
        Math.min(3, lv) as DifficultyLevel,
        Math.min(2, lv) as DifficultyLevel,
      ),
      question:
        cardText +
        'の' +
        cards.length +
        '枚のカードをすべて使って一列に並べます。同じ文字は区別できないとして、並べ方は何通りありますか',
      answer: { kind: 'integer', value: ans },
      explanation:
        duplicatedLetters.map((c) => c + 'が2枚以上あります').join('、') +
        'ので、重複する並びを取り除いて数えると' +
        ans +
        '通りです。',
      parameters: { letters: cards, answer: ans, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { letters, answer } = problem.parameters as {
      letters: string[];
      answer: number;
    };
    if (!Array.isArray(letters) || letters.length === 0) {
      errors.push('カードの構成がありません');
      return { valid: false, errors };
    }
    const expected = countDistinctArrangements(letters);
    if (answer !== expected) errors.push('重複を除いた並べ方が誤っています');
    return { valid: errors.length === 0, errors };
  }
}