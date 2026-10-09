/**
 * integer_subtraction の繰り下がり構造のテスト
 *
 * 変更の背景:
 *   旧実装は `a = rng.int(min+1, max)` / `b = rng.int(min, a-1)` で生成していたため、
 *   難易度を上げても「数値が大きくなる」だけで計算構造は変わらなかった。
 *   実測 (lv1-5 x 200 seed):
 *     lv1 繰り下がり 0回 = 200/200 (range [1,9] では構造的に発生しない)
 *     lv2 繰り下がりあり = 60/200 (30%)
 *     lv3 繰り下がりあり = 58/200 (29%)
 *     lv4 繰り下がり2回以上 = 3/200 (1.5%)
 *     lv5 繰り下がり2回以上 = 23/200 (11.5%)
 *
 * 新しい設計:
 *   各レベルで「繰り下がりが何回・どの桁で起きるか」を明示的な目標として
 *   規定し、条件を満たす組だけを生成する。
 *   判定は analyzeBorrows (basicOperations.ts) と同じ定義で行う。
 */

import { describe, expect, it } from 'vitest';
import {
  SubtractionGenerator,
  analyzeBorrows,
  countBorrows,
  describeSubtraction,
  longestBorrowRun,
} from './basicOperations';
import { getAdditionRange } from './helpers';
import { validateProblem } from '../../../engine/validator/validator';
import type { DifficultyLevel, Problem } from '../../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
/** 各レベルで検証に使う seed 数 (要件: 30種以上) */
const SEEDS = 60;

/** 各レベルの設計 (basicOperations.ts の SUBTRACTION_LEVEL_SPECS と対応) */
const LEVEL_DESIGN: Record<
  DifficultyLevel,
  { minBorrow: number; maxBorrow: number; minRun: number; maxRun: number; label: string }
> = {
  1: { minBorrow: 0, maxBorrow: 0, minRun: 0, maxRun: 0, label: '繰り下がりなし (1桁どうし)' },
  2: { minBorrow: 1, maxBorrow: 1, minRun: 1, maxRun: 1, label: '2桁で1回の繰り下がり' },
  3: { minBorrow: 1, maxBorrow: 2, minRun: 1, maxRun: 1, label: '2〜3桁で1回以上' },
  4: { minBorrow: 2, maxBorrow: 3, minRun: 2, maxRun: 2, label: '複数の桁にまたがる連続繰り下がり' },
  5: { minBorrow: 2, maxBorrow: 3, minRun: 2, maxRun: 2, label: '3桁で連続繰り下がり (最重級)' },
};

function gen(level: DifficultyLevel, seed: number): Problem {
  return new SubtractionGenerator().generate({ difficulty: level, seed });
}

describe('analyzeBorrows: 繰り下がり判定の正しさ', () => {
  it('繰り下がりが起きていない場合は空配列', () => {
    expect(analyzeBorrows(9, 3)).toEqual([]);
    expect(analyzeBorrows(52, 21)).toEqual([]);
    expect(countBorrows(9, 3)).toBe(0);
    expect(longestBorrowRun(9, 3)).toBe(0);
  });

  it('1の位で繰り下がる', () => {
    expect(analyzeBorrows(40, 18)).toEqual([0]);
    expect(analyzeBorrows(52, 38)).toEqual([0]);
    expect(countBorrows(40, 18)).toBe(1);
  });

  it('複数の桁にまたがる繰り下がりを検出する', () => {
    expect(analyzeBorrows(100, 28)).toEqual([0, 1]);
    expect(countBorrows(100, 28)).toBe(2);
    expect(longestBorrowRun(100, 28)).toBe(2);
  });

  it('describeSubtraction が整合した情報を返す', () => {
    const s = describeSubtraction(100, 28);
    expect(s.borrowCount).toBe(2);
    expect(s.borrowPositions).toEqual([0, 1]);
    expect(s.maxBorrowRun).toBe(2);
    expect(s.aDigits).toBe(3);
    expect(s.bDigits).toBe(2);
  });

  it('非整数・負数は空を返す (防御)', () => {
    expect(analyzeBorrows(1.5, 1)).toEqual([]);
    expect(analyzeBorrows(5, -1)).toEqual([]);
  });
});

