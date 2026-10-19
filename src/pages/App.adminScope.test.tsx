/**
 * 管理者設定 → 出題処理の統合テスト (jsdom)
 *
 * 「UIで選択 → IndexedDB保存 → startQuiz で再読込 → filter 経由 →
 *  FilteredSelector → 実際の問題生成」の全データ経路を貫いて検証する。
 * 各層の単体テスト (db.adminPracticeTypes / filteredSelector /
 * homePage) だけでは経路の接続漏れを検出できないため、このファイルで
 * UI フロー全体を追跡する。
 *
 * 検出対象:
 * - 管理者画面の選択状態が保存されない・保存されても startQuiz に渡らない
 * - 実際の出題が選択した単元・難易度範囲の外に出る
 * - 範囲外の問題が出たときに設定を勝手に緩める
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import QuizPage from './QuizPage';
import { getAllGenerators } from '../engine/selector/generatorRegistry';

/** IndexedDB 相当のインメモリ保存 (idb モックで共有する) */
const store = vi.hoisted(() => ({
  records: new Map<string, unknown>(),
  questions: [] as unknown[],
}));

vi.mock('idb', () => ({
  openDB: async () => ({
    get: async (dbStore: string, key: string) => store.records.get(`${dbStore}:${key}`),
    getAll: async (dbStore: string) => {
      if (dbStore === 'questions') return [...store.questions];
      return [];
    },
    put: async (dbStore: string, value: { key: string }) => {
      store.records.set(`${dbStore}:${value.key}`, value);
    },
    add: async (dbStore: string, value: unknown) => {
      if (dbStore === 'questions') store.questions.push(value);
    },
    transaction: () => {
      throw new Error('このテストでは transaction は使わない想定');
    },
  }),
}));

/** fraction_add_sub の表示名 (PracticeSetupPage のチェックボックス検出に使う) */
const FRACTION_ADD_SUB_LABEL = getAllGenerators().find(
  (g) => g.type === 'fraction_add_sub',
)!.description;

/** 管理者設定を保存済み状態としてシードする */
function seedAdminScope(
  problemTypes: string[],
  difficultyRange: { min: number; max: number },
) {
  store.records.set('settings:admin-practice-scope-v1', {
    key: 'admin-practice-scope-v1',
    problemTypes,
    difficultyRange,
  });
}

/** 現在表示中の出題問題のカテゴリ・難易度ラベルを取得する */
function currentQuizMeta(): { category: string; difficulty: string } {
  return {
    category: document.querySelector('.quiz-category')!.textContent!.trim(),
    difficulty: document.querySelector('.quiz-difficulty')!.textContent!.trim(),
  };
}

beforeEach(() => {
  store.records.clear();
  store.questions.length = 0;
});

afterEach(() => {
  cleanup();
});

