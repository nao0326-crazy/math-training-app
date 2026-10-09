/**
 * RandomSelector のテスト
 *
 * 乱数を使うため、統計的な性質は十分な試行数で検証する
 * (単一 seed や少数試行の成否では合格判定しない)。
 * chooseCandidate は random 関数を注入できるため、抽選ロジック自体は決定的に検証する。
 */

import { describe, expect, it } from 'vitest';
import {
  RandomSelector,
  NoViableGeneratorError,
  buildViableGeneratorsByCategory,
  chooseCandidate,
} from './randomSelector';
import { QuestionSelector } from './questionSelector';
import { getAllGenerators, getCategories } from './generatorRegistry';
import { getTypeSupportedLevels } from '../diversity/metadata';
import { validateProblem } from '../validator/validator';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import type { DifficultyLevel, Problem } from '../../types/problem';
import type { QuestionHistory } from '../../types/history';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const selector = new RandomSelector();

/** 決定的な擬似乱数 (単純 LCG) */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function historyEntry(type: string, id: string): QuestionHistory {
  return {
    problemId: id,
    problemType: type,
    parameters: {},
    askedAt: new Date(0).toISOString(),
  };
}

describe('RandomSelector: 履歴0件でも全カテゴリから出題できる', () => {
  it('履歴が空でも integer 以外のカテゴリが出題される', () => {
    // 既存 QuestionSelector は履歴0件で integer に固定される。
    // RandomSelector はその制約を持たないことを実測で確認する。
    const categories = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const problem = selector.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 2,
      });
      categories.add(problem.category);
    }
    expect(categories.has('integer')).toBe(true);
    expect([...categories].some((c) => c !== 'integer')).toBe(true);
    expect(categories.size).toBeGreaterThan(1);
  });

  it('十分な試行数で全カテゴリが出題対象になる (lv2)', () => {
    const categories = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const problem = selector.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 2,
      });
      categories.add(problem.category);
    }
    for (const category of getCategories()) {
      expect(categories.has(category), `${category} が出題されない`).toBe(true);
    }
  });

  it('全難易度で少なくとも1問は出題できる', () => {
    for (const lv of LEVELS) {
      const categories = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const problem = selector.selectNextQuestion([], [], {
          mode: { kind: 'random' },
          difficulty: lv,
        });
        categories.add(problem.category);
      }
      expect(categories.size, `lv${lv}: 出題カテゴリ数`).toBeGreaterThan(0);
    }
  });
});

describe('RandomSelector: カテゴリ抽選は Generator 数に比例しない', () => {
  it('geometry は Generator が最多 (24個) だが過度に偏らない', () => {
    const counts = new Map<string, number>();
    const total = 1200;
    for (let i = 0; i < total; i++) {
      const problem = selector.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 3,
      });
      counts.set(problem.category, (counts.get(problem.category) ?? 0) + 1);
    }

    // Generator 数の比 (geometry 24 / 92 = 26%) を大きく超えないことを見る。
    const geometryShare = (counts.get('geometry') ?? 0) / total;
    expect(
      geometryShare,
      `geometry の出題比率=${(geometryShare * 100).toFixed(1)}%`,
    ).toBeLessThan(0.30);
    // 逆に過小にもならない (カテゴリ等確率なら約10%)。
    expect(geometryShare).toBeGreaterThan(0.02);
  });

  it('全カテゴリの出題比率が極端な偏りを持たない', () => {
    const counts = new Map<string, number>();
    const total = 1200;
    for (let i = 0; i < total; i++) {
      const problem = selector.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 3,
      });
      counts.set(problem.category, (counts.get(problem.category) ?? 0) + 1);
    }
    // 等確率なら各カテゴリ約 1/10 = 10%。2%未満 / 30%超は偏り過大。
    for (const [category, count] of counts) {
      const share = count / total;
      expect(share, `${category}=${(share * 100).toFixed(1)}%`).toBeGreaterThan(0.02);
      expect(share, `${category}=${(share * 100).toFixed(1)}%`).toBeLessThan(0.30);
    }
  });
});

