/**
 * 通常モードUI の回帰テスト (分野別学習と共有出題エントリの統合)
 *
 * - 通常モード: 分野 (area) ボタン・共有出題エントリ・履歴への導線。
 *   学年・問題タイプの選択は出さない (難易度ピッカーは共有出題用として残す)
 * - 管理者モード (解除済み): 分野・学年・難易度・問題タイプの指定が出る
 * - 共有出題: 保存済み出題範囲の表示・開始ボタン・エラー表示
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from './HomePage';
import { listLearningAreas } from '../utils/adaptiveDifficulty';
import type { DifficultyRange } from '../types/problem';

const noop = () => {};

/** 通常モード (管理者解除なし・認証なし・保存済み範囲あり) の必須 props */
function baseProps(): Parameters<typeof HomePage>[0] {
  return {
    onStartArea: noop,
    onShowHistory: noop,
    adminUnlocked: false,
    onAdminUnlockedChange: noop,
    onStartAdminQuiz: noop,
    onStartQuiz: noop,
    onOpenVerification: noop,
    onOpenPracticeSetup: noop,
    onCloseAdminSettings: noop,
    isAdminAuthenticated: false,
    savedProblemTypeCount: 2,
    savedDifficultyRange: { min: 2, max: 4 } satisfies DifficultyRange,
    scopeLoadError: null,
    startError: null,
    isStarting: false,
  };
}

function render(props: Parameters<typeof HomePage>[0]): string {
  return renderToStaticMarkup(createElement(HomePage, props));
}

describe('HomePage: 通常モード', () => {
  const markup = render(baseProps());

  it('分野を選ぶ導線がある', () => {
    expect(markup).toContain('どの分野を勉強しますか？');
    expect(markup).toContain('学習履歴を見る');
  });

  it('分野ボタンがすべて表示される (統合せず別ボタン)', () => {
    const areas = listLearningAreas();
    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      expect(markup).toContain(`data-area="${area}"`);
    }
  });

  it('旧「学習をはじめる」ボタンは無い (分野選択に置き換わった)', () => {
    expect(markup).not.toContain('学習をはじめる');
  });

  it('学年・問題タイプの選択は出さない', () => {
    expect(markup).not.toContain('admin-category');
    expect(markup).not.toContain('admin-grade');
    expect(markup).not.toContain('admin-difficulty');
    expect(markup).not.toContain('admin-type');
  });

  it('旧カテゴリ・学習方法ボタンUIは残さない (難易度ピッカーは共有出題用)', () => {
    expect(markup).not.toContain('category-buttons');
    // .difficulty-buttons は共有出題エントリ (問題を解く) の難易度選択として使うため残す
    expect(markup).not.toContain('study-kind-buttons');
  });

  it('e2eが禁止する選択UIの文字列が通常画面に無い', () => {
    for (const word of ['学年を選択', '分野を選択', '難易度を選択', '問題タイプ']) {
      expect(markup).not.toContain(word);
    }
  });

  it('隠れた管理者モードの入口だけはある', () => {
    expect(markup).toContain('管理者モード');
  });

  it('認証状態を渡さない初期表示では管理者設定を表示しない', () => {
    const initialMarkup = render({
      ...baseProps(),
      adminUnlocked: undefined,
      onAdminUnlockedChange: undefined,
      onStartAdminQuiz: undefined,
    });
    expect(initialMarkup).not.toContain('admin-category');
    expect(initialMarkup).toContain('admin-entry');
  });
});

describe('HomePage shared learning entry and admin settings', () => {
  it('shows one shared quiz entry and the admin authentication entry', () => {
    const html = render(baseProps());
    expect(html).toContain('問題を解く');
    expect(html).toContain('出題範囲：2種類');
    expect(html).toContain('出題難易度：Lv2〜Lv4');
    expect(html).toContain('管理者タブ');
    expect(html).not.toContain('管理者用の学習');
  });

  it('keeps saved practice scope visible when admin authentication is closed', () => {
    const html = render({ ...baseProps(), isAdminAuthenticated: false });
    expect(html).toContain('出題範囲：2種類');
    expect(html).toContain('出題難易度：Lv2〜Lv4');
    expect(html).toContain('問題を解く');
  });

  it('shows a clear empty-range warning without a fallback study action', () => {
    const html = render({ ...baseProps(), savedProblemTypeCount: 0 });
    expect(html).toContain('出題範囲が空です');
    expect(html).toContain('問題を解く');
    expect(html).not.toContain('管理者演習をはじめる');
  });

  it('disables duplicate starts while the saved scope is being loaded', () => {
    const html = render({
      ...baseProps(),
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

describe('HomePage: 管理者モード (解除済み)', () => {
  const markup = render({ ...baseProps(), adminUnlocked: true });

  it('分野・学年・難易度・問題タイプの指定が出現する', () => {
    expect(markup).toContain('admin-category');
    expect(markup).toContain('admin-grade');
    expect(markup).toContain('admin-difficulty');
    expect(markup).toContain('admin-type');
    expect(markup).toContain('小学1年');
    expect(markup).toContain('小学6年');
  });

  it('分野ボタンと履歴の導線も残る (通常モードへ戻せる)', () => {
    for (const area of listLearningAreas()) {
      expect(markup).toContain(`data-area="${area}"`);
    }
    expect(markup).toContain('学習履歴を見る');
  });
});
