import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionSelector } from './questionSelector';
import { validateProblem } from '../validator/validator';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import * as generatorRegistry from './generatorRegistry';
import { getCategories } from './generatorRegistry';
import { fingerprintProblem } from '../diversity/metadata';

function createAnswer(
  category: string,
  isCorrect: boolean,
  answerTimeSec = 5,
): AnswerRecord {
  return {
    problemId: `${category}-${isCorrect}-${answerTimeSec}`,
    problemType: 'integer_addition',
    category,
    isCorrect,
    answerTimeSec,
    answeredAt: new Date().toISOString(),
    difficultyLevel: 2,
    question: '2 + 3 = □',
    userAnswer: isCorrect ? '5' : '4',
    correctAnswer: '5',
  };
}

describe('QuestionSelector', () => {
  const selector = new QuestionSelector();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('問題を生成できる', () => {
    const problem = selector.selectNextQuestion([], [], {
      difficultyLevel: 2,
      category: null,
    });
    expect(problem).toBeDefined();
    expect(problem.question.length).toBeGreaterThan(0);
    const result = validateProblem(problem);
    expect(result.valid, result.errors.join(', ')).toBe(true);
  });

  it('保存範囲内のカテゴリだけを候補にする', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const problem = selector.selectNextQuestion(
      Array.from({ length: 10 }, () => createAnswer('geometry', false, 60)),
      [],
      {
        difficultyLevel: 2,
        category: null,
        problemTypes: ['integer_addition', 'fraction_add_sub'],
      },
    );

    expect(['integer_addition', 'fraction_add_sub']).toContain(problem.type);
    expect(['integer', 'fraction']).toContain(problem.category);
    expect(getCategories()).toContain(problem.category);
  });

  it('正答率の低い範囲内カテゴリを優先する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const history = [
      ...Array.from({ length: 10 }, () => createAnswer('integer', false)),
      ...Array.from({ length: 10 }, () => createAnswer('fraction', true)),
    ];

    const problem = selector.selectNextQuestion(history, [], {
      difficultyLevel: 2,
      category: null,
      problemTypes: ['integer_addition', 'fraction_add_sub'],
    });

    expect(problem.category).toBe('integer');
  });

  it('平均回答時間の長い範囲内カテゴリを優先する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const history = [
      ...Array.from({ length: 10 }, () => createAnswer('integer', true, 5)),
      ...Array.from({ length: 10 }, () => createAnswer('fraction', true, 300)),
    ];

    const problem = selector.selectNextQuestion(history, [], {
      difficultyLevel: 2,
      category: null,
      problemTypes: ['integer_addition', 'fraction_add_sub'],
    });

    expect(problem.category).toBe('fraction');
  });

  it('履歴のない範囲内カテゴリにも中立の優先度を与える', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    const history = Array.from({ length: 10 }, () => createAnswer('integer', true, 5));

    const problem = selector.selectNextQuestion(history, [], {
      difficultyLevel: 2,
      category: null,
      problemTypes: ['integer_addition', 'fraction_add_sub'],
    });

    expect(problem.category).toBe('fraction');
  });

  it('適応難易度に対応するタイプがないカテゴリを候補から除外する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const problem = selector.selectNextQuestion([], [], {
      difficultyLevel: 1,
      category: null,
      problemTypes: ['estimate_product', 'fraction_add_sub'],
    });

    expect(problem.type).toBe('fraction_add_sub');
    expect(problem.difficulty.level).toBe(1);
  });

  it('範囲内カテゴリが1つならそのカテゴリから出題する', () => {
    const problem = selector.selectNextQuestion([], [], {
      difficultyLevel: 2,
      category: null,
      problemTypes: ['fraction_add_sub'],
    });

    expect(problem.type).toBe('fraction_add_sub');
    expect(problem.category).toBe('fraction');
  });

  it('有効候補がない場合は範囲外へフォールバックしない', () => {
    expect(() =>
      selector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: null,
        problemTypes: ['not-a-registered-type'],
      }),
    ).toThrow('現在の難易度で出題できる問題がありません');
  });

  it('直近タイプ回避で唯一の範囲内タイプを除外しない', () => {
    const recentHistory: QuestionHistory[] = Array.from({ length: 10 }, (_, index) => ({
      problemId: `recent-${index}`,
      problemType: 'fraction_add_sub',
      parameters: { index },
      askedAt: new Date().toISOString(),
    }));

    const problem = selector.selectNextQuestion([], recentHistory, {
      difficultyLevel: 2,
      category: null,
      problemTypes: ['fraction_add_sub'],
    });

    expect(problem.type).toBe('fraction_add_sub');
  });

  it('カテゴリ生成失敗時の再試行も保存範囲と適応後難易度を守る', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const realGenerateProblem = generatorRegistry.generateProblem;
    const generateProblem = vi.spyOn(generatorRegistry, 'generateProblem');
    generateProblem.mockImplementation((config) => {
      if (config?.type === 'integer_addition') {
        throw new Error('simulated first-category failure');
      }
      return realGenerateProblem(config);
    });
    const history = [
      ...Array.from({ length: 10 }, () => createAnswer('integer', false, 60)),
      ...Array.from({ length: 10 }, () => createAnswer('fraction', false, 5)),
    ];

    const problem = selector.selectNextQuestion(history, [], {
      difficultyLevel: 3,
      category: null,
      problemTypes: ['integer_addition', 'fraction_add_sub'],
    });

    expect(problem.type).toBe('fraction_add_sub');
    expect(problem.difficulty.level).toBe(2);
    expect(generateProblem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fraction_add_sub', difficulty: 2 }),
    );
    expect(
      generateProblem.mock.calls.every(([config]) =>
        ['integer_addition', 'fraction_add_sub'].includes(config?.type ?? ''),
      ),
    ).toBe(true);
    expect(generateProblem.mock.calls.every(([config]) => config?.difficulty === 2)).toBe(true);
  });

  it('範囲内生成器が例外を投げても範囲外の生成器を呼ばない', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const generateProblem = vi.spyOn(generatorRegistry, 'generateProblem');
    generateProblem.mockImplementation(() => {
      throw new Error('simulated scoped generator failure');
    });

    expect(() =>
      selector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: null,
        problemTypes: ['integer_addition'],
      }),
    ).toThrow('設定された出題範囲から問題を生成できませんでした');

    const calledTypes = generateProblem.mock.calls.map(([config]) => config?.type);
    expect(calledTypes.length).toBeGreaterThan(0);
    expect(calledTypes.every((type) => type === 'integer_addition')).toBe(true);
  });

  it('範囲内で重複問題しか生成できない場合も範囲外生成器を呼ばない', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const realGenerateProblem = generatorRegistry.generateProblem;
    const duplicate = realGenerateProblem({
      type: 'integer_addition',
      difficulty: 2,
      seed: 123,
    });
    const generateProblem = vi.spyOn(generatorRegistry, 'generateProblem');
    generateProblem.mockImplementation((config) => {
      if (config?.type !== 'integer_addition') {
        throw new Error(`out-of-range generator called: ${config?.type}`);
      }
      return duplicate;
    });

    expect(() =>
      selector.selectNextQuestion(
        [],
        [
          {
            problemId: 'duplicate',
            problemType: duplicate.type,
            parameters: duplicate.parameters,
            askedAt: new Date().toISOString(),
            fingerprint: fingerprintProblem(duplicate),
          },
        ],
        {
          difficultyLevel: 2,
          category: null,
          problemTypes: ['integer_addition'],
        },
      ),
    ).toThrow('設定された出題範囲から問題を生成できませんでした');

    const calledTypes = generateProblem.mock.calls.map(([config]) => config?.type);
    expect(calledTypes.length).toBeGreaterThan(0);
    expect(calledTypes.every((type) => type === 'integer_addition')).toBe(true);
  });

  it('有効な範囲内候補が全て失敗した場合はエラーを返し、範囲外を呼ばない', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const generateProblem = vi.spyOn(generatorRegistry, 'generateProblem');
    generateProblem.mockImplementation(() => {
      throw new Error('simulated in-scope generator failure');
    });
    const allowedTypes = ['integer_addition', 'fraction_add_sub'];

    let result: ReturnType<typeof selector.selectNextQuestion> | undefined;
    expect(() => {
      result = selector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: null,
        problemTypes: allowedTypes,
      });
    }).toThrow('設定された出題範囲から問題を生成できませんでした');

    expect(result).toBeUndefined();
    const calledTypes = generateProblem.mock.calls.map(([config]) => config?.type);
    expect(calledTypes.length).toBeGreaterThan(0);
    expect(calledTypes.every((type) => allowedTypes.includes(type ?? ''))).toBe(true);
  });

  it('タイプ数の偏りでカテゴリ優先順位が変わらない', () => {
    const oneFractionType = ['integer_addition', 'fraction_add_sub'];
    const twoFractionTypes = [
      ...oneFractionType,
      'fraction_mul_integer',
    ];
    const chooseCategory = (randomValue: number, problemTypes: string[]) => {
      vi.spyOn(Math, 'random').mockReturnValue(randomValue);
      return selector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: null,
        problemTypes,
      }).category;
    };

    expect(chooseCategory(0.25, oneFractionType)).toBe(chooseCategory(0.25, twoFractionTypes));
    vi.restoreAllMocks();
    expect(chooseCategory(0.75, oneFractionType)).toBe(chooseCategory(0.75, twoFractionTypes));
  });

  it('選択範囲内の複数タイプから決定的に生成できる', () => {
    const allowedTypes = ['integer_addition', 'fraction_add_sub'];
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const first = selector.selectNextQuestion([], [], {
      difficultyLevel: 3,
      category: null,
      problemTypes: allowedTypes,
    });
    expect(allowedTypes).toContain(first.type);
    const second = selector.selectNextQuestion([], [], {
      difficultyLevel: 3,
      category: null,
      problemTypes: allowedTypes,
    });
    expect(allowedTypes).toContain(second.type);
  });

  it('空の出題範囲は全問題へフォールバックせず拒否する', () => {
    expect(() =>
      selector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: null,
        problemTypes: [],
      }),
    ).toThrow('出題範囲が設定されていません');
  });

  it('カテゴリ条件と保存範囲が交差しない場合は生成しない', () => {
    expect(() =>
      selector.selectNextQuestion([], [], {
        difficultyLevel: 2,
        category: 'integer',
        problemTypes: ['fraction_add_sub'],
      }),
    ).toThrow('現在の難易度で出題できる問題がありません');
  });

  it('履歴がある場合も生成できる', () => {
    const history: AnswerRecord[] = [
      createAnswer('integer', true, 10),
      createAnswer('integer', false, 30),
    ];
    const questionHistory: QuestionHistory[] = [
      {
        problemId: 'p1',
        problemType: 'integer_addition',
        parameters: { a: 2, b: 3 },
        askedAt: new Date().toISOString(),
      },
    ];

    const problem = selector.selectNextQuestion(history, questionHistory, {
      difficultyLevel: 2,
      category: null,
    });
    expect(problem).toBeDefined();
    expect(validateProblem(problem).valid).toBe(true);
  });

  it('正答率が高いと難易度が上がる', () => {
    const history = Array.from({ length: 10 }, () => createAnswer('integer', true, 5));
    const problem = selector.selectNextQuestion(history, [], {
      difficultyLevel: 2,
      category: 'integer',
    });
    expect(problem.difficulty.level).toBe(3);
    expect(validateProblem(problem).valid).toBe(true);
  });

  it('正答率が低いと難易度が下がる', () => {
    const history = Array.from({ length: 10 }, () => createAnswer('integer', false, 60));
    const problem = selector.selectNextQuestion(history, [], {
      difficultyLevel: 3,
      category: 'integer',
    });
    expect(problem.difficulty.level).toBe(2);
  });

  it('最近出題した問題タイプを可能な範囲で避ける', () => {
    const questionHistory: QuestionHistory[] = Array.from({ length: 10 }, (_, index) => ({
      problemId: `q${index}`,
      problemType: 'integer_addition',
      parameters: { a: index, b: index + 1 },
      askedAt: new Date().toISOString(),
    }));
    const problem = selector.selectNextQuestion([], questionHistory, {
      difficultyLevel: 2,
      category: 'integer',
      problemTypes: ['integer_addition', 'integer_subtraction'],
    });
    expect(problem.type).toBe('integer_subtraction');
  });
});
