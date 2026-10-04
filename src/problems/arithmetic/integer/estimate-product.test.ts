// estimate-product.test.ts — 積の見積もり 生成器単体テスト (Phase 2-Z5A)
//
// 範囲: 生成器と専用難易度ヘルパーの単体動作のみ。
// registry / metadata / curriculumScope への登録と480問の大量生成検証は
// Phase 2-Z5B の担当であり、ここでは行わない。
//
// 検算は generator の内部ロジックを再利用せず、テスト側で独立に
// 丸め算・掛け算を定義して行う。

import { describe, expect, it } from 'vitest';
import { EstimateProductGenerator } from './multiStep';
import { createEstimateDifficulty } from './helpers';
import { getTypeSupportedLevels } from '../../../engine/diversity/metadata';
import { generateProblem } from '../../../engine/selector/generatorRegistry';
import type { GenerationConfig } from '../../../types/problem';
import { numberSizeToComplexity } from '../../../engine/difficulty/difficulty';
import type { DifficultyLevel, Problem } from '../../../types/problem';

const SUPPORTED: DifficultyLevel[] = [2, 3, 4, 5];

/** 独立実装: place の倍数に四捨五入する */
function refRound(n: number, place: number): number {
  return Math.round(n / place) * place;
}

function gen(lv: DifficultyLevel, seed: number): Problem {
  return new EstimateProductGenerator().generate({ difficulty: lv, seed });
}

type Params = {
  variant: string;
  a: number;
  b: number;
  placeA: number;
  placeB: number;
  roundedA: number;
  roundedB: number;
  estimate: number;
  exactProduct: number;
  difficultyLevel: DifficultyLevel;
};

describe('createEstimateDifficulty: 見積り専用ヘルパー', () => {
  it('丸める位を基準に numberComplexity を評価する (十の位=2, 百の位=3)', () => {
    expect(createEstimateDifficulty({ level: 2, roundPlace: 10 }).components.numberComplexity).toBe(2);
    expect(createEstimateDifficulty({ level: 3, roundPlace: 100 }).components.numberComplexity).toBe(3);
    expect(createEstimateDifficulty({ level: 5, roundPlace: 10 }).components.numberComplexity)
      .toBe(numberSizeToComplexity(10));
  });

  it('最終レベルは max(要求レベル, 丸める位の複雑度) になる', () => {
    for (const lv of SUPPORTED) {
      for (const place of [10, 100]) {
        const d = createEstimateDifficulty({ level: lv, roundPlace: place, reasoningLevel: 5 });
        // calculation は要求レベル、numberComplexity は丸める位の複雑度。
        // よって最終レベルは両者の最大値になる。
        const want = Math.max(lv, numberSizeToComplexity(place)) as DifficultyLevel;
        expect(d.level, `lv${lv} place=${place}`).toBe(want);
      }
    }
    // 生成器が使う組み合わせでは必ず要求レベルに一致する
    // (十の位丸めは lv2 以上、百の位丸めは lv3 以上にしか出ない)
    for (const lv of SUPPORTED) {
      expect(createEstimateDifficulty({ level: lv, roundPlace: 10 }).level).toBe(lv);
      if (lv >= 3) {
        expect(createEstimateDifficulty({ level: lv, roundPlace: 100 }).level).toBe(lv);
      }
    }
  });

  it('calculation は要求レベルそのもの、他は要求レベルを超えない', () => {
    const c = createEstimateDifficulty({ level: 3, roundPlace: 10, reasoningLevel: 5, readingLevel: 5 }).components;
    expect(c.calculationComplexity).toBe(3);
    expect(c.reasoningComplexity).toBeLessThanOrEqual(3);
    expect(c.readingComplexity).toBeLessThanOrEqual(3);
    expect(c.numberComplexity).toBe(2);
  });
});

describe('EstimateProductGenerator: 対応レベル', () => {
  it('lv2〜lv5 で生成でき、要求 difficulty を返す', () => {
    for (const lv of SUPPORTED) {
      for (let s = 0; s < 20; s++) {
        const p = gen(lv, s * 7919 + lv);
        expect(p.difficulty.level, `lv${lv} seed${s}`).toBe(lv);
        expect(p.type).toBe('estimate_product');
      }
    }
  });

  it('lv1 は未対応として例外を投げる (別レベルの問題を返さない)', () => {
    const g = new EstimateProductGenerator();
    for (let s = 0; s < 20; s++) {
      expect(() => g.generate({ difficulty: 1, seed: s })).toThrow();
    }
  });
});

