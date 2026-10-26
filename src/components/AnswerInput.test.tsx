/**
 * AnswerInput の対話テスト (jsdom)
 *
 * 実ユーザーの操作 (キーパッド押下・PC キーボード・選択ボタン) から
 * onSubmit へ渡る文字列を、入力タイプごとに検証する。
 * 「入力が反映されない」「送信できない」「空欄が送信される」を主な検出対象とする。
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnswerInput from './AnswerInput';
import type { Answer, Problem } from '../types/problem';

afterEach(cleanup);

function makeProblem(overrides: Partial<Problem> & { answer: Answer }): Problem {
  const base: Problem = {
    id: 'test-problem-1',
    category: 'integer',
    type: 'test_type',
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
    answer: { kind: 'integer', value: 0 },
  };
  return { ...base, ...overrides };
}

/** キーパッドの数字ボタンを順に押す */
function pressDigits(container: HTMLElement, digits: string): void {
  for (const d of digits) {
    const btn = [...container.querySelectorAll('.keypad-button')].find(
      (b) => b.textContent === d && b.className.includes('number-btn'),
    );
    if (!btn) throw new Error(`キーパッドに数字 ${d} が見つからない`);
    fireEvent.click(btn);
  }
}

/** キーパッドのラベル (記号) ボタンを押す */
function pressLabel(container: HTMLElement, label: string): void {
  const btn = [...container.querySelectorAll('.keypad-button')].find((b) => b.textContent === label);
  if (!btn) throw new Error(`キーパッドに ${label} が見つからない`);
  fireEvent.click(btn);
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

describe('AnswerInput (integer)', () => {
  const problem = makeProblem({ answer: { kind: 'integer', value: 42 } });

  it('キーパッド入力→決定で数値が渡る', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressDigits(container, '42');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('42');
  });

  it('空欄のまま決定すると送信せずエラー表示', () => {
    const onSubmit = vi.fn();
    render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('答えを入力してください');
  });

  it('⌫ で削除できる', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressDigits(container, '42');
    pressLabel(container, '⌫');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('4');
  });

  it('C で全消去 (空欄は送信不可)', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressDigits(container, '9');
    pressLabel(container, 'C');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('PC キーボード (数字・Enter) で送信できる', () => {
    const onSubmit = vi.fn();
    render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    const field = screen.getByDisplayValue('') as HTMLInputElement;
    fireEvent.keyDown(field, { key: '4' });
    fireEvent.keyDown(field, { key: '2' });
    expect(field.value).toBe('42');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('42');
  });

  it('無効な文字 (a や -) は integer に入らない', () => {
    const onSubmit = vi.fn();
    render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    const field = screen.getByDisplayValue('') as HTMLInputElement;
    fireEvent.keyDown(field, { key: 'a' });
    fireEvent.keyDown(field, { key: '-' });
    expect(field.value).toBe('');
  });
});

describe('AnswerInput (decimal)', () => {
  const problem = makeProblem({
    category: 'decimal',
    answer: { kind: 'decimal', value: 3.14 },
  });

  it('小数点を含む入力ができる', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressDigits(container, '3');
    pressLabel(container, '．');
    pressDigits(container, '14');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('3.14');
  });

  it('小数点は1個しか入らない', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressLabel(container, '．');
    pressLabel(container, '．');
    const field = container.querySelector('.answer-display') as HTMLInputElement;
    expect(field.value).toBe('.');
  });
});

describe('AnswerInput (fraction)', () => {
  const problem = makeProblem({
    category: 'fraction',
    answer: { kind: 'fraction', numerator: 3, denominator: 4 },
  });

  it('分子・分母に入力して 3/4 を送信', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    // 既定で分子がアクティブ
    pressDigits(container, '3');
    focusField(screen.getByLabelText(/分母/));
    pressDigits(container, '4');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('3/4');
  });

  it('分母0はエラーにして送信しない', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressDigits(container, '3');
    focusField(screen.getByLabelText(/分母/));
    pressDigits(container, '0');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('分母に0');
  });

  it('分母未入力は具体的な案内を出して送信しない', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressDigits(container, '3');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('分母');
  });
});

describe('AnswerInput (choice / yesno / list / expression / ratio)', () => {
  const choiceProblem = makeProblem({
    type: 'data_compare',
    category: 'data',
    answer: { kind: 'string', value: 'A組' },
    question: 'どちらの組の合計が多いですか？',
  });

  it('choice: 選択肢ボタンで回答できる', () => {
    const onSubmit = vi.fn();
    render(<AnswerInput problem={choiceProblem} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'A組' }));
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('A組');
  });

  it('choice: 未選択のまま決定すると送信しない', () => {
    const onSubmit = vi.fn();
    render(<AnswerInput problem={choiceProblem} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('yesno: はいボタンで回答できる', () => {
    const problem = makeProblem({
      type: 'yesno_test',
      category: 'numberTheory',
      answer: { kind: 'string', value: 'はい' },
      question: '12は3の倍数ですか？はい いいえで答えましょう。',
    });
    const onSubmit = vi.fn();
    render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'はい' }));
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('はい');
  });

  it('list: カンマ入力を含む複数値がそのまま渡る', () => {
    const problem = makeProblem({
      type: 'divisors_finding',
      category: 'numberTheory',
      answer: { kind: 'string', value: '1, 2, 3' },
      question: '6の約数をすべて書きましょう。',
    });
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressDigits(container, '1');
    pressLabel(container, '，');
    pressDigits(container, '2');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    // キーパッドの '，' ボタンは表示のみ全角・値は半角カンマ (実装どおり)
    expect(onSubmit).toHaveBeenCalledWith('1,2');
  });

  it('expression: 文字式をキーで入力', () => {
    const problem = makeProblem({
      type: 'expression_make',
      category: 'expression',
      answer: { kind: 'string', value: '5x' },
      inputType: 'expression',
      question: 'xの5倍を式で表しましょう。',
    });
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressDigits(container, '5');
    pressLabel(container, 'x');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('5x');
  });

  it('expression: y を含む式をキーで入力', () => {
    const problem = makeProblem({
      type: 'expression_make',
      category: 'expression',
      answer: { kind: 'string', value: 'y=5x' },
      inputType: 'expression',
      question: 'yをxの式で表しましょう。',
    });
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    pressLabel(container, 'y');
    pressLabel(container, '＝');
    pressDigits(container, '5');
    pressLabel(container, 'x');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('y=5x');
  });
});

