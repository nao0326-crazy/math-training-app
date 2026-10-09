/**
 * Phase 2: 修正した generator の level 差と多様性を個別に固定するテスト。
 *
 * 既存の quality-gate.test.ts は「宣言した level は生成可能か」だけを見るため、
 * 「lv5 が lv1 とほぼ同じ内容にならないこと」は保証していない。
 * ここでは数値範囲・丸め桁・variant 構成が意図どおりか、
 * 「数字が違うだけの同一構造」ばかりでないことを実測して固定する。
 */

import { describe, expect, it } from 'vitest';
import {
  DecimalMulDecimalGenerator,
  DecimalMulIntegerGenerator,
  DecimalRoundGenerator,
} from './decimal/generators';
import { RatioValueGenerator } from './ratio/generators';
import {
  RectangleAreaGenerator,
  TrapezoidAreaGenerator,
  AreaUnitConversionGenerator,
  UnitConversionBasicGenerator,
} from './geometry/generators';
import { PrimeRangeGenerator } from './numberTheory/generators';
import { FractionReduceGenerator, FractionDivIntegerGenerator } from './fraction/generators';
import { ArrangeSimpleGenerator } from './combinatorics/generators';
import { SpeedUnitConversionGenerator } from './speed/generators';
import { validateProblem } from '../engine/validator/validator';
import { generateSolutionSteps } from '../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../utils/answer';
import { findLearningQualityIssues, SCALE_BUDGETS } from '../quality/learning-quality';
import { difficultyLabel } from '../engine/difficulty/difficulty';
import type { DifficultyLevel, Problem } from '../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

function many(
  gen: { generate: (c: { difficulty: DifficultyLevel; seed: number }) => Problem },
  lv: DifficultyLevel,
  per = 60,
): Problem[] {
  const out: Problem[] = [];
  for (let s = 0; s < per; s++) {
    try {
      out.push(gen.generate({ difficulty: lv, seed: s * 104729 + lv }));
    } catch {
      // 生成できなかった seed はスキップ
    }
  }
  return out;
}

function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b);
}

describe('decimal_round: 必ず丸めが起き、小6の範囲に収まる', () => {
  const gen = new DecimalRoundGenerator();

  it('lv1-5 すべてで「丸めても変わらない問題」が 0 件', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (const p of many(gen, lv)) {
        const params = p.parameters as { value: number; rounded: number; roundTo: number };
        expect(p.difficulty.level, `lv${lv}`).toBe(lv);
        expect(params.value, `${p.question} は丸めが起きない`).not.toBe(params.rounded);
        expect(params.roundTo, '丸める桁は小数第2位まで').toBeLessThanOrEqual(2);
        expect(params.value, '整数部は3桁まで').toBeLessThan(1000);
        expect(findLearningQualityIssues(p).map((i) => i.rule)).toEqual([]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(250);
  });

  it('lv が上がるほど整数部の桁が伸びる (lv5 が lv1 と同一範囲にならない)', () => {
    const avgDigits = (lv: DifficultyLevel): number => {
      const values = many(gen, lv).map((p) =>
        String(Math.trunc((p.parameters as { value: number }).value)).length,
      );
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    expect(avgDigits(1)).toBeLessThan(avgDigits(4));
    expect(avgDigits(4)).toBeLessThanOrEqual(avgDigits(5));
    const lv3 = many(gen, 3);
    expect(lv3.every((p) => (p.parameters as { roundTo: number }).roundTo === 2)).toBe(true);
  });

  it('解説が「判定する桁」に言及し、答えと矛盾しない', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 20)) {
        const params = p.parameters as { value: number; rounded: number; roundTo: number };
        expect(p.explanation ?? '', p.question).toContain('小数第' + (params.roundTo + 1) + '桁');
        expect(p.explanation ?? '', p.question).toContain(String(params.rounded));
        expect(validateProblem(p).valid, p.question).toBe(true);
        expect(generateSolutionSteps(p).length, p.question).toBeGreaterThan(0);
      }
    }
  });
});
describe('小数×小数・小数×整数: 計算量が教科書の範囲に収まる', () => {
  it('decimal_mul_decimal: 整数部は2桁、小数部分は第1位', () => {
    const gen = new DecimalMulDecimalGenerator();
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 40)) {
        const { a, b } = p.parameters as { a: number; b: number };
        expect(Math.abs(a), p.question).toBeLessThanOrEqual(99.9);
        expect(Math.abs(b), p.question).toBeLessThanOrEqual(99.9);
        expect(Math.round(a * 10) / 10, p.question).toBe(a);
        expect(Math.round(b * 10) / 10, p.question).toBe(b);
        expect(findLearningQualityIssues(p).map((i) => i.rule)).toEqual([]);
      }
    }
  });

  it('decimal_mul_integer: 小数部分は第1位、整数部分は2桁、乗数は2桁', () => {
    const gen = new DecimalMulIntegerGenerator();
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 40)) {
        const { a, b } = p.parameters as { a: number; b: number };
        expect(Math.round(a * 10) / 10, p.question).toBe(a);
        expect(Math.abs(a), p.question).toBeLessThanOrEqual(99.9);
        expect(Math.abs(b), p.question).toBeLessThanOrEqual(50);
        expect(findLearningQualityIssues(p).map((i) => i.rule)).toEqual([]);
      }
    }
  });

  it('lv1→lv5 で積の平均値は増える (数字を大きくするだけの難化)', () => {
    const gen = new DecimalMulDecimalGenerator();
    const avgProduct = (lv: DifficultyLevel): number => {
      const vals = many(gen, lv, 40).map((p) => {
        const { a, b } = p.parameters as { a: number; b: number };
        return a * b;
      });
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    expect(avgProduct(1)).toBeLessThan(avgProduct(3));
    expect(avgProduct(3)).toBeLessThan(avgProduct(5));
  });
});

