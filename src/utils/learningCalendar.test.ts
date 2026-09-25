import { describe, expect, it } from 'vitest';
import type { AnswerRecord } from '../types/history';
import {
  buildCalendarDays,
  groupRecordsByStudyDate,
  shiftStudyMonth,
  summarizeRecordUnits,
  toStudyDateKey,
} from './learningCalendar';

function record(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    problemId: 'problem-1',
    problemType: 'integer_addition',
    category: 'integer',
    isCorrect: true,
    answerTimeSec: 10,
    answeredAt: '2026-09-23T14:59:59.999Z',
    difficultyLevel: 2,
    question: '問題文',
    userAnswer: '12',
    correctAnswer: '12',
    ...overrides,
  };
}

describe('buildCalendarDays', () => {
  it('月曜始まりの42セルを生成する', () => {
    const days = buildCalendarDays({ year: 2026, month: 9 }, '2026-09-24');
    expect(days).toHaveLength(42);
    // 2026-09-01は火曜
    expect(days[0]).toBeNull();
    expect(days[1]).toEqual({ dateKey: '2026-09-01', day: 1, isToday: false });
    expect(days[24]).toEqual({ dateKey: '2026-09-24', day: 24, isToday: true });
  });
});

describe('shiftStudyMonth', () => {
  it('月をまたぐと年BLEも更新する', () => {
    expect(shiftStudyMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftStudyMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });
});

describe('groupRecordsByStudyDate', () => {
  it('AnswerRecord.answeredAtをAsia/Tokyoの日付ごとにまとめる', () => {
    const grouped = groupRecordsByStudyDate([
      record({ answeredAt: '2026-09-23T14:59:59.999Z' }),
      record({ problemId: 'problem-2', answeredAt: '2026-09-23T15:00:00.000Z' }),
    ]);

    expect(grouped.get('2026-09-23')).toHaveLength(1);
    expect(grouped.get('2026-09-24')).toHaveLength(1);
  });

  it('不正な日時は除外する', () => {
    expect(groupRecordsByStudyDate([record({ answeredAt: 'invalid' })])).toEqual(new Map());
  });
});

describe('summarizeRecordUnits', () => {
  it('通常はcategoryでまとめて問題数の降順にする', () => {
    const summary = summarizeRecordUnits([
      record({ category: 'fraction' }),
      record({ problemId: 'problem-2', category: 'fraction' }),
      record({ problemId: 'problem-3', category: 'integer' }),
    ]);
    expect(summary).toEqual([
      { key: 'category:fraction', label: '分数', count: 2 },
      { key: 'category:integer', label: '整数', count: 1 },
    ]);
  });

  it('未知のcategoryはproblemTypeへフォールバックする', () => {
    const summary = summarizeRecordUnits([
      record({ category: 'legacy-unit', problemType: 'fraction_reduce' }),
    ]);
    expect(summary).toEqual([{ key: 'type:fraction_reduce', label: 'fraction_reduce', count: 1 }]);
  });
});

describe('toStudyDateKey', () => {
  it('月と日をゼロ埋めする', () => {
    expect(toStudyDateKey(2026, 1, 5)).toBe('2026-01-05');
  });
});
