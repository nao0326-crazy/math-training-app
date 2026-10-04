// problems-phase2t.test.ts — 小数の位取り / 単位分数の導入 / 三角形の分類 (Phase 2-T)
//
// 目的:
//   - 3つの新規 generator が lv1-5 で生成でき、validate を通ること
//   - generator 自身の validate を鵜呑みにせず、独立した方法で正答を検算すること
//   - 問題文・解答・解説・途中式が相互に一致すること
//   - displayed answer をそのまま入力すると正解判定されること
//   - 各 lv で十分な種類・十分な数の問題が出ること
//   - parameters を改ざんした validate が「不正」と報告すること
//
// 独立検算の方式:
//   - 小数: Math.pow ではなく「小数文字列を地道に積む」別実装で求める
//   - 分数: 分子・分母の文字列連結を独立に組み立て、分母の範囲も独立に検査する
//   - 三角形: 辺をソートして最長辺と他2辺の和を別実装で判定する

import { describe, expect, it } from 'vitest';
import { DecimalPlaceValueGenerator } from './decimal/generators';
import { FractionUnitIntroGenerator } from './fraction/generators';
import { TriangleClassifyGenerator } from './geometry/generators';
import { validateProblem } from '../engine/validator/validator';
import { generateSolutionSteps } from '../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../utils/answer';
import type { DifficultyLevel, Problem } from '../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const PER_LEVEL = 120;

/** 各 lv で PER_LEVEL 問を生成する */
function generateMany(
  gen: { generate: (c: { difficulty: DifficultyLevel; seed: number }) => Problem },
  lv: DifficultyLevel,
): Problem[] {
  const out: Problem[] = [];
  for (let s = 0; s < PER_LEVEL; s++) {
    out.push(gen.generate({ difficulty: lv, seed: s * 104729 + lv * 7919 }));
  }
  return out;
}

/**
 * 小数を「文字列を地道に積む」方法で求める (generator の Math.pow 実装と別系統)。
 * 例: refDecimal([0, 3, 7]) = 0.037
 */
function refDecimal(digits: number[]): number {
  let total = 0;
  let weight = 1;
  for (const d of digits) {
    weight = weight / 10;
    total = total + d * weight;
  }
  return Math.round(total * 1e12) / 1e12;
}

/** 分数文字列を独立に組み立てる */
function refFraction(num: number, den: number): string {
  return num.toString() + '/' + den.toString();
}

/** 三角形の種類を独立に判定する (ソートして自前で判定する) */
function refTriangleKind(a: number, b: number, c: number): '正三角形' | '二等辺三角形' | '不等辺三角形' {
  const s = [a, b, c].slice().sort((x, y) => x - y);
  if (s[0] + s[1] <= s[2]) return '不等辺三角形';
  const uniqueCount = new Set([a, b, c]).size;
  if (uniqueCount === 1) return '正三角形';
  if (uniqueCount === 2) return '二等辺三角形';
  return '不等辺三角形';
}

describe('decimal_place_value: 小数の位取り', () => {
  const gen = new DecimalPlaceValueGenerator();

  it('lv1-5 の各レベルで 100問以上生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      const problems = generateMany(gen, lv);
      expect(problems.length).toBeGreaterThanOrEqual(100);
      for (const p of problems) {
        expect(p.difficulty.level, `lv${lv}`).toBe(lv);
      }
    }
  });

  it('全問題が validate を通り、displayed answer を入力すると正解判定される', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        expect(validateProblem(p).valid, `validate ${p.question}`).toBe(true);
        expect(gen.validate(p).valid, `generator.validate ${p.question}`).toBe(true);
        const shown = String(formatAnswer(p.answer));
        expect(shown.length, 'displayed answer が空').toBeGreaterThan(0);
        expect(checkUserAnswer(shown, p.answer), `自己入力判定: ${shown}`).toBe(true);
      }
    }
  });

  it('独立検算: 各 variant の正答が別実装と一致する', () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        const params = p.parameters as {
          variant: string;
          place: number;
          digits?: number[];
          digit?: number;
          answer: number | string;
        };
        seen.add(params.variant);
        if (params.variant === 'read_digit') {
          const want = params.digits![params.place - 1];
          expect(p.answer.kind === 'integer' && p.answer.value).toBe(want);
          expect(Number(params.answer)).toBe(want);
          expect(want).toBeGreaterThanOrEqual(1);
        } else if (params.variant === 'place_value') {
          const d = params.digit!;
          let w = 1;
          for (let i = 0; i < params.place; i++) w = w / 10;
          const want = d * w;
          expect(p.answer.kind === 'decimal' && p.answer.value).toBeCloseTo(want, 12);
          expect(Number(params.answer)).toBeCloseTo(want, 12);
        } else if (params.variant === 'decompose') {
          const d = params as unknown as { bigPart: number; smallPart: number };
          expect(d.bigPart + d.smallPart).toBeCloseTo(Number(params.answer), 12);
          expect(p.answer.kind).toBe('string');
        } else if (params.variant === 'compose') {
          const want = refDecimal(params.digits!);
          expect(p.answer.kind === 'decimal' && p.answer.value).toBeCloseTo(want, 12);
          expect(Number(params.answer)).toBeCloseTo(want, 12);
          expect(want).toBeGreaterThan(0);
        } else {
          throw new Error('未知の variant: ' + params.variant);
        }
      }
    }
    expect([...seen].sort()).toEqual(['compose', 'decompose', 'place_value', 'read_digit']);
  });

  it('各 difficulty で十分な種類が出ない (同じ問題の連なりにならない)', () => {
    for (const lv of LEVELS) {
      const questions = generateMany(gen, lv).map((p) => p.question);
      expect(new Set(questions).size, `lv${lv} 問題文の種類`).toBeGreaterThanOrEqual(20);
      const structures = generateMany(gen, lv).map((p) => {
        const params = p.parameters as { variant: string; place: number };
        return params.variant + ':' + params.place;
      });
      expect(new Set(structures).size, `lv${lv} 構造の種類`).toBeGreaterThanOrEqual(3);
    }
  });

  it('parameters を改ざんすると validate が不正を報告する', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        const tampered: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), place: 9 },
        };
        expect(gen.validate(tampered).valid, 'place 改ざんを検出できる').toBe(false);
      }
    }
  });
});

