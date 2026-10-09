import { describe, expect, it } from 'vitest'
import { findWeakTargets } from './weakTargets'
import {
  WeakSelector,
  NoWeakTargetError,
  filterGeneratableTargets,
} from './weakSelector'
import {
  MIN_ATTEMPTS_FOR_WEAKNESS,
  WEAKNESS_ACCURACY_THRESHOLD,
  findWeakAreas,
} from '../../utils/weakAreas'
import { getTypeSupportedLevels } from '../diversity/metadata'
import { validateProblem } from '../validator/validator'
import { formatAnswer, checkUserAnswer } from '../../utils/answer'
import type { AnswerRecord } from '../../types/history'
import type { DifficultyLevel } from '../../types/problem'
import { RandomSelector } from './randomSelector'
import { QuestionSelector } from './questionSelector'

let seq = 0;

function rec(options: {
  problemType: string;
  difficultyLevel: number;
  isCorrect: boolean;
  atMs?: number;
}): AnswerRecord {
  seq += 1;
  const base = new Date('2026-01-01T00:00:00Z').getTime();
  return {
    problemId: `p-${seq}`,
    problemType: options.problemType,
    category: 'fraction',
    isCorrect: options.isCorrect,
    answerTimeSec: 20,
    answeredAt: new Date(base + (options.atMs ?? seq * 1000)).toISOString(),
    difficultyLevel: options.difficultyLevel,
    question: `q${seq}`,
    userAnswer: '1',
    correctAnswer: '2',
  };
}

/** total問中 correct問正解の履歴 */
function group(
  problemType: string,
  difficultyLevel: number,
  total: number,
  correct: number,
  startMs = 100000,
): AnswerRecord[] {
  return Array.from({ length: total }, (_, i) =>
    rec({
      problemType,
      difficultyLevel,
      isCorrect: i < correct,
      atMs: startMs + i * 1000,
    }),
  );
}

describe('A. 苦手対象の抽出 (problemType x difficulty)', () => {
  it('履歴から problemType x difficulty の組を抽出する', () => {
    const history = [
      ...group('fraction_div_fraction', 3, 10, 4),
      ...group('fraction_div_integer', 2, 10, 5),
      ...group('rectangle_area', 3, 10, 3),
    ];
    const targets = findWeakTargets(history);
    expect(targets).toHaveLength(3);
    const pairs = targets.map((t) => `${t.problemType}@${t.difficulty}`).sort();
    expect(pairs).toEqual(
      ['fraction_div_fraction@3', 'fraction_div_integer@2', 'rectangle_area@3'].sort(),
    );
  });

  it('同じ problemType でも difficulty が違えば別の対象になる', () => {
    const history = [
      ...group('fraction_div_fraction', 2, 10, 4), // 40% -> 苦手
      ...group('fraction_div_fraction', 4, 10, 9), // 90% -> 苦手でない
    ];
    const targets = findWeakTargets(history);
    expect(targets).toHaveLength(1);
    expect(targets[0].difficulty).toBe(2);
  });

  it('既存ルールと同じ閾値を使う (回答数5未満・正答率70%以上は対象外)', () => {
    expect(findWeakTargets(group('fraction_mul_integer', 2, 4, 0))).toHaveLength(0);
    expect(findWeakTargets(group('fraction_mul_integer', 2, 10, 7))).toHaveLength(0);
    expect(WEAKNESS_ACCURACY_THRESHOLD).toBe(0.7);
    expect(MIN_ATTEMPTS_FOR_WEAKNESS).toBe(5);
  });

  it('正答率の低い順に並ぶ', () => {
    const history = [
      ...group('a_type', 2, 10, 7, 100000), // 70% -> 対象外
      ...group('b_type', 2, 10, 5, 200000), // 50%
      ...group('c_type', 2, 10, 2, 300000), // 20%
    ];
    const targets = findWeakTargets(history);
    expect(targets.map((t) => t.problemType)).toEqual(['c_type', 'b_type']);
  });

  it('正答率が同じなら直近に間違えている方が先', () => {
    const history = [
      ...group('older_wrong', 2, 10, 5, 100000),
      ...group('recent_wrong', 2, 10, 5, 900000),
    ];
    const targets = findWeakTargets(history);
    expect(targets[0].problemType).toBe('recent_wrong');
  });
});

