/**
 * QuizPage の一連動作テスト (jsdom)
 *
 * 「問題表示 → 回答入力 → 送信 → 採点 → 学習記録 → 次の問題 → 結果」を
 * 決定論的な問題スクリプトで通し検証する。
 *
 * 検出対象:
 * - 二重送信 (同一回答が2回記録される)
 * - 時間切れと解答送信の競合 (二重計上・フィードバック上書き)
 * - 次の問題への遷移で前の回答が残る
 * - 集計 (せいかい数・正答率・時間切れ数) のずれ
 *
 * @vitest-environment jsdom
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function makeProblem(
  overrides: Partial<Problem> & Pick<Problem, 'answer' | 'type' | 'category'>,
): Problem {
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

/** キーパッドの数字を押す */
function pressDigits(container: HTMLElement, digits: string): void {
  for (const d of digits) {
    const btn = [...container.querySelectorAll('.keypad-button')].find(
      (b) => b.textContent === d && b.className.includes('number-btn'),
    );
    if (!btn) throw new Error(`キーパッドに数字 ${d} が見つからない`);
    fireEvent.click(btn);
  }
}

/**
 * 入力フィールドをアクティブにする。
 * 実ブラウザではクリックでフォーカスするが jsdom は自動ではフォーカスしないため、
 * click + focus + focusin (React 17+ が捕捉するバブル形式) を明示的に発火する。
 */
function focusField(el: HTMLElement): void {
  fireEvent.click(el);
  el.focus();
  fireEvent(el, new FocusEvent('focusin', { bubbles: true }));
}

/** すべての回答入力欄が空であること (前の回答の残存がないこと) を検証する */
function expectAllAnswerFieldsEmpty(message?: string): void {
  const fields = [...document.querySelectorAll<HTMLInputElement>('input.answer-display')];
  expect(fields.length, '回答入力欄が見つからない').toBeGreaterThan(0);
  const leftover = fields.filter((f) => f.value !== '');
  expect(
    leftover.map((f) => f.value),
    message ?? '前の回答の入力が残っている',
  ).toEqual([]);
}

beforeEach(() => {
  resetTimerStore();
  resetScript([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetTimerStore();
});

describe('QuizPage: 表示 → 回答 → 採点 → 次の問題 → 結果', () => {
  it('正答・誤答・記録・集計が一連で正しく動く', async () => {
    const p1 = makeProblem({
      type: 'integer_addition',
      category: 'integer',
      answer: { kind: 'integer', value: 42 },
      question: '35 + 7 = ?',
    });
    const p2 = makeProblem({
      type: 'fraction_mul_fraction',
      category: 'fraction',
      answer: { kind: 'fraction', numerator: 3, denominator: 4 },
      question: '1/2 × 3/2 = ?',
    });
    const p3 = makeProblem({
      type: 'integer_multiplication',
      category: 'integer',
      answer: { kind: 'integer', value: 7 },
      question: '7 × 1 = ?',
    });
    resetScript([p1, p2, p3]);

    renderQuiz();

    // --- 1問目: 正答 ---
    await screen.findByText('35 + 7 = ?');
    expect(screen.getByText(/問題 1 \/ 3/)).toBeTruthy();
    expectAllAnswerFieldsEmpty();

    pressDigits(document.body, '42');
    expect((screen.getByDisplayValue('42') as HTMLInputElement).value).toBe('42');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));

    await screen.findByText('🎉 せいかい！');
    expect(h.savedAnswers).toHaveLength(1);
    expect(h.savedAnswers[0].isCorrect).toBe(true);
    expect(h.savedAnswers[0].userAnswer).toBe('42');
    expect(h.savedAnswers[0].correctAnswer).toBe('42');
    expect(h.savedAnswers[0].isTimedOut).toBeUndefined();

    // --- 2問目へ (入力状態が残っていないこと) ---
    fireEvent.click(screen.getByRole('button', { name: 'つぎの問題へ' }));
    await screen.findByText('1/2 × 3/2 = ?');
    expect(screen.getByText(/問題 2 \/ 3/)).toBeTruthy();
    expectAllAnswerFieldsEmpty('次の問題で前の回答が残っている');

    // 分数入力で 3/4 を正答
    focusField(screen.getByPlaceholderText('分子'));
    pressDigits(document.body, '3');
    focusField(screen.getByPlaceholderText('分母'));
    pressDigits(document.body, '4');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    await screen.findByText('🎉 せいかい！');
    expect(h.savedAnswers).toHaveLength(2);
    expect(h.savedAnswers[1].userAnswer).toBe('3/4');

    // --- 3問目: 誤答 → 正解表示・途中式表示 ---
    fireEvent.click(screen.getByRole('button', { name: 'つぎの問題へ' }));
    await screen.findByText('7 × 1 = ?');
    expectAllAnswerFieldsEmpty('2問目→3問目の移行で入力が残っている');
    pressDigits(document.body, '8');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    await screen.findByText('❌ ざんねん...');
    expect(screen.getByText(/正解は/).textContent).toContain('7');
    expect(document.querySelector('.solution-display')).toBeTruthy();
    expect(h.savedAnswers).toHaveLength(3);
    expect(h.savedAnswers[2].isCorrect).toBe(false);
    expect(h.savedAnswers[2].userAnswer).toBe('8');

    // --- 結果画面 ---
    fireEvent.click(screen.getByRole('button', { name: 'けっかをみる' }));
    await screen.findByText('けっか');
    const score = document.querySelector('.result-score');
    expect(score?.textContent).toContain('2');
    expect(score?.textContent).toContain('3');
    expect(document.querySelector('.result-page')?.textContent).toContain('67%');
    expect(document.querySelector('.result-page')?.textContent).toContain('0問');
    // 記録は3問ちょうど (重複なし)
    expect(h.savedAnswers).toHaveLength(3);
    expect(h.savedQuestions).toHaveLength(3);
    const problemIds = h.savedAnswers.map((r) => r.problemId);
    expect(new Set(problemIds).size).toBe(3);
  });

  it('同一回答の二重送信では記録1件のみ', async () => {
    const p1 = makeProblem({
      type: 'integer_addition',
      category: 'integer',
      answer: { kind: 'integer', value: 5 },
      question: '2 + 3 = ?',
    });
    resetScript([p1]);
    renderQuiz();

    await screen.findByText('2 + 3 = ?');
    const submit = screen.getByRole('button', { name: '決定する' });
    pressDigits(document.body, '5');
    // 連打 (DOMから外れる前の2回目を擬似的に発火)
    fireEvent.click(submit);
    fireEvent.click(submit);

    await screen.findByText('🎉 せいかい！');
    expect(h.savedAnswers).toHaveLength(1);
    expect(h.savedQuestions).toHaveLength(1);
  });

  it('正答後に「答えと解き方をみる」で途中式を開示できる', async () => {
    const p1 = makeProblem({
      type: 'integer_addition',
      category: 'integer',
      answer: { kind: 'integer', value: 5 },
      question: '2 + 3 = ?',
    });
    resetScript([p1]);
    renderQuiz();

    await screen.findByText('2 + 3 = ?');
    pressDigits(document.body, '5');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    await screen.findByText('🎉 せいかい！');

    // 既定は途中式を隠す
    expect(document.querySelector('.solution-display')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '答えと解き方をみる' }));
    await screen.findByText('途中式');
    expect(screen.queryByRole('button', { name: '答えと解き方をみる' })).toBeNull();
  });
});

