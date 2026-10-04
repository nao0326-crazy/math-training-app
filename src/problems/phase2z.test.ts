// phase2z.test.ts — 正方形・長方形の面積 (Phase 2-Z)
//
// 目的:
//   - 令和6年度の調査で第4学年「正方形，長方形の面積」を確認できた内容を実装している
//   - lv1-5 のすべてで要求 difficulty を返すこと
//   - 独立実装 (面積 = 縦 × 横) で全問を検算すること
//   - 正方形と長方形を取り違えないこと (2辺が等しいかどうか)
//   - 公式の逆 (面積から1辺) と単位換算 (m → cm) が整合すること
//   - 解説と途中式が必ず付くこと

import { describe, expect, it } from 'vitest';
import { RectangleAreaGenerator } from './geometry/generators';
import { validateProblem } from '../engine/validator/validator';
import { generateSolutionSteps } from '../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../utils/answer';
import type { DifficultyLevel, Problem } from '../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const PER_LEVEL = 120;

function many(lv: DifficultyLevel): Problem[] {
  const gen = new RectangleAreaGenerator();
  const out: Problem[] = [];
  for (let s = 0; s < PER_LEVEL; s++) out.push(gen.generate({ difficulty: lv, seed: s * 104729 + lv * 7919 }));
  return out;
}

type Params = {
  variant: string;
  width: number;
  height: number;
  area: number;
  answer: number;
  unit: string;
};

describe('rectangle_area: 正方形・長方形の面積', () => {
  const gen = new RectangleAreaGenerator();

  it('lv1-5 の各レベルで 100問以上生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      const list = many(lv);
      expect(list.length).toBeGreaterThanOrEqual(100);
      for (const p of list) expect(p.difficulty.level, `lv${lv}`).toBe(lv);
    }
  });

  it('独立検算: 全600問が 面積 = 縦 × 横 を満たし、答えが整合する', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (const p of many(lv)) {
        const q = p.parameters as Params;
        expect(q.width, '縦の長さが正').toBeGreaterThan(0);
        expect(q.height, '横の長さが正').toBeGreaterThan(0);
        // 独立に検算する
        expect(q.width * q.height).toBe(q.area);
        if (q.variant === 'square') {
          expect(q.width).toBe(q.height); // 正方形は2辺が等しい
        }
        if (q.variant === 'rectangle') {
          expect(q.width).not.toBe(q.height); // 長方形は2辺が異なる
        }
        if (q.variant === 'find_side') {
          // 答えがもう一方の辺と掛け合わさる
          const other = q.answer === q.width ? q.height : q.width;
          expect(other * q.answer).toBe(q.area);
        }
        if (q.variant === 'unit_convert') {
          expect(q.area % 10000).toBe(0); // cm2 は 10000 の倍数
          expect(q.width % 100).toBe(0); // 1辺は100cmの倍数
        }
        // 答えの整合
        if (q.variant === 'choose_formula') {
          expect(p.answer.kind).toBe('string');
        } else {
          expect(p.answer.kind === 'integer' && p.answer.value).toBe(q.answer);
        }
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
      for (const p of many(lv)) {
        seen.add((p.parameters as Params).variant);
        expect(String(p.explanation ?? '').length, '説明が空').toBeGreaterThan(0);
        // 解説の最終結果と答えが矛盾しないこと
        expect(p.explanation, '解説に答えが含まれません').toContain(
          String((p.parameters as Params).answer),
        );
        expect(generateSolutionSteps(p).length).toBeGreaterThan(0);
      }
    }
    expect([...seen].sort()).toEqual(['choose_formula', 'find_side', 'rectangle', 'square', 'unit_convert']);
  });

  it('低い難易度では難しい variant が出ない', () => {
    const byLevel = new Map<DifficultyLevel, Set<string>>();
    for (const lv of LEVELS) {
      const set = new Set<string>();
      for (const p of many(lv)) set.add((p.parameters as Params).variant);
      byLevel.set(lv, set);
    }
    expect(byLevel.get(1)).not.toContain('choose_formula');
    expect(byLevel.get(1)).not.toContain('unit_convert');
    expect(byLevel.get(1)!.size).toBeGreaterThanOrEqual(2);
    expect(byLevel.get(5)!.size).toBeGreaterThanOrEqual(byLevel.get(1)!.size);
  });

  it('多様性: 数値の入れ替え以外の問題文も出る', () => {
    const all = LEVELS.flatMap((lv) => many(lv));
    expect(new Set(all.map((p) => p.question)).size).toBeGreaterThanOrEqual(200);
  });

  it('改ざん検出: parameters を壊すと validate が不正を報告する', () => {
    for (const lv of LEVELS) {
      for (const p of many(lv)) {
        const q = p.parameters as Params;
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), area: q.area + 1 } }).valid,
          '面積の改ざん').toBe(false);
        expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), width: 0 } }).valid,
          '幅0').toBe(false);
        if (q.variant === 'square') {
          expect(gen.validate({ ...p, parameters: { ...(p.parameters as object), height: q.width + 1 } }).valid,
            '正方形の2辺が等しくない').toBe(false);
        }
      }
    }
  });
});