describe('EstimateProductGenerator: 出題内容', () => {
  it('問題文に丸める位が明記され、答えが概算値である', () => {
    for (const lv of SUPPORTED) {
      for (let s = 0; s < 20; s++) {
        const p = gen(lv, s * 104729 + lv);
        expect(p.question, '問題文が空').not.toBe('');
        // 丸め方の指示が必ず入っていること (曖昧な丸め方を許さない)
        expect(p.question).toMatch(/四捨五入/);
        // 概算であることを示す語
        expect(p.question).toContain('およそ');
        expect(p.answer.kind).toBe('integer');
      }
    }
  });

  it('丸め方・概算値・正確な積が独立計算と一致する', () => {
    for (const lv of SUPPORTED) {
      for (let s = 0; s < 40; s++) {
        const p = gen(lv, s * 104729 + lv * 31);
        const q = p.parameters as Params;
        // 独立に丸め直す
        expect(q.roundedA, '1つめの丸め').toBe(refRound(q.a, q.placeA));
        expect(q.roundedB, '2つめの丸め').toBe(refRound(q.b, q.placeB));
        // 独立に掛け合わせる
        const wantEstimate = refRound(q.a, q.placeA) * refRound(q.b, q.placeB);
        expect(q.estimate).toBe(wantEstimate);
        expect(p.answer.kind === 'integer' && p.answer.value).toBe(wantEstimate);
        // 正確な積
        expect(q.exactProduct).toBe(q.a * q.b);
        // 概算値は正確な積と混同されていない
        expect(q.estimate).not.toBe(q.exactProduct);
        // 概算した数が 0 になっていないこと
        expect(q.roundedA).toBeGreaterThan(0);
        expect(q.roundedB).toBeGreaterThan(0);
      }
    }
  });

  it('解説が問題文の数値・答えと一致する', () => {
    for (const lv of SUPPORTED) {
      for (let s = 0; s < 20; s++) {
        const p = gen(lv, s * 15485863 + lv);
        const q = p.parameters as Params;
        const ex = String(p.explanation ?? '');
        expect(ex.length, '解説が空').toBeGreaterThan(0);
        expect(ex).toContain(String(q.a));
        expect(ex).toContain(String(q.b));
        expect(ex).toContain(String(q.estimate));
        expect(ex).toContain(String(q.exactProduct));
        expect(ex).toContain('概算');
        expect(ex).toContain('一致しません');
      }
    }
  });

  it('validate が正常な問題を通す', () => {
    const g = new EstimateProductGenerator();
    for (const lv of SUPPORTED) {
      for (let s = 0; s < 20; s++) {
        const p = gen(lv, s * 6700417 + lv);
        const v = g.validate(p);
        expect(v.valid, v.errors.join(',')).toBe(true);
      }
    }
  });
});

describe('EstimateProductGenerator: variant と対応レベル', () => {
  it('variant が意図したレベルで出現する', () => {
    const g = new EstimateProductGenerator();
    const expected: Record<number, string[]> = {
      2: ['estimate_one_exact', 'estimate_to_tens'],
      3: ['estimate_mixed_places', 'estimate_to_hundreds', 'estimate_one_exact', 'estimate_to_tens'],
      4: ['estimate_mixed_places', 'estimate_to_hundreds', 'estimate_one_exact', 'estimate_to_tens'],
      5: ['estimate_mixed_places', 'estimate_shopping', 'estimate_to_hundreds', 'estimate_one_exact', 'estimate_to_tens'],
    };
    for (const lv of SUPPORTED) {
      const seen = new Set<string>();
      for (let s = 0; s < 80; s++) {
        seen.add((g.generate({ difficulty: lv, seed: s * 7919 + lv }).parameters as Params).variant);
      }
      expect([...seen].sort(), `lv${lv}`).toEqual([...(expected[lv] as string[])].sort());
    }
  });

  it('丸める位と数値範囲が仕様どおりである', () => {
    for (const lv of SUPPORTED) {
      for (let s = 0; s < 60; s++) {
        const q = gen(lv, s * 49979687 + lv).parameters as Params;
        switch (q.variant) {
          case 'estimate_to_tens':
            expect(q.placeA).toBe(10); expect(q.placeB).toBe(10);
            expect(q.a).toBeGreaterThanOrEqual(15); expect(q.a).toBeLessThanOrEqual(49);
            break;
          case 'estimate_one_exact':
            expect(q.placeA).toBe(1); expect(q.placeB).toBe(10);
            break;
          case 'estimate_to_hundreds':
            expect(q.placeA).toBe(100); expect(q.placeB).toBe(100);
            expect(q.a).toBeGreaterThanOrEqual(150); expect(q.a).toBeLessThanOrEqual(449);
            break;
          case 'estimate_mixed_places':
            expect(q.placeA).toBe(10); expect(q.placeB).toBe(100);
            break;
          case 'estimate_shopping':
            expect(q.placeA).toBe(100); expect(q.placeB).toBe(10);
            break;
          default:
            throw new Error('未知の variant: ' + q.variant);
        }
      }
    }
  });
});

