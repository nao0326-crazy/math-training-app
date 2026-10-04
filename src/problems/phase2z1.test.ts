// phase2z1.test.ts — 三角形の面積 / 平行四辺形の面積 (Phase 2-Z1)
//
// 目的:
//   - 第5学年「三角形，平行四辺形，ひし形，台形の求積」に対応する2型を検証する
//   - 独立実装 (面積 = 底辺 × 高さ ÷ 2 / 底辺 × 高さ) で全問を検算する
//   - 整数で答えられること (端数が出ないこと)
//   - lv1-5 で要求 difficulty を返すこと
//   - 解説が問題の数値と矛盾しないこと
//   - 多様性 (問題文の重複率、variant の偏り) を確認する

import { describe, expect, it } from 'vitest';
import { TriangleAreaGenerator, ParallelogramAreaGenerator } from './geometry/generators';
import { validateProblem } from '../engine/validator/validator';
import { generateSolutionSteps } from '../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../utils/answer';
import type { DifficultyLevel, Problem } from '../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const PER_LEVEL = 120;

function many(
  gen: { generate: (c: { difficulty: DifficultyLevel; seed: number }) => Problem },
  lv: DifficultyLevel,
): Problem[] {
  const out: Problem[] = [];
  for (let s = 0; s < PER_LEVEL; s++) out.push(gen.generate({ difficulty: lv, seed: s * 104729 + lv * 7919 }));
  return out;
}

/** 独立実装: 三角形の面積 */
function refTriangleArea(base: number, height: number): number {
  return (base * height) / 2;
}

/** 独立実装: 平行四辺形の面積 (÷2 しない) */
function refParallelogramArea(base: number, height: number): number {
  return base * height;
}

type BaseParams = {
  variant: string;
  base: number;
  height: number;
  area: number;
  answer: number;
  slant?: number;
  rectangleArea?: number;
  triangleArea?: number;
};

/** 両方に共通する検証 (数値の妥当性・解答・解説・判定) */
function checkCommon(gen: { validate: (p: Problem) => { valid: boolean; errors: string[] } }, p: Problem): void {
  const q = p.parameters as BaseParams;
  expect(q.base, '底辺が正ではありません').toBeGreaterThan(0);
  expect(q.height, '高さが正ではありません').toBeGreaterThan(0);
  expect(p.question, '問題文が空').not.toBe('');
  // 面積の単位 (cm2) が問題文または解説で明示されていること。
  // 長さの答えを求める variant では cm2 は面積の条件として問題文に出る。
  const areaUnitShown = p.question.includes('cm2') || String(p.explanation ?? '').includes('cm2');
  expect(areaUnitShown, '面積の単位 (cm2) が明示されていません: ' + p.question).toBe(true);
  expect(p.answer.kind).toBe('integer');
  expect(p.answer.kind === 'integer' && p.answer.value).toBe(q.answer);
  expect(validateProblem(p).valid, p.question).toBe(true);
  expect(gen.validate(p).valid, p.question).toBe(true);
  const shown = String(formatAnswer(p.answer));
  expect(checkUserAnswer(shown, p.answer), shown).toBe(true);
  expect(generateSolutionSteps(p).length, '途中式が無い').toBeGreaterThan(0);
}

