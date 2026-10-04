// phase2y.test.ts — 異分母の分数の加法・減法 / 百分率 (Phase 2-Y)
//
// 目的:
//   - 調査で「平成29年告示の解説編に第5学年として記載あり」と確認できた内容だけを実装している
//   - lv1-5 のすべてで要求 difficulty を返すこと
//   - 解答が一意に定まり、解説が問題の条件と一致すること
//   - 丸め誤差・ゼロ・負数・分母0 などの異常値が出ないこと
//   - 多様性が数値の入れ替えだけではないこと
//   - 独立実装 (refGcd / refLcm) で全問を検算すること

import { describe, expect, it } from 'vitest';
import { FractionAddSubGenerator } from './fraction/generators';
import { PercentageGenerator } from './ratio/generators';
import { validateProblem } from '../engine/validator/validator';
import { generateSolutionSteps } from '../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../utils/answer';
import type { DifficultyLevel, Problem } from '../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const PER_LEVEL = 120;

/** 独立実装: 最大公約数 */
function refGcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** 独立実装: 最小公倍数 */
function refLcm(a: number, b: number): number {
  return (a * b) / refGcd(a, b);
}

function many(
  gen: { generate: (c: { difficulty: DifficultyLevel; seed: number }) => Problem },
  lv: DifficultyLevel,
): Problem[] {
  const out: Problem[] = [];
  for (let s = 0; s < PER_LEVEL; s++) out.push(gen.generate({ difficulty: lv, seed: s * 104729 + lv * 7919 }));
  return out;
}

describe('fraction_add_sub: 異分母の分数の加法・減法', () => {
  const gen = new FractionAddSubGenerator();

  it('lv1-5 の各レベルで 100問以上生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      const list = many(gen, lv);
      expect(list.length).toBeGreaterThanOrEqual(100);
      for (const p of list) expect(p.difficulty.level, `lv${lv}`).toBe(lv);
    }
  });

  it('独立検算: 全600問の答えが通分→加減→約分で一致する', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as {
          variant: string; operation: string; n1: number; d1: number;
          n2: number; d2: number; numerator: number; denominator: number; commonDenominator: number;
        };
        expect(q.d1).toBeGreaterThanOrEqual(2);
        expect(q.d2).toBeGreaterThanOrEqual(2);
        expect(q.n1).toBeGreaterThanOrEqual(1); expect(q.n1).toBeLessThan(q.d1);
        expect(q.n2).toBeGreaterThanOrEqual(1); expect(q.n2).toBeLessThan(q.d2);
        expect(q.d1).not.toBe(q.d2); // 異分母であること

        const l = refLcm(q.d1, q.d2);
        expect(q.commonDenominator).toBe(l);
        const a = (q.n1 * l) / q.d1;
        const b = (q.n2 * l) / q.d2;
        const raw = q.operation === 'add' ? a + b : a - b;
        expect(raw).toBeGreaterThan(0); // 減法で負にならない

        const g = refGcd(raw, l);
        expect(q.numerator).toBe(raw / g);
        expect(q.denominator).toBe(l / g);
        expect(refGcd(q.numerator, q.denominator)).toBe(1); // 既約分数
        expect(p.answer.kind).toBe('fraction');
        expect(p.answer.kind === 'fraction' && p.answer.numerator).toBe(q.numerator);
        expect(p.answer.kind === 'fraction' && p.answer.denominator).toBe(q.denominator);
        checked++;
      }
    }
    expect(checked).toBe(LEVELS.length * PER_LEVEL);
  });

  it('全問題が validate を通り、解説と途中式が必ず付く', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        expect(validateProblem(p).valid, p.question).toBe(true);
        expect(gen.validate(p).valid, p.question).toBe(true);
        expect(String(p.explanation ?? '').length).toBeGreaterThan(0);
        expect(generateSolutionSteps(p).length).toBeGreaterThan(0);
        const shown = String(formatAnswer(p.answer));
        expect(checkUserAnswer(shown, p.answer), shown).toBe(true);
      }
    }
  });

  it('全 variant が出現し、答えの形が variant の約束を満たす', () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as { variant: string; numerator: number; denominator: number };
        seen.add(q.variant);
        const isProper = q.numerator < q.denominator;
        const reduced = refGcd(q.numerator, q.denominator) === 1;
        if (q.variant === 'add') { expect(isProper).toBe(true); expect(reduced).toBe(true); }
        if (q.variant === 'add_reduces') expect(reduced).toBe(true);
        if (q.variant === 'add_improper') expect(isProper).toBe(false);
        if (q.variant === 'subtract') expect(isProper).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual(['add', 'add_improper', 'add_reduces', 'fill_blank', 'subtract']);
  });

  it('改ざん検出: parameters を壊すと validate が不正を報告する', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as { n1: number; d1: number; numerator: number };
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), n1: q.d1 } }).valid,
          '真分数でない入力').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), numerator: q.numerator + 1 } }).valid,
          '答えの改ざん').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), d2: q.d1 } }).valid,
          '同分母になった改ざん').toBe(false);
      }
    }
  });
});

