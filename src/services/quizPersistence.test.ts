import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerRecord, QuestionHistory } from '../types/history';
import {
  getAllAnswerRecords,
  getAllQuestionHistory,
  saveAnswerRecord,
  saveQuestionHistory,
} from '../storage/db';
import { runDailyAnswerSync } from './dailyAnswerSync';
import {
  loadQuizHistory,
  persistAnswerRecord,
  persistQuestionHistory,
} from './quizPersistence';

const persistedRecords = vi.hoisted(() => ({
  answers: [] as unknown[],
  questions: [] as unknown[],
}));

vi.mock('../storage/db', () => ({
  getAllAnswerRecords: vi.fn().mockImplementation(async () => [...persistedRecords.answers]),
  getAllQuestionHistory: vi.fn().mockImplementation(async () => [...persistedRecords.questions]),
  saveAnswerRecord: vi.fn().mockImplementation(async (record: unknown) => {
    persistedRecords.answers.push(record);
  }),
  saveQuestionHistory: vi.fn().mockImplementation(async (record: unknown) => {
    persistedRecords.questions.push(record);
  }),
}));

vi.mock('./dailyAnswerSync', () => ({
  runDailyAnswerSync: vi.fn().mockResolvedValue(undefined),
}));

const answerRecord: AnswerRecord = {
  problemId: 'answer-test',
  problemType: 'integer_addition',
  category: 'integer',
  isCorrect: true,
  answerTimeSec: 3,
  answeredAt: '2026-10-09T00:00:00.000Z',
  difficultyLevel: 2,
  question: '1 + 1 = □',
  userAnswer: '2',
  correctAnswer: '2',
};

const questionHistory: QuestionHistory = {
  problemId: 'question-test',
  problemType: 'integer_addition',
  parameters: { a: 1, b: 1 },
  askedAt: '2026-10-09T00:00:00.000Z',
};

describe('quiz persistence for shared learning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistedRecords.answers.length = 0;
    persistedRecords.questions.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and persists actual quiz records using the existing history and sync path', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });

    await loadQuizHistory();
    persistQuestionHistory(questionHistory);
    persistAnswerRecord(answerRecord);
    await Promise.resolve();

    expect(getAllAnswerRecords).toHaveBeenCalledOnce();
    expect(getAllQuestionHistory).toHaveBeenCalledOnce();
    expect(saveQuestionHistory).toHaveBeenCalledWith(questionHistory);
    expect(saveAnswerRecord).toHaveBeenCalledWith(answerRecord);
    expect(runDailyAnswerSync).toHaveBeenCalledOnce();
    expect(dispatchEvent).toHaveBeenCalledOnce();
  });

  it('finishes an accepted answer save but defers synchronization after leaving learning pages', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    let finishSave!: () => void;
    vi.mocked(saveAnswerRecord).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    let canRunSync = true;
    const canStartDailySync = () => canRunSync;

    persistAnswerRecord(answerRecord, canStartDailySync);
    expect(saveAnswerRecord).toHaveBeenCalledWith(answerRecord);
    expect(runDailyAnswerSync).not.toHaveBeenCalled();

    canRunSync = false;
    finishSave();
    await Promise.resolve();

    expect(runDailyAnswerSync).not.toHaveBeenCalled();
    expect(dispatchEvent).toHaveBeenCalledOnce();
  });
});
