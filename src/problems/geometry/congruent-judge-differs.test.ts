/**
 * congruent-judge-differs.test.ts — judge_differs の数学的独立検算
 *
 * 最重要原則:
 *   generator 内部の guard (guardDist / guardSideSet / guardIsCongruent /
 *   polygonArea / triangleSideLengths) をテストから一切呼び出さない。
 *   generator と同じ誤りを持つと検出できなくなるため、
 *   このファイルは完全に独立した実装で図形データを再計算する。
 *
 * 検証:
 *   1. figure が存在し、図形が2つある
 *   2. 両方とも三角形 (kind と頂点数)
 *   3. 両方とも非退化 (面積 > eps)
 *   4. 辺長を独立に再計算し、multiset が一致しない (非合同の証拠)
 *   5. 頂点対応6通りを全探索しても距離行列が一致しない
 *   6. 問題文・解説・正解が存在する
 *   7. 図Aと図Bが完全に同一座標ではない
 *   8. registry 経由 generateProblem でも同じ性質を保つ
 */

import { describe, expect, it } from 'vitest';
import { CongruentJudgeDiffersGenerator } from './generators';
import type { DifficultyLevel, FigurePoint, Problem } from '../../types/problem';
import { getTypeSupportedLevels } from '../../engine/diversity/metadata';
import { generateProblem } from '../../engine/selector/generatorRegistry';
import { validateProblem } from '../../engine/validator/validator';

const gen = new CongruentJudgeDiffersGenerator();
const SEEDS = 40;
const EPS = 1e-6;

/* ============================================================
 * 独立した幾何計算 (generator を一切使わない)
 * ============================================================ */

/** 2点間距離 (独立実装) */
function dist(p: FigurePoint, q: FigurePoint): number {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 三角形の面積を、独立した別式 (外積の絶対値の半分) で求める */
function areaIndependent(t: FigurePoint[]): number {
  const e1 = (t[1].x - t[0].x) * (t[2].y - t[0].y);
  const e2 = (t[2].x - t[0].x) * (t[1].y - t[0].y);
  return Math.abs(e1 - e2) / 2;
}

/** 3辺の長さを独立計算し昇順で返す */
function sidesIndependent(t: FigurePoint[]): number[] {
  return [dist(t[0], t[1]), dist(t[1], t[2]), dist(t[2], t[0])].sort((x, y) => x - y);
}

/** 6通りの頂点対応すべてを試し、合同なら true を返す (SSS の直接検証) */
function congruentByAnyCorrespondence(a: FigurePoint[], b: FigurePoint[]): boolean {
  const perms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2],
    [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  for (const [i, j, k] of perms) {
    if (
      Math.abs(dist(a[0], a[1]) - dist(b[i], b[j])) < 1e-6 &&
      Math.abs(dist(a[0], a[2]) - dist(b[i], b[k])) < 1e-6 &&
      Math.abs(dist(a[1], a[2]) - dist(b[j], b[k])) < 1e-6
    ) {
      return true;
    }
  }
  return false;
}

function extractTriangles(p: Problem): [FigurePoint[], FigurePoint[]] {
  const spec = p.figure;
  if (!spec || spec.figures.length !== 2) {
    throw new Error(`judge_differs は図2つを持つべき: ${p.id}`);
  }
  const a = spec.figures[0].vertices;
  const b = spec.figures[1].vertices;
  if (a.length !== 3 || b.length !== 3) {
    throw new Error(`judge_differs は三角形を持つべき: ${p.id}`);
  }
  return [a, b];
}

function near(x: number, y: number, tol = EPS): boolean {
  return Math.abs(x - y) <= tol;
}

const LEVELS: DifficultyLevel[] = getTypeSupportedLevels('judge_differs');
const seedOf = (s: number, lv: number): number => s * 104729 + lv;
describe('judge_differs: 生成された問題の構造', () => {
  it(`lv${LEVELS.join('/')} × ${SEEDS} seed で figure が2つの三角形になっている`, () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const p = gen.generate({ difficulty: lv, seed: seedOf(s, lv) });
        expect(p.figure, `lv${lv} seed${s}: figure が無い`).toBeDefined();
        expect(p.figure!.figures.length, `lv${lv} seed${s}`).toBe(2);
        for (const fig of p.figure!.figures) {
          expect(fig.kind, `lv${lv} seed${s}`).toBe('triangle');
          expect(fig.vertices.length, `lv${lv} seed${s}`).toBe(3);
        }
        expect(p.question.length, `lv${lv} seed${s}`).toBeGreaterThan(0);
        expect((p.explanation ?? '').length, `lv${lv} seed${s}`).toBeGreaterThan(0);
        expect(p.answer.kind).toBe('string');
        expect((p.answer as { value: string }).value).toBe('いいえ');
        const v = gen.validate(p);
        expect(v.valid, `lv${lv} seed${s}: ${v.errors.join(',')}`).toBe(true);
      }
    }
  });

  it('judge_differs は lv2-5 のみを検証対象にする (lv1 は未対応)', () => {
    expect(getTypeSupportedLevels('judge_differs')).toEqual([2, 3, 4, 5]);
  });

  it('宣言したレベルと実際の生成挙動が一致する (lv1 は明示的に失敗する)', () => {
    const declared = getTypeSupportedLevels('judge_differs');
    for (const lv of [1, 2, 3, 4, 5] as DifficultyLevel[]) {
      let threw = false;
      let msg = '';
      try {
        const r = gen.generate({ difficulty: lv, seed: 42 });
        msg = `lv=${r.difficulty.level}`;
      } catch (e) {
        threw = true;
        msg = (e as Error).message;
      }
      // 対応レベルのときは生成でき、未対応レベル (lv1) は明示的に Error になる。
      expect(
        threw,
        `lv${lv}: 宣言=${JSON.stringify(declared)} throw=${threw} ${msg}`,
      ).toBe(!declared.includes(lv));
    }
  });

  it('registry 経由 generateProblem でも lv2-5 が同じ性質を保つ', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 5; s++) {
        const direct = gen.generate({ difficulty: lv, seed: s * 31 + lv });
        expect(validateProblem(direct).valid, `lv${lv} seed${s}`).toBe(true);
        const p = generateProblem({ type: 'judge_differs', difficulty: lv, seed: s * 31 + lv });
        expect(p.type).toBe('judge_differs');
        expect(p.difficulty.level, `lv${lv} seed${s}`).toBe(lv);
        const [a, b] = extractTriangles(p);
        expect(congruentByAnyCorrespondence(a, b), `lv${lv} seed${s}`).toBe(false);
      }
    }
  });
});

