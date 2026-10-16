import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerRecord, QuestionHistory } from '../types/history';

const { database, getAnswers, getQuestions, saveAnswer, saveQuestion, sync } = vi.hoisted(() => {
  const database = {
    answers: [] as AnswerRecord[],
    questions: [] as QuestionHistory[],
    dailySync: [] as string[],
  };
  return {
    database,
    getAnswers: vi.fn(async () => [...database.answers]),
    getQuestions: vi.fn(async () => [...database.questions]),
    saveAnswer: vi.fn(async (record: AnswerRecord) => {
      database.answers.push(record);
      if (record.submissionId) database.dailySync.push(record.submissionId);
    }),
    saveQuestion: vi.fn(async (record: QuestionHistory) => {
      database.questions.push(record);
    }),
    sync: vi.fn(async () => {}),
  };
});

vi.mock('../storage/db', () => ({
  getAllAnswerRecords: getAnswers,
  getAllQuestionHistory: getQuestions,
  saveAnswerRecord: saveAnswer,
  saveQuestionHistory: saveQuestion,
}));

vi.mock('./dailyAnswerSync', () => ({
  runDailyAnswerSync: sync,
}));

import { loadQuizHistory, persistQuizAnswer, persistQuizQuestion } from './quizPersistence';

const answer: AnswerRecord = {
  problemId: 'admin-problem',
  problemType: 'fraction_div_integer',
  category: 'fraction',
  isCorrect: true,
  answerTimeSec: 5,
  answeredAt: '2026-01-01T00:00:00.000Z',
  difficultyLevel: 3,
  question: 'admin question',
  userAnswer: '1',
  correctAnswer: '1',
  submissionId: 'admin-submission',
};

const question: QuestionHistory = {
  problemId: 'admin-problem',
  problemType: 'fraction_div_integer',
  parameters: {},
  askedAt: '2026-01-01T00:00:00.000Z',
  fingerprint: 'admin-fingerprint',
};

describe('quiz persistence mode isolation', () => {
  beforeEach(() => {
    database.answers = [];
    database.questions = [];
    database.dailySync = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('admin mode neither reads nor changes normal records, daily counts, or sync queue', async () => {
    database.answers.push({ ...answer, problemId: 'existing-answer', submissionId: 'existing-sync' });
    database.questions.push({ ...question, problemId: 'existing-question' });
    const before = structuredClone(database);
    const eventTarget = new EventTarget();
    const answerRecorded = vi.fn();
    eventTarget.addEventListener('answer-recorded', answerRecorded);
    vi.stubGlobal('window', eventTarget);

    expect(await loadQuizHistory(true)).toEqual({ answers: [], questions: [] });
    await persistQuizQuestion(true, question);
    await persistQuizAnswer(true, answer);

    expect(database).toEqual(before);
    expect(getAnswers).not.toHaveBeenCalled();
    expect(getQuestions).not.toHaveBeenCalled();
    expect(saveQuestion).not.toHaveBeenCalled();
    expect(saveAnswer).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect(answerRecorded).not.toHaveBeenCalled();
  });

  it('normal mode still loads and persists learning records and sync events', async () => {
    const eventTarget = new EventTarget();
    const answerRecorded = vi.fn();
    eventTarget.addEventListener('answer-recorded', answerRecorded);
    vi.stubGlobal('window', eventTarget);

    expect(await loadQuizHistory(false)).toEqual({ answers: [], questions: [] });
    await persistQuizQuestion(false, question);
    await persistQuizAnswer(false, answer);

    expect(getAnswers).toHaveBeenCalledOnce();
    expect(getQuestions).toHaveBeenCalledOnce();
    expect(database.answers).toEqual([answer]);
    expect(database.questions).toEqual([question]);
    expect(database.dailySync).toEqual(['admin-submission']);
    expect(sync).toHaveBeenCalledOnce();
    expect(answerRecorded).toHaveBeenCalledOnce();
  });

  it('finishes an accepted normal answer after a mode switch without starting a new sync', async () => {
    let finishSave!: () => void;
    const saveGate = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    saveAnswer.mockImplementationOnce(async (record) => {
      await saveGate;
      database.answers.push(record);
      if (record.submissionId) database.dailySync.push(record.submissionId);
    });
    let adminMode = false;
    const canStartSync = () => !adminMode;
    const eventTarget = new EventTarget();
    const answerRecorded = vi.fn();
    eventTarget.addEventListener('answer-recorded', answerRecorded);
    vi.stubGlobal('window', eventTarget);

    const saving = persistQuizAnswer(false, answer, canStartSync);
    expect(saveAnswer).toHaveBeenCalledOnce();
    adminMode = true;
    finishSave();
    await saving;

    expect(database.answers).toEqual([answer]);
    expect(database.dailySync).toEqual(['admin-submission']);
    expect(answerRecorded).toHaveBeenCalledOnce();
    expect(sync).not.toHaveBeenCalled();
  });
});
