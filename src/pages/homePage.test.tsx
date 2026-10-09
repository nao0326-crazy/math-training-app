import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from './HomePage';
import type { DifficultyRange } from '../types/problem';

const noOp = () => {};

function render(overrides: Partial<Parameters<typeof HomePage>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(HomePage, {
      onStartQuiz: noOp,
      onShowHistory: noOp,
      onOpenVerification: noOp,
      onOpenPracticeSetup: noOp,
      onCloseAdminSettings: noOp,
      isAdminAuthenticated: false,
      savedProblemTypeCount: 2,
      savedDifficultyRange: { min: 2, max: 4 } satisfies DifficultyRange,
      scopeLoadError: null,
      startError: null,
      isStarting: false,
      ...overrides,
    }),
  );
}

describe('HomePage shared learning entry and admin settings', () => {
  it('shows one shared quiz entry and the admin authentication entry', () => {
    const html = render();
    expect(html).toContain('問題を解く');
    expect(html).toContain('出題範囲：2種類');
    expect(html).toContain('出題難易度：Lv2〜Lv4');
    expect(html).toContain('管理者タブ');
    expect(html).not.toContain('管理者用の学習');
  });

  it('keeps saved practice scope visible when admin authentication is closed', () => {
    const html = render({ isAdminAuthenticated: false });
    expect(html).toContain('出題範囲：2種類');
    expect(html).toContain('出題難易度：Lv2〜Lv4');
    expect(html).toContain('問題を解く');
  });

  it('shows a clear empty-range warning without a fallback study action', () => {
    const html = render({ savedProblemTypeCount: 0 });
    expect(html).toContain('出題範囲が空です');
    expect(html).toContain('問題を解く');
    expect(html).not.toContain('管理者演習をはじめる');
  });

  it('disables duplicate starts while the saved scope is being loaded', () => {
    const html = render({
      savedProblemTypeCount: null,
      scopeLoadError: '設定エラー',
      startError: '開始エラー',
      isStarting: true,
    });
    expect(html).toContain('disabled=""');
    expect(html).toContain('設定エラー');
    expect(html).toContain('開始エラー');
  });
});