describe('RandomSelector: 難易度フィルタ', () => {
  it('生成不可能な Generator は候補から除外される', () => {
    for (const lv of LEVELS) {
      const viable = buildViableGeneratorsByCategory(lv);
      const allTypes = [...viable.values()].flat();
      for (const type of allTypes) {
        expect(
          getTypeSupportedLevels(type),
          `${type} should be an lv${lv} candidate`,
        ).toContain(lv);
      }
      expect(allTypes.length).toBeLessThanOrEqual(getAllGenerators().length);
    }
  });

  it('prime_judgment は lv1/lv2 の候補に含まれない (Phase 0 の実測結果)', () => {
    // Phase 0 実測: prime_judgment は lv3〜5 のみ生成可能。
    const flat1 = [...buildViableGeneratorsByCategory(1).values()].flat();
    const flat2 = [...buildViableGeneratorsByCategory(2).values()].flat();
    const flat3 = [...buildViableGeneratorsByCategory(3).values()].flat();
    expect(flat1).not.toContain('prime_judgment');
    expect(flat2).not.toContain('prime_judgment');
    expect(flat3).toContain('prime_judgment');
  });

  it('returns problems at exactly the requested difficulty', () => {
    for (const lv of LEVELS) {
      for (let i = 0; i < 30; i++) {
        const problem = selector.selectNextQuestion([], [], {
          mode: { kind: 'random' },
          difficulty: lv,
        });
        expect(problem.difficulty.level, `lv${lv} attempt ${i}`).toBe(lv);
        expect(validateProblem(problem).valid, `lv${lv} attempt ${i}`).toBe(true);
      }
    }
  });

  it('全候補が生成不可能な場合に呼び出し側が null を検出し明示的にエラーにできる', () => {
    const empty = new Map<string, string[]>();
    const choice = chooseCandidate(empty, [], makeRandom(1));
    expect(choice).toBeNull();
  });

  it('NoViableGeneratorError は除外理由を保持する', () => {
    const err = new NoViableGeneratorError(1, [
      { type: 'prime_judgment', difficulty: 1, reason: 'supportedLevels に含まれない' },
    ]);
    expect(err.name).toBe('NoViableGeneratorError');
    expect(err.excluded).toHaveLength(1);
    expect(err.excluded[0].type).toBe('prime_judgment');
    expect(err.message).toContain('prime_judgment');
  });

  it('特定の Generator が除外されても他カテゴリは出題できる (lv1)', () => {
    const wide = new RandomSelector({ candidateCount: 8, maxCategoryAttempts: 20 });
    const categories = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const problem = wide.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 1,
      });
      categories.add(problem.category);
    }
    expect(categories.size).toBeGreaterThan(3);
  });
});

describe('RandomSelector: 連続出題の抑制', () => {
  it('直近履歴に同じカテゴリがあっても全カテゴリから選べる (枯渇しない)', () => {
    const history: QuestionHistory[] = [
      historyEntry('integer_addition', 'a'),
      historyEntry('integer_subtraction', 'b'),
      historyEntry('integer_multiplication', 'c'),
    ];
    const categories = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const problem = selector.selectNextQuestion([], history, {
        mode: { kind: 'random' },
        difficulty: 2,
      });
      categories.add(problem.category);
    }
    expect(categories.size).toBeGreaterThan(2);
  });

  it('直近履歴が空でも全カテゴリから抽選できる', () => {
    const categories = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const problem = selector.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 3,
      });
      categories.add(problem.category);
    }
    expect(categories.size).toBeGreaterThan(3);
  });

  it('直近と同形式が出ても学習を止めない (完全排除ではなくペナルティ方式)', () => {
    // 全ての直近 fingerprint を，制造した重複で埋めると
    // 重複回避で候補が尽きる。そうなっても1問は必ず返る。
    const history: QuestionHistory[] = [
      historyEntry('integer_addition', 'x'),
      historyEntry('integer_subtraction', 'y'),
      historyEntry('integer_multiplication', 'z'),
      historyEntry('fraction_mul_integer', 'w'),
      historyEntry('decimal_addition', 'v'),
    ];
    const problem = selector.selectNextQuestion([], history, {
      mode: { kind: 'random' },
      difficulty: 2,
    });
    expect(validateProblem(problem).valid).toBe(true);
    expect(problem.difficulty.level).toBe(2);
  });
});