describe('B. 苦手でない問題が対象にならない', () => {
  it('十分な正答率の型は復習対象から外れる', () => {
    const history = [
      ...group('good_type', 2, 20, 18), // 90%
      ...group('bad_type', 2, 20, 6), // 30%
    ];
    const targets = findWeakTargets(history);
    expect(targets.map((t) => t.problemType)).toEqual(['bad_type']);
  });

  it('正答が増えると苦手対象から外れる', () => {
    const weak = group('integer_addition', 2, 6, 1);
    expect(findWeakTargets(weak)).toHaveLength(1);
    const improved = [...weak, ...group('integer_addition', 2, 20, 20)];
    expect(findWeakTargets(improved)).toHaveLength(0);
  });

  it('1問間違えただけでは対象にならない (回答数不足)', () => {
    const history = [rec({ problemType: 'integer_subtraction', difficultyLevel: 2, isCorrect: false })];
    expect(findWeakTargets(history)).toHaveLength(0);
  });
});

describe('C. 履歴にない型・難易度が勝手に対象にならない', () => {
  it('履歴に存在しない problemType は候補にならない', () => {
    const targets = findWeakTargets(group('fraction_div_fraction', 2, 10, 3));
    expect(targets).toHaveLength(1);
    expect(targets[0].problemType).toBe('fraction_div_fraction');
    expect(targets.some((t) => t.problemType === 'prime_judgment')).toBe(false);
    expect(targets.some((t) => t.problemType === 'rectangle_area')).toBe(false);
  });

  it('履歴に存在しない難易度 (同じ型の別lv) は追加されない', () => {
    const targets = findWeakTargets(group('fraction_div_fraction', 3, 10, 3));
    expect(targets).toHaveLength(1);
    expect(targets[0].difficulty).toBe(3);
  });

  it('lv1 で生成不可能な型は supportedLevels で除外される', () => {
    // prime_judgment は Phase 0 実測で lv3-5 のみ。
    const history = group('prime_judgment', 1, 10, 2);
    const { viable, excluded } = filterGeneratableTargets(findWeakTargets(history), history);
    expect(viable.some((t) => t.problemType === 'prime_judgment')).toBe(false);
    expect(
      excluded.some((e) => e.problemType === 'prime_judgment' && e.difficulty === 1),
    ).toBe(true);
  });

  it('履歴にない型・lvは推測で追加されない (実測可能なlvのみ)', () => {
    // 履歴に prime_judgment lv5 があれば実測可能なので生成できる。
    const ok = group('prime_judgment', 5, 10, 2);
    const r1 = filterGeneratableTargets(findWeakTargets(ok), ok);
    expect(r1.viable.some((t) => t.problemType === 'prime_judgment')).toBe(true);

    // 同じ型の lv1 は除外される。
    const ng = group('prime_judgment', 1, 10, 2);
    const r2 = filterGeneratableTargets(findWeakTargets(ng), ng);
    expect(r2.viable.some((t) => t.problemType === 'prime_judgment')).toBe(false);
  });
});

