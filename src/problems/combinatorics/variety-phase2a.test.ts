/**
 * variety-phase2a.test.ts — arrange_tree / combine_table の多様性と正しさ (Phase 2-A)
 *
 * 目的:
 *   - 名前や記号だけの差し替えで多様性を偽っていないことを確認する
 *   - 全列挙で答えを確定させているため、条件と答えが必ず一致することを保証する
 *   - 生成の再現性 (同じシード → 同じ問題) を保つ
 *
 * Phase 1 の quality-gate.test.ts のベースラインは、
 * 本テストが実際に改善を検証できた後にのみ更新する。
 */

import { describe, expect, it } from 'vitest';
import {
  TreeDiagramGenerator,
  CombineTableGenerator,
  type ArrangeTreeVariant,
  type CombineTableVariant,
} from './generators';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import { fingerprintProblem } from '../../engine/diversity/metadata';
import { attachSolutionSteps } from '../../engine/solution/solutionGenerator';
import type { DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

const arrangement = new TreeDiagramGenerator();
const table = new CombineTableGenerator();

/** 条件 (n, variant) を stable な文字列にする (空白差で比較が壊れないように) */
function conditionKey(p: Problem): string {
  const { n, variant } = p.parameters as { n: number; variant: string };
  return `${n}:${variant}`;
}

function answerOf(p: Problem): number {
  return p.answer.kind === 'integer' ? p.answer.value : Number.NaN;
}

// ---------------------------------------------------------------------------
// 1. 多様性 (人名・記号だけの差し替えではないこと)
// ---------------------------------------------------------------------------

describe('arrange_tree: 実質的な多様性', () => {
  it('同じ (n, variant) なら問題文は常に同一である (表現ゆらぎなし)', () => {
    const byCondition = new Map<string, Set<string>>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 13 + lv });
        const key = conditionKey(p);
        if (!byCondition.has(key)) byCondition.set(key, new Set());
        byCondition.get(key)!.add(p.question);
      }
    }
    for (const [key, questions] of byCondition) {
      expect(questions.size, `条件 ${key} で問題文が揺れています`).toBe(1);
    }
  });

  it('条件 (n, variant) の組み合わせが十分に多い', () => {
    const conditions = new Set<string>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        conditions.add(conditionKey(arrangement.generate({ difficulty: lv, seed: s * 7919 + lv })));
      }
    }
    // 測定で全難易度合計の最大条件数は 22。
    // これが減으면多様性の退行なので、下限として 20 を守る。
    expect(conditions.size).toBeGreaterThanOrEqual(20);
  });

  it('複数の条件種類が出現する (1種類に固定されない)', () => {
    const variants = new Set<ArrangeTreeVariant>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 7919 + lv });
        variants.add((p.parameters as { variant: ArrangeTreeVariant }).variant);
      }
    }
    // 定義済みの5種類すべてが出ることが望ましい
    expect(variants.size).toBeGreaterThanOrEqual(5);
  });

  it('答えが複数種類ある (同じ答えばかりにならない)', () => {
    const answers = new Set<number>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        answers.add(answerOf(arrangement.generate({ difficulty: lv, seed: s * 5 + lv })));
      }
    }
    // 測定値: 2,4,6,12,24,48,120,240,720 の9種類
    expect(answers.size).toBeGreaterThanOrEqual(9);
  });
});

describe('combine_table: 実質的な多様性', () => {
  it('同じ (n, variant) なら問題文は常に同一である', () => {
    const byCondition = new Map<string, Set<string>>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = table.generate({ difficulty: lv, seed: s * 13 + lv });
        const key = conditionKey(p);
        if (!byCondition.has(key)) byCondition.set(key, new Set());
        byCondition.get(key)!.add(p.question);
      }
    }
    for (const [key, questions] of byCondition) {
      expect(questions.size, `条件 ${key} で問題文が揺れています`).toBe(1);
    }
  });

  it('条件 (n, variant) の組み合わせが十分に多い', () => {
    const conditions = new Set<string>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        conditions.add(conditionKey(table.generate({ difficulty: lv, seed: s * 7919 + lv })));
      }
    }
    // 測定で全難易度合計の最大条件数は 25。減れば退行なので下限として 22 を守る。
    expect(conditions.size).toBeGreaterThanOrEqual(22);
  });

  it('複数の条件種類が出現する (総当たりばかりにならない)', () => {
    const variants = new Set<CombineTableVariant>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = table.generate({ difficulty: lv, seed: s * 7919 + lv });
        variants.add((p.parameters as { variant: CombineTableVariant }).variant);
      }
    }
    // 定義済みの4種類すべてが出ることが望ましい
    expect(variants.size).toBeGreaterThanOrEqual(4);
  });

  it('答えが複数種類ある', () => {
    const answers = new Set<number>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        answers.add(answerOf(table.generate({ difficulty: lv, seed: s * 5 + lv })));
      }
    }
    // 測定値: 4〜72 の16種類
    expect(answers.size).toBeGreaterThanOrEqual(16);
  });
});
// ---------------------------------------------------------------------------
// 2. 条件の正しさ・境界値 (生成側と独立に数え直して突き合わせる)
// ---------------------------------------------------------------------------