describe('QuizPage: 時間切れと送信の競合', () => {
  const level1Problem = () =>
    makeProblem({
      type: 'integer_addition',
      category: 'integer',
      difficulty: {
        level: 1,
        components: {
          calculationComplexity: 1,
          numberComplexity: 1,
          reasoningComplexity: 1,
          readingComplexity: 1,
        },
      },
      answer: { kind: 'integer', value: 5 },
      question: '2 + 3 = ?',
    });

  it('制限時間切れで時間切れ記録1件・フィードバック表示', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    resetScript([level1Problem()]);
    renderQuiz({ questionCount: 1, difficulty: 1 });

    // 初回ロード (loadQuizHistory の Promise 解決) を流す
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('2 + 3 = ?')).toBeTruthy();

    // 制限時間 level1 integer = 30秒 → 31秒進める
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    expect(screen.getByText('⏰ 時間切れ！')).toBeTruthy();
    expect(h.savedAnswers).toHaveLength(1);
    expect(h.savedAnswers[0].isCorrect).toBe(false);
    expect(h.savedAnswers[0].isTimedOut).toBe(true);
    expect(h.savedAnswers[0].userAnswer).toBe('（時間切れ）');
    expect(h.savedAnswers[0].timeLimitSec).toBe(30);
    expect(h.savedQuestions).toHaveLength(1);

    // 結果画面: 時間切れは解いた問題数に不算入
    fireEvent.click(screen.getByRole('button', { name: 'けっかをみる' }));
    expect(screen.getByText('けっか')).toBeTruthy();
    const page = document.querySelector('.result-page')?.textContent ?? '';
    expect(page).toContain('0問'); // 時間切れ数
    expect(page).toContain('0%'); // 正答率
    expect(h.savedAnswers).toHaveLength(1);
  });

  it('送信が先に確定した後は期限到来で上書きされない (競合)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    resetScript([level1Problem()]);
    renderQuiz({ questionCount: 1, difficulty: 1 });

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('2 + 3 = ?')).toBeTruthy();

    // 期限の1秒前に正答送信
    await act(async () => {
      vi.advanceTimersByTime(29_000);
    });
    pressDigits(document.body, '5');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(screen.getByText('🎉 せいかい！')).toBeTruthy();

    // 送信後に期限超過分を進める (古い interval が残っていたとしても発火しないこと)
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByText('🎉 せいかい！'), '期限到来でフィードバックが上書きされた').toBeTruthy();
    expect(screen.queryByText('⏰ 時間切れ！')).toBeNull();
    expect(h.savedAnswers, '二重記録されている').toHaveLength(1);
    expect(h.savedAnswers[0].isTimedOut).toBeUndefined();
    expect(h.savedAnswers[0].isCorrect).toBe(true);
  });
});


