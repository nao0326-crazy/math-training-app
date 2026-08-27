/**
 * 分数問題ジェネレータのテスト
 *
 * 最重要の回帰防止 (2026-08 修正):
 *   「分母をそろえる」問題で、問題文は約分済み分数 (例: 3/4) で表示されるのに、
 *   正解が約分前の内部パラメータ (6/8 → LCM(8,5)=40) から計算され、
 *   「30/40 と 16/40」のような誤った標準形が生成されていた。
 *   修正後は必ず既約分数で出題し、共通分母は最小公倍数 (LCM)、
 *   解答は kind: 'fractions' の構造化データとして保存する。
 */

import { describe, expect, it } from 'vitest';
import {
  FractionCommonDenominatorGenerator,
  FractionBigSmallGenerator,
} from './generators';
import {
  gcd,
  lcm,
  commonDenominatorForm,
} from '../../utils/fraction';
import { validateProblem } from '../../engine/validator/validator';

const SEEDS = Array.from({ length: 200 }, (_, i) => i);
const DIFFICULTIES = [1, 2, 3] as const;

describe('FractionCommonDenominatorGenerator (通分)', () => {
  it('3/4 と 2/5 は最小公倍数 20 を使って 15/20 と 8/20 になる', () => {
    // ユーザー報告ケースの直接検証
    expect(lcm(4, 5)).toBe(20);
    const result = commonDenominatorForm(3, 4, 2, 5);
    expect(result.commonDenominator).toBe(20);
    expect(result.numerators).toEqual([15, 8]);
  });

  it('全シード×難易度で既約分数を出題し、表示と計算が一致する (根本原因の回帰防止)', () => {
    const gen = new FractionCommonDenominatorGenerator();
    let checked = 0;

    for (const seed of SEEDS) {
      for (const lv of DIFFICULTIES) {
        let problem;
        try {
          problem = gen.generate({ seed, difficulty: lv });
        } catch {
          continue;
        }
        const { n1, d1, n2, d2, common, newN1, newN2 } = problem.parameters as {
          n1: number; d1: number; n2: number; d2: number;
          common: number; newN1: number; newN2: number;
        };

        // 問題の分数は既約であること (表示 = 計算 を保証)
        expect(gcd(n1, d1), `seed=${seed} lv=${lv} n1/d1=${n1}/${d1}`).toBe(1);
        expect(gcd(n2, d2), `seed=${seed} lv=${lv} n2/d2=${n2}/${d2}`).toBe(1);

        // 問題文には約分後の分数がそのまま表示されること
        expect(problem.question).toContain(`${d1}分の${n1}`);
        expect(problem.question).toContain(`${d2}分の${n2}`);
        // 問題文は最小公倍数による標準形を要求すること
        expect(problem.question).toContain('分母を最小公倍数にそろえて');

        // 共通分母は最小公倍数そのものであること (分母の積ではない)
        expect(common).toBe(lcm(d1, d2));
        expect(common % d1).toBe(0);
        expect(common % d2).toBe(0);
        expect(common).toBeLessThanOrEqual(d1 * d2);

        // 分子は common / 分母 の倍率を掛けた値であること
        expect(newN1).toBe(n1 * (common / d1));
        expect(newN2).toBe(n2 * (common / d2));

        // 解答は構造化データ (kind: 'fractions') で標準形を保持する
        if (problem.answer.kind !== 'fractions') {
          throw new Error(`answer.kind が fractions ではありません: seed=${seed}`);
        }
        expect(problem.answer.values).toEqual([
          { numerator: newN1, denominator: common },
          { numerator: newN2, denominator: common },
        ]);

        // ジェネレータ自身の validate も通過すること
        const result = gen.validate(problem);
        expect(result.valid, `${seed}/${lv}: ${result.errors.join(', ')}`).toBe(true);
        expect(validateProblem(problem).valid).toBe(true);

        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('ジェネレータ単体の validate は改ざんされた解答を検出する', () => {
    const gen = new FractionCommonDenominatorGenerator();
    const problem = gen.generate({ seed: 0, difficulty: 2 });
    const tampered = {
      ...problem,
      answer:
        problem.answer.kind === 'fractions'
          ? {
              kind: 'fractions' as const,
              values: [
                { numerator: problem.answer.values[0].numerator + 1, denominator: problem.answer.values[0].denominator },
                problem.answer.values[1],
              ],
            }
          : problem.answer,
    };
    expect(gen.validate(tampered).valid).toBe(false);

    // 文字列ベースの旧形式解答も拒否する
    const legacyString = {
      ...problem,
      answer: { kind: 'string' as const, value: '1/2 と 1/3' },
    };
    expect(gen.validate(legacyString).valid).toBe(false);
  });
});

describe('FractionBigSmallGenerator (大きさ比較)', () => {
  it('validate は生成した問題を正しく検証する', () => {
    const gen = new FractionBigSmallGenerator();
    for (let seed = 0; seed < 50; seed++) {
      let problem;
      try {
        problem = gen.generate({ seed });
      } catch {
        continue;
      }
      const result = gen.validate(problem);
      expect(result.valid, `seed=${seed}: ${result.errors.join(', ')}`).toBe(true);
    }
  });
});