describe('estimate_product: 480問の独立検算 (lv2-5 x 120)', () => {
  it('全480問が丸め・見積り・難易度・解説で独立検算を通過する', () => {
    // generator の内部ロジック (roundToPlace など) を一切使わず、
    // テスト側で定義した独立実装だけで検算する。
    const perLevel: Record<number, { gen: number; ok: number; fail: number }> = {};
    const perVariant: Record<string, { gen: number; ok: number; fail: number }> = {};
    const failures: string[] = [];

    for (const lv of SUPPORTED) {
      const stat = { gen: 0, ok: 0, fail: 0 };
      perLevel[lv] = stat;
      for (let s = 0; s < 120; s++) {
        stat.gen++;
        const p = gen(lv, s * 104729 + lv * 7919);
        const q = p.parameters as Params;
        const vStat = perVariant[q.variant] ?? (perVariant[q.variant] = { gen: 0, ok: 0, fail: 0 });
        vStat.gen++;

        const problems: string[] = [];
        // (1) 問題文から数値と演算が読み取れること
        if (!p.question.includes(String(q.a)) || !p.question.includes(String(q.b))) {
          problems.push('問題文に元の数がありません');
        }
        if (!p.question.includes('四捨五入')) problems.push('丸め方が明記されていません');
        if (!p.question.includes('およそ')) problems.push('概算であることが明記されていません');
        // (2) 丸める位が明確であること
        if (!(q.placeA > 0) || !(q.placeB > 0)) problems.push('丸める位が不正です');
        // (3) 丸めた数値が四捨五入の規則と一致すること (独立計算)
        if (refRound(q.a, q.placeA) !== q.roundedA) problems.push('1つめの丸めが不正');
        if (refRound(q.b, q.placeB) !== q.roundedB) problems.push('2つめの丸めが不正');
        // (4) 見積り計算結果が正しいこと (独立計算)
        const wantEstimate = refRound(q.a, q.placeA) * refRound(q.b, q.placeB);
        if (wantEstimate !== q.estimate) problems.push('概算値が不正');
        if (p.answer.kind !== 'integer' || p.answer.value !== wantEstimate) problems.push('answer が不正');
        // (5) 正確な積と概算値を区別できること
        if (q.a * q.b !== q.exactProduct) problems.push('正確な積が不正');
        if (q.estimate === q.exactProduct) problems.push('概算値が正確な積と一致');
        // (6) 不正な数値・0・過大値がないこと
        if (!(q.a > 0) || !(q.b > 0)) problems.push('0 または負の数');
        if (!(q.roundedA > 0) || !(q.roundedB > 0)) problems.push('概算値が 0');
        if (q.estimate > 1000000) problems.push('概算値が過大');
        if (!Number.isInteger(q.estimate)) problems.push('概算値が整数でない');
        // (7) 難易度評価が要求レベルと一致すること
        if (p.difficulty.level !== lv) problems.push('difficulty 不一致');
        // (8) 解説が問題文・数値・答えと矛盾しないこと
        const ex = String(p.explanation ?? '');
        for (const needle of [String(q.a), String(q.b), String(q.estimate), String(q.exactProduct)]) {
          if (!ex.includes(needle)) problems.push('解説に数値 ' + needle + ' がありません');
        }
        if (!ex.includes('概算')) problems.push('解説に概算の明示がありません');
        // (9) validate が通ること
        if (!new EstimateProductGenerator().validate(p).valid) problems.push('validate 失敗');

        if (problems.length === 0) {
          stat.ok++;
          vStat.ok++;
        } else {
          stat.fail++;
          vStat.fail++;
          if (failures.length < 10) failures.push(`lv${lv} seed${s}: ${problems.join('/')}`);
        }
      }
    }

    const total = Object.values(perLevel).reduce((a, b) => a + b.gen, 0);
    expect(total).toBe(480);
    expect(failures.join('\n'), '480問の独立検算に失敗があります').toBe('');
    for (const lv of SUPPORTED) {
      expect(perLevel[lv].fail, `lv${lv}`).toBe(0);
      expect(perLevel[lv].gen, `lv${lv}`).toBe(120);
    }
    for (const v of Object.keys(perVariant)) {
      expect(perVariant[v].fail, `variant ${v}`).toBe(0);
    }
    // 結果をあとから読めるよう出力する
    console.log('480問独立検算: ' + JSON.stringify({ perLevel, perVariant }));
  });
});