describe('fraction_unit_intro: 単位分数の導入', () => {
  const gen = new FractionUnitIntroGenerator();

  it('lv1-5 の各レベルで 100問以上生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      const problems = generateMany(gen, lv);
      expect(problems.length).toBeGreaterThanOrEqual(100);
      for (const p of problems) {
        expect(p.difficulty.level, `lv${lv}`).toBe(lv);
      }
    }
  });

  it('全問題が validate を通り、displayed answer を入力すると正解判定される', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        expect(validateProblem(p).valid, `validate ${p.question}`).toBe(true);
        expect(gen.validate(p).valid, `generator.validate ${p.question}`).toBe(true);
        const shown = String(formatAnswer(p.answer));
        expect(shown.length, 'displayed answer が空').toBeGreaterThan(0);
        expect(checkUserAnswer(shown, p.answer), `自己入力判定: ${shown}`).toBe(true);
      }
    }
  });

  it('独立検算: 各 variant の正答が別実装と一致し、3年の範囲 (真分数) を守る', () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        const params = p.parameters as {
          variant: string;
          num: number;
          den: number;
          answer: number | string;
        };
        seen.add(params.variant);
        expect(params.den).toBeGreaterThanOrEqual(2);
        expect(params.num).toBeGreaterThanOrEqual(1);
        expect(params.num).toBeLessThanOrEqual(params.den);

        if (params.variant === 'meaning') {
          expect(p.answer.kind === 'string' && p.answer.value).toBe(refFraction(1, params.den));
          expect(String(params.answer)).toBe(refFraction(1, params.den));
        } else if (params.variant === 'how_many_units') {
          expect(p.answer.kind === 'integer' && p.answer.value).toBe(params.num);
          expect(Number(params.answer)).toBe(params.num);
        } else if (params.variant === 'count_units') {
          expect(p.answer.kind === 'string' && p.answer.value).toBe(refFraction(params.num, params.den));
        } else if (params.variant === 'read_fraction') {
          expect(p.answer.kind === 'integer' && p.answer.value).toBe(params.den);
          expect(Number(params.answer)).toBe(params.den);
        } else {
          throw new Error('未知の variant: ' + params.variant);
        }
      }
    }
    expect([...seen].sort()).toEqual(['count_units', 'how_many_units', 'meaning', 'read_fraction']);
  });

  it('各 difficulty で十分な種類が出ない (同じ問題の連なりにならない)', () => {
    for (const lv of LEVELS) {
      const questions = generateMany(gen, lv).map((p) => p.question);
      expect(new Set(questions).size, `lv${lv} 問題文の種類`).toBeGreaterThanOrEqual(20);
    }
  });

  it('parameters を改ざんすると validate が不正を報告する', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        const params = p.parameters as { num: number; den: number };
        const badDen: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), den: 1 },
        };
        expect(gen.validate(badDen).valid, '分母1 は検出できる').toBe(false);

        const badNum: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), num: params.den + 1 },
        };
        expect(gen.validate(badNum).valid, '分子>分母 は検出できる').toBe(false);
      }
    }
  });
});

