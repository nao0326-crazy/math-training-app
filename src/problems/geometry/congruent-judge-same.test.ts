/**
 * congruent-judge-same.test.ts — judge_same の数学的独立検算
 *
 * 最重要原則:
 *   generator 自身 (polygonArea / triangleSideLengths) をテストで呼び出さない。
 *   同じ誤り (例: 面積計算式のtypo) を共有すると検出できなくなるため、
 *   このファイルは **完全に独立した実装** で図形データを再計算する。
 */

import { describe, expect, it } from 'vitest';
import { CongruentJudgeSameGenerator } from './generators';
import type { DifficultyLevel, FigurePoint, Problem } from '../../types/problem';
import { getTypeSupportedLevels } from '../../engine/diversity/metadata';
import { generateProblem } from '../../engine/selector/generatorRegistry';
import { validateProblem } from '../../engine/validator/validator';

const gen = new CongruentJudgeSameGenerator();
const SEEDS = 40;
const EPS = 1e-6;

/* ============================================================
 * 独立した幾何計算 (generator を一切使わない)
 * ============================================================ */

/** 2点間距離 (独立実装) */
function d(p: FigurePoint, q: FigurePoint): number {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 三角形の面積 (Shoelace) を独立実装 */
function areaShoelace(t: FigurePoint[]): number {
  const cross = Math.abs(
    t[0].x * (t[1].y - t[2].y) +
    t[1].x * (t[2].y - t[0].y) +
    t[2].x * (t[0].y - t[1].y),
  );
  return cross / 2;
}

/** 3辺の長さを独立計算し昇順で返す */
function sidesOf(t: FigurePoint[]): number[] {
  return [d(t[0], t[1]), d(t[1], t[2]), d(t[2], t[0])].sort((x, y) => x - y);
}

/** 距離行列 (3x3) を独立計算 */
function distanceMatrix(t: FigurePoint[]): number[][] {
  return t.map((p, i) => t.map((q, j) => (i === j ? 0 : d(p, q))));
}

/** 問題から図A / 図B の頂点配列を取り出す */
function extractTriangles(p: Problem): [FigurePoint[], FigurePoint[]] {
  const spec = p.figure;
  if (!spec || spec.figures.length !== 2) {
    throw new Error(`judge_same は図2つを持つべき: ${p.id}`);
  }
  const a = spec.figures[0].vertices;
  const b = spec.figures[1].vertices;
  if (a.length !== 3 || b.length !== 3) {
    throw new Error(`judge_same は三角形を持つべき: ${p.id}`);
  }
  return [a, b];
}

/** 浮動小数点の一致判定 */
function near(x: number, y: number, tol = EPS): boolean {
  return Math.abs(x - y) <= tol;
}

const LEVELS: DifficultyLevel[] = getTypeSupportedLevels('judge_same');
describe('judge_same: 生成された問題の構造', () => {
  it(`lv${LEVELS.join('/')} × ${SEEDS} seed で figure 要素が正しい形をしている`, () => {
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
        expect((p.answer as { value: string }).value).toBe('はい');
        const v = gen.validate(p);
        expect(v.valid, `lv${lv} seed${s}: ${v.errors.join(',')}`).toBe(true);
      }
    }
  });

  it('validate が独立に「はい」を要求する (図1つだけの不正問題は弾く)', () => {
    const p = gen.generate({ difficulty: 2, seed: 1 });
    const broken: Problem = { ...p, figure: { figures: [p.figure!.figures[0]] } };
    expect(gen.validate(broken).valid).toBe(false);
  });
});