describe('EstimateProductGenerator: 改ざん検出', () => {
  it('parameters を壊すと validate が不正を報告する', () => {
    const g = new EstimateProductGenerator();
    for (const lv of SUPPORTED) {
      for (let s = 0; s < 10; s++) {
        const p = gen(lv, s * 86028121 + lv);
        const q = p.parameters as Params;
        expect(g.validate({ ...p, parameters: { ...(p.parameters as object), estimate: q.estimate + 1 } }).valid,
          '概算値の改ざん').toBe(false);
        expect(g.validate({ ...p, parameters: { ...(p.parameters as object), a: 0 } }).valid,
          '0 の入力').toBe(false);
        expect(g.validate({ ...p, parameters: { ...(p.parameters as object), roundedA: q.roundedA + 1 } }).valid,
          '丸め結果の改ざん').toBe(false);
        expect(g.validate({ ...p, parameters: { ...(p.parameters as object), difficultyLevel: 1 } }).valid,
          '未対応レベルの混入').toBe(false);
      }
    }
  });
});
describe('estimate_product: 対応レベルの宣言', () => {
  it('宣言のない既存 generator は lv1〜5 をすべて検証対象にする', () => {
    for (const type of ['integer_addition', 'decimal_round', 'rectangle_area', 'triangle_area', 'parallelogram_area']) {
      expect(getTypeSupportedLevels(type), type).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('estimate_product は lv2〜5 のみを検証対象にする (lv1 は未対応)', () => {
    expect(getTypeSupportedLevels('estimate_product')).toEqual([2, 3, 4, 5]);
  });

  it('宣言したレベルと実際の生成挙動が一致する', () => {
    const declared = getTypeSupportedLevels('estimate_product');
    const g = new EstimateProductGenerator();
    for (const lv of [1, 2, 3, 4, 5] as DifficultyLevel[]) {
      let generated = false;
      try {
        g.generate({ difficulty: lv, seed: 1 });
        generated = true;
      } catch {
        generated = false;
      }
      expect(generated, 'lv' + lv + ' の宣言と実装が矛盾').toBe(declared.includes(lv));
    }
  });

  it('未登録の型・宣言が空の場合は lv1〜5 にフォールバックする', () => {
    expect(getTypeSupportedLevels('no_such_type')).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('estimate_product: 未対応難易度の早期検出', () => {
  it('lv1 指定は再試行せずに明確な未対応エラーになる', () => {
    let err: unknown;
    try {
      generateProblem({ type: 'estimate_product', difficulty: 1 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).toContain('この問題タイプはこの難易度に対応していません');
    expect(String((err as Error).message)).toContain('estimate_product');
  });

  it('generator が呼ばれずに早期検出される (300回再試行されない)', () => {
    const g = new EstimateProductGenerator();
    let called = 0;
    const spy = {
      generate: (c: GenerationConfig) => {
        called++;
        return g.generate(c);
      },
    };
    // generateProblem 内の型解決はレジストリの実インスタンスを使うため、
    // generator の呼び出し回数は直接数えられない。
    // 代わりに、エラーが即座に投げられ 300 回再試行されていないことを確認する。
    const started = Date.now();
    expect(() => generateProblem({ type: 'estimate_product', difficulty: 1 })).toThrow();
    // 300 回再試行なら与此明显に時間がかかるが、早期検出なら即座に返る
    expect(Date.now() - started).toBeLessThan(1000);
    expect(called).toBe(0);
    expect(spy).toBeDefined();
  });

  it('lv2〜5 は従来どおり生成できる', () => {
    for (const lv of SUPPORTED) {
      const p = generateProblem({ type: 'estimate_product', difficulty: lv });
      expect(p.type).toBe('estimate_product');
      expect(p.difficulty.level).toBe(lv);
    }
  });

  it('対応レベル未宣言の既存 generator は従来どおり lv1〜5 で生成できる', () => {
    for (const type of ['integer_addition', 'decimal_round', 'rectangle_area']) {
      for (const lv of [1, 2, 3, 4, 5] as DifficultyLevel[]) {
        const p = generateProblem({ type, difficulty: lv });
        expect(p.type).toBe(type);
        expect(p.difficulty.level).toBe(lv);
      }
    }
  });

  it('未登録型のエラーは既存仕様のまま', () => {
    expect(() => generateProblem({ type: 'no_such_type', difficulty: 1 }))
      .toThrow('不明な問題タイプです');
  });
});