describe('percentage: 百分率', () => {
  const gen = new PercentageGenerator();

  it('lv1-5 の各レベルで 100問以上生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      const list = many(gen, lv);
      expect(list.length).toBeGreaterThanOrEqual(100);
      for (const p of list) expect(p.difficulty.level, `lv${lv}`).toBe(lv);
    }
  });

  it('独立検算: 全600問が 部分量 = 全体量 × 百分率 ÷ 100 を満たす', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as { variant: string; percent: number; whole: number; part: number; answer: number };
        expect(q.percent).toBeGreaterThan(0);
        expect(q.percent).toBeLessThanOrEqual(100);
        expect(q.whole).toBeGreaterThan(0);
        expect(q.part).toBeGreaterThan(0);
        expect(q.part).toBeLessThanOrEqual(q.whole);
        // 端数が出ないこと (丸めしていない)
        expect((q.whole * q.percent) % 100).toBe(0);
        expect(q.part).toBe((q.whole * q.percent) / 100);
        if (q.variant === 'percent_of') expect(q.answer).toBe(q.part);
        else expect(q.answer).toBe(q.percent);
        expect(validateProblem(p).valid, p.question).toBe(true);
        expect(gen.validate(p).valid, p.question).toBe(true);
        const shown = String(formatAnswer(p.answer));
        expect(checkUserAnswer(shown, p.answer), shown).toBe(true);
        checked++;
      }
    }
    expect(checked).toBe(LEVELS.length * PER_LEVEL);
  });

  it('全 variant が出現し、解説と途中式が必ず付く', () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        seen.add((p.parameters as { variant: string }).variant);
        expect(String(p.explanation ?? '').length).toBeGreaterThan(0);
        expect(generateSolutionSteps(p).length).toBeGreaterThan(0);
      }
    }
    expect([...seen].sort()).toEqual(['find_percent', 'percent_of', 'what_percent']);
  });

  it('多様性: 百分率の値も複数種類出現する', () => {
    for (const lv of LEVELS) {
      const list = many(gen, lv);
      expect(new Set(list.map((p) => p.question)).size, `lv${lv}`).toBeGreaterThanOrEqual(15);
      expect(new Set(list.map((p) => (p.parameters as { percent: number }).percent)).size).toBeGreaterThanOrEqual(3);
    }
  });

  it('改ざん検出: parameters を壊すと validate が不正を報告する', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as { whole: number; answer: number };
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), percent: 0 } }).valid, '0パーセント').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), percent: 140 } }).valid, '140パーセント').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), part: q.whole + 1 } }).valid, '部分量が全体より大きい').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), answer: q.answer + 1 } }).valid, '答えの改ざん').toBe(false);
      }
    }
  });
});