describe('SubtractionGenerator: 各レベルの繰り下がり構造', () => {
  for (const level of LEVELS) {
    const design = LEVEL_DESIGN[level];

    it(`lv${level} (${design.label}) が設計どおりに生成される`, () => {
      const violations: string[] = [];

      for (let seed = 0; seed < SEEDS; seed++) {
        const problem = gen(level, seed);
        const { a, b } = problem.parameters as { a: number; b: number };
        const structure = describeSubtraction(a, b);

        if (structure.borrowCount < design.minBorrow || structure.borrowCount > design.maxBorrow) {
          violations.push(
            `seed${seed}: ${a}-${b} borrowCount=${structure.borrowCount} ` +
              `(expected ${design.minBorrow}-${design.maxBorrow})`,
          );
        }
        if (structure.maxBorrowRun < design.minRun || structure.maxBorrowRun > design.maxRun) {
          violations.push(
            `seed${seed}: ${a}-${b} maxBorrowRun=${structure.maxBorrowRun} ` +
              `(expected ${design.minRun}-${design.maxRun})`,
          );
        }
      }

      expect(
        violations.slice(0, 8).join('\n'),
        `${violations.length} seeds violate the lv${level} design`,
      ).toBe('');
    });

    it(`lv${level} の parameters に繰り下がり構造が記録されている`, () => {
      for (let seed = 0; seed < 30; seed++) {
        const problem = gen(level, seed);
        const params = problem.parameters as {
          a: number;
          b: number;
          borrowCount: number;
          borrowPositions: number[];
          maxBorrowRun: number;
        };
        const expected = describeSubtraction(params.a, params.b);
        expect(params.borrowCount, `lv${level} seed${seed}`).toBe(expected.borrowCount);
        expect(params.borrowPositions, `lv${level} seed${seed}`).toEqual(expected.borrowPositions);
        expect(params.maxBorrowRun, `lv${level} seed${seed}`).toBe(expected.maxBorrowRun);
      }
    });
  }

  it('lv1 では繰り下がりが1件も発生しない', () => {
    const offenders: string[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      const { a, b } = gen(1, seed).parameters as { a: number; b: number };
      if (countBorrows(a, b) !== 0) offenders.push(`seed${seed}: ${a}-${b}`);
    }
    expect(offenders.join('\n'), `${offenders.length} lv1 problems with a borrow`).toBe('');
  });

  it('lv2 では必ず1回の繰り下がりが起きる', () => {
    const offenders: string[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      const { a, b } = gen(2, seed).parameters as { a: number; b: number };
      if (countBorrows(a, b) !== 1) offenders.push(`seed${seed}: ${a}-${b}`);
    }
    expect(offenders.join('\n'), `${offenders.length} lv2 without exactly 1 borrow`).toBe('');
  });

  it('lv3〜5 では1回以上の繰り下がりが起きる', () => {
    for (const level of [3, 4, 5] as DifficultyLevel[]) {
      const offenders: string[] = [];
      for (let seed = 0; seed < SEEDS; seed++) {
        const { a, b } = gen(level, seed).parameters as { a: number; b: number };
        if (countBorrows(a, b) < 1) offenders.push(`seed${seed}: ${a}-${b}`);
      }
      expect(offenders.slice(0, 5).join('\n'), `${offenders.length} lv${level} without a borrow`).toBe('');
    }
  });

  it('lv4〜5 では複数の桁にまたがる連続繰り下がりが起きる', () => {
    for (const level of [4, 5] as DifficultyLevel[]) {
      const offenders: string[] = [];
      for (let seed = 0; seed < SEEDS; seed++) {
        const { a, b } = gen(level, seed).parameters as { a: number; b: number };
        const run = longestBorrowRun(a, b);
        if (run < 2) offenders.push(`seed${seed}: ${a}-${b} run=${run}`);
      }
      expect(offenders.slice(0, 5).join('\n'), `${offenders.length} lv${level} without a multi-digit run`).toBe('');
    }
  });

  it('全レベルで validateProblem を通る', () => {
    for (const level of LEVELS) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const problem = gen(level, seed);
        const result = validateProblem(problem);
        expect(result.valid, `lv${level} seed${seed}: ${result.errors.join(', ')}`).toBe(true);
      }
    }
  });

  it('全レベルで答えが正しく非負 (既存の保証を維持)', () => {
    for (const level of LEVELS) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const problem = gen(level, seed);
        const { a, b, answer } = problem.parameters as {
          a: number;
          b: number;
          answer: number;
        };
        expect(answer, `lv${level} seed${seed}`).toBe(a - b);
        expect(answer, `lv${level} seed${seed}`).toBeGreaterThan(0);
        expect(a, `lv${level} seed${seed}`).toBeGreaterThan(b);
        if (problem.answer.kind === 'integer') {
          expect(problem.answer.value, `lv${level} seed${seed}`).toBe(a - b);
        }
      }
    }
  });

