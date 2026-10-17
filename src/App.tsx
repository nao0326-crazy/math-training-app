import { useCallback, useEffect, useRef, useState } from 'react';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import HistoryPage from './pages/HistoryPage';
import DailyProgressNotification from './components/DailyProgressNotification';
import type { Category, DifficultyRange } from './types/problem';
import { REVIEW_QUESTION_COUNT } from './utils/weakAreas';
import { runDailyAnswerSync } from './services/dailyAnswerSync';
import MaintenancePage from './components/MaintenancePage';
import { isMaintenanceMode } from './utils/maintenanceMode';
import type { QuizSelection } from './pages/quizSelection';
import VerificationCodePage from './pages/VerificationCodePage';
import PracticeSetupPage from './pages/PracticeSetupPage';
import {
  DEFAULT_ADMIN_PRACTICE_DIFFICULTY_RANGE,
  getAdminPracticeConfiguration,
} from './storage/db';
import { getAvailableDifficultyLevels } from './engine/selector/questionSelector';

type Page = 'home' | 'quiz' | 'history' | 'verification' | 'practiceSetup';

function NormalApp() {
  const [page, setPage] = useState<Page>('home');
  const [questionCount, setQuestionCount] = useState(10);
  /** 出題条件 (共有出題では category / difficulty のみ使用) */
  const [selection, setSelection] = useState<QuizSelection>({
    studyMode: { kind: 'full-random' },
    category: null,
    difficulty: 2,
    filter: null,
  });
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [isAdminQuiz, setIsAdminQuiz] = useState(false);
  const isAdminQuizRef = useRef(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [savedProblemTypes, setSavedProblemTypes] = useState<string[] | null>(null);
  const [savedDifficultyRange, setSavedDifficultyRange] = useState<DifficultyRange | null>(null);
  const [scopeLoadError, setScopeLoadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startLockRef = useRef(false);
  const pageRef = useRef(page);
  pageRef.current = page;
  // 通常学習ページ判定: 同期と通知は通常モードのページ遷移中だけ動かす
  const isLearningPage = page === 'home' || page === 'history' || page === 'quiz';
  // 通常学習同期を新規開始してよいか: 通常学習ページ上にあり、かつ管理者演習ではない
  const canStartNormalSync = useCallback(
    () => ['home', 'history', 'quiz'].includes(pageRef.current) && !isAdminQuizRef.current,
    [],
  );

  const setAdminQuizMode = (enabled: boolean) => {
    isAdminQuizRef.current = enabled;
    setIsAdminQuiz(enabled);
  };

  const clearAdminMode = () => {
    setAdminQuizMode(false);
    setAdminUnlocked(false);
    setSelection({
      studyMode: { kind: 'full-random' },
      category: null,
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
    void getAdminPracticeConfiguration()
      .then((configuration) => {
        if (!cancelled) {
          setSavedProblemTypes(configuration.problemTypes);
          setSavedDifficultyRange(configuration.difficultyRange);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSavedProblemTypes(null);
          setSavedDifficultyRange(null);
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

  const returnToNormalMode = () => {
    clearAdminMode();
    setPage('home');
  };

  /**
   * 通常モードで学習を始める (分野指定つきの適応難易度)
   *
   * selection を明示的に adaptive に戻す。管理者モードで指定して開始した
   * 直後でも、分野を選ぶと通常モードの分野別学習に戻る
   * (管理者の絞り込みが残り続けない)。
   */
  const startAreaQuiz = (area: string) => {
    setAdminQuizMode(false);
    setAdminUnlocked(false);
    setSelection({
      studyMode: { kind: 'adaptive', area },
      category: null,
      difficulty: 2,
      filter: null,
    });
    setQuestionCount(10);
    setPage('quiz');
  };

  /** 管理者モードから指定条件つきで学習を始める */
  const startAdminQuiz = (next: QuizSelection) => {
    setSelection(next);
    setQuestionCount(10);
    setAdminQuizMode(true);
    setPage('quiz');
  };

  /**
   * 共有出題 (問題を解く): 保存済みの出題範囲を検証してから開始する
   *
   * selection に studyMode がない共有出題では、QuizPage 内で
   * QuestionSelector が保存済み範囲 (problemTypes / difficultyRange) に
   * 従って問題を選ぶ。
   */
  const startQuiz = async (
    difficulty: number,
    category: Category | null = null,
    count = 10,
  ) => {
    if (startLockRef.current) return;
    startLockRef.current = true;
    setIsStarting(true);
    setStartError(null);
    try {
      const configuration = await getAdminPracticeConfiguration();
      const { problemTypes, difficultyRange } = configuration;
      setSavedProblemTypes(problemTypes);
      setSavedDifficultyRange(difficultyRange);
      setScopeLoadError(null);
      if (problemTypes.length === 0) {
        setStartError('出題範囲が空です。管理者タブで出題範囲を設定してください。');
        setPage('home');
        return;
      }
      if (getAvailableDifficultyLevels(problemTypes, difficultyRange, category).length === 0) {
        setStartError(
          `設定範囲（Lv${difficultyRange.min}〜Lv${difficultyRange.max}）で出題できる問題がありません。管理者タブで難易度範囲を見直してください。`,
        );
        setPage('home');
        return;
      }

      // 共有出題では selection に studyMode を持たせず、
      // category / difficulty と保存済み範囲だけで QuizPage を開始する。
      setAdminQuizMode(false);
      setSelection({ studyMode: undefined, category, difficulty, filter: null });
      setQuestionCount(count);
      setPage('quiz');
    } catch {
      setSavedProblemTypes(null);
      setSavedDifficultyRange(null);
      setStartError('保存済みの出題設定を読み込めないため、学習を開始できません。');
      setPage('home');
    } finally {
      startLockRef.current = false;
      setIsStarting(false);
    }
  };

  /**
   * 学習履歴ページから苦手復習を開始する
   *
   * weak モードで開始する。WeakSelector は復習対象の
   * problemType x difficulty を回答履歴から決めるため、
   * QuestionSelector に Fallback しない。
   */
  const startReview = (_category: Category, difficulty: number) => {
    setAdminQuizMode(false);
    setAdminUnlocked(false);
    setSelection({ studyMode: { kind: 'weak', types: [] }, category: null, difficulty, filter: null });
    setQuestionCount(REVIEW_QUESTION_COUNT);
    setPage('quiz');
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
          </nav>
        )}
      </header>

      <main className="app-main">
        {page === 'home' && (
          <HomePage
            onStartArea={startAreaQuiz}
            onShowHistory={() => {
              clearAdminMode();
              setPage('history');
            }}
            adminUnlocked={adminUnlocked}
            onAdminUnlockedChange={setAdminUnlocked}
            onStartAdminQuiz={startAdminQuiz}
            onStartQuiz={(difficulty) => void startQuiz(difficulty)}
            onOpenVerification={() => setPage('verification')}
            onOpenPracticeSetup={() => setPage('practiceSetup')}
            onCloseAdminSettings={() => {
              setIsAdminAuthenticated(false);
              setPage('home');
            }}
            isAdminAuthenticated={isAdminAuthenticated}
            savedProblemTypeCount={savedProblemTypes?.length ?? null}
            savedDifficultyRange={savedDifficultyRange}
            scopeLoadError={scopeLoadError}
            startError={startError}
            isStarting={isStarting}
          />
        )}
        {page === 'quiz' && (
          <QuizPage
            category={selection.category}
            difficulty={selection.difficulty}
            questionCount={questionCount}
            studyMode={selection.studyMode}
            filter={selection.filter}
            isAdminMode={isAdminQuiz}
            problemTypes={savedProblemTypes ?? []}
            difficultyRange={savedDifficultyRange ?? DEFAULT_ADMIN_PRACTICE_DIFFICULTY_RANGE}
            canStartNormalSync={canStartNormalSync}
            onExit={returnToNormalMode}
          />
        )}
        {page === 'history' && <HistoryPage onStartReview={startReview} />}
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
            onSaved={(problemTypes, difficultyRange) => {
              setSavedProblemTypes(problemTypes);
              setSavedDifficultyRange(difficultyRange);
              setStartError(null);
              setPage('home');
            }}
            onClose={() => {
              setIsAdminAuthenticated(false);
              setPage('home');
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
