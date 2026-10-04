// geometry-phase2s.test.ts — 円周 / 台形の面積 / 基本単位換算 (Phase 2-S)
//
// 目的:
//   - 3つの新規 generator が lv1-5 で生成でき、validate を通ること
//   - generator 自身の validate を鵜呑みにせず、独立した方法で正答を検算すること
//   - 問題文・解答・解説・途中式が相互に一致すること
//   - 数値が正の整数であること、ゼロ除算がないこと
//   - 各 lv で十分な種類の問題が出ること
//
// 独立検算の方式:
//   - 円周: 「直径×円周率」「円周÷円周率」を別実装で計算する
//   - 台形: (上底+下底)×高さ÷2 を別実装で計算する
//   - 単位: 基準単位 (mm / g / 秒 / ㎠) の倍率表を別実装で持ち、比の一致を確認する

import { describe, expect, it } from 'vitest';
import {
  CircleCircumferenceGenerator,
  TrapezoidAreaGenerator,
  UnitConversionBasicGenerator,
} from './generators';
import { validateProblem } from '../../engine/validator/validator';
import { attachSolutionSteps } from '../../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import { generateProblemId } from '../../utils/random';
import type { DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const PI = 3.14;

/** 生成器と独立に「直径 × 円周率」を計算する */
function independentCircumference(diameter: number): number {
  return Math.round(diameter * PI * 100) / 100;
}

/** 生成器と独立に「(上底+下底)×高さ÷2」を計算する */
function independentTrapezoidArea(a: number, b: number, h: number): number {
  return ((a + b) * h) / 2;
}

/** 生成器と独立に、基準単位に対する倍率表 (mm / g / 秒 / ㎠ が基準) */
const REFACTORS: Record<string, Record<string, number>> = {
  length: { mm: 1, cm: 10, m: 1000, km: 1000000 },
  mass: { g: 1, kg: 1000 },
  time: { '秒': 1, '分': 60, '時': 3600 },
  area: { '㎠': 1, '㎡': 10000 },
};

function generateMany(
  gen: { generate: (c: { difficulty: DifficultyLevel; seed: number }) => Problem },
  count: number,
  seed: number,
): Problem[] {
  const out: Problem[] = [];
  for (let i = 0; i < count; i++) out.push(gen.generate({ difficulty: 3, seed: seed + i * 7919 }));
  return out;
}

describe('circle_circumference: 円周', () => {
  const gen = new CircleCircumferenceGenerator();

  it('lv1-5 のすべてで生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 104729 + lv });
        expect(p.difficulty.level, `lv${lv} seed${s}`).toBe(lv);
        expect(validateProblem(p).valid, `lv${lv} seed${s} validate`).toBe(true);
      }
    }
  });

  it('直径×円周率 で独立検算できる (from_diameter)', () => {
    let checked = 0;
    // from_diameter は lv1 / lv3 / lv4 で使われる
    for (const lv of [1, 3, 4] as DifficultyLevel[]) {
      for (let s = 0; s < 60; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 6151 + lv });
        const params = p.parameters as {
          variant: string;
          diameter: number;
          circumference: number;
          unit: string;
          answerUnit?: string;
        };
        expect(params.variant).toBe('from_diameter');
        expect(p.question).toContain('直径');
        expect(p.question).toContain('円周');
        expect(p.question).toContain('3.14');
        expect(params.diameter).toBeGreaterThan(0);
        const expected = independentCircumference(params.diameter);
        expect(params.circumference).toBeCloseTo(expected, 6);
        expect(p.answer.kind).toBe('decimal');
        if (params.answerUnit === 'm') {
          // 単位変換を伴うのは lv4。答えは m で、piArea と同じく小数第2位に丸める。
          expect(p.answer.kind).toBe('decimal');
          if (p.answer.kind === 'decimal') {
            expect(p.answer.value).toBeCloseTo(Math.round((expected / 100) * 100) / 100, 6);
          }
          expect(p.question).toContain('mで求めなさい');
          expect(p.explanation).toContain('100cm＝1m');
        } else {
          if (p.answer.kind === 'decimal') {
            expect(p.answer.value).toBeCloseTo(expected, 6);
          }
        }
        checked++;
      }
    }
    expect(checked).toBe(180);
  });

  it('円周÷円周率 で直径が求まる (from_circumference)', () => {
    let checked = 0;
    for (const lv of [2, 5] as DifficultyLevel[]) {
      for (let s = 0; s < 60; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 7907 + lv });
        const params = p.parameters as {
          variant: string;
          diameter: number;
          circumference: number;
          unit: string;
        };
        expect(params.variant).toBe('from_circumference');
        expect(p.question).toContain('円周が');
        expect(p.question).toContain('直径');
        expect(p.answer.kind).toBe('integer');
        const expectCirc = independentCircumference(
          params.unit === 'm' ? params.diameter * 100 : params.diameter,
        );
        expect(params.circumference).toBeCloseTo(
          params.unit === 'm' ? expectCirc / 100 : expectCirc,
          6,
        );
        if (p.answer.kind === 'integer') {
          expect(p.answer.value).toBe(params.diameter);
        }
        checked++;
      }
    }
    expect(checked).toBe(120);
  });

  it('解答判定・解説・途中式が一致する', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 40; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 31 + lv });
        expect(checkUserAnswer(formatAnswer(p.answer), p.answer)).toBe(true);
        expect(p.explanation).toContain(formatAnswer(p.answer));
        const steps = attachSolutionSteps(p).solutionSteps ?? [];
        expect(steps.length).toBeGreaterThan(0);
        expect(steps.some((st) => (st.expression ?? '').includes('3.14'))).toBe(true);
      }
    }
  });

  it('半径を問わない (直径と取り違えない)', () => {
    for (const p of generateMany(gen, 120, 500)) {
      expect(p.question).toContain('直径');
      expect(p.question).not.toContain('半径');
    }
  });

  it('lv ごとに複数種類の問題が出る', () => {
    for (const lv of LEVELS) {
      const qs = new Set<string>();
      for (let s = 0; s < 60; s++) {
        qs.add(gen.generate({ difficulty: lv, seed: s * 104729 + lv }).question);
      }
      expect(qs.size, `lv${lv} の問題文の種類`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('trapezoid_area: 台形の面積', () => {
  const gen = new TrapezoidAreaGenerator();

  it('lv1-5 のすべてで生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 104729 + lv });
        expect(p.difficulty.level, `lv${lv} seed${s}`).toBe(lv);
        expect(validateProblem(p).valid, `lv${lv} seed${s} validate`).toBe(true);
      }
    }
  });

  it('(上底+下底)×高さ÷2 で独立検算できる (全 variant)', () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 6151 + lv });
        const { variant, a, b, h } = p.parameters as {
          variant: string;
          a: number;
          b: number;
          h: number;
        };
        seen.add(variant);
        expect(a).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
        expect(Number.isInteger(a)).toBe(true);
        expect(Number.isInteger(b)).toBe(true);
        expect(Number.isInteger(h)).toBe(true);
        const area = independentTrapezoidArea(a, b, h);
        expect(Number.isInteger(area)).toBe(true);
        expect(p.answer.kind).toBe('integer');
        expect(p.question).toContain('上底');
        expect(p.question).toContain('下底');
        if (variant === 'basic') {
          // 公式をそのまま代入する形なので、答えが面積になる
          if (p.answer.kind === 'integer') expect(p.answer.value).toBe(area);
          expect(p.question).toContain('面積を求めなさい');
        } else if (variant === 'reverse_height') {
          expect(p.question).toContain('高さは何cmですか');
          if (p.answer.kind === 'integer') expect(p.answer.value).toBe(h);
        } else {
          expect(p.question).toContain('上底は何cmですか');
          if (p.answer.kind === 'integer') expect(p.answer.value).toBe(a);
        }
      }
    }
    expect([...seen].sort()).toEqual(['basic', 'reverse_base', 'reverse_height']);
  });

  it('解答判定・解説・途中式が一致する', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 40; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 31 + lv });
        expect(checkUserAnswer(formatAnswer(p.answer), p.answer)).toBe(true);
        expect(p.explanation).toContain(formatAnswer(p.answer));
        const steps = attachSolutionSteps(p).solutionSteps ?? [];
        expect(steps.length).toBeGreaterThan(0);
      }
    }
  });

  it('斜辺を要求しない (高さと区別している)', () => {
    for (const p of generateMany(gen, 120, 700)) {
      expect(p.question).not.toContain('斜辺');
    }
  });

  it('lv ごとに複数種類の問題が出る', () => {
    for (const lv of LEVELS) {
      const qs = new Set<string>();
      for (let s = 0; s < 60; s++) {
        qs.add(gen.generate({ difficulty: lv, seed: s * 104729 + lv }).question);
      }
      expect(qs.size, `lv${lv} の問題文の種類`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('unit_conversion_basic: 基本単位換算', () => {
  const gen = new UnitConversionBasicGenerator();

  it('lv1-5 のすべてで生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 104729 + lv });
        expect(p.difficulty.level, `lv${lv} seed${s}`).toBe(lv);
        expect(validateProblem(p).valid, `lv${lv} seed${s} validate`).toBe(true);
      }
    }
  });

  it('独立した倍率表で換算が正しい', () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 80; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 6151 + lv });
        const { variant, from, to, value, answer } = p.parameters as {
          variant: string;
          from: string;
          to: string;
          value: number;
          answer: number;
        };
        seen.add(variant);
        const table = REFACTORS[variant];
        expect(table, `未知の variant ${variant}`).toBeDefined();
        const fFrom = table[from];
        const fTo = table[to];
        expect(fFrom, `未知の変換元単位 ${from}`).toBeDefined();
        expect(fTo, `未知の変換先単位 ${to}`).toBeDefined();
        expect(from).not.toBe(to);
        expect(value).toBeGreaterThan(0);
        expect(Number.isInteger(value)).toBe(true);
        expect(answer).toBeGreaterThan(0);
        expect(Number.isInteger(answer)).toBe(true);
        // 独立検算: value(from)×fFrom ＝ answer(to)×fTo
        expect(value * fFrom).toBe(answer * fTo);
        expect(p.answer.kind).toBe('integer');
        if (p.answer.kind === 'integer') expect(p.answer.value).toBe(answer);
        expect(p.question).toContain(String(value));
        expect(p.question).toContain(from);
        expect(p.question).toContain(to);
      }
    }
    expect([...seen].sort()).toEqual(['area', 'length', 'mass', 'time']);
  });

  it('面積の倍率は長さの2乗になっている', () => {
    expect(REFACTORS.area['㎡'] / REFACTORS.area['㎠']).toBe(10000);
    const ratio = REFACTORS.length.m / REFACTORS.length.cm;
    expect(ratio * ratio).toBe(REFACTORS.area['㎡'] / REFACTORS.area['㎠']);
  });

  it('体積は対象としない (既存 volume_unit と重複させない)', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 104729 + lv });
        expect(p.question).not.toContain('cm³');
        expect(p.question).not.toContain('㎤');
        expect(p.question).not.toContain('L');
      }
    }
  });

  it('解答判定・解説・途中式が一致する', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 40; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 31 + lv });
        expect(checkUserAnswer(formatAnswer(p.answer), p.answer)).toBe(true);
        expect(p.explanation).toContain(formatAnswer(p.answer));
        const steps = attachSolutionSteps(p).solutionSteps ?? [];
        expect(steps.length).toBeGreaterThan(0);
      }
    }
  });

  it('lv ごとに複数種類の問題が出る', () => {
    for (const lv of LEVELS) {
      const qs = new Set<string>();
      for (let s = 0; s < 60; s++) {
        qs.add(gen.generate({ difficulty: lv, seed: s * 104729 + lv }).question);
      }
      expect(qs.size, `lv${lv} の問題文の種類`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('新規3型の validate は改ざんを検出する', () => {
  it('台形の面積が違えば invalid になる', () => {
    const gen = new TrapezoidAreaGenerator();
    const p = gen.generate({ difficulty: 1, seed: 42 });
    const bad: Problem = {
      ...p,
      parameters: { ...p.parameters, area: 999999 },
      answer: { kind: 'integer', value: 999999 },
    };
    expect(gen.validate(bad).valid).toBe(false);
  });

  it('円周が違えば invalid になる', () => {
    const gen = new CircleCircumferenceGenerator();
    const p = gen.generate({ difficulty: 1, seed: 42 });
    const bad: Problem = { ...p, parameters: { ...p.parameters, circumference: 12345 } };
    expect(gen.validate(bad).valid).toBe(false);
  });

  it('単位換算が違えば invalid になる', () => {
    const gen = new UnitConversionBasicGenerator();
    const p = gen.generate({ difficulty: 2, seed: 42 });
    const bad: Problem = {
      ...p,
      parameters: { ...p.parameters, answer: 123456 },
      answer: { kind: 'integer', value: 123456 },
    };
    expect(gen.validate(bad).valid).toBe(false);
  });

  it('未知の variant は invalid になる', () => {
    const gen = new TrapezoidAreaGenerator();
    const p = gen.generate({ difficulty: 1, seed: 42 });
    const bad: Problem = {
      ...p,
      id: generateProblemId(),
      parameters: { ...p.parameters, variant: 'nope' },
    };
    expect(gen.validate(bad).valid).toBe(false);
  });
});