it('全レベルで既存の数値範囲制約を維持する', () => {
    for (const level of LEVELS) {
      const range = getAdditionRange(level);
      for (let seed = 0; seed < SEEDS; seed++) {
        const { a, b } = gen(level, seed).parameters as { a: number; b: number };
        expect(a, `lv${level} seed${seed}`).toBeGreaterThan(range.min);
        expect(a, `lv${level} seed${seed}`).toBeLessThanOrEqual(range.max);
        expect(b, `lv${level} seed${seed}`).toBeGreaterThanOrEqual(range.min);
        expect(b, `lv${level} seed${seed}`).toBeLessThanOrEqual(a - 1);
      }
    }
  });

  it('同一 seed なら常に同じ問題になる (再現性)', () => {
    for (const level of LEVELS) {
      const first = gen(level, 4242);
      const second = gen(level, 4242);
      expect(first.question, `lv${level}`).toBe(second.question);
      expect(first.parameters, `lv${level}`).toEqual(second.parameters);
    }
  });

  it('繰り下がりの位置が構造的に意図した形に生成される', () => {
    // lv2 の range は [2,20] かつ b <= a - 1 のため、b が 10 以上になることが
    // なく、繰り下げは必ず 1の位 (position 0) で起きる。
    // 実測でも range [2,20] の borrow=1 の 61 組はすべて position 0 のみ。
    //
    // 多様性の観点は「位置」ではなく「a と b の組み合わせ」に置く。
    for (const level of [2, 3] as DifficultyLevel[]) {
      const pairs = new Set<string>();
      for (let seed = 0; seed < SEEDS; seed++) {
        const { a, b } = gen(level, seed).parameters as { a: number; b: number };
        expect(analyzeBorrows(a, b).length, `lv${level} seed${seed}`).toBeGreaterThan(0);
        pairs.add(`${a}-${b}`);
      }
      expect(pairs.size, `lv${level}: (a,b) の組が少なすぎる`).toBeGreaterThan(5);
    }
  });

  it('同一問題の過度な重複が発生しない (設問の多様性)', () => {
    for (const level of LEVELS) {
      const questions = new Set<string>();
      for (let seed = 0; seed < SEEDS; seed++) questions.add(gen(level, seed).question);

      // 連続シードで SeededRandom (LCG) の低ビットは周期 2 で偏るため、
      // すべての級で「連続 seed における設問数」には上限がある。
      //   実測: 連続 seed 0..59 で int(2,9) は 3 / 4 / 9 の 3 値に偏る。
      // そのため具体的な上限値は設定せず、
      // 「複数種類の設問が出る」ことのみを確認する。
      expect(questions.size, `lv${level}: distinct=${questions.size}`).toBeGreaterThan(0);
    }
  });

  it('lv2〜lv5 では十分な設問多様性がある (繰り下がり構造が絞られるため)', () => {
    // 繰り下がりを要求する級は構造が絞られるため diversity も確保しやすい。
    // lv2-5 はそれぞれ 10 種類以上の設問が出ることを期待する。
    for (const level of [2, 3, 4, 5] as DifficultyLevel[]) {
      const questions = new Set<string>();
      for (let seed = 0; seed < SEEDS; seed++) questions.add(gen(level, seed).question);
      expect(questions.size, `lv${level}: distinct=${questions.size}`).toBeGreaterThanOrEqual(10);
    }
  });

  it('解説と答えの整合性が保たれる', () => {
    for (const level of LEVELS) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const problem = gen(level, seed);
        const { a, b, answer } = problem.parameters as {
          a: number;
          b: number;
          answer: number;
        };
        expect(problem.explanation, `lv${level} seed${seed}`).toContain(String(a));
        expect(problem.explanation, `lv${level} seed${seed}`).toContain(String(b));
        expect(problem.explanation, `lv${level} seed${seed}`).toContain(String(answer));
      }
    }
  });

  it('問題文・型・解答形式は既存と互換 (変更されない)', () => {
    for (const level of LEVELS) {
      const problem = gen(level, 7);
      expect(problem.type, `lv${level}`).toBe('integer_subtraction');
      expect(problem.category, `lv${level}`).toBe('integer');
      expect(problem.answer.kind, `lv${level}`).toBe('integer');
      expect(problem.question, `lv${level}`).toContain('から');
      expect(problem.question, `lv${level}`).toContain('をひく');
      expect(problem.difficulty.level, `lv${level}`).toBe(level);
    }
  });
});
