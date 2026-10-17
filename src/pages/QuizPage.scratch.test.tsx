/**
 * QuizPage と手書き途中式の統合テスト (jsdom)
 *
 * 検証する点:
 * - 途中式を書かずに回答できる (必須化されていない)
 * - 途中式を書いた後も既存の回答欄から回答できる
 * - 正解・不正解の判定が変更されていない
 * - 学習記録に scratchAttemptId が付き、集計フィールドは従来どおり
 * - 次の問題への遷移で attemptId が切り替わり、途中式が混ざらない
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import QuizPage from './QuizPage';
import type { Problem } from '../types/problem';
import type { AnswerRecord, QuestionHistory } from '../types/history';
import { resetTimerStore } from '../utils/quizTimer';

/** モックに渡す共有状態 (vi.mock の hoisting で必要) */
const h = vi.hoisted(() => ({
  script: [] as unknown[],
  index: 0,
  savedAnswers: [] as AnswerRecord[],
  savedQuestions: [] as QuestionHistory[],
  notes: new Map<string, { strokes: Array<{ points: Array<{ x: number; y: number }> }> }>(),
}));

vi.mock('./quizSelection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./quizSelection')>();
  return {
    ...actual,
    createQuizSelector: () => ({
      selectNextQuestion: () => {
        if (h.index >= h.script.length) {
          throw new Error('scripted problem exhausted');
        }
        return h.script[h.index++];
      },
    }),
  };
});

vi.mock('../services/quizPersistence', () => ({
  loadQuizHistory: async () => ({ answers: [], questions: [] }),
  persistQuizQuestion: async (_admin: boolean, rec: QuestionHistory) => {
    h.savedQuestions.push(rec);
  },
  persistQuizAnswer: async (_admin: boolean, rec: AnswerRecord) => {
    h.savedAnswers.push(rec);
  },
}));

vi.mock('../services/scratchNote', () => ({
  loadScratchNote: async (attemptId: string) => h.notes.get(attemptId) ?? null,
  storeScratchNote: async (note: { attemptId: string; strokes: unknown[] }) => {
    h.notes.set(note.attemptId, note as { strokes: Array<{ points: Array<{ x: number; y: number }> }> });
    return true;
  },
  loadAllScratchNotes: async () => [...h.notes.values()],
}));

function makeProblem(overrides: Partial<Problem> & Pick<Problem, 'answer' | 'type' | 'category'>): Problem {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    difficulty: {
      level: 3,
      components: {
        calculationComplexity: 3,
        numberComplexity: 3,
        reasoningComplexity: 3,
        readingComplexity: 3,
      },
    },
    question: 'テスト問題です。',
    parameters: { test: true },
    solutionSteps: [{ expression: '1 + 1 = 2', explanation: '計算します' }],
    ...overrides,
  };
}

function resetScript(problems: Problem[]): void {
  h.script = problems;
  h.index = 0;
  h.savedAnswers = [];
  h.savedQuestions = [];
  h.notes.clear();
}

function renderQuiz(props: Partial<Parameters<typeof QuizPage>[0]> = {}) {
  return render(
    <QuizPage
      category={null}
      difficulty={3}
      questionCount={3}
      problemTypes={[]}
      difficultyRange={{ min: 1, max: 5 }}
      studyMode={{ kind: 'full-random' }}
      isAdminMode={false}
      canStartNormalSync={() => true}
      onExit={vi.fn()}
      {...props}
    />,
  );
}

function pointerEvent(type: string, x: number, y: number): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const anyEv = ev as unknown as Record<string, unknown>;
  anyEv.clientX = x;
  anyEv.clientY = y;
  anyEv.pointerId = 1;
  return ev;
}

function getCanvas(): HTMLElement {
  const canvas = document.querySelector('.scratch-canvas');
  if (!canvas) throw new Error('scratch canvas が見つからない');
  return canvas as HTMLElement;
}