/** k! を素朴に計算する (生成側とは別の実装で検算するため) */
function fact(k: number): number {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

describe('arrange_tree: 条件と答えの正しさ', () => {
  it('全難易度・全シードで validate を通り、答えが正の整数になる', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 100; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 17 + lv });
        const result = arrangement.validate(p);
        expect(result.valid, `lv${lv} seed${s}: ${result.errors.join(', ')}`).toBe(true);
        expect(answerOf(p)).toBeGreaterThan(0);
      }
    }
  });

  it('fixed_first の答えは (n-1)! (位置が決まる分だけ減る)', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 19 + lv });
        const { n, variant } = p.parameters as { n: number; variant: ArrangeTreeVariant };
        if (variant !== 'fixed_first') continue;
        checked++;
        expect(answerOf(p)).toBe(fact(n - 1));
      }
    }
    expect(checked, 'fixed_first was never generated').toBeGreaterThan(0);
  });

  it('circle の答えは (n-1)! (回転して重なる並びを数えない)', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 23 + lv });
        const { n, variant } = p.parameters as { n: number; variant: ArrangeTreeVariant };
        if (variant !== 'circle') continue;
        checked++;
        expect(answerOf(p)).toBe(fact(n - 1));
      }
    }
    expect(checked, 'circle was never generated').toBeGreaterThan(0);
  });

  it('adjacent は 2x(n-1)! / both_ends は 2x(n-2)!', () => {
    const seen = new Set<ArrangeTreeVariant>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 80; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 29 + lv });
        const { n, variant } = p.parameters as { n: number; variant: ArrangeTreeVariant };
        seen.add(variant);
        if (variant === 'adjacent') expect(answerOf(p)).toBe(fact(n - 1) * 2);
        if (variant === 'both_ends') expect(answerOf(p)).toBe(fact(n - 2) * 2);
      }
    }
    expect(seen.has('adjacent')).toBe(true);
    expect(seen.has('both_ends')).toBe(true);
  });

  it('all は n! (条件なし全部の並び)', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 43 + lv });
        const { n, variant } = p.parameters as { n: number; variant: ArrangeTreeVariant };
        if (variant !== 'all') continue;
        expect(answerOf(p)).toBe(fact(n));
      }
    }
  });

  it('境界: 解説が壊れた式 (×0) を含まない', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 120; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 31 + lv });
        expect(p.explanation ?? '', `lv${lv} seed${s}`).not.toContain('×0');
      }
    }
  });

  it('境界: n は3以上で、答えも1以上になる', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 120; s++) {
        const p = arrangement.generate({ difficulty: lv, seed: s * 37 + lv });
        const { n } = p.parameters as { n: number };
        expect(n, `lv${lv} seed${s}`).toBeGreaterThanOrEqual(3);
        expect(answerOf(p)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('combine_table: 条件と答えの正しさ', () => {
  it('全難易度・全シードで validate を通り、答えが正の整数になる', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 100; s++) {
        const p = table.generate({ difficulty: lv, seed: s * 17 + lv });
        const result = table.validate(p);
        expect(result.valid, `lv${lv} seed${s}: ${result.errors.join(', ')}`).toBe(true);
        expect(answerOf(p)).toBeGreaterThan(0);
      }
    }
  });

  it('round_robin の答えは n(n-1)/2 (二度数えを2で割る)', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (let s = 0; s < 80; s++) {
        const p = table.generate({ difficulty: lv, seed: s * 19 + lv });
        const { n, variant } = p.parameters as { n: number; variant: CombineTableVariant };
        if (variant !== 'round_robin') continue;
        checked++;
        expect(answerOf(p)).toBe((n * (n - 1)) / 2);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('two_rounds は round_robin のちょうど2倍になる', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = table.generate({ difficulty: lv, seed: s * 37 + lv });
        const { n, variant } = p.parameters as { n: number; variant: CombineTableVariant };
        if (variant !== 'two_rounds') continue;
        expect(answerOf(p)).toBe(((n * (n - 1)) / 2) * 2);
      }
    }
  });

  it('one_team_games の答えは n-1 (その1チームの試合数だけ)', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (let s = 0; s < 80; s++) {
        const p = table.generate({ difficulty: lv, seed: s * 41 + lv });
        const { n, variant } = p.parameters as { n: number; variant: CombineTableVariant };
        if (variant !== 'one_team_games') continue;
        checked++;
        expect(answerOf(p)).toBe(n - 1);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

// ---------------------------------------------------------------------------
// 3. 解答判定・解説・再現性・既存接口
// ---------------------------------------------------------------------------

describe('解答判定と解説の整合', () => {
  it('表示された正解をそのまま入力すると正解と判定される', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 100; s++) {
        const gens = [
          arrangement.generate({ difficulty: lv, seed: s * 3 + lv }),
          table.generate({ difficulty: lv, seed: s * 3 + lv }),
        ];
        for (const p of gens) {
          const shown = formatAnswer(p.answer);
          expect(
            checkUserAnswer(shown, p.answer),
            `${p.type}: "${shown}" was judged wrong`,
          ).toBe(true);
        }
      }
    }
  });

  it('解説に正解の数値が含まれる', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const gens = [
          arrangement.generate({ difficulty: lv, seed: s * 5 + lv }),
          table.generate({ difficulty: lv, seed: s * 5 + lv }),
        ];
        for (const p of gens) {
          const ans = formatAnswer(p.answer).replace(/[,\s]/g, '');
          const expl = (p.explanation ?? '').replace(/[,\s]/g, '');
          expect(
            expl.includes(ans),
            `${p.type} lv${lv} seed${s}: explanation lacks answer ${ans}`,
          ).toBe(true);
        }
      }
    }
  });

  it('途中式の最終ステップに正解が含まれる', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 60; s++) {
        const gens = [
          arrangement.generate({ difficulty: lv, seed: s * 7 + lv }),
          table.generate({ difficulty: lv, seed: s * 7 + lv }),
        ];
        for (const raw of gens) {
          const p = attachSolutionSteps(raw);
          const steps = p.solutionSteps ?? [];
          expect(steps.length, `${p.type} has empty solutionSteps`).toBeGreaterThan(0);
          const last = steps[steps.length - 1];
          const text = `${last.expression ?? ''}${last.explanation ?? ''}`.replace(/[,\s]/g, '');
          expect(
            text.includes(formatAnswer(p.answer).replace(/[,\s]/g, '')),
            `${p.type} lv${lv} seed${s}: last step lacks the answer`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('シードの再現性', () => {
  it('同じシードなら同じ問題・同じフィンガープリントになる', () => {
    for (const lv of LEVELS) {
      for (const seed of [1, 12345, 999999]) {
        const a = attachSolutionSteps(arrangement.generate({ difficulty: lv, seed }));
        const b = attachSolutionSteps(arrangement.generate({ difficulty: lv, seed }));
        expect(b.question).toBe(a.question);
        expect(fingerprintProblem(b)).toBe(fingerprintProblem(a));

        const c = attachSolutionSteps(table.generate({ difficulty: lv, seed }));
        const d = attachSolutionSteps(table.generate({ difficulty: lv, seed }));
        expect(d.question).toBe(c.question);
        expect(fingerprintProblem(d)).toBe(fingerprintProblem(c));
      }
    }
  });

  it('異なるシードなら複数の問題になる (固定していない)', () => {
    for (const lv of LEVELS) {
      const fps = new Set<string>();
      for (let s = 0; s < 40; s++) {
        fps.add(fingerprintProblem(arrangement.generate({ difficulty: lv, seed: s * 1013 + lv })));
      }
      expect(fps.size, `arrange_tree lv${lv} is stuck`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('既存接口の維持', () => {
  it('type / category が変わっていない', () => {
    const a = arrangement.generate({ difficulty: 2, seed: 1 });
    const t = table.generate({ difficulty: 2, seed: 1 });
    expect(a.type).toBe('arrange_tree');
    expect(a.category).toBe('combinatorics');
    expect(t.type).toBe('combine_table');
    expect(t.category).toBe('combinatorics');
  });

  it('問題文・解説に不要な英単語が混ざっていない', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 80; s++) {
        const gens = [
          arrangement.generate({ difficulty: lv, seed: s * 7 + lv }),
          table.generate({ difficulty: lv, seed: s * 7 + lv }),
        ];
        for (const p of gens) {
          const text = `${p.question}${p.explanation ?? ''}`;
          expect(text).not.toMatch(/keshi|plastic|beside|Stavarna|Income|iemann/);
        }
      }
    }
  });
});
  it('one_game_pairs の答えは n(n-1)/2 (1試合 = 2チームの組合せ)', () => {
    let checked = 0;
    for (const lv of LEVELS) {
      for (let s = 0; s < 80; s++) {
        const p = table.generate({ difficulty: lv, seed: s * 43 + lv });
        const { n, variant } = p.parameters as { n: number; variant: CombineTableVariant };
        if (variant !== 'one_game_pairs') continue;
        checked++;
        expect(answerOf(p)).toBe((n * (n - 1)) / 2);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});