describe('AnswerInput (ratio / disabled)', () => {
  const ratioProblem = makeProblem({
    type: 'ratio_simplify',
    category: 'ratio',
    answer: { kind: 'string', value: '3:5' },
    inputType: 'ratio',
    question: '6:10を最も単純な比で表しましょう。',
  });

  it('ratio: 左右それぞれに入力して 3:5 を送信', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={ratioProblem} onSubmit={onSubmit} />);
    pressDigits(container, '3');
    focusField(screen.getByLabelText(/右/));
    pressDigits(container, '5');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('3:5');
  });

  it('ratio: 片側のみ入力はエラーで送信しない', () => {
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={ratioProblem} onSubmit={onSubmit} />);
    pressDigits(container, '3');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('右');
  });

  it('disabled 中は入力・送信できない', () => {
    const problem = makeProblem({ answer: { kind: 'integer', value: 42 } });
    const onSubmit = vi.fn();
    const { container } = render(
      <AnswerInput problem={problem} disabled onSubmit={onSubmit} />,
    );
    const padButton = container.querySelector('.keypad-button') as HTMLButtonElement;
    expect(padButton.disabled).toBe(true);
    fireEvent.click(padButton);
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('AnswerInput (mixed / fraction-list)', () => {
  it('mixed: 整数部1・分子2・分母3 → 1と2/3 を送信', () => {
    const problem = makeProblem({
      category: 'fraction',
      answer: { kind: 'mixed', whole: 1, numerator: 2, denominator: 3 },
      inputType: 'mixed',
      question: '1と2/3を帯分数で表しましょう。',
    });
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    focusField(screen.getByLabelText(/整数部/));
    pressDigits(container, '1');
    focusField(screen.getByLabelText(/分子/));
    pressDigits(container, '2');
    focusField(screen.getByLabelText(/分母/));
    pressDigits(container, '3');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('1と2/3');
  });

  it('mixed: 整数部が空なら 0と... として送信される', () => {
    const problem = makeProblem({
      category: 'fraction',
      answer: { kind: 'mixed', whole: 0, numerator: 2, denominator: 3 },
      inputType: 'mixed',
      question: '2/3を帯分数で表しましょう。',
    });
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    focusField(screen.getByLabelText(/分子/));
    pressDigits(container, '2');
    focusField(screen.getByLabelText(/分母/));
    pressDigits(container, '3');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('0と2/3');
  });

  it('mixed: 分母0はエラーで送信しない', () => {
    const problem = makeProblem({
      category: 'fraction',
      answer: { kind: 'mixed', whole: 1, numerator: 2, denominator: 3 },
      inputType: 'mixed',
      question: '1と2/3を帯分数で表しましょう。',
    });
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    focusField(screen.getByLabelText(/分子/));
    pressDigits(container, '2');
    focusField(screen.getByLabelText(/分母/));
    pressDigits(container, '0');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('分母に0');
  });

  it('fraction-list: 2つの分数を入力して「15/20 と 8/20」を送信', () => {
    const problem = makeProblem({
      category: 'fraction',
      answer: {
        kind: 'fractions',
        values: [
          { numerator: 15, denominator: 20 },
          { numerator: 8, denominator: 20 },
        ],
      },
      inputType: 'fraction-list',
      question: '15/20と8/20を分母20で通しましょう。',
    });
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    focusField(container.querySelector('#fraction-list-0-numerator')!);
    pressDigits(container, '15');
    focusField(container.querySelector('#fraction-list-0-denominator')!);
    pressDigits(container, '20');
    focusField(container.querySelector('#fraction-list-1-numerator')!);
    pressDigits(container, '8');
    focusField(container.querySelector('#fraction-list-1-denominator')!);
    pressDigits(container, '20');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).toHaveBeenCalledWith('15/20 と 8/20');
  });

  it('fraction-list: 片方の分数が未完成なら送信せず案内する', () => {
    const problem = makeProblem({
      category: 'fraction',
      answer: {
        kind: 'fractions',
        values: [
          { numerator: 15, denominator: 20 },
          { numerator: 8, denominator: 20 },
        ],
      },
      inputType: 'fraction-list',
      question: '15/20と8/20を分母20で通しましょう。',
    });
    const onSubmit = vi.fn();
    const { container } = render(<AnswerInput problem={problem} onSubmit={onSubmit} />);
    focusField(container.querySelector('#fraction-list-0-numerator')!);
    pressDigits(container, '15');
    focusField(container.querySelector('#fraction-list-0-denominator')!);
    pressDigits(container, '20');
    fireEvent.click(screen.getByRole('button', { name: '決定する' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('2つ目の分数');
  });
});




