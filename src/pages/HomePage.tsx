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

import { DAILY_GOAL } from '../utils/dailyCount';

interface DailyTabStatus {
  prevDay: { remaining: number; completed: boolean };
  today: { remaining: number; completed: boolean; locked: boolean };
  normal: { solved: number; goal: number; completed: boolean };
}

interface HomePageProps {
  // ... existing
  dailyStatus?: DailyTabStatus;
  onSelectDailyTab?: (tab: 'prevDay' | 'today' | 'normal') => void;
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
  speedGateCompleted?: boolean;
  /** 朝のハイスピード計算が利用可能か (6:00以降) */
  speedGateAvailable?: boolean;
  /** 朝のハイスピード計算画面を開く */
  onOpenSpeedGate?: () => void;
  /** 時間切れ後正解で獲得した報酬回数 */
  rewardCount?: number;
}

export default function HomePage({
  onShowHistory,
  onOpenVerification,
  onOpenPracticeSetup,
  onCloseAdminSettings,
  isAdminAuthenticated,
  savedProblemTypeCount,
  scopeLoadError,
  startError,
  isStarting,
  isSpeedGateRequired = false,
  dailyStatus,
  onSelectDailyTab,
  speedGateCompleted = false,
  speedGateAvailable = false,
  onOpenSpeedGate,
  rewardCount,
}: HomePageProps) {
  const normalSolved = dailyStatus?.normal.solved ?? 0;
  const normalGoal = dailyStatus?.normal.goal ?? DAILY_GOAL;
  const normalPercent = Math.min(100, Math.round((normalSolved / normalGoal) * 100));
  const todayLocked = dailyStatus?.today.locked ?? false;

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

      {/* 3つの大きな学習メニュー */}
      <section className="learning-menu-section" aria-label="学習メニュー">
        <div className="learning-menu-grid">
          <button
            type="button"
            className="learning-menu-card"
            onClick={() => onSelectDailyTab?.('prevDay')}
          >
            <span className="learning-menu-title">前日に間違えた問題</span>
            <span className="learning-menu-status">
              {dailyStatus?.prevDay.completed
                ? '完了'
                : `残り${dailyStatus?.prevDay.remaining ?? 0}種類`}
            </span>
            <span className="learning-menu-description">
              前日に間違えた問題を復習します。
            </span>
          </button>

          <button
            type="button"
            className="learning-menu-card"
            disabled={todayLocked}
            onClick={() => {
              if (!todayLocked) onSelectDailyTab?.('today');
            }}
          >
            <span className="learning-menu-title">今日間違えた問題</span>
            <span className="learning-menu-status">
              {todayLocked
                ? '110問完了後に解放'
                : dailyStatus?.today.completed
                  ? '完了'
                  : `残り${dailyStatus?.today.remaining ?? 0}種類`}
            </span>
            <span className="learning-menu-description">
              今日間違えた問題を克服します。
            </span>
          </button>

          <button
            type="button"
            className="learning-menu-card learning-menu-card-primary start-button"
            disabled={isStarting || savedProblemTypeCount === 0 || isSpeedGateRequired}
            onClick={() => onSelectDailyTab?.('normal')}
          >
            <span className="learning-menu-title">ノーマル110問</span>
            <span className="learning-menu-status">
              {`${normalSolved}/${normalGoal}`}
            </span>
            <div className="learning-menu-progress" aria-hidden="true">
              <div
                className="learning-menu-progress-bar"
                style={{ width: `${normalPercent}%` }}
              />
            </div>
            <span className="learning-menu-description">
              毎日の基本学習です。
            </span>
            <span className="learning-menu-action">
              {isStarting
                ? '設定を読み込んでいます...'
                : isSpeedGateRequired
                  ? '朝のハイスピード計算を先に完了してください'
                  : '問題を解く'}
            </span>
          </button>
          <button
            type="button"
            className="learning-menu-card"
            disabled={!speedGateAvailable}
            onClick={() => {
              if (speedGateAvailable) onOpenSpeedGate?.();
            }}
          >
            <span className="learning-menu-title">朝のハイスピード計算</span>
            <span className="learning-menu-status">
              {!speedGateAvailable
                ? '6:00から'
                : speedGateCompleted
                  ? '完了'
                  : '未完了'}
            </span>
            <span className="learning-menu-description">
              100問の計算でスピードと正確さを鍛えます。
            </span>
            <span className="learning-menu-action">
              {!speedGateAvailable
                ? '6:00以降に利用できます'
                : speedGateCompleted
                  ? '結果を見る'
                  : '計算を始める'}
            </span>
          </button>
        </div>
      </section>

      <p className="timeout-reward-status" role="status">
        時間切れ後正解の報酬: {rewardCount ?? 0}回分
      </p>

      <div className="action-buttons">
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
