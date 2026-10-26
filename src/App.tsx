import { useCallback, useEffect, useRef, useState } from 'react';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import HistoryPage from './pages/HistoryPage';
import DailyProgressNotification from './components/DailyProgressNotification';
import type { Category } from './types/problem';
import { runDailyAnswerSync } from './services/dailyAnswerSync';
import { REVIEW_QUESTION_COUNT } from './utils/weakAreas';
import MaintenancePage from './components/MaintenancePage';
import { isMaintenanceMode } from './utils/maintenanceMode';
import type { QuizSelection } from './pages/quizSelection';
import VerificationCodePage from './pages/VerificationCodePage';
import PracticeSetupPage from './pages/PracticeSetupPage';
import AdminVerificationPage from './pages/AdminVerificationPage';
import { getAdminPracticeTypes } from './storage/db';
import SpeedGatePage from './pages/SpeedGatePage';
import GrowthPage from './pages/GrowthPage';
import { getSpeedGateDateKey, isSpeedGateRequiredAt } from './utils/speedGateTime';
import { DAILY_GOAL } from './utils/dailyCount';
import { getStudyDateKey, ANSWER_RECORDED_EVENT } from './utils/dailyCount';
import MistakePracticePage from './pages/MistakePracticePage';
import type { DailyLearningState } from './utils/dailyLearning';
import {
  createEmptyDailyState,
  rolloverDailyState,
} from './utils/dailyLearning';
import {
  loadDailyLearningState,
  saveDailyLearningState,
} from './storage/db';
import { isSpeedGateCompleted } from './storage/speedGate';

type Page = 'home' | 'quiz' | 'history' | 'verification' | 'practiceSetup' | 'adminVerification' | 'speedGate' | 'growth' | 'mistakePractice';

