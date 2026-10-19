/**
 * ホーム画面 (管理者出題範囲による学習)
 *
 * 方針:
 * - すべての学習で管理者が設定した出題範囲 (problemTypes / difficultyRange) を使用する。
 * - 「通常モード」は存在しない。分野別・適応難易度・苦手復習などの通常モードは廃止。
 * - 管理者認証後、PracticeSetupPage で出題範囲を設定し、「問題を解く」で学習を始める。
 * - 出題範囲が未設定または空の場合は、エラーを表示して学習を開始できない。
 */

import type { DifficultyRange } from '../types/problem';


interface HomePageProps {
  /** 学習履歴へ移動 */
  onShowHistory: () => void;
  /** 保存済みの出題範囲に従って学習を始める (引数なし: 管理者設定の難易度範囲を使用) */
  onStartQuiz: () => void;
  /** 管理者タブ (認証) を開く */
  onOpenVerification: () => void;
  /** 管理者タブ (設定済み) を開く */
  onOpenPracticeSetup: () => void;
  /** 管理者タブを閉じる */
  onCloseAdminSettings: () => void;
  /** 管理者タブが認証済みかどうか */
  isAdminAuthenticated: boolean;
  /** 保存済みの問題タイプ数 (null = 読み込み中) */
  savedProblemTypeCount: number | null;
  /** 保存済みの難易度範囲 (null = 読み込み中) */
  savedDifficultyRange: DifficultyRange | null;
  /** 出題範囲の読み込みエラー */
  scopeLoadError: string | null;
  /** 学習開始時のエラー */
  startError: string | null;
  /** 学習開始処理中かどうか */
  isStarting: boolean;
}

export default function HomePage({
  onShowHistory,
  onStartQuiz,
  onOpenVerification,
  onOpenPracticeSetup,
  onCloseAdminSettings,
  isAdminAuthenticated,
  savedProblemTypeCount,
  savedDifficultyRange,
  scopeLoadError,
  startError,
  isStarting,
}: HomePageProps) {
  return (
    <div className="home-page">
      <section className="hero-section">
        <h2>ようこそ！</h2>
        <p>管理者が設定した出題範囲から問題を出題します。</p>
        <p>「問題を解く」で学習を始めましょう。</p>
      </section>

      {/* 保存済みの出題範囲と共有出題エントリ */}
      <section className="settings-section">
        <h3>出題範囲</h3>
        <p aria-live="polite">
          {savedProblemTypeCount === null
            ? '保存済みの出題範囲を確認しています...'
            : `出題範囲：${savedProblemTypeCount}種類`}
        </p>
        {savedDifficultyRange && (
          <p aria-live="polite">
            出題難易度：Lv{savedDifficultyRange.min}〜Lv{savedDifficultyRange.max}
          </p>
        )}
        {savedProblemTypeCount === 0 && (
          <p className="error-message" role="status">
            出題範囲が設定されていません。管理者タブで出題範囲を設定してください。
          </p>
        )}
        {scopeLoadError && (
          <p className="error-message" role="status">{scopeLoadError}</p>
        )}
        {startError && <p className="error-message" role="alert">{startError}</p>}
      </section>

      <div className="action-buttons">
        <button
          className="primary-button start-button"
          disabled={isStarting || savedProblemTypeCount === 0}
          onClick={() => onStartQuiz()}
        >
          {isStarting ? '設定を読み込んでいます...' : '問題を解く'}
        </button>
        {isAdminAuthenticated ? (
          <>
            <button className="secondary-button" onClick={onOpenPracticeSetup}>
              管理者タブ（出題設定）
            </button>
            <button className="secondary-button" onClick={onCloseAdminSettings}>
              管理者タブを閉じる
            </button>
          </>
        ) : (
          <>
            <button className="secondary-button" onClick={onOpenVerification}>
              管理者タブ
            </button>
            <button className="secondary-button" onClick={onShowHistory}>
              学習履歴を見る
            </button>
          </>
        )}
      </div>
    </div>
  );
}