describe('管理者設定 → 出題のデータ経路 (UIフロー全体)', () => {
  it('管理者画面で単元96項目から選択し難易度範囲を保存すると、出題がその範囲に限定される', async () => {
    render(<App maintenanceMode={false} />);

    // 初期状態: 設定なし
    expect(await screen.findByText('出題範囲：0種類')).toBeTruthy();

    // 管理者タブ → パスワード認証 → 出題設定画面
    fireEvent.click(screen.getByRole('button', { name: '管理者タブ' }));
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: '0326' } });
    fireEvent.click(screen.getByRole('button', { name: '確認する' }));
    expect(await screen.findByText('管理者タブ：出題設定')).toBeTruthy();

    // 全単元 (96項目) が個別に選択できるチェックボックスとして一覧表示される
    const checkboxes = document.querySelectorAll(
      '.category-buttons input[type="checkbox"]',
    );
    expect(checkboxes.length).toBe(96);

    // 全て解除 → fraction_add_sub のみ選択
    fireEvent.click(screen.getByRole('button', { name: '全て解除' }));
    fireEvent.click(screen.getByLabelText(FRACTION_ADD_SUB_LABEL));

    // 難易度の下限/上限を設定
    fireEvent.change(screen.getByLabelText('出題難易度の下限'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('出題難易度の上限'), {
      target: { value: '3' },
    });

    // 保存 → ホームへ戻り、保存状態が表示される
    fireEvent.click(screen.getByRole('button', { name: '出題範囲を保存' }));
    expect(await screen.findByText('出題範囲：1種類')).toBeTruthy();
    expect(screen.getByText('出題難易度：Lv2〜Lv3')).toBeTruthy();

    // IndexedDB (settings ストア) に選択状態が保存されていること
    expect(store.records.get('settings:admin-practice-scope-v1')).toEqual({
      key: 'admin-practice-scope-v1',
      problemTypes: ['fraction_add_sub'],
      difficultyRange: { min: 2, max: 3 },
    });

    // 「問題を解く」→ 実際の出題が管理者設定どおりになる
    fireEvent.click(await screen.findByRole('button', { name: '問題を解く' }));
    expect(await screen.findByText('問題 1 / 10')).toBeTruthy();

    const meta = currentQuizMeta();
    expect(meta.category).toBe('分数'); // 選択した単元のみ
    expect(['ふつう', 'ややむずかしい']).toContain(meta.difficulty); // Lv2〜Lv3 のみ

    // 選択した単元の問題記録が出題処理で保存されていること (経路到達の証跡)
    expect(store.questions).toHaveLength(1);
    expect((store.questions[0] as { problemType: string }).problemType).toBe(
      'fraction_add_sub',
    );
  });

  it('保存済みの管理者設定 (複数単元・難易度固定) が全出題に適用される', async () => {
    seedAdminScope(['fraction_add_sub', 'integer_addition'], { min: 3, max: 3 });

    render(<App maintenanceMode={false} />);
    expect(await screen.findByText('出題範囲：2種類')).toBeTruthy();
    expect(screen.getByText('出題難易度：Lv3〜Lv3')).toBeTruthy();

    // 複数サイクルで出題し直し、毎回が選択範囲内であることを確認する
    const seenCategories = new Set<string>();
    for (let cycle = 0; cycle < 8; cycle++) {
      fireEvent.click(await screen.findByRole('button', { name: '問題を解く' }));
      expect(await screen.findByText('問題 1 / 10')).toBeTruthy();

      const meta = currentQuizMeta();
      expect(
        ['整数', '分数'],
        `サイクル${cycle}で範囲外カテゴリ: ${meta.category}`,
      ).toContain(meta.category);
      // 難易度範囲 Lv3〜Lv3 → 「ややむずかしい」以外は出ない
      expect(meta.difficulty).toBe('ややむずかしい');
      seenCategories.add(meta.category);

      // ホームへ戻る (次サイクル)
      fireEvent.click(screen.getByRole('button', { name: 'ホーム' }));
      expect(await screen.findByText('出題範囲：2種類')).toBeTruthy();
    }

    // 2単元が一様ランダムで選ばれること (片方だけに固定されない)
    expect(seenCategories.size).toBe(2);
  });
});

describe('条件に合う問題がない場合 (設定を緩めない)', () => {
  it('矛盾する絞り込み条件ではエラーを表示し、問題を出題しない', async () => {
    // fraction × 1年 の組み合わせは母集団0件
    const impossibleFilter = { category: 'fraction' as const, grade: 1 as const };
    render(
      <QuizPage
        difficulty={2}
        questionCount={10}
        studyMode={{ kind: 'filtered', filter: impossibleFilter }}
        filter={impossibleFilter}
        isAdminMode={false}
        canStartNormalSync={() => true}
        onExit={() => {}}
      />,
    );

    // 条件を緩めずにエラー表示 (問題カードは出ない)
    expect(
      await screen.findByText(/指定条件に出題できる問題がありません/),
    ).toBeTruthy();
    expect(document.querySelector('.question-text')).toBeNull();
    expect(document.querySelector('.quiz-category')).toBeNull();
  });
});

