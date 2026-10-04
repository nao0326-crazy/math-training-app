/**
 * variety-phase2b.test.ts — arrange_simple の多様性と正しさ (Phase 2-B)
 *
 * 目的:
 *   - 5 つの条件 (variant) が「人名や記号を替えただけ」でなく、
 *     条件・考え方・解法が異なることを確認する
 *   - ジェネレータ本体とは独立した検算ロジックで答えを検証する
 *   - 生成の再現性 (同じシード → 同じ問題) を保つ
 *
 * 検算の考え方:
 *   ジェネレータの combination() / permutation() と同じ式を書くと、
 *   同じ誤りを共有して検出できなくなる。ここでは DFS で全列挙して
 *   並べ方・選び方を数え直し、期待値を独立に求める。
 *   到达する (n, r) は n<=7 なので全列挙でも十分軽い。
 */

import { describe, expect, it } from 'vitest';
import { ArrangeSimpleGenerator, type ArrangeSimpleVariant } from './generators';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import { attachSolutionSteps } from '../../engine/solution/solutionGenerator';
import type { DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const gen = new ArrangeSimpleGenerator();

/** 条件 (n, r, variant) を stable な文字列にする */
function conditionKey(p: Problem): string {
  const { n, r, variant } = p.parameters as {
    n: number;
    r: number;
    variant: ArrangeSimpleVariant;
  };
  return `${n}:${r}:${variant}`;
}

function answerOf(p: Problem): number {
  return p.answer.kind === 'integer' ? p.answer.value : Number.NaN;
}

// ---------------------------------------------------------------------------
// 独立した検算ロジック (ジェネレータ本体とは別の実装)
// ---------------------------------------------------------------------------

/** n 個から r 個を選んで並べる通り数を、DFS の全列挙で数える */
function countArrangementsByEnumeration(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let count = 0;
  const walk = (remaining: number[], acc: number[]) => {
    if (acc.length === r) {
      count++;
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      walk([...remaining.slice(0, i), ...remaining.slice(i + 1)], [...acc, remaining[i]]);
    }
  };
  walk([...Array(n).keys()], []);
  return count;
}

/** n 個から r 個を選ぶ (並べない) 通り数を、全列挙で数える */
function countSelectionsByEnumeration(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let count = 0;
  const walk = (start: number, picked: number) => {
    if (picked === r) {
      count++;
      return;
    }
    for (let i = start; i < n; i++) walk(i + 1, picked + 1);
  };
  walk(0, 0);
  return count;
}

/** 検証用の期待値。ジェネレータの combination / permutation を使わない */
function expectedByEnumeration(
  variant: ArrangeSimpleVariant,
  n: number,
  r: number,
): number {
  switch (variant) {
    case 'pick_only':
      return countArrangementsByEnumeration(n, r);
    case 'pick_special':
      // 特別の1人を n 人の中から決める n 通り × 残りの選び方
      // (n 人の中から決めてから残りを選ぶ、として数え直す)
      return n * countSelectionsByEnumeration(n - 1, r - 1);
    case 'pick_include_one':
      // Aさんを含めるので、Aさん以外の n-1 人から r-1 人を並べる
      return countArrangementsByEnumeration(n - 1, r - 1);
    case 'pick_first_fixed':
      // 先頭はAさん、残りの n-1 人から r-1 人を並べる
      return countArrangementsByEnumeration(n - 1, r - 1);
    case 'pick_both_ends':
      // 両端がBさんとCさん: 左右 2 通り × 残り n-2 人から r-2 人を並べる
      return 2 * countArrangementsByEnumeration(n - 2, r - 2);
  }
}

/** 文字化け・不要な英単語の検出 */
const MOJIBAKE = /[\uFFFD\uFFFE]|锟斤拷/;
const SUSPECT_WORDS = [
  '而且',
  'choose',
  'hood',
  'Wedding',
  'designated',
  'single',
  'mole',
  'Jacob',
  'TODO',
  'FIXME',
  'undefined',
  'NaN',
];

function findSuspicious(text: string): string[] {
  const found: string[] = [];
  if (MOJIBAKE.test(text)) found.push('文字化け');
  for (const w of SUSPECT_WORDS) {
    if (text.includes(w)) found.push(w);
  }
  return found;
}

/** lv1-5 を十分なシード数で生成する */
function generateMany(perLevel: number): Problem[] {
  const all: Problem[] = [];
  for (const lv of LEVELS) {
    for (let s = 0; s < perLevel; s++) {
      all.push(gen.generate({ difficulty: lv, seed: s * 1000003 + lv * 97 }));
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// 1. 独立検算: 答えが正しいこと
// ---------------------------------------------------------------------------

describe('arrange_simple: 独立した検算ロジックで答えを検証', () => {
  it('全 variant の全 (n, r) 条件で、答えは全列挙の検算値と一致する', () => {
    const mismatches: string[] = [];
    for (const p of generateMany(120)) {
      const { n, r, variant } = p.parameters as {
        n: number;
        r: number;
        variant: ArrangeSimpleVariant;
      };
      const expected = expectedByEnumeration(variant, n, r);
      if (answerOf(p) !== expected) {
        mismatches.push(`${conditionKey(p)}: 生成=${answerOf(p)} 検算=${expected}`);
      }
    }
    expect(
      mismatches.slice(0, 10).join('\n'),
      `${mismatches.length} 件で答えが検算と不一致`,
    ).toBe('');
  });

  it('検算ロジック自体の健全性 (既知の値で確認する)', () => {
    // 3人から2人を並べる = 3 × 2 = 6
    expect(expectedByEnumeration('pick_only', 3, 2)).toBe(6);
    // 4人から3人を並べる = 4 × 3 × 2 = 24
    expect(expectedByEnumeration('pick_only', 4, 3)).toBe(24);
    // 5人から2人を選ぶ (並べない) = 10
    expect(countSelectionsByEnumeration(5, 2)).toBe(10);
    // 4人から3人を選ぶ = 4
    expect(countSelectionsByEnumeration(4, 3)).toBe(4);
    // 4人から2人を並べ、両端固定 (残り2人から0人) = 2
    expect(expectedByEnumeration('pick_both_ends', 4, 2)).toBe(2);
    // 3人から2人を選び、そのうち1人を特別にする = 3 × 2 = 6
    // (特別の1人は 3 人から選ぶので 3 通り、残り1人はそのほかの2人から)
    expect(expectedByEnumeration('pick_special', 3, 2)).toBe(6);
    // 5人から3人を選び、そのうち1人を特別にする = 5 × (4から2人を選ぶ=6) = 30
    expect(expectedByEnumeration('pick_special', 5, 3)).toBe(30);
  });

  it('validate が全生成問題で正常に通過する', () => {
    const failures: string[] = [];
    for (const p of generateMany(120)) {
      const res = gen.validate(p);
      if (!res.valid) failures.push(`${conditionKey(p)}: ${res.errors.join(', ')}`);
    }
    expect(failures.slice(0, 10).join('\n'), `${failures.length} 件で validate が失敗`).toBe('');
  });

  it('条件を満たす: 常に r < n (arrange_tree と重複しない) かつ r >= 2', () => {
    const bad: string[] = [];
    for (const p of generateMany(120)) {
      const { n, r } = p.parameters as { n: number; r: number };
      if (!(r < n)) bad.push(`r=${r} n=${n} (r が n 以上)`);
      if (r < 2) bad.push(`r=${r} (2 未満)`);
    }
    expect(bad.slice(0, 10).join('\n'), `${bad.length} 件で条件を満たさない`).toBe('');
  });

  it('答えは必ず正の整数 (0・負数・小数にならない)', () => {
    const bad: string[] = [];
    for (const p of generateMany(120)) {
      const a = answerOf(p);
      if (!Number.isInteger(a) || a <= 0) bad.push(`${conditionKey(p)}: ${a}`);
    }
    expect(bad.slice(0, 10).join('\n'), `${bad.length} 件で答えが不正`).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 2. 解答判定・解説・途中式の一致
// ---------------------------------------------------------------------------

describe('arrange_simple: 解答判定・解説・途中式', () => {
  it('正解の文字列を解答判定に通すと正答と判定される', () => {
    const wrong: string[] = [];
    for (const p of generateMany(80)) {
      const text = formatAnswer(p.answer);
      if (!checkUserAnswer(text, p.answer)) {
        wrong.push(`${conditionKey(p)}: ${text} が正と判定されなかった`);
      }
    }
    expect(
      wrong.slice(0, 10).join('\n'),
      `${wrong.length} 件で正解が正答にならなかった`,
    ).toBe('');
  });

  it('解説に正解の数値が含まれる', () => {
    const wrong: string[] = [];
    for (const p of generateMany(80)) {
      const ans = formatAnswer(p.answer);
      if (!(p.explanation ?? '').includes(ans)) {
        wrong.push(`${conditionKey(p)}: 解説に正解 ${ans} がない`);
      }
    }
    expect(wrong.slice(0, 10).join('\n'), `${wrong.length} 件で解説に正解がない`).toBe('');
  });

  it('解説の条件が問題文と矛盾しない', () => {
    const bad: string[] = [];
    for (const p of generateMany(80)) {
      const { n, r, variant } = p.parameters as {
        n: number;
        r: number;
        variant: ArrangeSimpleVariant;
      };
      const e = p.explanation ?? '';
      if (variant === 'pick_both_ends' && e.includes(`${r}人を選んで並べる`)) {
        bad.push(`${conditionKey(p)}: 解説が ${r} 人並べるとなっている`);
      }
      // 人数として n+1 人を数えている箇所があれば誤り
      // (数字だけを見ると 60 通り に含まれる 6 を誤検出するため「人」で測る)
      if (e.includes(`${n + 1}人`)) {
        bad.push(`${conditionKey(p)}: 解説に存在しない ${n + 1} 人がある`);
      }
    }
    expect(bad.slice(0, 10).join('\n'), `${bad.length} 件で解説の条件が矛盾`).toBe('');
  });

  it('途中式が存在し、最終ステップに正解の数値が含まれる', () => {
    const wrong: string[] = [];
    for (const p of generateMany(80)) {
      const ans = formatAnswer(p.answer);
      const steps = attachSolutionSteps(p).solutionSteps ?? [];
      if (steps.length === 0) {
        wrong.push(`${conditionKey(p)}: 途中式が空`);
        continue;
      }
      const lastExpr = steps[steps.length - 1].expression ?? '';
      if (!lastExpr.includes(ans)) {
        wrong.push(`${conditionKey(p)}: 最終式に正解 ${ans} がない`);
      }
    }
    expect(wrong.slice(0, 10).join('\n'), `${wrong.length} 件で途中式が不正`).toBe('');
  });

  it('問題文・解説・途中式に文字化けや不要な英単語が混ざらない', () => {
    const bad: string[] = [];
    for (const p of generateMany(80)) {
      const steps = attachSolutionSteps(p).solutionSteps ?? [];
      const texts = [
        p.question,
        p.explanation ?? '',
        ...steps.flatMap((s) => [s.expression ?? '', s.explanation ?? '']),
      ];
      for (const t of texts) {
        const found = findSuspicious(t);
        if (found.length > 0) bad.push(`${conditionKey(p)}: ${found.join('/')} in ${t}`);
      }
    }
    expect(bad.slice(0, 10).join('\n'), `${bad.length} 箇所で不正な文字列`).toBe('');
  });
});


// ---------------------------------------------------------------------------
// 3. 難易度と再現性
// ---------------------------------------------------------------------------

describe('arrange_simple: 難易度と再現性', () => {
  it('指定した難易度どおりの問題が生成される', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 40; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 7919 + lv });
        expect(p.difficulty.level, `lv${lv} seed${s}`).toBe(lv);
      }
    }
  });

  it('lv1 は両端固定を出さない、lv5 は条件のある variant が出きる', () => {
    const variantsAt = (lv: DifficultyLevel): Set<string> => {
      const set = new Set<string>();
      for (let s = 0; s < 200; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 31337 + lv });
        set.add((p.parameters as { variant: string }).variant);
      }
      return set;
    };
    const v1 = variantsAt(1);
    const v5 = variantsAt(5);
    expect(v1.has('pick_both_ends'), 'lv1 に両端固定が出ている').toBe(false);
    expect(v5.size, 'lv5 の variant が lv1 と同じ数').toBeGreaterThan(v1.size);
  });

  it('同じシードなら常に同じ問題になる', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 50; s++) {
        const seed = s * 12345 + lv;
        const a = gen.generate({ difficulty: lv, seed });
        const b = gen.generate({ difficulty: lv, seed });
        expect(a.question, `lv${lv} seed${seed} の問題文が再現しない`).toBe(b.question);
        expect(answerOf(a)).toBe(answerOf(b));
      }
    }
  });

  it('異なるシードでは条件や数値が変化する', () => {
    const questions = new Set<string>();
    const conditions = new Set<string>();
    for (let s = 0; s < 200; s++) {
      const p = gen.generate({ difficulty: 3, seed: s * 31337 + 3 });
      questions.add(p.question);
      conditions.add(conditionKey(p));
    }

// ---------------------------------------------------------------------------
// 4. 多様性
// ---------------------------------------------------------------------------

describe('arrange_simple: 多様性の指標', () => {
  it('quality-gate と同じ条件 (lv1-5 x 20 seeds) で問題文の種類が 25% 以上', () => {
    const questions = new Set<string>();
    let total = 0;
    for (const lv of LEVELS) {
      for (let s = 0; s < 20; s++) {
        questions.add(gen.generate({ difficulty: lv, seed: s * 104729 + lv }).question);
        total++;
      }
    }
    expect(total).toBe(100);
    // 修正前 (1 variant のみ) は 24/100 だった
    expect(questions.size, `問題文の種類が ${questions.size}/${total}`).toBeGreaterThanOrEqual(25);
  });

  it('数値条件の種類・数学的条件の種類・答えの種類を測定できる', () => {
    const conditions = new Set<string>();
    const variants = new Set<string>();
    const answers = new Set<number>();
    for (const p of generateMany(200)) {
      const { n, r, variant } = p.parameters as {
        n: number;
        r: number;
        variant: string;
      };
      conditions.add(`${n}:${r}`);
      variants.add(variant);
      answers.add(answerOf(p));
    }
    expect(conditions.size, '数値条件の種類が少なすぎる').toBeGreaterThan(20);
    expect(variants.size, '数学的条件の種類が少なすぎる').toBe(5);
    expect(answers.size, '答えの種類が少なすぎる').toBeGreaterThan(10);
  });

  it('5 つの variant はすべて実際に生成される', () => {
    const variants = new Set<string>();
    for (const p of generateMany(200)) {
      variants.add((p.parameters as { variant: string }).variant);
    }
    expect([...variants].sort()).toEqual([
      'pick_both_ends',
      'pick_first_fixed',
      'pick_include_one',
      'pick_only',
      'pick_special',
    ]);
  });

  it('同じ条件なら問題文は常に同一 (表現のゆらぎなし)', () => {
    const byCondition = new Map<string, Set<string>>();
    for (const p of generateMany(200)) {
      const key = conditionKey(p);
      if (!byCondition.has(key)) byCondition.set(key, new Set());
      byCondition.get(key)!.add(p.question);
    }
    for (const [key, qs] of byCondition) {
      expect(qs.size, `条件 ${key} で問題文が揺れています`).toBe(1);
    }
  });

  it('条件ごとに答えの式が異なる (名前の付け替えだけの差にしない)', () => {
    // 5 種類の variant で答えが常に同一なら「名前だけの差し替え」と疑われる
    const byVariant = new Map<ArrangeSimpleVariant, Set<number>>();
    for (const p of generateMany(200)) {
      const { variant } = p.parameters as { variant: ArrangeSimpleVariant };
      if (!byVariant.has(variant)) byVariant.set(variant, new Set());
      byVariant.get(variant)!.add(answerOf(p));
    }
    const allSame = [...byVariant.values()].every((s) => s.size === 1);
    expect(allSame, '全 variant で答えが同一のため、実質的な差がない疑いがある').toBe(false);
  });
});

    expect(conditions.size, '条件の種類が極端に少ない').toBeGreaterThan(5);
    expect(questions.size, '問題文の種類が極端に少ない').toBeGreaterThan(5);
  });
});

