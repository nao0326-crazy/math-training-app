/**
 * variety-phase2d.test.ts — duplicate_removal / multiples_finding / speed_unit_conversion (Phase 2-D)
 *
 * 目的:
 *   - 追加した構造 (variant / 重複構成 / 変換方向) がすべて生成されること
 *   - 答えが「生成器の内部計算」ではなく、数学的に独立した式で正しいこと
 *   - 生成の再現性 (同じシード → 同じ問題) を保つ
 *
 * 独立検証の考え方:
 *   - duplicate_removal : 並びを全列挙して「異なる並びの個数」を数える
 *                         (生成器の countDistinctArrangements と同じ方法が
 *                          使われていないよう、DFS の写法を変えて数える)
 *   - multiples_finding : 「倍数は n の正の整数倍」という定義から数え直す
 *   - speed_unit_conversion : 1時間=60分=3600秒、1km=1000m だけを○
 */

import { describe, expect, it } from 'vitest';
import {
  DuplicateRemovalGenerator,
  type DuplicateRemovalSymbolMode,
} from './generators';
import { MultiplesFindingGenerator, type MultiplesFindingVariant } from '../numberTheory/generators';
import { SpeedUnitConversionGenerator, type SpeedUnitConversionVariant } from '../speed/generators';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import { attachSolutionSteps } from '../../engine/solution/solutionGenerator';
import type { DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const dup = new DuplicateRemovalGenerator();
const mul = new MultiplesFindingGenerator();
const spd = new SpeedUnitConversionGenerator();

function conditionKey(p: Problem): string {
  return Object.keys(p.parameters)
    .filter((k) => k !== 'difficultyLevel' && k !== 'answer')
    .sort()
    .map((k) => k + '=' + JSON.stringify((p.parameters as any)[k]))
    .join(',');
}

function answerOf(p: Problem): string {
  return formatAnswer(p.answer);
}

/** 十分な数の問題を生成する (lv1-5 x シード) */
function generateMany(gen: { generate: (c?: any) => Problem }, perLevel: number): Problem[] {
  const all: Problem[] = [];
  for (const lv of LEVELS) {
    for (let s = 0; s < perLevel; s++) {
      all.push(gen.generate({ difficulty: lv, seed: s * 1000003 + lv * 97 }));
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// 独立した検算ロジック (ジェネレータ本体とは別の実装)
// ---------------------------------------------------------------------------

/**
 * 重複ありカードから異なる並びの個数を数える。
 * 生成器は「permute して Set に全部入れる」方式なので、
 * ここでは「先頭から1文字ずつ選ぶ再帰 + 正準形の重複除去」で数え直す。
 */
function countDistinctByCanonical(cards: string[]): number {
  const canonical = new Set<string>();
  const recurse = (prefix: string[], rest: string[]) => {
    if (rest.length === 0) {
      canonical.add(prefix.join(''));
      return;
    }
    const next = new Set<string>();
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if (next.has(ch)) continue; // 同じ文字を2回使わない
      next.add(ch);
      recurse([...prefix, ch], [...rest.slice(0, i), ...rest.slice(i + 1)]);
    }
  };
  recurse([], cards);
  return canonical.size;
}

/** n の倍数 (n×1, n×2, …) を hi 以下で列挙する */
function multiplesUpTo(n: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = 1; n * m <= hi; m++) out.push(n * m);
  return out;
}

/** 速度変換の期待値 (単位の関係だけを使う) */
function expectedSpeed(variant: SpeedUnitConversionVariant, v: number): number {
  const SECONDS_PER_HOUR = 3600;
  const MINUTES_PER_HOUR = 60;
  const METERS_PER_KM = 1000;
  switch (variant) {
    case 'kmh_to_mmin':
      return (v * METERS_PER_KM) / MINUTES_PER_HOUR;
    case 'mmin_to_kmh':
      return (v * MINUTES_PER_HOUR) / METERS_PER_KM;
    case 'kmh_to_ms':
      return (v * METERS_PER_KM) / SECONDS_PER_HOUR;
    case 'ms_to_kmh':
      return (v * SECONDS_PER_HOUR) / METERS_PER_KM;
  }
}

/** 文字化け・不要な英単語の検出 */
const MOJIBAKE = /[\uFFFD\uFFFE]|锟斤拷/;
// 日本語の本文に現れない語だけを対象にする (「会」「的」は正規の漢字なので含めない)
const SUSPECT = [
  '而且',
  '座位',
  'Distinct',
  'Moreover',
  'TODO',
  'FIXME',
  'undefined',
  'NaN',
];
function findSuspicious(text: string): string[] {
  const found: string[] = [];
  if (MOJIBAKE.test(text)) found.push('文字化け');
  for (const w of SUSPECT) if (text.includes(w)) found.push(w);
  return found;
}
// ---------------------------------------------------------------------------
// duplicate_removal
// ---------------------------------------------------------------------------

describe('duplicate_removal: 重複構成の多様性と正しさ', () => {
  it('答えは独立した全列挙 (正準形) と一致する', () => {
    const bad: string[] = [];
    for (const p of generateMany(dup, 120)) {
      const { letters, answer } = p.parameters as { letters: string[]; answer: number };
      const expected = countDistinctByCanonical(letters);
      if (answer !== expected) bad.push(`${letters.join('')}: ${answer} != ${expected}`);
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で全列挙と不一致`).toBe('');
  });

  it('検算ロジック自体の健全性 (既知の値で確認する)', () => {
    // A,A,B -> 3!/2! = 3
    expect(countDistinctByCanonical(['A', 'A', 'B'])).toBe(3);
    // A,A,B,B -> 4!/(2!2!) = 6
    expect(countDistinctByCanonical(['A', 'A', 'B', 'B'])).toBe(6);
    // A,A,B,B,C -> 5!/(2!2!) = 30
    expect(countDistinctByCanonical(['A', 'A', 'B', 'B', 'C'])).toBe(30);
    // すべて同じ (A,A,A) -> 1
    expect(countDistinctByCanonical(['A', 'A', 'A'])).toBe(1);
  });

  it('validate が全生成問題で通る', () => {
    const bad: string[] = [];
    for (const p of generateMany(dup, 120)) {
      const r = dup.validate(p);
      if (!r.valid) bad.push(`${conditionKey(p)}: ${r.errors.join(', ')}`);
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で validate が失敗`).toBe('');
  });

  it('必ず重複が含まれる (同じ記号が2枚以上ある)', () => {
    const bad: string[] = [];
    for (const p of generateMany(dup, 120)) {
      const { letters } = p.parameters as { letters: string[] };
      const counts = new Map<string, number>();
      for (const c of letters) counts.set(c, (counts.get(c) ?? 0) + 1);
      if (![...counts.values()].some((k) => k >= 2)) bad.push(letters.join(''));
      if (letters.length < 3) bad.push('枚数不足: ' + letters.join(''));
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で重複が無い`).toBe('');
  });

  it('記号の種類数と枚数配分が変化している (水増しでないこと)', () => {
    const structures = new Set<string>();
    const symbolModes = new Set<string>();
    for (const p of generateMany(dup, 200)) {
      const { letters, symbolMode } = p.parameters as {
        letters: string[];
        symbolMode: DuplicateRemovalSymbolMode;
      };
      // 記号ごとの枚数の多重集合で構造を識別する
      const counts = [
        ...letters.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map<string, number>()).values(),
      ]
        .sort((a, b) => a - b)
        .join(',');
      structures.add(counts);
      symbolModes.add(symbolMode);
    }
    expect(structures.size, '重複構成の種類が少なすぎる').toBeGreaterThan(8);
    expect(symbolModes.size, '記号の種類 (文字/数字) が両方出ていない').toBe(2);
  });

  it('同じシードなら同じ問題になり、異なるシードで構造が変わる', () => {
    for (const lv of LEVELS) {
      const a = dup.generate({ difficulty: lv, seed: 42 });
      const b = dup.generate({ difficulty: lv, seed: 42 });
      expect(a.question).toBe(b.question);
      expect(answerOf(a)).toBe(answerOf(b));
    }
    const qs = new Set<string>();
    for (let s = 0; s < 200; s++) qs.add(dup.generate({ difficulty: 4, seed: s * 31337 + 4 }).question);
    expect(qs.size).toBeGreaterThan(10);
  });
// ---------------------------------------------------------------------------
// multiples_finding
// ---------------------------------------------------------------------------

describe('multiples_finding: 構造の多様性と正しさ', () => {
  it('答えは倍数の定義から数え直した値と一致する', () => {
    const bad: string[] = [];
    for (const p of generateMany(mul, 120)) {
      const { n, variant, arg1, arg2, answer } = p.parameters as {
        n: number;
        variant: MultiplesFindingVariant;
        arg1: number;
        arg2: number | null;
        answer: string;
      };
      let expected: string;
      switch (variant) {
        case 'list_first_n':
          expected = multiplesUpTo(n, n * arg1).join(', ');
          break;
        case 'list_up_to':
          expected = multiplesUpTo(n, arg1).join(', ');
          break;
        case 'list_between': {
          const hi = arg2 as number;
          expected = multiplesUpTo(n, hi)
            .filter((k) => k >= arg1)
            .join(', ');
          break;
        }
        case 'nth_multiple':
          expected = String(n * arg1);
          break;
        case 'count_in_range':
          expected = String(multiplesUpTo(n, arg1).length);
          break;
        default:
          bad.push('未知の variant: ' + variant);
          continue;
      }
      if (answer !== expected) {
        bad.push(`${variant} n=${n} ${arg1}/${arg2}: ${answer} != ${expected}`);
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で検算と不一致`).toBe('');
  });

  it('検算ロジック自体の健全性 (既知の値で確認する)', () => {
    expect(multiplesUpTo(3, 12).join(', ')).toBe('3, 6, 9, 12');
    expect(multiplesUpTo(4, 10).join(', ')).toBe('4, 8');
    expect(multiplesUpTo(5, 5).length).toBe(1);
  });

  it('5 つの構造すべてが実際に生成される', () => {
    const variants = new Set<string>();
    for (const p of generateMany(mul, 200)) {
      variants.add((p.parameters as { variant: string }).variant);
    }
    expect([...variants].sort()).toEqual([
      'count_in_range',
      'list_between',
      'list_first_n',
      'list_up_to',
      'nth_multiple',
    ]);
  });

  it('lv1 では区間・数え上げの構造を使わない', () => {
    const variants = new Set<string>();
    for (let s = 0; s < 200; s++) {
      variants.add(
        (mul.generate({ difficulty: 1, seed: s * 31337 + 1 }).parameters as { variant: string }).variant,
      );
    }
    expect(variants.has('count_in_range')).toBe(false);
    expect(variants.has('list_between')).toBe(false);
  });

  it('validate が全生成問題で通り、答えが空にならない', () => {
    const bad: string[] = [];
    for (const p of generateMany(mul, 120)) {
      const r = mul.validate(p);
      if (!r.valid) bad.push(`${conditionKey(p)}: ${r.errors.join(', ')}`);
      const a = (p.parameters as { answer: string }).answer;
      if (a === '') bad.push('答えが空: ' + p.question);
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で問題あり`).toBe('');
  });

  it('正解は解答判定で正答になり、途中式が解を含む', () => {
    const bad: string[] = [];
    for (const p of generateMany(mul, 80)) {
      const shown = formatAnswer(p.answer);
      if (!checkUserAnswer(shown, p.answer)) bad.push('judge: ' + p.question);
      const steps = attachSolutionSteps(p).solutionSteps ?? [];
      const last = steps[steps.length - 1]?.expression ?? '';
      if (steps.length === 0) bad.push('steps empty: ' + p.question);
      else if (p.answer.kind === 'integer' && !last.includes(shown)) {
        bad.push(`last="${last}" に正解 ${shown} なし`);
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で判定・途中式に問題`).toBe('');
  });

  it('同じシードなら再現し、構造が変化する', () => {
    for (const lv of LEVELS) {
      const a = mul.generate({ difficulty: lv, seed: 7 });
      const b = mul.generate({ difficulty: lv, seed: 7 });
      expect(a.question).toBe(b.question);
    }
    const keys = new Set<string>();
    for (let s = 0; s < 200; s++) {
      keys.add(conditionKey(mul.generate({ difficulty: 4, seed: s * 31337 + 4 })));
    }
    expect(keys.size).toBeGreaterThan(20);
  });
});
// ---------------------------------------------------------------------------
// speed_unit_conversion
// ---------------------------------------------------------------------------

describe('speed_unit_conversion: 変換方向の多様性と正しさ', () => {
  it('答えは単位の関係から求めた値と一致する', () => {
    const bad: string[] = [];
    for (const p of generateMany(spd, 120)) {
      const { givenValue, variant, answer } = p.parameters as {
        givenValue: number;
        variant: SpeedUnitConversionVariant;
        answer: number;
      };
      const expected = expectedSpeed(variant, givenValue);
      if (Math.abs(expected - answer) > 1e-9) {
        bad.push(`${variant} ${givenValue}: ${answer} != ${expected}`);
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で検算と不一致`).toBe('');
  });

  it('検算ロジック自体の健全性 (既知の値で確認する)', () => {
    expect(expectedSpeed('kmh_to_mmin', 60)).toBe(1000);
    expect(expectedSpeed('mmin_to_kmh', 1000)).toBe(60);
    expect(expectedSpeed('kmh_to_ms', 18)).toBe(5);
    expect(expectedSpeed('ms_to_kmh', 5)).toBe(18);
  });

  it('答えは必ず有限小数 (整数か小数第2位までで終わる)', () => {
    const bad: string[] = [];
    for (const p of generateMany(spd, 200)) {
      const a = (p.parameters as { answer: number }).answer;
      const rounded = Math.round(a * 100) / 100;
      if (Math.abs(rounded - a) > 1e-9) bad.push(`${p.question} -> ${a}`);
      if (p.answer.kind !== 'decimal') bad.push('kind != decimal: ' + p.question);
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で有限小数でない`).toBe('');
  });

  it('4 つの変換方向すべてが lv4 以上で生成される', () => {
    const variants = new Set<string>();
    for (const lv of [4, 5] as DifficultyLevel[]) {
      for (let s = 0; s < 200; s++) {
        variants.add(
          (spd.generate({ difficulty: lv, seed: s * 31337 + lv }).parameters as { variant: string })
            .variant,
        );
      }
    }
    expect([...variants].sort()).toEqual(['kmh_to_mmin', 'kmh_to_ms', 'mmin_to_kmh', 'ms_to_kmh']);
  });

  it('lv1 は時速→分速のみ (基本的方向)', () => {
    const variants = new Set<string>();
    for (let s = 0; s < 100; s++) {
      variants.add(
        (spd.generate({ difficulty: 1, seed: s * 31337 + 1 }).parameters as { variant: string }).variant,
      );
    }
    expect([...variants]).toEqual(['kmh_to_mmin']);
  });

  it('validate が全生成問題で通り、判定・解説が整合する', () => {
    const bad: string[] = [];
    for (const p of generateMany(spd, 120)) {
      const r = spd.validate(p);
      if (!r.valid) bad.push('validate: ' + r.errors.join(', '));
      const shown = formatAnswer(p.answer);
      if (!checkUserAnswer(shown, p.answer)) bad.push('judge: ' + p.question);
      if (!(p.explanation ?? '').includes(shown)) bad.push('explanation: ' + p.question);
      const steps = attachSolutionSteps(p).solutionSteps ?? [];
      if (steps.length === 0) bad.push('steps empty: ' + p.question);
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 件で問題あり`).toBe('');
  });

  it('lv3 以上で指定した難易度が守られる (lv1・lv2 は既存のベースライン値)', () => {
    // 品質ゲートは speed_unit_conversion:1 / :2 を
    // 「要求した難易度と異なる pair」としてベースライン記録済み。
    // Phase 1 の難易度モデルに手を入れない方針なので、
    // ここでは lv3-5 についてだけ「要求どおり」を保証する。
    for (const lv of [3, 4, 5] as DifficultyLevel[]) {
      for (let s = 0; s < 30; s++) {
        const seed = s * 15485863 + lv;
        const p = spd.generate({ difficulty: lv, seed });
        expect(p.difficulty.level, `lv${lv} seed${seed}`).toBe(lv);
      }
    }
  });

  it('同じシードなら常に同じ問題になる', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 30; s++) {
        const seed = s * 15485863 + lv;
        const a = spd.generate({ difficulty: lv, seed });
        const b = spd.generate({ difficulty: lv, seed });
        expect(a.question, `lv${lv} seed${seed}`).toBe(b.question);
        expect(answerOf(a)).toBe(answerOf(b));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 共通チェック
// ---------------------------------------------------------------------------

describe('Phase 2-D 共通チェック', () => {
  it('問題文・解説・途中式に文字化けや不要な英単語が混ざらない', () => {
    const bad: string[] = [];
    for (const gen of [dup, mul, spd]) {
      for (const p of generateMany(gen, 80)) {
        const steps = attachSolutionSteps(p).solutionSteps ?? [];
        const texts = [
          p.question,
          p.explanation ?? '',
          ...steps.flatMap((s) => [s.expression ?? '', s.explanation ?? '']),
        ];
        for (const t of texts) {
          const found = findSuspicious(t);
          if (found.length > 0) bad.push(`${p.type}: ${found.join('/')} in ${t}`);
        }
      }
    }
    expect(bad.slice(0, 8).join('\n'), `${bad.length} 箇所で不正な文字列`).toBe('');
  });

  it('同じ条件なら問題文は常に同一 (表現のゆらぎなし)', () => {
    for (const gen of [dup, mul, spd]) {
      const byCondition = new Map<string, Set<string>>();
      for (const p of generateMany(gen, 150)) {
        const key = conditionKey(p);
        if (!byCondition.has(key)) byCondition.set(key, new Set());
        byCondition.get(key)!.add(p.question);
      }
      for (const [key, qs] of byCondition) {
        expect(qs.size, `${gen.constructor.name} 条件 ${key} で問題文が揺れています`).toBe(1);
      }
    }
  });
});
});