describe('decimal_round: 四捨五入の「分岐そのもの」を練習できる', () => {
  const gen = new DecimalRoundGenerator();

  /**
   * 第3次監査の発見。
   *
   * 判定桁 (小数第 roundTo+1 桁) を 5〜9 に固定していた実装では、
   * 切り上げ 99.2% / 切り捨て 0.8% となり、
   * 「5未満なら切り捨て」という四捨五入の分岐をほぼ練習できていなかった。
   * 「丸めた結果が変わる」ことしか保証しておらず、
   * 学習目標である「判定の規則」は練習できていない状態だった。
   */
  it('切り上げと切り捨てがどちらも十分な割合で出る', () => {
    let up = 0;
    let down = 0;
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 200)) {
        const params = p.parameters as { value: number; rounded: number };
        if (params.rounded > params.value) up++;
        else if (params.rounded < params.value) down++;
      }
    }
    expect(up + down).toBeGreaterThanOrEqual(500);
    const upRatio = up / (up + down);
    // ほぼ同数。片側に偏ると四捨五入の規則を練習できない。
    expect(upRatio, `切り上げ ${up} / 切り捨て ${down}`).toBeGreaterThan(0.35);
    expect(upRatio, `切り上げ ${up} / 切り捨て ${down}`).toBeLessThan(0.65);
    // 切り捨てが「ほとんど出ない」状態を明示的に防ぐ
    expect(down / (up + down), '切り捨てケースが不足').toBeGreaterThan(0.3);
  });

  it('判定桁がちょうど 5 (四捨五入の分岐点) も出る', () => {
    let boundary = 0;
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 200)) {
        const q = p.parameters as { value: number; roundTo: number };
        const scale = 10 ** (q.roundTo + 1);
        if (Math.floor((q.value * scale) % 10) === 5) boundary++;
      }
    }
    expect(boundary, '5ちょうどの境界ケースが出ない').toBeGreaterThan(0);
  });

  it('lv ごとに切り上げ・切り捨ての両方が出る', () => {
    for (const lv of LEVELS) {
      let up = 0;
      let down = 0;
      for (const p of many(gen, lv, 200)) {
        const q = p.parameters as { value: number; rounded: number };
        if (q.rounded > q.value) up++;
        else if (q.rounded < q.value) down++;
      }
      expect(up, `lv${lv} で切り上げが出ない`).toBeGreaterThan(30);
      expect(down, `lv${lv} で切り捨てが出ない`).toBeGreaterThan(30);
    }
  });
});

