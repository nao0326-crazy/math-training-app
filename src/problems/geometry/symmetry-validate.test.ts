/**
 * symmetry-validate.test.ts — symmetry_fold / symmetry_point の validate 修正
 *
 * 背景:
 *   両ジェネレータは parameters に「正答」を保存していないのに、
 *   validate() が parameters.answer を参照していたため、
 *   生成された問題と parameters が一致せず **常に validate が失敗**していた
 *   (undefined !== 'はい')。
 *   generate() 側の正解は正しいので、生成ロジックではなく
 *   validate だけが壊れていた。
 *
 * このテストの方針:
 *   - 期待値は「図形の数学的な性質」表をこのファイル側で持つことで決める。
 *     generator 内の isFold / isPoint をそのまま流用しない
 *     (同じ誤りを共有すると検出できなくなるため)。
 *   - validate を通ることと、独立した表から求めた正解に一致することを
 *     の両方を確認する。
 */

import { describe, expect, it } from 'vitest';
import { SymmetryFoldGenerator, SymmetryPointGenerator } from './generators';
import type { DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const fold = new SymmetryFoldGenerator();
const point = new SymmetryPointGenerator();

/**
 * 線対称かどうかの独立した判定表。
 * 根拠: 正多角形は頂点を通る軸を持つ。一般三角形・平行四辺形・台形は
 * 折り返して自分自身に重ならない。
 */
const LINE_SYMMETRIC: Record<string, boolean> = {
  正三角形: true,
  長方形: true,
  正五角形: true,
  ひし形: true,
  三角形: false,
  平行四辺形: false,
  台形: false,
  正六角形: true,
};

/** 点対称かどうかの独立した判定表 (中心が対称中心になる図形) */
const POINT_SYMMETRIC: Record<string, boolean> = {
  長方形: true,
  正方形: true,
  正六角形: true,
  円: true,
  正三角形: false,
  台形: false,
  平行四辺形: true,
};

/** 独立した表から期待する正解を作る */
function expectedAnswer(table: Record<string, boolean>, p: Problem): string {
  const shape = (p.parameters as { shape: string }).shape;
  if (!(shape in table)) {
    throw new Error(`判定表にない図形です: ${shape}`);
  }
  return table[shape] ? 'はい' : 'いいえ';
}

describe('symmetry_fold: validate が生成された問題の正答を受理する', () => {
  it('lv1-5 のすべての生成问题上、validate が通る', () => {
    const failures: string[] = [];
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = fold.generate({ difficulty: lv, seed: s * 104729 + lv });
        const res = fold.validate(p);
        if (!res.valid) {
          failures.push(`lv${lv} seed${s * 104729 + lv}: ${res.errors.join(', ')}`);
        }
      }
    }
    expect(failures.slice(0, 5).join('\n'), `${failures.length} 件で validate が失敗`).toBe('');
  });

  it('生成された正答は、独立した判定表とも一致する', () => {
    const failures: string[] = [];
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = fold.generate({ difficulty: lv, seed: s * 104729 + lv });
        const expected = expectedAnswer(LINE_SYMMETRIC, p);
        if (answerValue(p) !== expected) {
          failures.push(`${p.question} -> ${answerValue(p)} (期待 ${expected})`);
        }
      }
    }
    expect(failures.slice(0, 5).join('\n'), `${failures.length} 件で判定表と不一致`).toBe('');
  });

  it('はい / いいえ の両方が実際に生成される', () => {
    const answers = new Set<string>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        answers.add(answerValue(fold.generate({ difficulty: lv, seed: s * 104729 + lv })));
      }
    }
    expect([...answers].sort()).toEqual(['いいえ', 'はい']);
  });

  it('明らかに誤った答えは validate で拒否される', () => {
    for (const lv of LEVELS) {
      const p = fold.generate({ difficulty: lv, seed: 3 });
      const correct = answerValue(p);
      const wrong = correct === 'はい' ? 'いいえ' : 'はい';

      const tampered = { ...p, answer: { kind: 'string' as const, value: wrong } };
      const res = fold.validate(tampered);
      expect(res.valid, `lv${lv}: 誤答 ${wrong} が受理された`).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);

      // parameters 側の判定だけを反転させた場合も拒否される
      const flipped = {
        ...p,
        parameters: { ...(p.parameters as object), isFold: !(p.parameters as any).isFold },
      };
      expect(fold.validate(flipped).valid, 'isFold を反転したものが受理された').toBe(false);
    }
  });
});