describe('judge_same: 数学的独立検算 (generator を信頼しない)', () => {
  it('辺長: 図A と図B の3辺長 multiset が一致する', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        const sa = sidesOf(a);
        const sb = sidesOf(b);
        for (let k = 0; k < 3; k++) {
          expect(near(sa[k], sb[k]), `lv${lv} seed${s}: 辺${k} 不一致 A=${sa} B=${sb}`).toBe(true);
        }
      }
    }
  });

  it('面積: 図A と図B の面積が一致する (独立 Shoelace)', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        expect(
          near(areaShoelace(a), areaShoelace(b), 1e-5),
          `lv${lv} seed${s}: 面積不一致`,
        ).toBe(true);
      }
    }
  });

  it('非退化: 両図の面積が eps より大きい', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        expect(areaShoelace(a), `lv${lv} seed${s}: 図A が退化`).toBeGreaterThan(EPS);
        expect(areaShoelace(b), `lv${lv} seed${s}: 図B が退化`).toBeGreaterThan(EPS);
      }
    }
  });
describe('judge_same: 合同変換の直接検証', () => {
  it('距離行列: 対応関係のもとで全頂点間距離が一致する', () => {
    const perms = [
      [0, 1, 2], [0, 2, 1], [1, 0, 2],
      [1, 2, 0], [2, 0, 1], [2, 1, 0],
    ];
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        const da = distanceMatrix(a);
        const db = distanceMatrix(b);
        const ok = perms.some((pm) => {
          for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
              if (!near(da[i][j], db[pm[i]][pm[j]], 1e-5)) return false;
            }
          }
          return true;
        });
        expect(ok, `lv${lv} seed${s}: 一致する対応が存在しない`).toBe(true);
      }
    }
  });

  it('図A と図B は完全同一座標ではない (見た目だけが同じでない)', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        const same = a.every((p) => b.some((q) => near(p.x, q.x) && near(p.y, q.y)));
        expect(same, `lv${lv} seed${s}: 図A と図B が完全に同一`).toBe(false);
      }
    }
  });

  it('拡大縮小されていない: 対応する辺長比がすべて 1', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const [a, b] = extractTriangles(gen.generate({ difficulty: lv, seed: seedOf(s, lv) }));
        const sa = sidesOf(a);
        const sb = sidesOf(b);
        for (let k = 0; k < 3; k++) {
          expect(near(sa[k] / sb[k], 1, 1e-5), `lv${lv} seed${s}: 辺${k} の比が1でない`).toBe(true);
        }
      }
    }
  });
});

describe('judge_same: registry 統合と多様性', () => {
  it('judge_same は宣言なしで lv1-5 に対応する', () => {
    expect(getTypeSupportedLevels('judge_same')).toEqual([1, 2, 3, 4, 5]);
  });

  it('registry 経由 generateProblem でも辺長が一致する', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 5; s++) {
        // generate 直後から既存の validator を通ること
        const direct = gen.generate({ difficulty: lv, seed: s * 31 + lv });
        expect(
          validateProblem(direct).valid,
          `lv${lv} seed${s}: validateProblem が失敗`,
        ).toBe(true);

        const p = generateProblem({ type: 'judge_same', difficulty: lv, seed: s * 31 + lv });
        expect(p.type).toBe('judge_same');
        expect(p.difficulty.level, `lv${lv} seed${s}: difficulty が指定lvと違う`).toBe(lv);
        const [a, b] = extractTriangles(p);
        const sa = sidesOf(a);
        const sb = sidesOf(b);
        for (let k = 0; k < 3; k++) {
          expect(near(sa[k], sb[k], 1e-5), `lv${lv} seed${s}`).toBe(true);
        }
      }
    }
  });

  it('同一難易度内で図形の variety がある (uniqueQuestions >= 2)', () => {
    for (const lv of LEVELS) {
      const unique = new Set<string>();
      for (let s = 0; s < SEEDS; s++) {
        const p = gen.generate({ difficulty: lv, seed: seedOf(s, lv) });
        unique.add(JSON.stringify(p.figure!.figures.map((f) => f.vertices)));
      }
      expect(unique.size, `lv${lv}: variety が1未満`).toBeGreaterThanOrEqual(2);
    }
  });
});
});
const seedOf = (s: number, lv: number): number => s * 104729 + lv;