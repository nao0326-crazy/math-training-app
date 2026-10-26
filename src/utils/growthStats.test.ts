/**
 * 成長記録集計ロジックのテスト
 *
 * IndexedDB はモックせず、純粋関数としてテスト可能な部分を中心に検証する。
 * aggregateGrowthData は IndexedDB に依存するため、ここでは内部ヘルパー関数を
 * テストする。実際の統合テストは GrowthPage.test.tsx で行う。
 */

import { describe, it, expect } from 'vitest';
import type { AnswerRecord } from '../types/history';
import {
  deduplicateAnswers,
  buildDailyGrowth,
  formatAccuracy,
  formatAverageTime,
  formatMs,
} from './growthStats';

function makeRecord(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    id: 1,
    problemId: 'prob-1',
    problemType: 'addition_2_2',
    category: 'integer',
    isCorrect: true,
    answerTimeSec: 10,
    answeredAt: '2026-10-25T10:00:00Z',
    difficultyLevel: 3,
    question: '12 + 34 = ?',
    userAnswer: '46',
    correctAnswer: '46',
    ...overrides,
  };
}

describe('deduplicateAnswers', () => {
  it('submissionId があればそれによる重複を除去する', () => {
    const records: AnswerRecord[] = [
      makeRecord({ id: 1, submissionId: 'sub-1', problemId: 'p1', answeredAt: '2026-10-25T10:00:00Z' }),
      makeRecord({ id: 2, submissionId: 'sub-1', problemId: 'p1', answeredAt: '2026-10-25T10:00:00Z' }),
    ];
    const result = deduplicateAnswers(records);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('submissionId が無ければ problemId + answeredAt で重複を除去する', () => {
    const records: AnswerRecord[] = [
      makeRecord({ id: 1, problemId: 'p1', answeredAt: '2026-10-25T10:00:00Z' }),
      makeRecord({ id: 2, problemId: 'p1', answeredAt: '2026-10-25T10:00:00Z' }),
    ];
    const result = deduplicateAnswers(records);
    expect(result).toHaveLength(1);
  });

  it('異なる answeredAt は別レコードとして保持する', () => {
    const records: AnswerRecord[] = [
      makeRecord({ id: 1, problemId: 'p1', answeredAt: '2026-10-25T10:00:00Z' }),
      makeRecord({ id: 2, problemId: 'p1', answeredAt: '2026-10-25T11:00:00Z' }),
    ];
    const result = deduplicateAnswers(records);
    expect(result).toHaveLength(2);
  });
});

describe('buildDailyGrowth', () => {
  it('正答率・平均時間を正しく集計する', () => {
    const records: AnswerRecord[] = [
      makeRecord({ id: 1, isCorrect: true, answerTimeSec: 10 }),
      makeRecord({ id: 2, isCorrect: false, answerTimeSec: 20 }),
      makeRecord({ id: 3, isCorrect: true, answerTimeSec: 30, isTimedOut: true }),
    ];
    const result = buildDailyGrowth('2026-10-25', records);
    // 正答率 = 正解数 / 採点対象数 (時間切れも分母に含む) = 2/3 = 66.67%
    expect(result.questionCount).toBe(3);
    expect(result.correctCount).toBe(2);
    expect(Math.round(result.accuracyRate)).toBe(67);
    // 平均時間 = 時間切れを除いた解答の平均 = (10+20)/2 = 15
    expect(result.averageTimeSec).toBe(15);
  });

  it('空配列の場合はゼロを返す', () => {
    const result = buildDailyGrowth('2026-10-25', []);
    expect(result.questionCount).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.accuracyRate).toBe(0);
    expect(result.averageTimeSec).toBe(0);
    expect(result.hasLearned).toBe(false);
  });
});

describe('formatAccuracy', () => {
  it('null は「未学習」を返す', () => {
    expect(formatAccuracy(null)).toBe('未学習');
  });

  it('0〜100のパーセント文字列を返す', () => {
    expect(formatAccuracy(0.85)).toBe('85%');
    expect(formatAccuracy(0)).toBe('0%');
    expect(formatAccuracy(1)).toBe('100%');
    expect(formatAccuracy(0.666)).toBe('67%');
  });
});

describe('formatAverageTime', () => {
  it('null は「未学習」を返す', () => {
    expect(formatAverageTime(null)).toBe('未学習');
  });

  it('秒未満は秒単位、60秒以上は分秒単位を返す', () => {
    expect(formatAverageTime(30)).toBe('30秒');
    expect(formatAverageTime(90)).toBe('1分30秒');
    expect(formatAverageTime(120)).toBe('2分');
  });
});

describe('formatMs', () => {
  it('ミリ秒を秒/分秒にフォーマットする', () => {
    expect(formatMs(30000)).toBe('30秒');
    expect(formatMs(90000)).toBe('1分30秒');
    expect(formatMs(120000)).toBe('2分');
  });
});