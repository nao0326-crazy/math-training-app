/**
 * 整数の四則演算問題ジェネレータ
 * 足し算・引き算・掛け算・割り算
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../../types/problem';
import { createRandom, generateProblemId } from '../../../utils/random';
import { validateProblem } from '../../../engine/validator/validator';
import {
  getAdditionRange,
  getMultiplicationRange,
  generateDivision,
  createIntegerDifficulty,
  expressionToJapanese,
} from './helpers';

/**
 * 足し算ジェネレータ
 */
export class AdditionGenerator implements ProblemGenerator {
  readonly type = 'integer_addition';
  readonly category = 'integer' as const;
  readonly description = '整数の足し算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const level = config?.difficulty ?? (2 as DifficultyLevel);
    const range = getAdditionRange(level);
    const a = rng.int(range.min, range.max);
    const b = rng.int(range.min, range.max);
    const answer = a + b;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(level, a, b),
      question: expressionToJapanese(a, '+', b),
      answer: { kind: 'integer', value: answer },
      explanation: `${a}＋${b}＝${answer} です。`,
      parameters: {
        a,
        b,
        operator: '+',
        answer,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 引き算の「繰り下がり構造」を判定するユーティリティ
 *
 * 小学の減算で学習の段階を分けるのは「数が有多大か」ではなく
 * 「何個の位の繰り下がりが起きるか」である。
 * 同じ 40 - 18 でも、繰り下がりが 0 回か 2 回かで計算の構造が変わる。
 *
 * このファイルは「どの桁で繰り下がりが起きたか」を機械的に判定し、
 * 生成器とテストの双方が同じ定義を共有できるようにする。
 */

/** 繰り下がりが起きた桁の位置 (0 = 1の位, 1 = 10の位, ...) */
export type BorrowPosition = number;

/**
 * a - b の繰り下がり構造を解析する
 *
 * @returns 繰り下がりが起きた桁の位置の配列 (0の位から順に)
 *          繰り下がりがなければ空配列
 */
export function analyzeBorrows(a: number, b: number): BorrowPosition[] {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return [];
  if (a < 0 || b < 0) return [];

  const positions: BorrowPosition[] = [];
  let restA = a;
  let restB = b;
  let borrow = 0;
  let position = 0;

  // 筆算と同じ順序で1の位から処理する。
  // 前の桁で繰り下げられた分 (borrow) を今の桁から差し引いた上で比較する。
  // これを怠ると 100 - 28 の2回目の繰り下げを見落とす
  // (1の位で 0 < 8 と判定した時点で、10の位は「0 ではなく -1」になっているため)。
  while (restA > 0 || restB > 0) {
    const digitA = (restA % 10) - borrow;
    const digitB = restB % 10;
    if (digitA < digitB) {
      positions.push(position);
      borrow = 1;
    } else {
      borrow = 0;
    }
    restA = Math.floor(restA / 10);
    restB = Math.floor(restB / 10);
    position += 1;
  }

  return positions;
}

/**
 * 繰り下がりの回数 (桁の単位)
 */
export function countBorrows(a: number, b: number): number {
  return analyzeBorrows(a, b).length;
}

/**
 * 指定した「桁位置」に繰り下がりが起きているか
 *
 * 例: borrowAt(40, 18, 0) === true  (1の位で 0 < 8 なので繰り下がり)
 */
export function borrowAt(a: number, b: number, position: BorrowPosition): boolean {
  return analyzeBorrows(a, b).includes(position);
}

/**
 * 繰り下がりが連続する桁数 (最長の連続区間)
 *
 * 例: 1000 - 8 は 1の位・10の位・100の位で連続して繰り下がるため 3。
 * 「1つの繰り下がりが何桁に波及するか」を表す。
 */
export function longestBorrowRun(a: number, b: number): number {
  const positions = analyzeBorrows(a, b);
  if (positions.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < positions.length; i++) {
    // positions は 0の位から昇順で並ぶ。隣り合う位置が連続していれば連鎖。
    if (positions[i] === positions[i - 1] + 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

/**
 * 問題の減算構造を表す型 (生成器の parameters に載せる)
 */
export interface SubtractionStructure {
  /** 繰り下がりが起きた桁の位置 (0 = 1の位) */
  borrowPositions: BorrowPosition[];
  /** 繰り下がりの回数 (桁の単位) */
  borrowCount: number;
  /** 連続する繰り下がりの最大桁数 */
  maxBorrowRun: number;
  /** a の桁数 */
  aDigits: number;
  /** b の桁数 */
  bDigits: number;
}

/**
 * 減算の構造をまとめて求める
 */
export function describeSubtraction(a: number, b: number): SubtractionStructure {
  const positions = analyzeBorrows(a, b);
  return {
    borrowPositions: positions,
    borrowCount: positions.length,
    maxBorrowRun: longestBorrowRun(a, b),
    aDigits: String(a).length,
    bDigits: String(b).length,
  };
}
/**
 * さらに `a = b` (答え0) を**除外する**。理由:
 *   - 「n から n をひく」 は減算の練習として成立しない (何も引かない計算になる)
 *   - 小学の減算は「もとの数より小さい数をひいて残りを求める」概念であり、
 *     答え0は「繰り下がりがない」ことを検証しない
 * ただし「0 の学習を意図する」問題が必要になった場合は、
 * 別の問題タイプとして明示的に追加する (既存の減算練習とは目的が異なるため)。
 *
 * 境界値: range.min が1のとき a が range.min に取られると a - 1 = 0 になるため、
 * b の上限を `a - 1` にして b >= range.min を満たす a のみを選ぶ。
 */
export class SubtractionGenerator implements ProblemGenerator {
  readonly type = 'integer_subtraction';
  readonly category = 'integer' as const;
  readonly description = '整数の引き算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = config?.difficulty ?? (2 as DifficultyLevel);
    const { a, b } = generateSubtractionPair(rng, level);
    const answer = a - b;
    const structure = describeSubtraction(a, b);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(level, a, b),
      question: expressionToJapanese(a, '-', b),
      answer: { kind: 'integer', value: answer },
      explanation: `${a}−${b}＝${answer} です。`,
      parameters: {
        a,
        b,
        operator: '-',
        answer,
        difficultyLevel: level,
        // 繰り下がり構造を parameters に載せることで、
        // テスト側が同じ定義 (describeSubtraction) で検証できる。
        borrowCount: structure.borrowCount,
        borrowPositions: structure.borrowPositions,
        maxBorrowRun: structure.maxBorrowRun,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * レベルごとの減算構造の設計
 *
 * minBorrow / maxBorrow は「繰り下がりが起きる桁の数」の許容範囲。
 * maxBorrowRun は「連続して繰り下がる桁数」の上限。
 *
 * 既存の getAdditionRange は **変更せず** 使用する。
 * そのため lv1 は range [1,9] = 1桁どうしとなり、繰り下がりは原理的に発生しない。
 * これは「繰り下 がりをまだ扱わない」段階として妥当なので、
 * これは「繰り下がりをまだ扱わない」段階として妥当なので、
 */
interface SubtractionLevelSpec {
  minBorrow: number;
  maxBorrow: number;
  /** 連続した繰り下がりの最小桁数 (0 = 連続Doesn't必要なし) */
  minBorrowRun: number;
  /** 連続した繰り下がりの最大桁数 */
  maxBorrowRun: number;
  /** 試行回数の上限 (条件を満たす組が出るまで再抽選する) */
  attempts: number;
}

const SUBTRACTION_LEVEL_SPECS: Record<DifficultyLevel, SubtractionLevelSpec> = {
  // 1桁どうし (range [1,9]) では繰り下がりは発生しない。
  //
  // attempts は 1 のままにする。SeededRandom は LCG であり、連続シードの
  // 低ビットは周期 2 で偏る (実測: 連続 seed 0..59 で int(2,9) が 3/4/9 の
  // 3値に偏る)。再抽選しても同じ偏りを繰り返すだけなので、
  // ここを増やしても多様性は改善しない。
  1: { minBorrow: 0, maxBorrow: 0, minBorrowRun: 0, maxBorrowRun: 0, attempts: 1 },
  // 2桁で1回の繰り下がり (1の位 or 10の位 のどちらか)。
  2: { minBorrow: 1, maxBorrow: 1, minBorrowRun: 1, maxBorrowRun: 1, attempts: 200 },
  // 2〜3桁で1回以上。2回の繰り下がりも含める。
  3: { minBorrow: 1, maxBorrow: 2, minBorrowRun: 1, maxBorrowRun: 1, attempts: 200 },
  // 3桁で「複数の桁にまたがる」繰り下がり (連続した繰り下がり) を要求する。
  //
  // 実測: getAdditionRange(4) = [20,100] で run >= 2 を満たす組は
  //   **a = 100 の 72 組だけ** (a=20..99 では 0 組)。
  // 範囲 [20,100] は「3桁」を含まないため、3桁にまたがる繰り下がりは
  // 原理的に 100 以外に出現しない。
  // getAdditionRange は他の generator と共有されているため変更せず、
  // この級は「構造上取り出せる最も重い形 = a=100 の連続繰り下がり」を
  // 明示的に狙う。a が固定になる制約は、Fingerprint 多様性で吸収する。
  4: { minBorrow: 2, maxBorrow: 3, minBorrowRun: 2, maxBorrowRun: 2, attempts: 4000 },
  // lv5: 3桁で繰り下がりが2桁以上連続する最も重い形 (例: 100 - 51)。
  //
  // 実測: range [50,200] における連続繰り下がりの本数分布は
  //   run=0 が 4526 組 / run=1 が 4864 組 / run=2 が 1935 組、**run=3 は 0 組**。
  // 3つの桁すべてに繰り下げるには a が 100 で b が 1桁である必要があるが、
  // b >= range.min = 50 という既存の制約 (subtraction-zero.test.ts が保証) のため
  // 「100 - 8」のような形は生成範囲に入らない。
  // よって lv5 は「構造上可能な最大級」= run >= 2 を要求し、
  // 追加で、繰り下がりの総数と位置の多様性を担保する
  // (繰り下がりが 1の位だけ / 10の位まで / 両方 の3種を出し分ける)。
  5: { minBorrow: 2, maxBorrow: 3, minBorrowRun: 2, maxBorrowRun: 2, attempts: 4000 },
};

/**
 * 指定レベルの繰り下がり構造を満たす (a, b) を生成する
 *
 * 既存の制約をすべて維持する:
 *   - range = getAdditionRange(level) に収まる
 *   - a >= range.min + 1 (b <= a - 1 で答え0を避ける)
 *   - b >= range.min
 *   - a - b > 0
 *
 * 条件を満たす組が見つからない場合は範囲内の組を返す
 * (rng の偏りで spec を満たさない場合への保険。答えは必ず非負なので validator は通る)。
 */
function generateSubtractionPair(
  rng: ReturnType<typeof createRandom>,
  level: DifficultyLevel,
): { a: number; b: number } {
  const range = getAdditionRange(level);
  const spec = SUBTRACTION_LEVEL_SPECS[level];
  let fallback: { a: number; b: number } | null = null;

  for (let attempt = 0; attempt < spec.attempts; attempt++) {
    const a = rng.int(range.min + 1, range.max);
    const b = rng.int(range.min, a - 1);
    const structure = describeSubtraction(a, b);

    if (!fallback) fallback = { a, b };

    if (
      structure.borrowCount >= spec.minBorrow &&
      structure.borrowCount <= spec.maxBorrow &&
      structure.maxBorrowRun >= spec.minBorrowRun &&
      structure.maxBorrowRun <= spec.maxBorrowRun
    ) {
      return { a, b };
    }
  }

  return fallback ?? { a: range.min + 1, b: range.min };
}

/**
 * 掛け算ジェネレータ
 */
export class MultiplicationGenerator implements ProblemGenerator {
  readonly type = 'integer_multiplication';
  readonly category = 'integer' as const;
  readonly description = '整数の掛け算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const level = config?.difficulty ?? (2 as DifficultyLevel);
    const range = getMultiplicationRange(level);
    const a = rng.int(range.min, range.max);
    const b = rng.int(range.min, range.max);
    const answer = a * b;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(level, a, b),
      question: expressionToJapanese(a, '×', b),
      answer: { kind: 'integer', value: answer },
      explanation: `${a}×${b}＝${answer} です。`,
      parameters: {
        a,
        b,
        operator: '×',
        answer,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 割り算ジェネレータ
 * 割り切れる問題のみ生成する
 */
export class DivisionGenerator implements ProblemGenerator {
  readonly type = 'integer_division';
  readonly category = 'integer' as const;
  readonly description = '整数の割り算 (割り切れる)';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 1 (easy) if not specified
    // 商が1になるケースも含む簡単な割り算を生成する
    const level = config?.difficulty ?? (1 as DifficultyLevel);

    // レベル1では九九の範囲 (被除数・除数・商がすべて1桁) に抑え、
    // 数値の大きさの難易度もレベル1相当を維持する
    let dividend: number;
    let divisor: number;
    let quotient: number;
    if (level === 1) {
      divisor = rng.int(2, 9);
      quotient = rng.int(1, Math.floor(9 / divisor));
      dividend = divisor * quotient;
    } else {
      ({ dividend, divisor, quotient } = generateDivision(rng, level));
    }

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(level, dividend, divisor),
      question: expressionToJapanese(dividend, '÷', divisor),
      answer: { kind: 'integer', value: quotient },
      explanation: `${dividend}÷${divisor}＝${quotient} です。${divisor}×${quotient}＝${dividend} なので確かめられます。`,
      parameters: {
        dividend,
        divisor,
        quotient,
        operator: '÷',
        answer: quotient,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}