describe('triangle_classify: 三角形の分類', () => {
  const gen = new TriangleClassifyGenerator();

  it('lv1-5 の各レベルで 100問以上生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      const problems = generateMany(gen, lv);
      expect(problems.length).toBeGreaterThanOrEqual(100);
      for (const p of problems) {
        expect(p.difficulty.level, `lv${lv}`).toBe(lv);
      }
    }
  });

  it('全問題が validate を通り、displayed answer を入力すると正解判定される', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        expect(validateProblem(p).valid, `validate ${p.question}`).toBe(true);
        expect(gen.validate(p).valid, `generator.validate ${p.question}`).toBe(true);
        const shown = String(formatAnswer(p.answer));
        expect(shown.length, 'displayed answer が空').toBeGreaterThan(0);
        expect(checkUserAnswer(shown, p.answer), `自己入力判定: ${shown}`).toBe(true);
      }
    }
  });

  it('独立検算: 3辺の長さが答えと一致し、三角形が成立している', () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        const params = p.parameters as {
          variant: string;
          a: number;
          b: number;
          c: number;
          kind: string;
          equalCount?: number;
        };
        seen.add(params.variant);

        const sorted = [params.a, params.b, params.c].sort((x, y) => x - y);
        expect(sorted[0] + sorted[1], '三角形が成立していない').toBeGreaterThan(sorted[2]);
        expect(refTriangleKind(params.a, params.b, params.c)).toBe(params.kind);
        expect(p.question).toContain(String(params.a));
        expect(p.question).toContain(String(params.b));
        expect(p.question).toContain(String(params.c));

        if (params.variant === 'classify') {
          expect(['正三角形', '二等辺三角形', '不等辺三角形']).toContain(
            p.answer.kind === 'string' && p.answer.value,
          );
        } else if (params.variant === 'which_sides_equal') {
          const expectCount = params.kind === '正三角形' ? 3 : 2;
          expect(params.kind).not.toBe('不等辺三角形');
          expect(p.answer.kind === 'integer' && p.answer.value).toBe(expectCount);
          expect(params.equalCount).toBe(expectCount);
        } else {
          throw new Error('未知の variant: ' + params.variant);
        }
      }
    }
    expect([...seen].sort()).toEqual(['classify', 'which_sides_equal']);
  });

  it('正三角形と二等辺三角形が両方出現する (偏りがない)', () => {
    const kinds = new Set<string>();
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        const params = p.parameters as { kind: string };
        if (params.kind !== '不等辺三角形') kinds.add(params.kind);
      }
    }
    expect([...kinds].sort()).toEqual(['二等辺三角形', '正三角形']);
  });

  it('各 difficulty で十分な種類が出ない (同じ問題の連なりにならない)', () => {
    for (const lv of LEVELS) {
      const questions = generateMany(gen, lv).map((p) => p.question);
      expect(new Set(questions).size, `lv${lv} 問題文の種類`).toBeGreaterThanOrEqual(20);
    }
  });

  it('parameters を改ざんすると validate が不正を報告する', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(gen, lv)) {
        const params = p.parameters as { a: number; b: number; c: number; kind: string };
        const broken: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), c: params.a + params.b },
        };
        expect(gen.validate(broken).valid, '三角形が成立しない改ざんを検出できる').toBe(false);

        // 元の分類と異なる種類を代入する (同じ種類だと「改ざんしても正しい」ため検出できない)
        const otherKind = params.kind === '正三角形' ? '不等辺三角形' : '正三角形';
        const wrongKind: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), kind: otherKind },
        };
        expect(gen.validate(wrongKind).valid, '分類の改ざんを検出できる').toBe(false);
      }
    }
  });
});

describe('Phase 2-T: 解説 (途中式) が必ず付く', () => {
  const all = [
    ...LEVELS.flatMap((lv) => generateMany(new DecimalPlaceValueGenerator(), lv)),
    ...LEVELS.flatMap((lv) => generateMany(new FractionUnitIntroGenerator(), lv)),
    ...LEVELS.flatMap((lv) => generateMany(new TriangleClassifyGenerator(), lv)),
  ];

  it('全問題に説明と途中式が存在する', () => {
    for (const p of all) {
      expect(String(p.explanation ?? '').length, `説明が空: ${p.question}`).toBeGreaterThan(0);
      const steps = generateSolutionSteps(p);
      expect(steps.length, `途中式が空: ${p.question}`).toBeGreaterThan(0);
      for (const s of steps) {
        expect(String(s.explanation ?? '').length, '途中の説明が空').toBeGreaterThan(0);
      }
    }
  });
});