/**
 * phase2f-validate.test.ts — Phase 2-F 横断監査で見つかった validate / 生成バグの回帰テスト
 *
 * いずれも「generator単体では検出できなかった」不整合である。
 * 共通 validateProblem() は通るため、既存テストでは見落としていた。
 *
 * 1. ratio_simplify: 答えが最大公約数で割った形になっていなかった
 *    (生成時に選んだ g は「公約数」であって最大公約数とは限らない)
 * 2. fraction_mixed_convert: 答えが簡約されるため validate が
 *    「分母一致」を要求して誤検知していた (両方向の変換)
 * 3. data_compare: 平均が等しい問題を出しており、選択肢が2つだと答えられない
 * 4. inverse_word: lv5 で「割り切れる組み合わせ」の成立確率が約17%のため
 *    100回試行では生成失敗しうる
 */

import { describe, expect, it } from 'vitest';
import { RatioSimplifyGenerator, InverseWordGenerator } from '../problems/ratio/generators';
import { FractionMixedConvertGenerator, FractionMulIntegerGenerator } from '../problems/fraction/generators';
import { DataCompareGenerator } from '../problems/data/generators';
import { reduceFraction, toMixedNumber } from '../utils/fraction';
import { validateProblem } from '../engine/validator/validator';
import { checkUserAnswer, formatAnswer } from '../utils/answer';
import { getProblemChoiceOptions } from '../utils/inputType';
import type { DifficultyLevel } from '../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

/** 最大公約数 (ジェネレータの gcd() を借りずに自前で計算する) */
function maxCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

