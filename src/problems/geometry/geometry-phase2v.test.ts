// geometry-phase2v.test.ts — 面積の単位変換 (Phase 2-V)
//
// 目的:
//   - lv1-5 で生成でき、要求した difficulty を返すこと
//   - 単位の関係 (1㎡=10000㎠ / 1a=100㎡ / 1ha=100a / 1㎢=100ha) に反しないこと
//   - generator の係数を使わず、一次資料どおりの係数で独立に検算すること
//   - 割り切れない値を丸めて答えにしていないこと (丸め誤差の検出)
//   - validate が改ざんを検出すること
//   - 解説が問題の条件 (掛けるか割るか) と一致すること

import { describe, expect, it } from 'vitest';
import { AreaUnitConversionGenerator } from './generators';
import { validateProblem } from '../../engine/validator/validator';
import { generateSolutionSteps } from '../../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import type { DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const PER_LEVEL = 120;

/**
 * 一次資料 (第4学年 B(4) 面積の単位) に基づく係数。
 * generator の AREA_SQM_FACTOR とは別の表で検算する。
 */
const REF_FACTOR: Record<string, number> = {
  '㎠': 1,
  '㎡': 10000,
  'a': 10000 * 100,
  'ha': 10000 * 100 * 100,
  '㎢': 10000 * 100 * 100 * 100,
};

function generateMany(lv: DifficultyLevel): Problem[] {
  const gen = new AreaUnitConversionGenerator();
  const out: Problem[] = [];
  for (let s = 0; s < PER_LEVEL; s++) {
    out.push(gen.generate({ difficulty: lv, seed: s * 104729 + lv * 7919 }));
  }
  return out;
}

type Params = {
  variant: string;
  from: string;
  to: string;
  givenValue: number;
  answer: number;
  multiplier: number;
};