describe('triangle_area: 三角形の面積', () => {
  const gen = new TriangleAreaGenerator();

  it('lv1-5 の全レベルで 100問以上生成でき、要求 difficulty を返す', () => {
    for (const lv of LEVELS) {
      const list = many(gen, lv);
      expect(list.length).toBeGreaterThanOrEqual(100);
      for (const p of list) expect(p.difficulty.level, `lv${lv}`).toBe(lv);
    }
  });

  it('独立検算: 全600問が 面積 = 底辺 × 高さ ÷ 2 で整数になる', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as BaseParams;
        checkCommon(gen, p);
        // 端数が出ないこと (割り切れない値を丸めていない)
        expect((q.base * q.height) % 2, '底辺×高さが奇数です').toBe(0);
        const want = refTriangleArea(q.base, q.height);
        expect(Number.isInteger(want), '面積が小数になる組合せです').toBe(true);
        expect(q.area).toBe(want);
        if (q.variant === 'find_height') {
          expect(refTriangleArea(q.base, q.answer)).toBe(q.area);
          expect(q.answer).toBe(q.height);
        }
        if (q.variant === 'find_base') {
          expect(refTriangleArea(q.answer, q.height)).toBe(q.area);
          expect(q.answer).toBe(q.base);
        }
        if (q.variant === 'compare_with_rectangle') {
          // 同じ底辺・高さの長方形との差 = 三角形の面積
          expect(q.rectangleArea!).toBe(q.base * q.height);
          expect(q.rectangleArea! - q.area).toBe(q.area);
          expect(q.answer).toBe(q.area);
        }
        checked++;
      }
    }
    expect(checked).toBe(LEVELS.length * PER_LEVEL);
  });

  it('解説が問題の数値と矛盾せず、公式と理由を説明している', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as BaseParams;
        const ex = String(p.explanation ?? '');
        expect(ex.length, '解説が空').toBeGreaterThan(0);
        expect(ex, '公式が説明されていません').toContain('底辺 × 高さ');
        expect(ex, '底辺の数値が解説にありません').toContain(String(q.base));
        expect(ex, '高さの数値が解説にありません').toContain(String(q.height));
        expect(ex, '答えが解説にありません').toContain(String(q.answer));
      }
    }
  });

  it('全 variant が出現し、低い難易度では難しい variant が出ない', () => {
    const byLevel = new Map<DifficultyLevel, Set<string>>();
    for (const lv of LEVELS) {
      const set = new Set<string>();
      for (const p of many(gen, lv)) set.add((p.parameters as BaseParams).variant);
      byLevel.set(lv, set);
    }
    const all = new Set<string>();
    for (const s of byLevel.values()) for (const v of s) all.add(v);
    expect([...all].sort()).toEqual([
      'compare_with_rectangle', 'find_area', 'find_area_with_slant', 'find_base', 'find_height',
    ]);
    // lv1 は基本の公式適用のみ
    expect(byLevel.get(1)).toEqual(new Set(['find_area']));
    expect(byLevel.get(5)!.size).toBeGreaterThanOrEqual(byLevel.get(1)!.size);
  });

  it('多様性: 問題文の重複が低く、variant も偏っていない', () => {
    const all = LEVELS.flatMap((lv) => many(gen, lv));
    const unique = new Set(all.map((p) => p.question)).size;
    expect(unique, '問題文の種類').toBeGreaterThanOrEqual(400);
    expect(unique / all.length, '重複率が75%を下回る').toBeGreaterThan(0.75);
    const counts = new Map<string, number>();
    for (const p of all) {
      const v = (p.parameters as BaseParams).variant;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const max = Math.max(...counts.values());
    expect(max / all.length, '特定の variant に偏っています').toBeLessThan(0.6);
  });

  it('改ざん検出: parameters を壊すと validate が不正を報告する', () => {
    for (const lv of [1, 3, 5] as DifficultyLevel[]) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as BaseParams;
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), area: q.area + 1 } }).valid,
          '面積の改ざん').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), base: 0 } }).valid,
          '底辺0').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), answer: q.answer + 1 } }).valid,
          '答えの改ざん').toBe(false);
      }
    }
  });
});