function NormalApp() {
  const [page, setPage] = useState<Page>('home');
  const [questionCount, setQuestionCount] = useState(10);
  /** 出題条件 (filtered = 管理者出題範囲による一様ランダム出題のみ) */
  const [selection, setSelection] = useState<QuizSelection>({
    studyMode: { kind: 'filtered', filter: {} },
    difficulty: 2,
    filter: null,
  });
  const [isAdminQuiz, setIsAdminQuiz] = useState(false);
  const isAdminQuizRef = useRef(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [savedProblemTypes, setSavedProblemTypes] = useState<string[] | null>(null);
  const [scopeLoadError, setScopeLoadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [speedGateCompleted, setSpeedGateCompleted] = useState(false);
  const speedGateCompletedRef = useRef(false);
  speedGateCompletedRef.current = speedGateCompleted;
  const [mistakePracticeKind, setMistakePracticeKind] = useState<'prevDay' | 'today'>('prevDay');
  const [dailyState, setDailyState] = useState<DailyLearningState | null>(null);
  const dailyStateRef = useRef<DailyLearningState | null>(null);
  dailyStateRef.current = dailyState;
  const [isStarting, setIsStarting] = useState(false);
  const startLockRef = useRef(false);
  const pageRef = useRef(page);
  pageRef.current = page;
  // 通常学習ページ判定: 同期と通知は通常モードのページ遷移中だけ動かす
  const isLearningPage = page === 'home' || page === 'history' || page === 'quiz' || page === 'growth';
  // 通常学習同期を新規開始してよいか: 通常学習ページ上にあり、かつ管理者演習ではない
  const canStartNormalSync = useCallback(
    () => ['home', 'history', 'quiz', 'growth'].includes(pageRef.current) && !isAdminQuizRef.current,
    [],
  );

  const setAdminQuizMode = (enabled: boolean) => {
    isAdminQuizRef.current = enabled;
    setIsAdminQuiz(enabled);
  };

  const clearAdminMode = () => {
    setAdminQuizMode(false);
    setSelection({
      studyMode: { kind: 'filtered', filter: {} },
      difficulty: 2,
      filter: null,
    });
    setQuestionCount(10);
  };

  // 共有出題で使う保存済みの出題範囲を読み込む (home 表示時)
  useEffect(() => {
    if (page !== 'home') return;
    let cancelled = false;
    setScopeLoadError(null);
    void getAdminPracticeTypes()
      .then((types) => {
        if (!cancelled) {
          setSavedProblemTypes(types);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSavedProblemTypes(null);
          setScopeLoadError('保存済みの出題設定を読み込めませんでした。');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  // 管理者演習・認証ページでは通常学習の同期キューに触れない。
  useEffect(() => {
    if (!isLearningPage || !canStartNormalSync()) return;

    // 回答送信直後の同期を、Web の再接続・次回起動時にも補う。
    // Supabase 未設定時は既存 IndexedDB だけで動作する。
    const sync = () => {
      if (canStartNormalSync()) void runDailyAnswerSync(canStartNormalSync);
    };

    sync();
    window.addEventListener('online', sync);
    const interval = window.setInterval(sync, 60 * 1000);

    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(interval);
    };
  }, [canStartNormalSync, isLearningPage, isAdminQuiz]);

  const refreshSpeedGateStatus = useCallback(async () => {
    if (!isSpeedGateRequiredAt()) {
      setSpeedGateCompleted(true);
      return;
    }
    try {
      const done = await isSpeedGateCompleted(getSpeedGateDateKey());
      setSpeedGateCompleted(done);
    } catch {
      setSpeedGateCompleted(false);
    }
  }, []);

  useEffect(() => {
    void refreshSpeedGateStatus();
    const interval = window.setInterval(() => void refreshSpeedGateStatus(), 1000);
    const onVisibility = () => void refreshSpeedGateStatus();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [refreshSpeedGateStatus]);

  useEffect(() => {
    if (isSpeedGateRequiredAt() && !speedGateCompletedRef.current && page === 'quiz') {
      setPage('speedGate');
    }
  }, [page, speedGateCompleted]);

  useEffect(() => {
    if (page !== 'home') return;
    let cancelled = false;
    void (async () => {
      const todayKey = getStudyDateKey();
      let s = await loadDailyLearningState();
      if (!s) s = createEmptyDailyState(todayKey);
      s = rolloverDailyState(s, todayKey);
      if (cancelled) return;
      setDailyState(s);
      await saveDailyLearningState(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);
  useEffect(() => {
    if (page !== 'quiz' || isAdminQuiz) return;
    const handler = () => {
      void (async () => {
        const todayKey = getStudyDateKey();
        const base = dailyStateRef.current
          ? rolloverDailyState(dailyStateRef.current, todayKey)
          : createEmptyDailyState(todayKey);
        const nextCount = Math.min(
          DAILY_GOAL,
          (base.normalSolvedCount ?? 0) + 1,
        );
        const next = { ...base, normalSolvedCount: nextCount };
        dailyStateRef.current = next;
        setDailyState(next);
        await saveDailyLearningState(next);
      })();
    };
    window.addEventListener(ANSWER_RECORDED_EVENT, handler);
    return () => window.removeEventListener(ANSWER_RECORDED_EVENT, handler);
  }, [page, isAdminQuiz]);

  const returnToNormalMode = () => {


    clearAdminMode();
    setPage('home');
  };

  const startMistakePractice = (kind: 'prevDay' | 'today') => {
    clearAdminMode();
    setMistakePracticeKind(kind);
    setPage('mistakePractice');
  };


  /**
   * 学習を始める (全学習共通): 保存済みの管理者出題範囲を厳密に適用する。
   *
   * 管理者が設定した problemTypes を filter に変換し、
   * FilteredSelector で出題する。出題レベルは難易度を手動指定する方式を
   * 廃止し、技能ごとの習熟度 (学習履歴から推定) の一段上が自動で選ばれる。
   * 復習 (reviewCategory 指定) も同じ出題範囲に「苦手カテゴリ」を追加絞り込み
   * するだけで、範囲外への緩和や履歴・苦手度による母集団の重み付けは行わない。
   * 出題範囲が空、または条件に一致する問題が0件の場合はエラーを表示する。
   */
  const startQuiz = async (count = 10, reviewCategory?: Category) => {
    if (startLockRef.current) return;
    startLockRef.current = true;
    setIsStarting(true);
    setStartError(null);
    try {
      if (isSpeedGateRequiredAt() && !(await isSpeedGateCompleted(getSpeedGateDateKey()))) {
        setPage('speedGate');
        return;
      }
      const problemTypes = await getAdminPracticeTypes();
      setSavedProblemTypes(problemTypes);
      setScopeLoadError(null);

      if (problemTypes.length === 0) {
        setStartError('出題範囲が設定されていません。管理者タブで出題範囲を設定してください。');
        setPage('home');
        return;
      }

      // 管理者設定を QuestionFilter に変換 (復習時は苦手カテゴリでも追加絞り込み)。
      // difficulty は filtered モードでは出題決定に使わない (型互換のための既定値)。
      const filter = {
        category: reviewCategory ?? null,
        types: problemTypes,
      };

      setAdminQuizMode(false);
      setSelection({
        studyMode: { kind: 'filtered', filter },
        difficulty: 2,
        filter,
      });
      setQuestionCount(count);
      setPage('quiz');
    } catch {
      setSavedProblemTypes(null);
      setStartError('保存済みの出題設定を読み込めないため、学習を開始できません。');
      setPage('home');
    } finally {
      startLockRef.current = false;
      setIsStarting(false);
    }
  };

  return (
    <div className="app">
      {isLearningPage && <DailyProgressNotification />}
      <header className="app-header">
        <h1 className="app-title">
          小6数学トレーニング <span className="app-version">v{__APP_VERSION__}</span>
        </h1>
        {isLearningPage && (
          <nav className="app-nav">
            <button
              className={`nav-button ${page === 'home' ? 'active' : ''}`}
              onClick={returnToNormalMode}
            >
              ホーム
            </button>
            <button
              className={`nav-button ${page === 'history' ? 'active' : ''}`}
              onClick={() => {
                clearAdminMode();
                setPage('history');
              }}
            >
              学習履歴
            </button>
            <button
              className={`nav-button ${page === 'growth' ? 'active' : ''}`}
              onClick={() => {
                clearAdminMode();
                setPage('growth');
              }}
            >
              成長記録
            </button>
          </nav>
        )}
      </header>

      <main className="app-main">
       {page === 'speedGate' && (
          <SpeedGatePage
            dateKey={getSpeedGateDateKey()}
            onExit={() => {
              void refreshSpeedGateStatus();
              setPage('home');
            }}
            onCompleted={() => {
              setSpeedGateCompleted(true);
              void refreshSpeedGateStatus();
              setPage('home');
            }}
          />
        )}
        {page === 'home' && isSpeedGateRequiredAt() && !speedGateCompleted && (
          <div className="speed-gate-gate-notice" role="status">
            <p>本日の朝のハイスピード計算が未完了です。通常学習を始める前に100問を完了してください。</p>
            <button className="primary-button" onClick={() => setPage('speedGate')}>
              朝のハイスピード計算を始める
            </button>
          </div>
        )}
        {page === 'home' && (
          <HomePage
            onShowHistory={() => {
              clearAdminMode();
              setPage('history');
            }}
            onStartQuiz={() => void startQuiz(DAILY_GOAL)}
            onOpenVerification={() => setPage('verification')}
            onOpenPracticeSetup={() => setPage('practiceSetup')}
            onCloseAdminSettings={() => {
              setIsAdminAuthenticated(false);
              setPage('home');
            }}
            isAdminAuthenticated={isAdminAuthenticated}
            savedProblemTypeCount={savedProblemTypes?.length ?? null}
            scopeLoadError={scopeLoadError}
            startError={startError}
            isStarting={isStarting}
            isSpeedGateRequired={isSpeedGateRequiredAt() && !speedGateCompleted}
            speedGateCompleted={speedGateCompleted}
            speedGateAvailable={isSpeedGateRequiredAt()}
            onOpenSpeedGate={() => setPage('speedGate')}
            rewardCount={dailyState?.timeoutRewardsEarned ?? 0}
            dailyStatus={{
              prevDay: { remaining: dailyState?.prevDayTypes.length ?? 0, completed: (dailyState?.prevDayTypes.length ?? 0) === 0 },
              today: { remaining: dailyState?.todayTypes.length ?? 0, completed: (dailyState?.todayTypes.length ?? 0) === 0, locked: !(dailyState?.normalCompletedDateKey === getStudyDateKey()) },
              normal: { solved: dailyState?.normalCompletedDateKey === getStudyDateKey() ? DAILY_GOAL : Math.min(DAILY_GOAL, dailyState?.normalSolvedCount ?? 0), goal: DAILY_GOAL, completed: dailyState?.normalCompletedDateKey === getStudyDateKey() },
            }}
            onSelectDailyTab={(tab) => {
              if (tab === 'normal') void startQuiz(DAILY_GOAL);
              else if (tab === 'prevDay') startMistakePractice('prevDay');
              else if (tab === 'today' && dailyState?.normalCompletedDateKey === getStudyDateKey()) startMistakePractice('today');
            }}

          />
        )}
        {page === 'quiz' && (
          <QuizPage
            difficulty={selection.difficulty}
            questionCount={questionCount}
            studyMode={selection.studyMode}
            filter={selection.filter}
            isAdminMode={isAdminQuiz}
            canStartNormalSync={canStartNormalSync}
            onExit={returnToNormalMode}
             onCompleted={() => {
               if (isAdminQuiz) return;
               void (async () => {
                 const todayKey = getStudyDateKey();
                 const s = dailyState ? rolloverDailyState(dailyState, todayKey) : createEmptyDailyState(todayKey);
                 s.normalCompletedDateKey = todayKey;
                 s.normalSolvedCount = DAILY_GOAL;
                 setDailyState(s);
                 await saveDailyLearningState(s);
               })();
             }}

          />
        )}
        {page === 'history' && (
          <HistoryPage
            onStartReview={(category) =>
              void startQuiz(REVIEW_QUESTION_COUNT, category)
            }
            isSpeedGateRequired={isSpeedGateRequiredAt() && !speedGateCompleted}
          />
        )}
        {page === 'growth' && <GrowthPage />}
        {page === 'mistakePractice' && (
          <MistakePracticePage
            practiceKind={mistakePracticeKind}
            onExit={() => {
              void (async () => {
                const todayKey = getStudyDateKey();
                const s = await loadDailyLearningState();
                if (s) {
                  const rolled = rolloverDailyState(s, todayKey);
                  setDailyState(rolled);
                  await saveDailyLearningState(rolled);
                }
              })();
              setPage('home');
            }}
          />
        )}

        {page === 'verification' && (
          <VerificationCodePage
            onVerified={() => {
              setIsAdminAuthenticated(true);
              setPage('practiceSetup');
            }}
            onBack={() => setPage('home')}
          />
        )}
        {page === 'practiceSetup' && (
          <PracticeSetupPage
            onSaved={(problemTypes) => {
              setSavedProblemTypes(problemTypes);
              setStartError(null);
              setPage('home');
            }}
            onClose={() => {
              setIsAdminAuthenticated(false);
              setPage('home');
            }}
            onOpenVerificationMode={() => setPage('adminVerification')}
          />
        )}
        {page === 'adminVerification' && (
          <AdminVerificationPage
            onExit={() => {
              setIsAdminAuthenticated(true);
              setPage('practiceSetup');
            }}
          />
        )}
      </main>
    </div>
  );
}

interface AppProps {
  /** テスト・Storybook等から表示モードを上書きするための公開フラグ */
  maintenanceMode?: boolean;
}

export default function App({ maintenanceMode = isMaintenanceMode() }: AppProps) {
  return maintenanceMode ? <MaintenancePage /> : <NormalApp />;
}