describe('ratio_simplify: 答えは必ず最大公約数で割った既約比になる', () => {
  const gen = new RatioSimplifyGenerator();

  it('全 difficulty で validate を通り、答えが既約比である', () => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      for (let s = 0; s < 150; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 7919 + lv });
        const result = gen.validate(p);
        if (!result.valid) {
          bad.push(`lv${lv}s${s}: ${result.errors.join('|')}`);
          continue;
        }
        const { a, b } = p.parameters as { a: number; b: number };
        const g = maxCommonDivisor(a, b);
        const expected = `${a / g}：${b / g}`;
        if (p.answer.kind !== 'string' || p.answer.value !== expected) {
          bad.push(`lv${lv}s${s}: a=${a} b=${b} 答え=${formatAnswer(p.answer)} 期待=${expected}`);
        }
        if (maxCommonDivisor(a / g, b / g) !== 1) {
          bad.push(`lv${lv}s${s}: 答えが既約になっていない`);
        }
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で不正`).toBe('');
  });

  it('説明文の最大公約数が実際の最大公約数である', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 31 + lv });
        const { a, b } = p.parameters as { a: number; b: number };
        expect(p.explanation ?? '', `a=${a} b=${b}`).toContain(`最大公約数${maxCommonDivisor(a, b)}`);
      }
    }
  });

  it('4:8 は 1:2 になる (Phase 2-F で発見された具体例)', () => {
    // 修正前は 2:4 (約分されていない) を返していた
    let found = false;
    for (let s = 0; s < 400 && !found; s++) {
      for (const lv of LEVELS) {
        const p = gen.generate({ difficulty: lv, seed: s * 104729 + lv });
        const { a, b } = p.parameters as { a: number; b: number };
        if (a === 4 && b === 8) {
          expect(p.answer.kind === 'string' ? p.answer.value : '').toBe('1：2');
          found = true;
          break;
        }
      }
    }
    expect(found, '4:8 が生成されなかった').toBe(true);
  });
});
describe('fraction_mixed_convert: 両方向の変換を正しく検証する', () => {
  const gen = new FractionMixedConvertGenerator();

  it('全 difficulty で validate を通り、変換前の値と一致する', () => {
    const bad: string[] = [];
    let mixedCount = 0;
    let fracCount = 0;
    for (const lv of LEVELS) {
      for (let s = 0; s < 150; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 1013 + lv });
        const result = gen.validate(p);
        if (!result.valid) {
          bad.push(`lv${lv}s${s}: ${result.errors.join('|')}`);
          continue;
        }
        const params = p.parameters as {
          numerator: number; denominator: number; whole?: number;
        };
        const { numerator, denominator } = params;
        if (p.answer.kind === 'mixed') {
          mixedCount++;
          // 仮分数 -> 帯分数。値は変わっていないはず
          const value = p.answer.whole * p.answer.denominator + p.answer.numerator;
          if (value * denominator !== numerator * p.answer.denominator) {
            bad.push(`lv${lv}s${s}: 帯分数の値が不一致`);
          }
          if (p.answer.whole !== toMixedNumber(numerator, denominator).whole) {
            bad.push(`lv${lv}s${s}: 整数部が不一致`);
          }
        } else if (p.answer.kind === 'fraction') {
          fracCount++;
          // 帯分数 -> 仮分数。値は変わっていないはず
          const raw = params.whole! * denominator + numerator;
          if (p.answer.numerator * denominator !== raw * p.answer.denominator) {
            bad.push(`lv${lv}s${s}: 仮分数の値が不一致`);
          }
          // 答えは簡約されているはず
          const expected = reduceFraction(raw, denominator);
          if (p.answer.numerator !== expected.numerator || p.answer.denominator !== expected.denominator) {
            bad.push(`lv${lv}s${s}: 仮分数が簡約されていない`);
          }
        } else {
          bad.push(`lv${lv}s${s}: 答えが分数型でない`);
        }
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で不正`).toBe('');
    expect(mixedCount).toBeGreaterThan(0);
    expect(fracCount).toBeGreaterThan(0);
  });

  it('答えの分母が入力の分母と一致しなくてもよい (簡約されるため)', () => {
    let differing = 0;
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 1013 + lv });
        const pr = p.parameters as { denominator: number; answerDenominator: number };
        if (pr.answerDenominator !== pr.denominator) differing++;
        expect(gen.validate(p).valid).toBe(true);
      }
    }
    expect(differing, '分母が異なるケースが存在しない = 修正前の誤検知が再現しない').toBeGreaterThan(0);
  });
});
describe('data_compare: 平均が等しい問題を出さない', () => {
  const gen = new DataCompareGenerator();

  it('平均が等しい場合は生成されず、答えが選択式に存在する', () => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 3571 + lv });
        const result = gen.validate(p);
        if (!result.valid) {
          bad.push(`lv${lv}s${s}: ${result.errors.join('|')}`);
          continue;
        }
        const { groupA, groupB } = p.parameters as { groupA: number[]; groupB: number[] };
        const avgA = groupA.reduce((x, y) => x + y, 0) / groupA.length;
        const avgB = groupB.reduce((x, y) => x + y, 0) / groupB.length;
        if (avgA === avgB) {
          bad.push(`lv${lv}s${s}: 平均が等しい問題を出している`);
        }
        const expected = avgA > avgB ? 'A組' : 'B組';
        if (p.answer.kind !== 'string' || p.answer.value !== expected) {
          bad.push(`lv${lv}s${s}: 答え=${formatAnswer(p.answer)} 期待=${expected}`);
        }
        const options = getProblemChoiceOptions(p);
        if (p.answer.kind === 'string' && !options.includes(p.answer.value)) {
          bad.push(`lv${lv}s${s}: 答えが選択肢に無い`);
        }
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で不正`).toBe('');
  });

  it('共通 validate も通り、答えの入力判定が通る', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 80; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 3571 + lv });
        expect(validateProblem(p).valid).toBe(true);
        expect(checkUserAnswer(formatAnswer(p.answer), p.answer)).toBe(true);
      }
    }
  });
});

describe('inverse_word: どの difficulty でも確実に生成できる', () => {
  const gen = new InverseWordGenerator();

  it('lv5 で生成失敗しない (割り切れる組み合わせの探索回数)', () => {
    const failures: number[] = [];
    for (let s = 0; s < 300; s++) {
      try {
        gen.generate({ difficulty: 5, seed: s * 104729 + 5 });
      } catch {
        failures.push(s);
      }
    }
    expect(failures.slice(0, 10).join(','), `${failures.length} seed で生成失敗`).toBe('');
  });

  it('全 difficulty で validate を通り、答えが割り切れる', () => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      for (let s = 0; s < 150; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 104729 + lv });
        const result = gen.validate(p);
        if (!result.valid) {
          bad.push(`lv${lv}s${s}: ${result.errors.join('|')}`);
          continue;
        }
        const { total, people1, people2, per2 } = p.parameters as {
          total: number; people1: number; people2: number; per2: number;
        };
        if (total % people2 !== 0) bad.push(`lv${lv}s${s}: total が people2 で割り切れない`);
        if (total / people2 !== per2) bad.push(`lv${lv}s${s}: 1人分が一致しない`);
        if (total % people1 !== 0) bad.push(`lv${lv}s${s}: total が people1 で割り切れない`);
        if (p.answer.kind !== 'integer' || p.answer.value !== per2) {
          bad.push(`lv${lv}s${s}: 答え=${formatAnswer(p.answer)} per2=${per2}`);
        }
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で不正`).toBe('');
  });
});
describe('fraction_mul_integer: 分数にならない退化問題を出さない', () => {
  const gen = new FractionMulIntegerGenerator();

  it('生成される分数は必ず約分しても分母が2以上 (整数に約分されない)', () => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 7919 + lv });
        const { numerator, denominator } = p.parameters as {
          numerator: number; denominator: number;
        };
        const reduced = reduceFraction(numerator, denominator);
        if (reduced.denominator === 1) {
          bad.push(`lv${lv}s${s}: ${numerator}/${denominator} は整数 ${reduced.numerator} になりうる`);
        }
        // 独立検算: 答えの「値」が numerator*integer/denominator と一致するか
        // (答えが integer / fraction / mixed のどれでも比較できるように
        //  分母分子を分数に直してから交差乗算で比べる)
        const { integer } = p.parameters as { integer: number };
        const expected = reduceFraction(numerator * integer, denominator);
        let valueNum = 0;
        let valueDen = 1;
        if (p.answer.kind === 'integer') {
          valueNum = p.answer.value;
        } else if (p.answer.kind === 'fraction') {
          valueNum = p.answer.numerator;
          valueDen = p.answer.denominator;
        } else if (p.answer.kind === 'mixed') {
          valueNum = p.answer.whole * p.answer.denominator + p.answer.numerator;
          valueDen = p.answer.denominator;
        } else {
          bad.push(`lv${lv}s${s}: 想定外の answer kind ${p.answer.kind}`);
        }
        if (valueNum * expected.denominator !== expected.numerator * valueDen) {
          bad.push(`lv${lv}s${s}: 答えの値が一致しない (期待 ${expected.numerator}/${expected.denominator})`);
        }
        // validate も通る
        expect(gen.validate(p).valid).toBe(true);
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で不正`).toBe('');
  });
});