/** ScratchPad の読み込み完了を待つ */
async function flushLoad(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** キーパッドの数字を押す */
function pressDigits(digits: string): void {
  for (const d of digits) {
    const btn = [...document.querySelectorAll('.keypad-button')].find(
      (b) => b.textContent === d && b.className.includes('number-btn'),
    );
    if (!btn) throw new Error(`キーパッドに数字 ${d} が見つからない`);
    fireEvent.click(btn);
  }
}

afterEach(() => {
  cleanup();
});

describe('QuizPage + 途中式: 既存機能との統合', () => {
  it('途中式を書かずに回答できる (正解・記録・判定が従来どおり)', async () => {
    const p = makeProblem({
      type: 'integer_addition',
      category: 'integer',
      answer: { kind: 'integer', value: 5 },
      question: '2 + 3 = ?',
    });
    resetScript([p]);
    resetTimerStore();
    renderQuiz();

    await screen.findByText('2 + 3 = ?');
    // 途中式ノートが表示されるが、書かずにそのまま回答できる
    expect(document.querySelector('.scratch-pad')).toBeTruthy();
    expect(getCanvas().getAttribute('data-stroke-count')).toBe('0');

    pressDigits('5');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    await screen.findByText('🎉 せいかい！');

    expect(h.savedAnswers).toHaveLength(1);
    expect(h.savedAnswers[0].isCorrect).toBe(true);
    expect(h.savedAnswers[0].userAnswer).toBe('5');
    // scratchAttemptId が付くが、集計フィールドは従来どおり
    expect(typeof h.savedAnswers[0].scratchAttemptId).toBe('string');
    expect(h.savedAnswers[0].category).toBe('integer');
  });

  it('途中式を書いた後も既存の回答欄から回答できる (不正解の判定も従来どおり)', async () => {
    const p = makeProblem({
      type: 'integer_addition',
      category: 'integer',
      answer: { kind: 'integer', value: 5 },
      question: '2 + 3 = ?',
    });
    resetScript([p]);
    resetTimerStore();
    renderQuiz();

    await screen.findByText('2 + 3 = ?');
    await flushLoad();
    // 途中式を書く
    const canvas = getCanvas();
    fireEvent(canvas, pointerEvent('pointerdown', 64, 22));
    fireEvent(canvas, pointerEvent('pointermove', 128, 44));
    fireEvent(canvas, pointerEvent('pointerup', 128, 44));
    expect(canvas.getAttribute('data-stroke-count')).toBe('1');

    // 既存の回答欄から回答できる (わざと不正解にして判定を確認)
    pressDigits('4');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    await screen.findByText('❌ ざんねん...');

    expect(h.savedAnswers).toHaveLength(1);
    expect(h.savedAnswers[0].isCorrect).toBe(false);
    expect(h.savedAnswers[0].userAnswer).toBe('4');
    expect(typeof h.savedAnswers[0].scratchAttemptId).toBe('string');
  });

  it('次の問題への遷移で attemptId が切り替わり、途中式が混ざらない', async () => {
    const p1 = makeProblem({
      type: 'integer_addition',
      category: 'integer',
      answer: { kind: 'integer', value: 5 },
      question: '2 + 3 = ?',
    });
    const p2 = makeProblem({
      type: 'integer_addition',
      category: 'integer',
      answer: { kind: 'integer', value: 7 },
      question: '3 + 4 = ?',
    });
    resetScript([p1, p2]);
    resetTimerStore();
    renderQuiz({ questionCount: 3 });

    await screen.findByText('2 + 3 = ?');
    pressDigits('5');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    await screen.findByText('🎉 せいかい！');
    const firstAttempt = h.savedAnswers[0].scratchAttemptId;

    fireEvent.click(screen.getByRole('button', { name: 'つぎの問題へ' }));
    await screen.findByText('3 + 4 = ?');
    // 次の問題の途中式は空で始まる
    await flushLoad();
    expect(getCanvas().getAttribute('data-stroke-count')).toBe('0');

    pressDigits('7');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    await screen.findByText('🎉 せいかい！');
    expect(h.savedAnswers).toHaveLength(2);
    // 各回答が異なる attemptId を持ち、同じ記録を上書きしない
    expect(h.savedAnswers[1].scratchAttemptId).toBeTruthy();
    expect(h.savedAnswers[1].scratchAttemptId).not.toBe(firstAttempt);
    expect(h.savedQuestions).toHaveLength(2);
  });
});