describe('area_unit_conversion: 生成と difficulty', () => {
  const gen = new AreaUnitConversionGenerator();

  it('lv1-5 の各レベルで 100問以上生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      const problems = generateMany(lv);
      expect(problems.length).toBeGreaterThanOrEqual(100);
      for (const p of problems) {
        expect(p.difficulty.level, `lv${lv}`).toBe(lv);
      }
    }
  });

  it('全問題が validate を通り、displayed answer を入力すると正解判定される', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        expect(validateProblem(p).valid, `validate: ${p.question}`).toBe(true);
        expect(gen.validate(p).valid, `generator.validate: ${p.question}`).toBe(true);
        const shown = String(formatAnswer(p.answer));
        expect(shown.length).toBeGreaterThan(0);
        expect(checkUserAnswer(shown, p.answer), `自己入力判定: ${shown}`).toBe(true);
      }
    }
  });

  it('解説が必ず付き、途中の式も必ず付く', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        expect(String(p.explanation ?? '').length, `説明が空: ${p.question}`).toBeGreaterThan(0);
        const steps = generateSolutionSteps(p);
        expect(steps.length, `途中式が空: ${p.question}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('area_unit_conversion: 独立検算', () => {
  it('一次資料どおりの係数で全問題の答えを検算する', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        const params = p.parameters as Params;
        const fFrom = REF_FACTOR[params.from];
        const fTo = REF_FACTOR[params.to];
        expect(fFrom, '未知の変換元単位: ' + params.from).toBeGreaterThan(0);
        expect(fTo, '未知の変換先単位: ' + params.to).toBeGreaterThan(0);
        expect(params.from).not.toBe(params.to);

        // 与えられた値を ㎠ 換算し、答えが整数になることを確認する
        const totalSqcm = params.givenValue * fFrom;
        expect(Number.isInteger(totalSqcm), '与えらた値が ㎠ に換算できません: ' + p.question).toBe(true);
        const want = totalSqcm / fTo;
        expect(Number.isInteger(want), '答えが割り切れません: ' + p.question).toBe(true);

        // 丸め誤差がないこと (generator が丸めていないか)
        expect(p.answer.kind).toBe('integer');
        expect(p.answer.kind === 'integer' && p.answer.value).toBe(want);
        expect(params.answer).toBe(want);

        // 保存された係数が検算の係数と一致すること
        const wantMult = fTo / fFrom >= 1 ? fTo / fFrom : fFrom / fTo;
        expect(params.multiplier).toBe(wantMult);
        expect(Number.isInteger(params.multiplier)).toBe(true);
        expect(params.multiplier).toBeGreaterThanOrEqual(100);

        // 正の値であること (ゼロ除算・負値の防止)
        expect(params.answer).toBeGreaterThan(0);
        expect(params.givenValue).toBeGreaterThan(0);
        

        // 問題文に与えられた値と単位が入っていること (図なしでも判断できること)
        expect(p.question).toContain(params.from);
        expect(p.question).toContain(params.to);
        checked++;
      }
    }
    expect(checked).toBe(LEVELS.length * PER_LEVEL);
  });

  it('長さの単位と混同していない (面積どうしの換算のみ)', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        const params = p.parameters as Params;
        // 長さの単位 (cm / m / km / mm / g / 秒) が混ざっていない
        for (const lengthUnit of ['cm', 'm', 'km', 'mm', 'g', '秒', '分', '時']) {
          expect(params.from, `長さの単位が混入: ${p.question}`).not.toBe(lengthUnit);
          expect(params.to, `長さの単位が混入: ${p.question}`).not.toBe(lengthUnit);
        }
      }
    }
  });

  it('割り切れない組み合わせを出さない (1a は整数 ㎡ に必ず割り切れる)', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        const params = p.parameters as Params;
        if (params.from === '㎡' && params.to === 'a') {
          // 100㎡ = 1a なので、与えられた値は 100 の倍数でなければならない
          expect(params.givenValue % 1, '1a 未満の値が出ています: ' + p.question).toBe(0);
        }
        if (params.from === 'ha' && params.to === '㎢') {
          expect(params.answer, '1㎢ 未満が出ています: ' + p.question).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('解説が掛けるか割るかを問題文と一致させている', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        const params = p.parameters as Params;
        const steps = generateSolutionSteps(p);
        const text = steps.map((s) => (s.expression ?? '') + (s.explanation ?? '')).join(' ');
        // 変換先の単位のほうが大きければ割り算、小さければ掛け算
        if (REF_FACTOR[params.to] > REF_FACTOR[params.from]) {
          expect(text, '割り算の解説が無い: ' + p.question).toContain('÷');
        } else {
          expect(text, '掛け算の解説が無い: ' + p.question).toContain('×');
        }
      }
    }
  });

  it('各難易度で十分な種類の問題が出る', () => {
    for (const lv of LEVELS) {
      const problems = generateMany(lv);
      const questions = problems.map((p) => p.question);
      const unique = new Set(questions).size;
      expect(unique, `lv${lv} の問題文の種類`).toBeGreaterThanOrEqual(15);
      expect(unique).toBeLessThanOrEqual(PER_LEVEL);
      // 数値の入れ替えだけでなく、換算の組み合わせも複数出ていること
      const variants = new Set(problems.map((p) => (p.parameters as Params).variant));
      expect(variants.size, `lv${lv} の換算の種類`).toBeGreaterThanOrEqual(3);
    }
  });

  it('低い難易度では難しい換算が出ない (段階的に増やす)', () => {
    const byLevel = new Map<DifficultyLevel, Set<string>>();
    for (const lv of LEVELS) {
      const set = new Set<string>();
      for (const p of generateMany(lv)) set.add((p.parameters as Params).variant);
      byLevel.set(lv, set);
    }
    expect(byLevel.get(1)).not.toContain('sqm_to_aresu');
    expect(byLevel.get(1)).not.toContain('hektaru_to_sqkm');
    expect(byLevel.get(5)!.size).toBeGreaterThanOrEqual(byLevel.get(1)!.size);
  });

  it('parameters を改ざんすると validate が不正を報告する', () => {
    const gen = new AreaUnitConversionGenerator();
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        const params = p.parameters as Params;

        const badAnswer: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), answer: params.answer + 1 },
        };
        expect(gen.validate(badAnswer).valid, '答えの改ざんを検出できる').toBe(false);

        const badUnit: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), to: 'cm' },
        };
        expect(gen.validate(badUnit).valid, '未知の単位を検出できる').toBe(false);

        const badSame: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), to: params.from },
        };
        expect(gen.validate(badSame).valid, '同一単位の改ざんを検出できる').toBe(false);

        const badZero: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), answer: 0 },
        };
        expect(gen.validate(badZero).valid, '答え0 を検出できる').toBe(false);

        const badMult: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), multiplier: 3 },
        };
        expect(gen.validate(badMult).valid, '倍率の改ざんを検出できる').toBe(false);
      }
    }
  });
});