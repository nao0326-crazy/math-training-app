/**
 * HistoryPage の途中式復習カードのテスト (jsdom)
 *
 * 検証する点:
 * - 記録のある問題では「最近の解答と途中式」にカードが表示され、
 *   問題文・自分の回答・正解・正誤・時間・日時と途中式キャンバスが見られる
 * - 途中式の記録が無い過去の問題でも、既存の復習画面が正常に動作する
 * - 途中式の読み込み失敗時も画面がクラッシュしない
 * - 時間切れの記録も正常に表示される
 *
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { AnswerRecord } from '../types/history';
import type { ScratchNote } from '../types/scratch';

const h = vi.hoisted(() => ({
  records: [] as AnswerRecord[],
  notes: [] as ScratchNote[],
  throwOnDb: false,
  throwOnNotes: false,
}));

vi.mock('../storage/db', () => ({
  getAllAnswerRecords: vi.fn(async () => {
    if (h.throwOnDb) throw new Error('db failed');
    return [...h.records];
  }),
}));

vi.mock('../services/scratchNote', () => ({
  loadAllScratchNotes: vi.fn(async () => {
    if (h.throwOnNotes) throw new Error('notes failed');
    return [...h.notes];
  }),
  loadScratchNote: vi.fn(async () => null),
  storeScratchNote: vi.fn(async () => true),
}));

import HistoryPage from './HistoryPage';

function makeRecord(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    problemId: 'p1',
    problemType: 'integer_addition',
    category: 'integer',
    isCorrect: true,
    answerTimeSec: 12.4,
    answeredAt: '2026-10-16T10:00:00.000Z',
    difficultyLevel: 3,
    question: '2 + 3 = ?',
    userAnswer: '5',
    correctAnswer: '5',
    ...overrides,
  };
}

function makeNote(attemptId: string): ScratchNote {
  return {
    attemptId,
    problemId: 'p1',
    problemType: 'integer_addition',
    category: 'integer',
    question: '2 + 3 = ?',
    strokes: [
      { points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], color: '#111', width: 3 },
      { points: [{ x: 0.5, y: 0.5 }], color: '#111', width: 3 },
    ],
    createdAt: '2026-10-16T09:59:00.000Z',
    updatedAt: '2026-10-16T10:00:00.000Z',
  };
}


afterEach(() => {
  cleanup();
  h.records = [];
  h.notes = [];
  h.throwOnDb = false;
  h.throwOnNotes = false;
});

describe('HistoryPage: 途中式の復習', () => {
  it('記録のある問題では途中式カードが表示される (問題文・回答・正誤・時間・途中式)', async () => {
    h.records = [makeRecord({ scratchAttemptId: 'att-1' })];
    h.notes = [makeNote('att-1')];
    render(<HistoryPage onStartReview={vi.fn()} />);

    await screen.findByText('最近の解答と途中式');
    // 元の問題文・自分の回答・正解・正誤・時間
    expect(screen.getAllByText('2 + 3 = ?').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('○ 正解').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('12秒').length).toBeGreaterThanOrEqual(1);
    // 途中式キャンバス (2ストローク) が復習カード内に表示される
    const canvases = document.querySelectorAll('.scratch-review-card .scratch-note-canvas');
    expect(canvases).toHaveLength(1);
    expect(canvases[0].getAttribute('data-stroke-count')).toBe('2');
    // 既存の「最近の問題」表も変わらず表示される
    expect(screen.getByText('最近の問題')).toBeTruthy();
  });

  it('途中式の記録が無い過去の問題でも既存の復習画面が正常に動作する', async () => {
    // scratchAttemptId の無い旧レコード
    h.records = [makeRecord({ scratchAttemptId: undefined })];
    h.notes = [];
    render(<HistoryPage onStartReview={vi.fn()} />);

    await screen.findByText('最近の解答と途中式');
    expect(screen.getByText('途中式の記録はありません')).toBeTruthy();
    // カード自体は表示される (問題・回答・正誤)
    expect(screen.getAllByText('2 + 3 = ?').length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('.scratch-review-card')).toBeTruthy();
    // 既存の表も表示される
    expect(screen.getByText('最近の問題')).toBeTruthy();
  });

  it('途中式の読み込み失敗時も画面がクラッシュしない', async () => {
    h.records = [makeRecord({ scratchAttemptId: 'att-x' })];
    h.throwOnNotes = true;
    render(<HistoryPage onStartReview={vi.fn()} />);

    await screen.findByText('最近の解答と途中式');
    // 途中式は無い扱いになり、既存の復習は継続する
    expect(screen.getByText('途中式の記録はありません')).toBeTruthy();
    expect(screen.getByText('最近の問題')).toBeTruthy();
  });

  it('時間切れの記録も正常に表示される (既存集計に影響しない表示のみ)', async () => {
    h.records = [
      makeRecord({
        isCorrect: false,
        isTimedOut: true,
        timeLimitSec: 30,
        scratchAttemptId: 'att-t',
      }),
    ];
    h.notes = [makeNote('att-t')];
    render(<HistoryPage onStartReview={vi.fn()} />);

    await screen.findByText('最近の解答と途中式');
    expect(screen.getAllByText('⏰ 時間切れ').length).toBeGreaterThanOrEqual(1);
  });

  it('別の出題の途中式は別カードに表示され混ざらない', async () => {
    h.records = [
      makeRecord({ problemId: 'p1', question: '2 + 3 = ?', scratchAttemptId: 'a1' }),
      makeRecord({ problemId: 'p2', question: '3 + 4 = ?', userAnswer: '7', correctAnswer: '7', scratchAttemptId: 'a2' }),
    ];
    h.notes = [
      { ...makeNote('a1'), strokes: [{ points: [{ x: 0.1, y: 0.1 }], color: '#111', width: 3 }] },
      {
        ...makeNote('a2'),
        strokes: [
          { points: [{ x: 0.2, y: 0.2 }], color: '#111', width: 3 },
          { points: [{ x: 0.3, y: 0.3 }], color: '#111', width: 3 },
          { points: [{ x: 0.4, y: 0.4 }], color: '#111', width: 3 },
        ],
      },
    ];
    render(<HistoryPage onStartReview={vi.fn()} />);

    await screen.findByText('最近の解答と途中式');
    const cards = document.querySelectorAll('.scratch-review-card');
    expect(cards).toHaveLength(2);
    const counts = [...document.querySelectorAll('.scratch-review-card .scratch-note-canvas')].map((c) =>
      c.getAttribute('data-stroke-count'),
    );
    // 新しい順 (p2, p1) で 3ストローク / 1ストローク
    expect(counts).toEqual(['3', '1']);
  });
});
