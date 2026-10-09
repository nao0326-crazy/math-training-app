/**
 * variety-phase2e.test.ts — combine_simple / common_multiples の多様性と正しさ (Phase 2-E)
 *
 * 目的:
 *   - 追加した構造 (variant) がすべて生成されること
 *   - 答えが「生成器の内部計算」ではなく、数学的に独立した方法で正しいこと
 *   - 生成の再現性 (同じシード → 同じ問題) を保つ
 *   - 既存型と役割が重複しないこと
 *
 * 独立検証の考え方:
 *   - combine_simple  : 選び方を「どの添字の集合か」で全列挙し、条件に合うものを数える。
 *                       ジェネレータの combination() / nCr 計算は使わない。
 *   - common_multiples: 公倍数の定義「aでもbでも割り切れる正の整数」から範囲を走査して
 *                       集める。lcm() を経由しないので生成器とは独立に数えている。
 *
 * 既存の variety-phase2a/b/d と同じ構成・同じファイル命名規則に揃えている。
 */

import { describe, expect, it } from 'vitest';
import {
  CombineSimpleGenerator,
  ArrangeSimpleGenerator,
  TreeDiagramGenerator,
  CombineTableGenerator,
  DuplicateRemovalGenerator,
  type CombineSimpleVariant,
} from './generators';
import {
  CommonMultiplesGenerator,
  LcmCalculationGenerator,
  type CommonMultiplesVariant,
} from '../numberTheory/generators';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import { fingerprintProblem } from '../../engine/diversity/metadata';
import { attachSolutionSteps } from '../../engine/solution/solutionGenerator';
import type { DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const comb = new CombineSimpleGenerator();
const cmult = new CommonMultiplesGenerator();
const arrangeSimple = new ArrangeSimpleGenerator();
const arrangeTree = new TreeDiagramGenerator();
const combineTable = new CombineTableGenerator();
const duplicateRemoval = new DuplicateRemovalGenerator();

/** lv1-5 × 十分なシード数で生成する */
function generateMany(
  gen: { generate: (c?: any) => Problem },
  perLevel: number,
  seedBase: number,
): Problem[] {
  const all: Problem[] = [];
  for (const lv of LEVELS) {
    for (let s = 0; s < perLevel; s++) {
      all.push(gen.generate({ difficulty: lv, seed: s * seedBase + lv * 97 }));
    }
  }
  return all;
}

function answerOf(p: Problem): number {
  return p.answer.kind === 'integer' ? p.answer.value : Number.NaN;
}

function answerTextOf(p: Problem): string {
  return formatAnswer(p.answer);
}

function levelOf(p: Problem): DifficultyLevel {
  return p.difficulty.level as DifficultyLevel;
}

// ---------------------------------------------------------------------------
// 独立した検算ロジック (ジェネレータ本体とは別の実装)
// ---------------------------------------------------------------------------

/**
 * n 個の要素から r 個を選ぶ組み合わせを全列挙で数える。
 * ジェネレータは combination() (nCr の式) を使うので、ここは列挙で数え直す。
 */
function countCombinations(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let count = 0;
  const walk = (start: number, picked: number): void => {
    if (picked === r) {
      count++;
      return;
    }
    for (let i = start; i < n; i++) walk(i + 1, picked + 1);
  };
  walk(0, 0);
  return count;
}

/**
 * n 個の要素 (0, 1, ...) から r 個選ぶ全ての組み合わせを「添字の配列」で列挙する。
 *
 * 添字を文字列として連結して持つと 10 / 11 が "0" を含む判定になり、
 * 誤って数えてしまうため、必ず数値配列のまま扱う。
 */
function enumerateCombinations(n: number, r: number): number[][] {
  const out: number[][] = [];
  const walk = (start: number, picked: number[]): void => {
    if (picked.length === r) {
      out.push([...picked]);
      return;
    }
    for (let i = start; i < n; i++) walk(i + 1, [...picked, i]);
  };
  walk(0, []);
  return out;
}

/**
 * 条件つきの選び方を、組み合わせの集合そのものから数え直す。
 * pick_only     : 全部
 * include_one   : 添字0 (Aさん) を含むもの
 * exclude_one   : 添字0 を含まないもの
 */
function countByCondition(
  variant: CombineSimpleVariant,
  n: number,
  r: number,
): number {
  const all = enumerateCombinations(n, r);
  switch (variant) {
    case 'pick_only':
      return all.length;
    case 'include_one':
      return all.filter((s) => s.includes(0)).length;
    case 'exclude_one':
      return all.filter((s) => !s.includes(0)).length;
  }
}

/**
 * 1 以上 limit 以下にある「a と b の公倍数」を、割り切れるかどうかで直接集める。
 * lcm() を経由しないので、生成器とは独立に数えている。
 */
function collectCommonMultiples(a: number, b: number, limit: number): number[] {
  const out: number[] = [];
  for (let m = 1; m <= limit; m++) {
    if (m % a === 0 && m % b === 0) out.push(m);
  }
  return out;
}

/** 期待値を「公倍数の定義」から作る (lcm を使わない) */
function expectedCommonMultiples(
  variant: CommonMultiplesVariant,
  a: number,
  b: number,
  arg1: number,
  arg2: number,
): string {
  switch (variant) {
    case 'list_first_n': {
      // 小さい方から arg1 個。定義どおり1つずつ「割り切れるか」を判定して集める
      const found: number[] = [];
      for (let m = 1; found.length < arg1; m++) {
        if (m % a === 0 && m % b === 0) found.push(m);
      }
      return found.join(', ');
    }
    case 'list_up_to':
      return collectCommonMultiples(a, b, arg1).join(', ');
    case 'list_between':
      return collectCommonMultiples(a, b, arg2)
        .filter((m) => m >= arg1)
        .join(', ');
    case 'count_in_range':
      return String(collectCommonMultiples(a, b, arg1).length);
  }
}

// ===========================================================================
// combine_simple
// ===========================================================================

describe('combine_simple: 独立検算で答えを検証する', () => {
  it('全 variant の答えが全列挙の検算値と一致する', () => {
    const mismatches: string[] = [];
    for (const p of generateMany(comb, 150, 1000003)) {
      const { n, r, variant } = p.parameters as {
        n: number;
        r: number;
        variant: CombineSimpleVariant;
      };
      const expected = countByCondition(variant, n, r);
      if (answerOf(p) !== expected) {
        mismatches.push(`${variant} n=${n} r=${r}: 生成=${answerOf(p)} 検算=${expected}`);
      }
    }
    expect(mismatches.slice(0, 10).join('\n'), `${mismatches.length} 件で不一致`).toBe('');
  });

  it('境界値 (r=2 / r=n-1) でも定義どおりになる', () => {
    // 2個選ぶケースを手計算した期待値と突き合わせる
    const cases: [CombineSimpleVariant, number, number, number][] = [
      ['pick_only', 5, 2, 10],
      ['include_one', 5, 2, 4],
      ['exclude_one', 5, 2, 6],
      ['pick_only', 6, 2, 15],
      ['include_one', 6, 2, 5],
      ['exclude_one', 6, 2, 10],
      // r = n - 1 (1人だけ選ばない) は教科書で確認できた具体例が n=5 まで。
      ['pick_only', 5, 4, 5],
      ['include_one', 5, 4, 4],
    ];
    for (const [variant, n, r, expected] of cases) {
      expect(countByCondition(variant, n, r), `${variant} n=${n} r=${r}`).toBe(expected);
    }

    // 独立な2つの数え方 (即時カウント / 列挙フィルタ) が一致することも確認する
    for (let n = 3; n <= 9; n++) {
      for (let r = 2; r < n; r++) {
        expect(countCombinations(n, r), `n=${n} r=${r}`).toBe(
          countByCondition('pick_only', n, r),
        );
      }
    }
  });

  it('選択人数と対象人数の関係が常に成立する (2 <= r < n)', () => {
    const violations: string[] = [];
    for (const p of generateMany(comb, 150, 7919)) {
      const { n, r } = p.parameters as { n: number; r: number };
      if (!(r >= 2 && r < n)) {
        violations.push(`n=${n} r=${r} が 2 <= r < n を満たさない`);
      }
      // 答えが1通り (学習価値が無い) になっていない
      if (answerOf(p) <= 1) {
        violations.push(`n=${n} r=${r} の答えが ${answerOf(p)} で1通り以下`);
      }
    }
    expect(violations.slice(0, 10).join('\n'), `${violations.length} 件で条件違反`).toBe('');
  });

  it('条件に合わないケース (全部を選ぶ) は validate で弾かれる', () => {
    const bad: Problem = {
      id: 'test',
      category: 'combinatorics',
      type: 'combine_simple',
      difficulty: {
        level: 2,
        components: {
          calculationComplexity: 2, numberComplexity: 1,
          reasoningComplexity: 2, readingComplexity: 1,
        },
      },
      question: '3人の中から3人を選びます。選び方は何通りありますか',
      answer: { kind: 'integer', value: 1 },
      explanation: '',
      parameters: { n: 3, r: 3, variant: 'pick_only', answer: 1, difficultyLevel: 2 },
    };
    const result = comb.validate(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('1通り');
  });

  it('答えを parameters で改ざんすると validate が失敗する', () => {
    const p = comb.generate({ difficulty: 3, seed: 42 });
    const tampered: Problem = {
      ...p,
      parameters: { ...p.parameters, answer: answerOf(p) + 1 },
    };
    expect(comb.validate(tampered).valid).toBe(false);
  });

  it('解説に正解の数値が含まれる', () => {
    for (const p of generateMany(comb, 80, 7)) {
      expect(p.explanation ?? '', p.question).toContain(String(answerOf(p)));
    }
  });

  it('表示された正解を入力し直すと判定を通る (answer judge)', () => {
    for (const p of generateMany(comb, 80, 11)) {
      expect(checkUserAnswer(formatAnswer(p.answer), p.answer)).toBe(true);
    }
  });
});

describe('combine_simple: 多様性', () => {
  it('3 種類すべての variant が出現する (Phase 2-K で 2条件の組合せを撤去)', () => {
    const variants = new Set<CombineSimpleVariant>();
    for (const p of generateMany(comb, 200, 7919)) {
      variants.add((p.parameters as { variant: CombineSimpleVariant }).variant);
    }
    expect([...variants].sort()).toEqual(['exclude_one', 'include_one', 'pick_only']);
  });

  it('同じ (n, r, variant) なら問題文は常に同一 (表現ゆらぎなし)', () => {
    const byCondition = new Map<string, Set<string>>();
    for (const p of generateMany(comb, 100, 13)) {
      const { n, r, variant } = p.parameters as { n: number; r: number; variant: string };
      const key = `${n}:${r}:${variant}`;
      if (!byCondition.has(key)) byCondition.set(key, new Set());
      byCondition.get(key)!.add(p.question);
    }
    for (const [key, questions] of byCondition) {
      expect(questions.size, `条件 ${key} で問題文が揺れています`).toBe(1);
    }
  });

  it('条件 (n, r, variant) の組み合わせが十分に多い', () => {
    const conditions = new Set<string>();
    for (const p of generateMany(comb, 200, 7919)) {
      const { n, r, variant } = p.parameters as { n: number; r: number; variant: string };
      conditions.add(`${n}:${r}:${variant}`);
    }
    expect(conditions.size).toBeGreaterThanOrEqual(40);
  });

  it('答えが複数種類ある (同じ答えばかりにならない)', () => {
    const answers = new Set<number>();
    for (const p of generateMany(comb, 200, 5)) answers.add(answerOf(p));
    expect(answers.size).toBeGreaterThanOrEqual(15);
  });

  it('difficulty ごとに使える variant が設計通りになる', () => {
    const allowed: Record<DifficultyLevel, CombineSimpleVariant[]> = {
      1: ['pick_only'],
      2: ['pick_only', 'include_one', 'exclude_one'],
      3: ['pick_only', 'include_one', 'exclude_one'],
      4: ['pick_only', 'include_one', 'exclude_one'],
      5: ['pick_only', 'include_one', 'exclude_one'],
    };
    for (const p of generateMany(comb, 120, 101)) {
      const variant = (p.parameters as { variant: CombineSimpleVariant }).variant;
      expect(allowed[levelOf(p)], `lv${levelOf(p)} で ${variant} が出ています`).toContain(variant);
    }
  });
});

describe('combine_simple: 既存型との重複がない', () => {
  it('combinatorics の他型と問題文が一致しない', () => {
    const otherQuestions = new Set<string>();
    for (const g of [arrangeSimple, arrangeTree, combineTable, duplicateRemoval]) {
      for (const lv of LEVELS) {
        for (let s = 0; s < 80; s++) {
          otherQuestions.add(g.generate({ difficulty: lv, seed: s * 4241 + lv }).question);
        }
      }
    }

    let overlap = 0;
    for (const p of generateMany(comb, 200, 7919)) {
      if (otherQuestions.has(p.question)) overlap++;
    }
    expect(overlap, `${overlap} 問が combinatorics の他型と重複`).toBe(0);
  });

  it('問いかけの語尾が他型と異なる (組合せでは「選び方」を問う)', () => {
    for (const p of generateMany(comb, 100, 7)) {
      // combine_simple は必ず「選び方は何通りですか」で終わる。
      // arrange_* 系は「並べ方」を問うので語尾が別物になる。
      expect(p.question, p.question).toContain('選び方は何通りありますか');
    }
  });
// ===========================================================================
// common_multiples
// ===========================================================================

describe('common_multiples: 独立検算で答えを検証する', () => {
  it('全 variant の答えが「割り切れるかどうか」で数えた値と一致する', () => {
    const mismatches: string[] = [];
    for (const p of generateMany(cmult, 150, 1000033)) {
      const { a, b, variant, arg1, arg2 } = p.parameters as {
        a: number; b: number; variant: CommonMultiplesVariant;
        arg1: number; arg2: number | null;
      };
      const expected = expectedCommonMultiples(variant, a, b, arg1, arg2 ?? 0);
      const actual = answerTextOf(p);
      if (actual !== expected) {
        mismatches.push(
          `${variant} a=${a} b=${b} arg1=${arg1} arg2=${arg2}: 生成=${actual} 検算=${expected}`,
        );
      }
    }
    expect(mismatches.slice(0, 10).join('\n'), `${mismatches.length} 件で不一致`).toBe('');
  });

  it('既知の例で公倍数の定義を確認する (検算側の自検)', () => {
    expect(collectCommonMultiples(4, 6, 36)).toEqual([12, 24, 36]);
    expect(collectCommonMultiples(3, 5, 45)).toEqual([15, 30, 45]);
    expect(collectCommonMultiples(2, 7, 60)).toEqual([14, 28, 42, 56]);
  });

  it('list_between の両端を正しく扱う (境界値を含む / 漏らしがない)', () => {
    let checked = 0;
    for (const p of generateMany(cmult, 200, 31337)) {
      const { a, b, variant, arg1, arg2 } = p.parameters as {
        a: number; b: number; variant: CommonMultiplesVariant;
        arg1: number; arg2: number | null;
      };
      if (variant !== 'list_between' || arg2 === null) continue;
      checked++;
      const list = answerTextOf(p) === '' ? [] : answerTextOf(p).split(', ').map(Number);
      for (const m of list) {
        expect(m).toBeGreaterThanOrEqual(arg1);
        expect(m).toBeLessThanOrEqual(arg2);
        expect(m % a).toBe(0);
        expect(m % b).toBe(0);
      }
      // 範囲内の公倍数が漏れていないこと (完全性)
      expect(list).toEqual(collectCommonMultiples(a, b, arg2).filter((m) => m >= arg1));
    }
    expect(checked, 'list_between が1度も出ていない').toBeGreaterThan(0);
  });

  it('list_up_to は上限以下を正確に列挙する', () => {
    for (const p of generateMany(cmult, 200, 7919)) {
      const { a, b, variant, arg1 } = p.parameters as {
        a: number; b: number; variant: CommonMultiplesVariant; arg1: number;
      };
      if (variant !== 'list_up_to') continue;
      const list = answerTextOf(p).split(', ').map(Number);
      for (const m of list) {
        expect(m).toBeLessThanOrEqual(arg1);
        expect(m % a).toBe(0);
        expect(m % b).toBe(0);
      }
      expect(list).toEqual(collectCommonMultiples(a, b, arg1));
    }
  });

  it('count_in_range は整数で「個数」を返す', () => {
    let checked = 0;
    for (const p of generateMany(cmult, 300, 65537)) {
      const { a, b, variant, arg1 } = p.parameters as {
        a: number; b: number; variant: CommonMultiplesVariant; arg1: number;
      };
      if (variant !== 'count_in_range') continue;
      checked++;
      expect(p.answer.kind).toBe('integer');
      expect(answerOf(p)).toBe(collectCommonMultiples(a, b, arg1).length);
      // 1個だけ数えるだけの問題は出さない
      expect(answerOf(p)).toBeGreaterThanOrEqual(2);
      // 個数を答えるので整数入力UIを使う
      expect(p.inputType).toBe('integer');
    }
    expect(checked, 'count_in_range が1度も出ていない').toBeGreaterThan(0);
  });

  it('空答え・1通りだけの答えを出さない', () => {
    for (const p of generateMany(cmult, 200, 12345)) {
      const text = answerTextOf(p);
      expect(text.trim(), p.question).not.toBe('');
      if (p.answer.kind === 'string') {
        expect(text.split(', ').length, p.question).toBeGreaterThanOrEqual(2);
        // 小6で書き間違いにくいよう、5個以下に収めている
        expect(text.split(', ').length, p.question).toBeLessThanOrEqual(5);
      }
    }
  });

  it('答えを改ざんすると validate が失敗する', () => {
    const p = cmult.generate({ difficulty: 3, seed: 7 });
    const tampered: Problem = {
      ...p,
      parameters: { ...p.parameters, answer: '999999, 1999998' },
    };
    expect(cmult.validate(tampered).valid).toBe(false);
describe('common_multiples: 多様性', () => {
  it('4 種類すべての variant が出現する', () => {
    const variants = new Set<CommonMultiplesVariant>();
    for (const p of generateMany(cmult, 300, 7919)) {
      variants.add((p.parameters as { variant: CommonMultiplesVariant }).variant);
    }
    expect(variants.size).toBe(4);
  });

  it('同じ (a, b, variant, arg1, arg2) なら問題文は常に同一', () => {
    const byCondition = new Map<string, Set<string>>();
    for (const p of generateMany(cmult, 200, 13)) {
      const params = p.parameters as Record<string, unknown>;
      const key = `${params.a}:${params.b}:${params.variant}:${params.arg1}:${params.arg2}`;
      if (!byCondition.has(key)) byCondition.set(key, new Set());
      byCondition.get(key)!.add(p.question);
    }
    for (const [key, questions] of byCondition) {
      expect(questions.size, `条件 ${key} で問題文が揺れています`).toBe(1);
    }
  });

  it('difficulty ごとに使える variant が設計通りになる', () => {
    const allowed: Record<DifficultyLevel, CommonMultiplesVariant[]> = {
      1: ['list_first_n'],
      2: ['list_first_n', 'list_up_to'],
      3: ['list_first_n', 'list_up_to', 'list_between'],
      4: ['list_first_n', 'list_up_to', 'list_between', 'count_in_range'],
      5: ['list_up_to', 'list_between', 'count_in_range'],
    };
    for (const p of generateMany(cmult, 200, 101)) {
      const variant = (p.parameters as { variant: CommonMultiplesVariant }).variant;
      expect(allowed[levelOf(p)], `lv${levelOf(p)} で ${variant} が出ています`).toContain(variant);
    }
  });

  it('答えが複数種類ある', () => {
    const answers = new Set<string>();
    for (const p of generateMany(cmult, 300, 5)) answers.add(answerTextOf(p));
    expect(answers.size).toBeGreaterThanOrEqual(100);
  });

  it('lcm_calculation の問題文と一致しない (役割が重複していない)', () => {
    const lcmGen = new LcmCalculationGenerator();
    const lcmQuestions = new Set<string>();
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        lcmQuestions.add(lcmGen.generate({ difficulty: lv, seed: s * 6151 + lv }).question);
      }
    }
    let overlap = 0;
    for (const p of generateMany(cmult, 300, 6151)) {
      if (lcmQuestions.has(p.question)) overlap++;
    }
    expect(overlap, `${overlap} 問が lcm_calculation と重複`).toBe(0);
  });
});

describe('シードの再現性 (両型)', () => {
  it('同じシードなら同じ問題・同じフィンガープリントになる', () => {
    for (const lv of LEVELS) {
      for (const seed of [1, 12345, 999999]) {
        const a1 = attachSolutionSteps(comb.generate({ difficulty: lv, seed }));
        const a2 = attachSolutionSteps(comb.generate({ difficulty: lv, seed }));
        expect(a2.question).toBe(a1.question);
        expect(fingerprintProblem(a2)).toBe(fingerprintProblem(a1));

        const b1 = attachSolutionSteps(cmult.generate({ difficulty: lv, seed }));
        const b2 = attachSolutionSteps(cmult.generate({ difficulty: lv, seed }));
        expect(b2.question).toBe(b1.question);
        expect(fingerprintProblem(b2)).toBe(fingerprintProblem(b1));
      }
    }
  });

  it('異なるシードなら複数の問題になる (固定していない)', () => {
    for (const lv of LEVELS) {
      const fps = new Set<string>();
      for (let s = 0; s < 40; s++) {
        fps.add(fingerprintProblem(comb.generate({ difficulty: lv, seed: s * 1013 + lv })));
      }
      expect(fps.size, `combine_simple lv${lv} が固定されている`).toBeGreaterThanOrEqual(3);
    }
    for (const lv of LEVELS) {
      const fps = new Set<string>();
      for (let s = 0; s < 40; s++) {
        fps.add(fingerprintProblem(cmult.generate({ difficulty: lv, seed: s * 1013 + lv })));
      }
      expect(fps.size, `common_multiples lv${lv} が固定されている`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('途中式と表示 (両型)', () => {
  it('combine_simple は途中式が生成され、最後のステップに正解が含まれる', () => {
    for (const p of generateMany(comb, 60, 7)) {
      const steps = attachSolutionSteps(p).solutionSteps ?? [];
      expect(steps.length, `${p.type} lv${levelOf(p)}`).toBeGreaterThan(0);
      const last = steps[steps.length - 1];
      const text = `${last.expression ?? ''}${last.explanation ?? ''}`.replace(/[,\s]/g, '');
      expect(text.includes(formatAnswer(p.answer).replace(/[,\s]/g, ''))).toBe(true);
    }
  });

  it('common_multiples も途中式が生成される', () => {
    for (const p of generateMany(cmult, 60, 7)) {
      const steps = attachSolutionSteps(p).solutionSteps ?? [];
      expect(steps.length, `${p.type} ${p.question}`).toBeGreaterThan(0);
    }
  });

  it('文字化け・不要な英単語が混ざっていない', () => {
    const suspect = /[\uFFFD]|NaN|undefined|Infinity|choose|Wedding|designated/;
    for (const p of [...generateMany(comb, 80, 7), ...generateMany(cmult, 80, 7)]) {
      const text = `${p.question}${p.explanation ?? ''}${answerTextOf(p)}`;
      expect(text, p.question).not.toMatch(suspect);
    }
  });

  it('type / category が変わっていない', () => {
    const a = comb.generate({ difficulty: 2, seed: 1 });
    const b = cmult.generate({ difficulty: 2, seed: 1 });
    expect(a.type).toBe('combine_simple');
    expect(a.category).toBe('combinatorics');
    expect(b.type).toBe('common_multiples');
    expect(b.category).toBe('numberTheory');
  });
});
  });

  it('表示された正解を入力し直すと判定を通る (answer judge)', () => {
    for (const p of generateMany(cmult, 150, 31)) {
      expect(checkUserAnswer(formatAnswer(p.answer), p.answer)).toBe(true);
    }
  });

  it('解説に最小公倍数が含まれる (解法の根拠が示されている)', () => {
    for (const p of generateMany(cmult, 100, 3)) {
      const { lcm } = p.parameters as { lcm: number };
      expect(p.explanation ?? '', p.question).toContain(String(lcm));
    }
  });
});
});