describe('symmetry_point: validate が生成された問題の正答を受理する', () => {
  it('lv1-5 のすべての生成问题上、validate が通る', () => {
    const failures: string[] = [];
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = point.generate({ difficulty: lv, seed: s * 104729 + lv });
        const res = point.validate(p);
        if (!res.valid) {
          failures.push(`lv${lv} seed${s * 104729 + lv}: ${res.errors.join(', ')}`);
        }
      }
    }
    expect(failures.slice(0, 5).join('\n'), `${failures.length} 件で validate が失敗`).toBe('');
  });

  it('生成された正答は、独立した判定表とも一致する', () => {
    const failures: string[] = [];
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = point.generate({ difficulty: lv, seed: s * 104729 + lv });
        const expected = expectedAnswer(POINT_SYMMETRIC, p);
        if (answerValue(p) !== expected) {
          failures.push(`${p.question} -> ${answerValue(p)} (期待 ${expected})`);
        }
      }
    }
    expect(failures.slice(0, 5).join('\n'), `${failures.length} 件で判定表と不一致`).toBe('');
  });

  it('明らかに誤った答えは validate で拒否される', () => {
    for (const lv of LEVELS) {
      const p = point.generate({ difficulty: lv, seed: 3 });
      const correct = answerValue(p);
      const wrong = correct === 'はい' ? 'いいえ' : 'はい';
      const tampered = { ...p, answer: { kind: 'string' as const, value: wrong } };
      const res = point.validate(tampered);
      expect(res.valid, `lv${lv}: 誤答 ${wrong} が受理された`).toBe(false);

      const flipped = {
        ...p,
        parameters: { ...(p.parameters as object), isPoint: !(p.parameters as any).isPoint },
      };
      expect(point.validate(flipped).valid, 'isPoint を反転したものが受理された').toBe(false);
    }
  });
});
function answerValue(p: Problem): string {
  return p.answer.kind === 'string' ? p.answer.value : '';
describe('symmetry 2型: 生成結果が変わっていないこと (再現性)', () => {
  it('同じシードなら問題文・正答・解説・difficulty がすべて再現する', () => {
    for (const gen of [fold, point]) {
      for (const lv of LEVELS) {
        for (let s = 0; s < 50; s++) {
          const seed = s * 65537 + lv;
          const a = gen.generate({ difficulty: lv, seed });
          const b = gen.generate({ difficulty: lv, seed });
          expect(a.question, `${gen.type} lv${lv} seed${seed} の問題文`).toBe(b.question);
          expect(answerValue(a), `${gen.type} lv${lv} seed${seed} の答え`).toBe(answerValue(b));
          expect(a.explanation, `${gen.type} lv${lv} seed${seed} の解説`).toBe(b.explanation);
          expect(a.difficulty.level, `${gen.type} lv${lv} seed${seed} の難易度`).toBe(b.difficulty.level);
        }
      }
    }
  });

  it('指定した difficulty が difficulty.level に反映される', () => {
    for (const gen of [fold, point]) {
      for (const lv of LEVELS) {
        for (let s = 0; s < 30; s++) {
          const p = gen.generate({ difficulty: lv, seed: s * 15485863 + lv });
          expect(p.difficulty.level, `${gen.type} lv${lv}`).toBe(lv);
        }
      }
    }
  });

  it('答えは必ず はい / いいえ で、他の値にならない', () => {
    for (const gen of [fold, point]) {
      for (const lv of LEVELS) {
        for (let s = 0; s < 100; s++) {
          const p = gen.generate({ difficulty: lv, seed: s * 31337 + lv });
          expect(['はい', 'いいえ'], `${gen.type}: ${p.question}`).toContain(answerValue(p));
          expect(p.answer.kind).toBe('string');
        }
      }
    }
  });

  it('parameters は既存のキーのみを持つ (生成出力の構造を変えていない)', () => {
    const p1 = fold.generate({ difficulty: 2, seed: 1 });
    expect(Object.keys(p1.parameters).sort()).toEqual(['count', 'difficultyLevel', 'isFold', 'shape']);
    const p2 = point.generate({ difficulty: 2, seed: 1 });
    expect(Object.keys(p2.parameters).sort()).toEqual(['difficultyLevel', 'isPoint', 'shape']);
  });
});
}