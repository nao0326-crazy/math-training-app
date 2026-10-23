/**
 * ホーム画面の回帰テスト (管理者出題範囲による学習)
 *
 * - すべての学習で管理者が設定した出題範囲を使用する
 * - 「通常モード」は存在しない
 * - 出題範囲が未設定または空の場合はエラーを表示
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from './HomePage';

const noop = () => {};

/** ホーム画面の必須 props */
function baseProps(): Parameters<typeof HomePage>[0] {
  return {
    onShowHistory: noop,
    onStartQuiz: noop,
    onOpenVerification: noop,
    onOpenPracticeSetup: noop,
    onCloseAdminSettings: noop,
    isAdminAuthenticated: false,
    savedProblemTypeCount: 2,
    scopeLoadError: null,
    startError: null,
    isStarting: false,
  };
}

function render(props: Parameters<typeof HomePage>[0]): string {
  return renderToStaticMarkup(createElement(HomePage, props));
}

describe('HomePage: 通常表示', () => {
  const markup = render(baseProps());

  it('出題範囲が表示される (難易度範囲の表示は廃止済み)', () => {
    expect(markup).toContain('出題範囲：2種類');
    // 従来の「出題難易度：Lv〜」表示は手動難易度方式の廃止により削除
    expect(markup).not.toContain('出題難易度：');
    // 習熟度ベース出題の案内が表示される
    expect(markup).toContain('学習履歴から自動で推定');
  });

  it('「問題を解く」ボタンがある', () => {
    expect(markup).toContain('問題を解く');
  });

  it('管理者タブへの導線がある', () => {
    expect(markup).toContain('管理者タブ');
  });

  it('学習履歴への導線がある', () => {
    expect(markup).toContain('学習履歴を見る');
  });

  it('e2eが禁止する選択UIの文字列が画面に無い', () => {
    for (const word of ['学年を選択', '分野を選択', '難易度を選択', '問題タイプ']) {
      expect(markup).not.toContain(word);
    }
  });

  it('分野選択 UI が出てこない', () => {
    expect(markup).not.toContain('どの分野を勉強しますか？');
    expect(markup).not.toContain('data-area=');
  });
});

describe('HomePage: 出題範囲未設定', () => {
  it('空の出題範囲でエラーを表示する', () => {
    const html = render({ ...baseProps(), savedProblemTypeCount: 0 });
    expect(html).toContain('出題範囲が設定されていません');
    expect(html).toContain('問題を解く');
  });

  it('読み込みエラーを表示する', () => {
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

describe('HomePage: 管理者認証済み', () => {
  const markup = render({ ...baseProps(), isAdminAuthenticated: true });

  it('管理者タブ（出題設定）への導線がある', () => {
    expect(markup).toContain('管理者タブ（出題設定）');
  });

  it('管理者タブを閉じるボタンがある', () => {
    expect(markup).toContain('管理者タブを閉じる');
  });
});
