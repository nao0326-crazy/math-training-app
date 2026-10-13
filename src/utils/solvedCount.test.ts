/**
 * 「解いた問題数」判定のテスト
 */

import { describe, expect, it } from 'vitest';
import { countSolvedRecords, isSolvedRecord } from './solvedCount';
import type { AnswerRecord } from '../types/history';

/** テスト用の解答記録を作成する */
function createRecord(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    problemId: 'p1',
    problemType: 'integer_addition',
    category: 'integer',
    isCorrect: true,
    answerTimeSec: 10,
    answeredAt: new Date().toISOString(),
    difficultyLevel: 2,
    question: '5 + 3 = □',
    userAnswer: '5',
    correctAnswer: '5',
    ...overrides,
  };
}

describe('isSolvedRecord', () => {
  it('時間内の解答は「解いた問題」', () => {
    expect(isSolvedRecord(createRecord())).toBe(true);
  });

  it('isTimedOut が undefined の旧レコードも「解いた問題」', () => {
    expect(isSolvedRecord(createRecord({ isTimedOut: undefined }))).toBe(true);
  });

  it('時間切れは「解いた問題」ではない', () => {
    expect(isSolvedRecord(createRecord({ isTimedOut: true }))).toBe(false);
  });
});

describe('countSolvedRecords', () => {
  it('空の履歴は0', () => {
    expect(countSolvedRecords([])).toBe(0);
  });

  it('時間内の正答・誤答は数え、時間切れは数えない', () => {
    const records = [
      createRecord({ isCorrect: true }),
      createRecord({ isCorrect: false }),
      createRecord({ isCorrect: false, isTimedOut: true }),
    ];
    // 正答1 + 誤答1 = 2 (時間切れ1は除外)
    expect(countSolvedRecords(records)).toBe(2);
  });

  it('すべて時間切れなら0', () => {
    const records = [
      createRecord({ isTimedOut: true }),
      createRecord({ isTimedOut: true }),
    ];
    expect(countSolvedRecords(records)).toBe(0);
  });
});
