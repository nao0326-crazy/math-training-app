/**
 * 通常モードUI の回帰テスト
 *
 * 通常ユーザーに見えてよいもの / 隠してよいものを静的な描画で確認する:
 * - 通常モード: 分野 (area) ボタンと履歴への導線だけ。学年・難易度・問題タイプの選択は出さない
 * - 管理者モード (解除済み): 分野・学年・難易度・問題タイプの指定が出る
 *
 * ※ 分野ボタンの「クリック → 学習開始」は DOM (jsdom) を持たない静的レンダリングでは
 *   検証できないため、クリック遷移は E2E (scripts/e2e-adaptive-learning.mjs) で確認する。
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from './HomePage';
import { listLearningAreas } from '../utils/adaptiveDifficulty';

const noop = () => {};

function render(props: Parameters<typeof HomePage>[0]): string {
  return renderToStaticMarkup(createElement(HomePage, props));
}

describe('HomePage: 通常モード', () => {
  const markup = render({
    onStartArea: noop,
    onShowHistory: noop,
    adminUnlocked: false,
    onAdminUnlockedChange: noop,
    onStartAdminQuiz: noop,
  });

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

  it('学年・難易度・問題タイプの選択は出さない', () => {
    expect(markup).not.toContain('admin-category');
    expect(markup).not.toContain('admin-grade');
    expect(markup).not.toContain('admin-difficulty');
    expect(markup).not.toContain('admin-type');
  });

  it('旧カテゴリ・難易度ボタンUIは残さない', () => {
    expect(markup).not.toContain('category-buttons');
    expect(markup).not.toContain('difficulty-buttons');
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
});

describe('HomePage: 管理者モード (解除済み)', () => {
  const markup = render({
    onStartArea: noop,
    onShowHistory: noop,
    adminUnlocked: true,
    onAdminUnlockedChange: noop,
    onStartAdminQuiz: noop,
  });

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