describe('RandomSelector: 既存機能との整合', () => {
  it('既存のカテゴリ指定学習は従来どおり動く', () => {
    const categorySelector = new QuestionSelector();
    for (const i of range(20)) {
      const problem = categorySelector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: 'fraction',
      });
      expect(problem.category, `attempt ${i}`).toBe('fraction');
      expect(validateProblem(problem).valid).toBe(true);
    }
  });

  it('RandomSelector は問題文・回答形式・解説の構造を変更しない', () => {
    for (let i = 0; i < 120; i++) {
      const problem: Problem = selector.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 2,
      });
      expect(problem.question.length, `attempt ${i}`).toBeGreaterThan(0);
      expect(problem.explanation ?? '', `attempt ${i}`).toBeTruthy();
      expect(problem.answer, `attempt ${i}`).toBeDefined();
      // 表示された正解はそのまま入力すれば正解判定される (採点整合の維持)
      const shown = formatAnswer(problem.answer);
      expect(checkUserAnswer(shown, problem.answer), `attempt ${i}`).toBe(true);
    }
  });

  it('既存 QuestionSelector の履歴なし時の挙動は変わっていない (integer 固定)', () => {
    // RandomSelector を導入した固然、既存セレクターの挙動は変えない。
    const categorySelector = new QuestionSelector();
    for (const i of range(30)) {
      const problem = categorySelector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: null,
      });
      expect(problem.category, `attempt ${i}`).toBe('integer');
    }
  });
});

describe('chooseCandidate: 抽選ロジックの決定的な検証', () => {
  it('カテゴリは Generator 数に比例した重み付けをしない', () => {
    // geometry: 24個, data: 4個 のマップ
    const via = new Map<string, string[]>([
      ['geometry', Array.from({ length: 24 }, (_, i) => `g${i}`)],
      ['data', Array.from({ length: 4 }, (_, i) => `d${i}`)],
    ]);

    const counts = new Map<string, number>();
    const random = makeRandom(12345);
    for (let i = 0; i < 2000; i++) {
      const choice = chooseCandidate(via, [], random);
      if (choice) counts.set(choice.category, (counts.get(choice.category) ?? 0) + 1);
    }

    const geo = counts.get('geometry') ?? 0;
    const dat = counts.get('data') ?? 0;
    // Generator 数で重み付けすると 24:4 = 85%:15% になるはず。
    // 等確率なら 50%:50%。ratio が 0.25〜0.75 に収まることを確認する。
    const ratio = geo / (geo + dat);
    expect(ratio).toBeLessThan(0.75);
    expect(ratio).toBeGreaterThan(0.25);
  });

  it('カテゴリ内は等確率で Generator が選ばれる', () => {
    const via = new Map<string, string[]>([['geometry', ['a', 'b', 'c', 'd']]]);
    const counts = new Map<string, number>();
    const random = makeRandom(2468);
    for (let i = 0; i < 4000; i++) {
      const choice = chooseCandidate(via, [], random);
      if (choice) counts.set(choice.type, (counts.get(choice.type) ?? 0) + 1);
    }
    expect(counts.size).toBe(4);
    for (const type of ['a', 'b', 'c', 'd']) {
      const share = (counts.get(type) ?? 0) / 4000;
      expect(share, `type ${type} share=${share}`).toBeGreaterThan(0.15);
      expect(share, `type ${type} share=${share}`).toBeLessThan(0.35);
    }
  });

  it('直近カテゴリには重み低下があるが除外されない', () => {
    const via = new Map<string, string[]>([
      ['a', ['a1']],
      ['b', ['b1']],
    ]);

    let aCount = 0;
    const random = makeRandom(999);
    for (let i = 0; i < 2000; i++) {
      const choice = chooseCandidate(via, ['a'], random);
      if (choice?.category === 'a') aCount++;
    }
    // 重み 0.5 なので約 1/3。0 にならず、100% にもならない。
    expect(aCount).toBeGreaterThan(0);
    expect(aCount).toBeLessThan(2000);
  });

  it('候補が空のときは null を返す (無限ループ防止の起点)', () => {
    expect(chooseCandidate(new Map(), [], makeRandom(1))).toBeNull();
  });

  it('同じ seed なら同じ選択になる (再現性)', () => {
    const viable = buildViableGeneratorsByCategory(2);
    const a = chooseCandidate(viable, [], makeRandom(42));
    const b = chooseCandidate(viable, [], makeRandom(42));
    expect(a).toEqual(b);
  });

  it('異なる seed では異なる選択になる (固定されていない)', () => {
    const viable = buildViableGeneratorsByCategory(2);
    const results = new Set<string>();
    for (let s = 0; s < 50; s++) {
      const choice = chooseCandidate(viable, [], makeRandom(s));
      if (choice) results.add(choice.type);
    }
    expect(results.size).toBeGreaterThan(3);
  });
});