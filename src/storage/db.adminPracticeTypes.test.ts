import { beforeEach, describe, expect, it, vi } from 'vitest';

const records = vi.hoisted(() => new Map<string, unknown>());
const dbState = vi.hoisted(() => ({
  answers: [] as unknown[],
  transaction: vi.fn(),
}));

vi.mock('idb', () => ({
  openDB: async () => ({
    get: async (store: string, key: string) => records.get(`${store}:${key}`),
    getAll: async (store: string) => (store === 'answers' ? dbState.answers : []),
    put: async (store: string, value: { key: string }) => {
      records.set(`${store}:${value.key}`, value);
    },
    transaction: dbState.transaction,
  }),
}));

import {
  getAdminPracticeConfiguration,
  getAdminPracticeTypes,
  getSettings,
  prepareLegacyDailyAnswerSyncTasks,
  saveAdminPracticeConfiguration,
  saveAdminPracticeTypes,
  saveSettings,
} from './db';

describe('admin practice settings persistence', () => {
  beforeEach(() => {
    records.clear();
    dbState.answers.length = 0;
    dbState.transaction.mockClear();
  });

  it('stores only registered types independently from learner settings and answer data', async () => {
    const answers = [{ id: 1, problemId: 'normal-answer' }];
    dbState.answers.push(...answers);
    await saveSettings({
      difficultyLevel: 3,
      category: 'integer',
      questionCount: 10,
    });
    await saveAdminPracticeTypes([
      'integer_addition',
      'fraction_add_sub',
      'integer_addition',
      'unknown_generator',
    ]);

    expect(await getAdminPracticeTypes()).toEqual(['integer_addition', 'fraction_add_sub']);
    expect(await getSettings()).toEqual({
      key: 'study',
      difficultyLevel: 3,
      category: 'integer',
      questionCount: 10,
    });
    expect(dbState.answers).toEqual(answers);
    expect(dbState.transaction).not.toHaveBeenCalled();
  });

  it('returns an empty range when no administrator range is saved', async () => {
    expect(await getAdminPracticeTypes()).toEqual([]);
    await expect(getAdminPracticeConfiguration()).resolves.toEqual({
      problemTypes: [],
      difficultyRange: { min: 1, max: 5 },
    });
  });

  it('persists difficulty bounds with the selected types and restores them on read', async () => {
    await saveAdminPracticeConfiguration(
      ['integer_addition', 'unknown_generator'],
      { min: 3, max: 4 },
    );

    await expect(getAdminPracticeConfiguration()).resolves.toEqual({
      problemTypes: ['integer_addition'],
      difficultyRange: { min: 3, max: 4 },
    });
    expect(records.get('settings:admin-practice-scope-v1')).toEqual({
      key: 'admin-practice-scope-v1',
      problemTypes: ['integer_addition'],
      difficultyRange: { min: 3, max: 4 },
    });
  });

  it('preserves saved difficulty bounds when the problem type range is updated', async () => {
    await saveAdminPracticeConfiguration(['fraction_add_sub'], { min: 2, max: 3 });
    await saveAdminPracticeTypes(['integer_addition']);

    await expect(getAdminPracticeConfiguration()).resolves.toEqual({
      problemTypes: ['integer_addition'],
      difficultyRange: { min: 2, max: 3 },
    });
  });

  it('rejects an invalid saved difficulty range instead of silently allowing every level', async () => {
    records.set('settings:admin-practice-scope-v1', {
      key: 'admin-practice-scope-v1',
      problemTypes: ['integer_addition'],
      difficultyRange: { min: 4, max: 2 },
    });

    await expect(getAdminPracticeConfiguration()).rejects.toThrow(
      '保存された難易度の範囲を読み込めませんでした',
    );
  });

  it('does not start legacy migration if the mode gate closes during the DB read', async () => {
    dbState.answers.push({
      id: 12,
      problemId: 'normal-answer',
      problemType: 'integer_addition',
      category: 'integer',
      isCorrect: true,
      answerTimeSec: 3,
      answeredAt: new Date().toISOString(),
      difficultyLevel: 2,
      question: '1 + 1',
      userAnswer: '2',
      correctAnswer: '2',
    });
    let gateCalls = 0;

    await expect(
      prepareLegacyDailyAnswerSyncTasks(() => {
        gateCalls++;
        return gateCalls === 1;
      }),
    ).resolves.toBe(false);
    expect(dbState.transaction).not.toHaveBeenCalled();
  });
});
