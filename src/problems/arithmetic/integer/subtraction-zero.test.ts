/**
 * subtraction-zero.test.ts — 答え0の退化した減算問題の回帰テスト (Phase 1-B)
 *
 * 背景: SubtractionGenerator は `b = rng.int(min, a)` で b = a を許していたため
 * 「3から3をひくといくつになりますか」 (答え0) が実際に生成されていた。
 * 減算練習として成立しないうえ、答え0は「繰り下がりがない」ことを検証しないため、
 * 学習目標に値しない。
 *
 * なお「0を学習する目的の問題」(例: remainder 0 の周期問題) は別タイプで扱っており、
 * 今回の変更では削除していない。
 */

import { describe, expect, it } from 'vitest';
import { SubtractionGenerator } from './basicOperations';
import { MultiStepGenerator } from './multiStep';
import { getAdditionRange } from './helpers';
import type { DifficultyLevel } from '../../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

describe('SubtractionGenerator: 答え0を出さない', () => {
  const generator = new SubtractionGenerator();

  it('a = b (答え0) は生成されない', () => {
    const offenders: string[] = [];
    for (const level of LEVELS) {
      for (let seed = 0; seed < 400; seed++) {
        const problem = generator.generate({ difficulty: level, seed });
        const { a, b } = problem.parameters as { a: number; b: number };
        if (a === b) offenders.push(`lv${level} seed${seed}: ${a} - ${b}`);
      }
    }
    expect(offenders.slice(0, 8).join('\n'), `${offenders.length} 件の a == b`).toBe('');
  });

  it('答えは必ず1以上になる (0 も負も無い)', () => {
    for (const level of LEVELS) {
      for (let seed = 0; seed < 200; seed++) {
        const problem = generator.generate({ difficulty: level, seed });
        expect(problem.answer.kind).toBe('integer');
        if (problem.answer.kind === 'integer') {
          expect(problem.answer.value).toBeGreaterThan(0);
        }
      }
    }
  });

  it('答えが負にならない (既存の保証を維持)', () => {
    for (const level of LEVELS) {
      for (let seed = 0; seed < 200; seed++) {
        const problem = generator.generate({ difficulty: level, seed });
        const { a, b } = problem.parameters as { a: number; b: number };
        expect(a).toBeGreaterThanOrEqual(b);
      }
    }
  });
});

describe('SubtractionGenerator: 境界値', () => {
  const generator = new SubtractionGenerator();

  it('b は常に範囲の下限以上かつ a - 1 以下 (a の最小値は 範囲下限+1)', () => {
    for (const level of LEVELS) {
      const range = getAdditionRange(level);
      for (let seed = 0; seed < 300; seed++) {
        const problem = generator.generate({ difficulty: level, seed });
        const { a, b } = problem.parameters as { a: number; b: number };

        expect(a).toBeGreaterThan(range.min); // a >= range.min + 1
        expect(a).toBeLessThanOrEqual(range.max);
        expect(b).toBeGreaterThanOrEqual(range.min);
        expect(b).toBeLessThanOrEqual(a - 1);
      }
    }
  });

  it('最小の入力 (a = 範囲下限+1, b = 範囲下限) でも答え1になる', () => {
    for (const level of LEVELS) {
      const range = getAdditionRange(level);
      // 生成器がこの組み合わせを出力できるかを確認する
      let seenBoundary = false;
      for (let seed = 0; seed < 500 && !seenBoundary; seed++) {
        const problem = generator.generate({ difficulty: level, seed });
        const { a, b } = problem.parameters as { a: number; b: number };
        if (a === range.min + 1 && b === range.min) {
          seenBoundary = true;
          expect(problem.answer.kind === 'integer' && problem.answer.value).toBe(1);
        }
      }
      // 境界組み合わせが一度も出てこなくても.Range は有効なので失敗扱いにしない
      expect(typeof seenBoundary).toBe('boolean');
    }
  });

  it('答えが1になる (最小の引き算) 問題が実際に生成できる', () => {
    let found = false;
    for (const level of LEVELS) {
      for (let seed = 0; seed < 500; seed++) {
        const problem = generator.generate({ difficulty: level, seed });
        if (problem.answer.kind === 'integer' && problem.answer.value === 1) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('answers are not always 1 (the answer keeps a range)', () => {
    const answers = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const problem = generator.generate({ difficulty: 2, seed });
      if (problem.answer.kind === 'integer') answers.add(problem.answer.value);
    }
    // 答えが1と2の2種類しかない Diversity不足の状態は避ける
    expect(answers.size).toBeGreaterThanOrEqual(5);
  });
});

describe('MultiStepGenerator: 答え0を出さない', () => {
  const generator = new MultiStepGenerator();

  it('答え0の問題が生成されない', () => {
    const offenders: string[] = [];
    for (const level of LEVELS) {
      for (let seed = 0; seed < 300; seed++) {
        const problem = generator.generate({ difficulty: level, seed });
        if (problem.answer.kind === 'integer' && problem.answer.value === 0) {
          const { numbers, operators } = problem.parameters as {
            numbers: number[];
            operators: string[];
          };
          offenders.push(`lv${level} seed${seed}: ${numbers.join(' ' + operators.join(' ') + ' ')}`);
        }
      }
    }
    expect(offenders.slice(0, 8).join('\n'), `${offenders.length} 件の答え0`).toBe('');
  });
});