describe('D. supportedLevels との整合性', () => {
  it('復習対象のすべてが getTypeSupportedLevels で生成可能である', () => {
    // 実測で生成可能な型 x 履歴の難易度を組み合わせて対象を作る
    const history = [
      ...group('fraction_div_fraction', 2, 10, 3),
      ...group('rectangle_area', 3, 10, 2),
      ...group('integer_addition', 1, 10, 1),
      ...group('prime_judgment', 5, 10, 2),
      ...group('speed_multi_step', 3, 10, 4),
    ];
    const { viable } = filterGeneratableTargets(findWeakTargets(history), history);
    expect(viable.length).toBeGreaterThan(0);
    for (const t of viable) {
      expect(getTypeSupportedLevels(t.problemType)).toContain(t.difficulty);
    }
  });

  it('履歴の難易度そのままを使う (problemType から推測しない)', () => {
    // prime_judgment は lv3-5。lv3 の履歴なら lv3 で出題される。
    const history = group('prime_judgment', 3, 10, 2);
    const { viable } = filterGeneratableTargets(findWeakTargets(history), history);
    expect(viable).toHaveLength(1);
    expect(viable[0].difficulty).toBe(3);
  });

  it('大量リトライなしで除外できる (除外時に理由が明示される)', () => {
    const history = group('prime_judgment', 2, 10, 1); // lv2 は非対応
    const { viable, excluded } = filterGeneratableTargets(findWeakTargets(history), history);
    expect(viable).toHaveLength(0);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].reason).toBeTruthy();
  });
});

describe('E. 実際の問題生成', () => {
  it('生成された問題の type / difficulty / validator が期待値と一致する', () => {
    const history = [
      ...group('fraction_div_fraction', 2, 10, 3),
      ...group('rectangle_area', 3, 10, 2),
    ];
    const selector = new WeakSelector();
    const targets = findWeakTargets(history);
    expect(targets).toHaveLength(2);

    for (let i = 0; i < 20; i++) {
      const problem = selector.selectNextQuestion(history, [], {
        mode: { kind: 'weak', types: [] },
        difficulty: 2,
      });
      // 復習対象のいずれかであること
      expect(
        targets.some((t) => t.problemType === problem.type),
        `attempt ${i}: ${problem.type} is not a weak target`,
      ).toBe(true);
      // 履歴に記録された難易度であること
      const target = targets.find((t) => t.problemType === problem.type);
      expect(problem.difficulty.level, `attempt ${i}`).toBe(target?.difficulty);
      expect(validateProblem(problem).valid, `attempt ${i}`).toBe(true);
      // 正解が入力されて採点を通ること (構造を壊していない)
      expect(checkUserAnswer(formatAnswer(problem.answer), problem.answer)).toBe(true);
    }
  });

  it('解説と問題文が非空である', () => {
    const history = group('fraction_div_integer', 2, 10, 2);
    const selector = new WeakSelector();
    for (let i = 0; i < 10; i++) {
      const problem = selector.selectNextQuestion(history, [], {
        mode: { kind: 'weak', types: [] },
        difficulty: 2,
      });
      expect(problem.question.length).toBeGreaterThan(0);
      expect(problem.explanation ?? '').toBeTruthy();
    }
  });

  it('types を指定するとその型に限定される', () => {
    const history = [
      ...group('fraction_div_fraction', 2, 10, 2),
      ...group('rectangle_area', 3, 10, 2),
    ];
    const selector = new WeakSelector();
    for (let i = 0; i < 15; i++) {
      const problem = selector.selectNextQuestion(history, [], {
        mode: { kind: 'weak', types: ['rectangle_area'] },
        difficulty: 2,
      });
      expect(problem.type).toBe('rectangle_area');
      expect(problem.difficulty.level).toBe(3);
    }
  });
});

