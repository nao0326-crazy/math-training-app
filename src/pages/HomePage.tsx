/**
 * ホーム画面 (管理者出題範囲 × 習熟度ベース出題)
 *
 * 方針:
 * - 出題範囲 (問題タイプ) は管理者が設定し、その範囲は常に尊重する。
 * - 出題レベルは手動選択を廃止し、学習履歴から推定した技能ごとの
 *   習熟レベルの一段上を自動で出題する (utils/mastery.ts)。
 * - 「通常モード」は存在しない。復習・苦手診断も同じ出題経路を通る。
 * - 出題範囲が未設定または空の場合は、エラーを表示して学習を開始できない。
 */

interface HomePageProps {
  /** 学習履歴へ移動 */
  onShowHistory: () => void;
  /** 保存済みの出題範囲に従って学習を始める (出題レベルは履歴から自動決定) */
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
  /** 出題範囲の読み込みエラー */
  scopeLoadError: string | null;
  /** 学習開始時のエラー */
  startError: string | null;
  /** 学習開始処理中かどうか */
  isStarting: boolean;
  /** ハイスピード計算ゲートが未完了で通常学習を開始できないか */
  isSpeedGateRequired?: boolean;
}

export default function HomePage({
  onShowHistory,
  onStartQuiz,
  onOpenVerification,
  onOpenPracticeSetup,
  onCloseAdminSettings,
  isAdminAuthenticated,
  savedProblemTypeCount,
  scopeLoadError,
  startError,
  isStarting,
  isSpeedGateRequired = false,
}: HomePageProps) {
  return (
    <div className="home-page">
      <section className="hero-section">
        <h2>ようこそ！</h2>
        <p>管理者が設定した出題範囲から問題を出題します。</p>
        <p>問題のレベルは学習履歴から自動で推定し、今の実力より一段階上の問題に挑戦します。</p>
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
          disabled={isStarting || savedProblemTypeCount === 0 || isSpeedGateRequired}
          onClick={() => onStartQuiz()}
        >
          {isStarting
            ? '設定を読み込んでいます...'
            : isSpeedGateRequired
              ? '朝のハイスピード計算を先に完了してください'
              : '問題を解く'}
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