describe('judge_differs: 数学的独立検算 (generator を信頼しない)', () => {
  it('非退化: 両図の面積が eps より大きい', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        expect(areaIndependent(a), `lv${lv} seed${s}: 図A が退化`).toBeGreaterThan(EPS);
        expect(areaIndependent(b), `lv${lv} seed${s}: 図B が退化`).toBeGreaterThan(EPS);
      }
    }
  });

  it('辺長: 対応する辺のmultiset が一致しない (非合同の証拠)', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        const sa = sidesIndependent(a);
        const sb = sidesIndependent(b);
        const allEqual = [0, 1, 2].every((k) => near(sa[k], sb[k], 1e-6));
        expect(allEqual, `lv${lv} seed${s}: 辺長がすべて一致 (=${sa})`).toBe(false);
      }
    }
  });

  it('距離行列: 頂点対応6通りを全探索しても合同にならない', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        expect(
          congruentByAnyCorrespondence(a, b),
          `lv${lv} seed${s}: 合同な対応が存在する`,
        ).toBe(false);
      }
    }
  });

  it('図A と図B は完全同一座標ではない', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        const same = a.every((p) => b.some((q) => near(p.x, q.x) && near(p.y, q.y)));
        expect(same, `lv${lv} seed${s}: 図A と図B が完全に同一`).toBe(false);
      }
    }
  });

  it('3種の変形 (scaled / apex_moved / base_widened) がすべて出現する', () => {
    const variants = new Set<string>();
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        variants.add((gen.generate({ difficulty: lv, seed: seedOf(s, lv) }).parameters as { variant: string }).variant);
      }
    }
    expect([...variants].sort()).toEqual(['apex_moved', 'base_widened', 'scaled']);
  });

  it('validate は合同な図形を偽の正解として受理しない', () => {
    const p = gen.generate({ difficulty: 3, seed: 5 });
    // 図Bを 図A と合同な図形に差し替える → validate が失敗するはず
    const fake: Problem = {
      ...p,
      figure: { figures: [p.figure!.figures[0], p.figure!.figures[1]] },
    };
    const relabelled: Problem = {
      ...fake,
      figure: {
        figures: [
          p.figure!.figures[0],
          // 図A をそのまま 2つ目{figure: [{...図A}]} にして合同を作る
          { ...p.figure!.figures[0], caption: '図B' },
        ],
      },
    };
    const v = gen.validate(relabelled);
    expect(v.valid).toBe(false);
    expect(v.errors.join()).toContain('合同');
  });
});