describe('F. 候補が複数ある場合', () => {
  it('特定の1型だけに永久固定されない', () => {
    const history = [
      ...group('fraction_div_fraction', 2, 10, 1),
      ...group('rectangle_area', 3, 10, 1),
      ...group('integer_addition', 1, 10, 1),
    ];
    const selector = new WeakSelector();
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const problem = selector.selectNextQuestion(history, [], {
        mode: { kind: 'weak', types: [] },
        difficulty: 2,
      });
      seen.add(problem.type);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('listTargets で復習対象の一覧を確認できる', () => {
    const history = group('fraction_div_fraction', 2, 10, 2);
    const selector = new WeakSelector();
    expect(selector.listTargets(history)).toHaveLength(1);
    expect(selector.listTargets([])).toHaveLength(0);
  });
});

describe('G. 苦手が0件の場合', () => {
  it('履歴が空なら NoWeakTargetError を投げる (クラッシュしない)', () => {
    const selector = new WeakSelector();
    expect(() =>
      selector.selectNextQuestion([], [], {
        mode: { kind: 'weak', types: [] },
        difficulty: 2,
      }),
    ).toThrow(NoWeakTargetError);
  });

  it('全問正解の履歴なら対象0件として扱われる', () => {
    const history = group('fraction_div_fraction', 2, 20, 20);
    const selector = new WeakSelector();
    expect(selector.listTargets(history)).toHaveLength(0);
    expect(() =>
      selector.selectNextQuestion(history, [], {
        mode: { kind: 'weak', types: [] },
        difficulty: 2,
      }),
    ).toThrow(NoWeakTargetError);
  });

  it('復習対象は存在するが全て生成不可能でも NoWeakTargetError になる', () => {
    // prime_judgment は lv2 で生成できない (supportedLevels: [3,4,5])
    const history = group('prime_judgment', 2, 10, 1);
    const selector = new WeakSelector();
    expect(() =>
      selector.selectNextQuestion(history, [], {
        mode: { kind: 'weak', types: [] },
        difficulty: 2,
      }),
    ).toThrow(NoWeakTargetError);
  });

  it('NoWeakTargetError は除外理由を保持する', () => {
    const history = group('prime_judgment', 2, 10, 1);
    const selector = new WeakSelector();
    try {
      selector.selectNextQuestion(history, [], {
        mode: { kind: 'weak', types: [] },
        difficulty: 2,
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(NoWeakTargetError);
      const err = e as NoWeakTargetError;
      expect(err.name).toBe('NoWeakTargetError');
      expect(err.excluded.length).toBeGreaterThan(0);
      expect(err.excluded[0].problemType).toBe('prime_judgment');
      expect(err.message).toContain('prime_judgment');
    }
  });
});
describe('H. 既存機能との回帰', () => {
  it('RandomSelector の挙動が変わっていない (履歴0件で全カテゴリから出題できる)', () => {
    const selector = new RandomSelector();
    const categories = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const problem = selector.selectNextQuestion([], [], {
        mode: { kind: 'random' },
        difficulty: 2,
      });
      categories.add(problem.category);
    }
    expect(categories.size).toBeGreaterThan(1);
  });

  it('RandomSelector が指定難易度どおりの問題を返す', () => {
    const selector = new RandomSelector();
    for (const lv of [1, 2, 3, 4, 5] as DifficultyLevel[]) {
      for (let i = 0; i < 10; i++) {
        const problem = selector.selectNextQuestion([], [], {
          mode: { kind: 'random' },
          difficulty: lv,
        });
        expect(problem.difficulty.level, `lv${lv} attempt ${i}`).toBe(lv);
      }
    }
  });

  it('カテゴリ指定学習は従来どおり動く', () => {
    const selector = new QuestionSelector();
    for (let i = 0; i < 20; i++) {
      const problem = selector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: 'fraction',
      });
      expect(problem.category, `attempt ${i}`).toBe('fraction');
      expect(validateProblem(problem).valid).toBe(true);
    }
  });

  it('既存の findWeakAreas (category 粒度) の判定は変わらない', () => {
    // WeakSelector は findWeakAreas を書き換えていない。
    // 同じデータで両者を並べる。
    const history = [
      ...group('fraction_div_fraction', 2, 10, 4), // 40%
      ...group('rectangle_area', 3, 10, 9), // 90%
    ];
    // 既存: category 単位 (record.category は fixture で fraction に固定)
    const weakCategories = findWeakAreas(history);
    expect(weakCategories).toHaveLength(1);
    expect(weakCategories[0].category).toBe('fraction');

    // 新規: problemType x difficulty 単位
    const weakTargets = findWeakTargets(history);
    expect(weakTargets).toHaveLength(1);
    expect(weakTargets[0].problemType).toBe('fraction_div_fraction');
  });
});