describe('parallelogram_area: 平行四辺形の面積', () => {
  const gen = new ParallelogramAreaGenerator();

  it('lv1-5 の全レベルで 100問以上生成でき、要求 difficulty を返す', () => {
    for (const lv of LEVELS) {
      const list = many(gen, lv);
      expect(list.length).toBeGreaterThanOrEqual(100);
      for (const p of list) expect(p.difficulty.level, `lv${lv}`).toBe(lv);
    }
  });

  it('独立検算: 全600問が 面積 = 底辺 × 高さ (÷2 しない) を満たす', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as BaseParams;
        checkCommon(gen, p);
        const want = refParallelogramArea(q.base, q.height);
        expect(q.area).toBe(want);
        // 三角形と混同していないこと (÷2 していない)
        expect(q.area, '三角形の面積になっていません').not.toBe(want / 2);
        if (q.variant === 'find_height') {
          expect(refParallelogramArea(q.base, q.answer)).toBe(q.area);
          expect(q.answer).toBe(q.height);
        }
        if (q.variant === 'find_base') {
          expect(refParallelogramArea(q.answer, q.height)).toBe(q.area);
          expect(q.answer).toBe(q.base);
        }
        if (q.variant === 'two_triangles') {
          expect(q.triangleArea).toBe(q.area / 2);
          expect(q.answer).toBe(q.area / 2);
          expect(Number.isInteger(q.answer), '三角形の面積が小数です').toBe(true);
        }
        // 斜辺が併記されている variant では、斜辺が高さと違うこと
        if (q.slant !== undefined) {
          expect(q.slant, '斜辺と高さが同じです').not.toBe(q.height);
        }
        checked++;
      }
    }
    expect(checked).toBe(LEVELS.length * PER_LEVEL);
  });

  it('解説が問題の数値と矛盾せず、公式と理由を説明している', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as BaseParams;
        const ex = String(p.explanation ?? '');
        expect(ex.length, '解説が空').toBeGreaterThan(0);
        expect(ex, '公式が説明されていません').toContain('底辺 × 高さ');
        expect(ex, '底辺の数値が解説にありません').toContain(String(q.base));
        expect(ex, '高さの数値が解説にありません').toContain(String(q.height));
        expect(ex, '答えが解説にありません').toContain(String(q.answer));
      }
    }
  });

  it('全 variant が出現し、低い難易度では難しい variant が出ない', () => {
    const byLevel = new Map<DifficultyLevel, Set<string>>();
    for (const lv of LEVELS) {
      const set = new Set<string>();
      for (const p of many(gen, lv)) set.add((p.parameters as BaseParams).variant);
      byLevel.set(lv, set);
    }
    const all = new Set<string>();
    for (const s of byLevel.values()) for (const v of s) all.add(v);
    expect([...all].sort()).toEqual([
      'find_area', 'find_area_with_slant', 'find_base', 'find_height', 'two_triangles',
    ]);
    expect(byLevel.get(1)).toEqual(new Set(['find_area']));
    expect(byLevel.get(5)!.size).toBeGreaterThanOrEqual(byLevel.get(1)!.size);
  });

  it('多様性: 問題文の重複が低く、variant も偏っていない', () => {
    const all = LEVELS.flatMap((lv) => many(gen, lv));
    const unique = new Set(all.map((p) => p.question)).size;
    expect(unique, '問題文の種類').toBeGreaterThanOrEqual(400);
    expect(unique / all.length, '重複率が75%を下回る').toBeGreaterThan(0.75);
    const counts = new Map<string, number>();
    for (const p of all) {
      const v = (p.parameters as BaseParams).variant;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const max = Math.max(...counts.values());
    expect(max / all.length, '特定の variant に偏っています').toBeLessThan(0.6);
  });

  it('改ざん検出: parameters を壊すと validate が不正を報告する', () => {
    for (const lv of [1, 3, 5] as DifficultyLevel[]) {
      for (const p of many(gen, lv)) {
        const q = p.parameters as BaseParams;
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), area: q.area + 1 } }).valid,
          '面積の改ざん').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), height: 0 } }).valid,
          '高さ0').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), answer: q.answer + 1 } }).valid,
          '答えの改ざん').toBe(false);
      }
    }
  });
});