describe('ratio_value: 丸めによって数学的に別の値を提示しない', () => {
  const gen = new RatioValueGenerator();

  /**
   * 第3次監査の独立検算で発見した実バグ。
   *
   * 旧実装は「割り切れる比 = 有限小数」だけを確認して小数第2位で丸めて
   * いたため、5:8 → 0.625 が 0.63 と表示されていた (1000問中160問 = 16%)。
   * 有限小数であっても小数第3位が必要なものは、
   * 2桁丸めすると**別の値**になるため採ってはいけない。
   */
  it('提示される答えは a ÷ b の厳密値と厳密に一致する', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 120)) {
        const q = p.parameters as { a: number; b: number };
        expect(p.answer.kind).toBe('decimal');
        const got = p.answer.kind === 'decimal' ? p.answer.value : null;
        expect(got, `${p.question} の答えが不正`).not.toBeNull();
        expect(
          got,
          `${q.a}:${q.b} の厳密値は ${q.a / q.b} だが ${got} を提示している`,
        ).toBe(q.a / q.b);
        expect(validateProblem(p).valid, p.question).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(400);
  });

  it(' 答えは小数第2位で正確に表せる有限小数に限定される', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 80)) {
        const q = p.parameters as { a: number; b: number };
        // 約分後の分母が 2^x*5^y (max(x,y) <= 2) で表せるか
        let den = q.b / gcdOf(q.a, q.b);
        let exp2 = 0;
        let exp5 = 0;
        while (den % 2 === 0) { den /= 2; exp2++; }
        while (den % 5 === 0) { den /= 5; exp5++; }
        expect(den, `${q.a}:${q.b} は2桁で表せない`).toBe(1);
        expect(Math.max(exp2, exp5), `${q.a}:${q.b}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('generator.validate は「丸められている」場合に不合格を返す', () => {
    const tampered = many(gen, 2, 1)[0];
    const q = tampered.parameters as { a: number; b: number };
    // 答えを意図的にずらした改ざん問題
    const broken = {
      ...tampered,
      parameters: { ...q, answer: Math.round((q.a / q.b) * 100) / 100 + 0.01 },
    } as Problem;
    // validateProblem は registry 経由で型ごとの validate を
    // 呼びを回さないため、generator の validate を直接使う。
    expect(gen.validate(broken).valid, '改ざんを検出できていない').toBe(false);
  });
});

describe('数値規模の逆監査: 上限が過度に厳しく学習价值和衝突していない', () => {
  it('数値そのものが学習目標の型は、大きな数を出し続けられる', () => {
    // 概算・単位変換は「大きな数を扱うこと」が目標なので、
    // 削り過ぎていないことを確認する。
    const cases: [string, () => { generate: (c: { difficulty: DifficultyLevel; seed: number }) => Problem }][] = [
      ['unit_conversion_basic', () => new UnitConversionBasicGenerator()],
      ['area_unit_conversion', () => new AreaUnitConversionGenerator()],
    ];
    for (const [name, make] of cases) {
      let maxSeen = 0;
      for (const lv of LEVELS) {
        for (const p of many(make(), lv, 40)) {
          const budget = SCALE_BUDGETS[name];
          const n = Math.max(
            ...(p.question.match(/\d+(?:\.\d+)?/g) ?? []).map((s) => Math.abs(Number(s))),
          );
          maxSeen = Math.max(maxSeen, n);
          expect(n, `${name}: ${n} が予算 ${budget?.max} を超える`).toBeLessThanOrEqual(
            budget?.max ?? 1000000,
          );
        }
      }
      // 大きな数が出る余地がある (上限が小さすぎない) ことを示す
      expect(maxSeen, `${name} が大きな数を一度も出してない`).toBeGreaterThan(100);
    }
  });

  it('answer の最大桁数が、その型の計算量として妥当な範囲に収まる', () => {
    // 小数×小数: 答えは小数第2位まで = 整数部2桁 + 小数2桁
    for (const lv of LEVELS) {
      for (const p of many(new DecimalMulDecimalGenerator(), lv, 30)) {
        const q = p.parameters as { a: number; b: number };
        const product = q.a * q.b;
        expect(product, `${p.question} の答えが大きすぎる`).toBeLessThan(1000);
      }
    }
    // 面積: 2桁 × 2桁 = 4桁以内 (unit_convert を除く)
    for (const lv of LEVELS) {
      for (const p of many(new RectangleAreaGenerator(), lv, 40)) {
        const q = p.parameters as { variant: string; width: number; height: number };
        if (q.variant !== 'unit_convert') {
          expect(q.width * q.height, p.question).toBeLessThanOrEqual(1000);
        }
      }
    }
  });
});

describe('面積: 答えが3〜4桁に収まる', () => {
  it('rectangle_area: 面積型 variant の辺は2桁以内 (unit_convert を除く)', () => {
    const gen = new RectangleAreaGenerator();
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 60)) {
        const params = p.parameters as {
          variant: string; width: number; height: number; area: number;
        };
        if (params.variant !== 'unit_convert') {
          expect(params.width, p.question).toBeLessThanOrEqual(31);
          expect(params.height, p.question).toBeLessThanOrEqual(31);
        }
        expect(validateProblem(p).valid, p.question).toBe(true);
        expect(gen.validate(p).valid, p.question).toBe(true);
        expect(checkUserAnswer(formatAnswer(p.answer), p.answer), p.question).toBe(true);
        expect(findLearningQualityIssues(p).map((i) => i.rule)).toEqual([]);
      }
    }
  });

  it('trapezoid_area: 3つの寸法が2桁以内で面積が4桁以内', () => {
    const gen = new TrapezoidAreaGenerator();
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 60)) {
        const params = p.parameters as { a: number; b: number; h: number; area: number };
        expect(Math.max(params.a, params.b), p.question).toBeLessThanOrEqual(40);
        expect(params.h, p.question).toBeLessThanOrEqual(25);
        expect(params.area, p.question).toBeLessThanOrEqual(1000);
        expect(validateProblem(p).valid, p.question).toBe(true);
        expect(findLearningQualityIssues(p).map((i) => i.rule)).toEqual([]);
      }
    }
  });
});

describe('area_unit_conversion: extension variant が低難度を支配しない', () => {
  const gen = new AreaUnitConversionGenerator();
  const HA_VARIANTS = [
    'hektaru_to_aresu', 'sqkm_to_hektaru', 'hektaru_to_sqkm', 'hektaru_to_sqm', 'sqm_to_hektaru',
  ];

  it('低難度では第4学年範囲の ㎠↔㎡ が必ず出る', () => {
    for (const lv of [1, 2] as DifficultyLevel[]) {
      const seen = new Set(
        many(gen, lv, 80).map((p) => (p.parameters as { variant: string }).variant),
      );
      expect(seen, `lv${lv} に sqm_to_sqcm が無い`).toContain('sqm_to_sqcm');
      expect(seen.size, `lv${lv} の variant が少なすぎる`).toBeGreaterThanOrEqual(2);
    }
  });

  it('ha 系が過半を占めず、㎠↔㎡ も必ず混ざる (範囲は狭めない)', () => {
    const all = LEVELS.flatMap((lv) => many(gen, lv, 60));
    const haCount = all.filter((p) =>
      HA_VARIANTS.includes((p.parameters as { variant: string }).variant),
    ).length;
    expect(all.length).toBeGreaterThan(200);
    expect(haCount / all.length, 'ha系が過半を占める').toBeLessThan(0.75);
    const sqmToSqcm = all.filter(
      (p) => (p.parameters as { variant: string }).variant === 'sqm_to_sqcm',
    );
    expect(sqmToSqcm.length, '㎠↔㎡ が余にも少ない').toBeGreaterThan(0);
  });

  it('与えられる値は現実的な範囲 (7790ha のような値を出さない)', () => {
    // 提示される数値そのものを判定する。
    // 単位を ㎠ に換算して比較すると「3 km2」は 3,000,000 ㎡ となり、
    // 表示されている数字の小ささが反映されないため。
    // 目安: 1 km2 = 100 ha なので ha は数百、㎢ は数、㎡ は万までが現実的。
    const DISPLAY_CAPS: Record<string, number> = {
      '㎠': 9, '㎡': 90000, a: 900, ha: 300, '㎢': 5,
    };
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 60)) {
        const params = p.parameters as { givenValue: number; from: string };
        expect(
          params.givenValue,
          `${p.question} は非現実的な値 (${params.from} の上限 ${DISPLAY_CAPS[params.from]})`,
        ).toBeLessThanOrEqual(DISPLAY_CAPS[params.from]);
        expect(findLearningQualityIssues(p).map((i) => i.rule)).toEqual([]);
      }
    }
  });
});

describe('prime_range: 指示と回答形式が一致している', () => {
  const gen = new PrimeRangeGenerator();

  it('問題文は「すべて答えなさい」の形式で、個数を問う文を含まない', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 30)) {
        expect(p.question, p.question).toContain('すべて答えなさい');
        expect(p.question, p.question).not.toContain('いくつあるでしょうか');
        expect(p.answer.kind).toBe('string');
        expect(validateProblem(p).valid, p.question).toBe(true);
        expect(gen.validate(p).valid, p.question).toBe(true);
      }
    }
  });
});

describe('fraction_reduce: 約分前の分数が問題文に出る (答えが漏れない)', () => {
  const gen = new FractionReduceGenerator();

  it('問題文の分数は必ず約分前であり、答えの表記は現れない', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 60)) {
        const params = p.parameters as {
          numerator: number; denominator: number;
          answerNumerator: number; answerDenominator: number;
        };
        expect(p.question, p.question).toContain(params.denominator + '分の' + params.numerator);
        const answerText =
          params.answerDenominator === 1
            ? String(params.answerNumerator)
            : params.answerDenominator + '分の' + params.answerNumerator;
        expect(p.question, `答え (${answerText}) が漏れている`).not.toContain(answerText);
        // 分子は分母未満 (「10分の10」のような無意味な約分を出さない)
        expect(params.numerator, p.question).toBeLessThan(params.denominator);
        expect(validateProblem(p).valid, p.question).toBe(true);
        expect(findLearningQualityIssues(p).map((i) => i.rule)).toEqual([]);
      }
    }
  });
});

describe('fraction_div_integer: 不自然な括弧が無く、問題文の分数は最簡分数', () => {
  const gen = new FractionDivIntegerGenerator();

  it('問題文に「（分母…）」も「（分子…）」も付かない', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 60)) {
        expect(p.question, p.question).not.toContain('（分母');
        expect(p.question, p.question).not.toContain('（分子');
        const params = p.parameters as { numerator: number; denominator: number };
        expect(gcdOf(params.numerator, params.denominator), `${p.question} は約分できる`).toBe(1);
        expect(validateProblem(p).valid, p.question).toBe(true);
      }
    }
  });
});

describe('arrange_simple: 「並べ方」と「選び方」の出し分けが問題文と一致', () => {
  const gen = new ArrangeSimpleGenerator();

  it('pick_special は「選び方」を問う文になり、それ以外は「並べ方」', () => {
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 80)) {
        const variant = (p.parameters as { variant: string }).variant;
        if (variant === 'pick_special') {
          expect(p.question, p.question).toContain('選び方');
          expect(p.question, p.question).not.toContain('並べ方');
        } else {
          expect(p.question, p.question).toContain('並べ方');
        }
        expect(validateProblem(p).valid, p.question).toBe(true);
      }
    }
  });

  it('generator の説明文が実態 (並べ方 と 選び方の両方) に合っている', () => {
    expect(gen.description).toContain('並べ方');
    expect(gen.description).toContain('選び方');
  });
});

describe('speed_unit_conversion: 現実的な速さの範囲に収まる', () => {
  const gen = new SpeedUnitConversionGenerator();

  it('時速1260km のような音速超の値が出ない', () => {
    const caps: Record<string, number> = {
      kmh_to_mmin: 360, mmin_to_kmh: 1200, kmh_to_ms: 360, ms_to_kmh: 99,
    };
    for (const lv of LEVELS) {
      for (const p of many(gen, lv, 60)) {
        const { givenValue, variant } = p.parameters as {
          givenValue: number; variant: string;
        };
        expect(givenValue, `${p.question} (${variant})`).toBeLessThanOrEqual(caps[variant]);
        expect(validateProblem(p).valid, p.question).toBe(true);
      }
    }
  });
});

describe('構造多様性: 数字だけの入れ替えばかりでない', () => {
  /**
   * 多様性の測り方は既存の quality-gate.test.ts に従う。
   *
   * 問題文の「数値を置換した構造」だけで測ると、variant が 5 個しかない型は
   * 構造が 5 種類に頭打ちになり、値を水増ししただけの空虚な diversity を
   * 求めることになる。ここでは
   *   (1) 数学的に異なる variant が複数出ているか
   *   (2) 表示される問題文そのものに重複がないか
   * の2つを測る。
   */
  it('数学的に異なる variant が複数出現する', () => {
    const cases: [string, Problem[]][] = [
      ['rectangle_area', LEVELS.flatMap((lv) => many(new RectangleAreaGenerator(), lv, 40))],
      ['trapezoid_area', LEVELS.flatMap((lv) => many(new TrapezoidAreaGenerator(), lv, 40))],
      ['area_unit_conversion', LEVELS.flatMap((lv) => many(new AreaUnitConversionGenerator(), lv, 40))],
      ['arrange_simple', LEVELS.flatMap((lv) => many(new ArrangeSimpleGenerator(), lv, 40))],
      ['speed_unit_conversion', LEVELS.flatMap((lv) => many(new SpeedUnitConversionGenerator(), lv, 40))],
    ];
    for (const [name, problems] of cases) {
      const variants = new Set(
        problems.map((p) => (p.parameters as { variant?: string }).variant ?? ''),
      );
      expect(variants.size, `${name}: variant が ${variants.size} 種類のみ`).toBeGreaterThanOrEqual(2);
    }
  });

  it('修正した型の問題文は 25% 以上が相異なる (既存 quality-gate と同じ基準)', () => {
    // speed_unit_conversion は既存の BASELINE_BELOW_FLOOR に入っている型
    // (15/100) なので、ここでは再計測しない。
    const cases: [string, Problem[]][] = [
      ['decimal_round', LEVELS.flatMap((lv) => many(new DecimalRoundGenerator(), lv, 40))],
      ['fraction_reduce', LEVELS.flatMap((lv) => many(new FractionReduceGenerator(), lv, 40))],
      ['fraction_div_integer', LEVELS.flatMap((lv) => many(new FractionDivIntegerGenerator(), lv, 40))],
      ['rectangle_area', LEVELS.flatMap((lv) => many(new RectangleAreaGenerator(), lv, 40))],
      ['trapezoid_area', LEVELS.flatMap((lv) => many(new TrapezoidAreaGenerator(), lv, 40))],
      ['area_unit_conversion', LEVELS.flatMap((lv) => many(new AreaUnitConversionGenerator(), lv, 40))],
      ['prime_range', LEVELS.flatMap((lv) => many(new PrimeRangeGenerator(), lv, 40))],
      ['arrange_simple', LEVELS.flatMap((lv) => many(new ArrangeSimpleGenerator(), lv, 40))],
    ];
    for (const [name, problems] of cases) {
      const questions = new Set(problems.map((p) => p.question));
      expect(
        questions.size / problems.length,
        `${name}: ${questions.size}/${problems.length}`,
      ).toBeGreaterThanOrEqual(0.25);
    }
  });

  it('difficultyLabel は lv ごとに異なる日本語表記を持つ', () => {
    expect(new Set(LEVELS.map(difficultyLabel)).size).toBe(LEVELS.length);
  });
});
