import { useCallback, useEffect, useRef, useState } from 'react';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import HistoryPage from './pages/HistoryPage';
import DailyProgressNotification from './components/DailyProgressNotification';
import type { Category } from './types/problem';
import { REVIEW_QUESTION_COUNT } from './utils/weakAreas';
import { runDailyAnswerSync } from './services/dailyAnswerSync';
import MaintenancePage from './components/MaintenancePage';
import { isMaintenanceMode } from './utils/maintenanceMode';
import VerificationCodePage from './pages/VerificationCodePage';
import PracticeSetupPage from './pages/PracticeSetupPage';
import { getAdminPracticeTypes } from './storage/db';

type Page = 'home' | 'quiz' | 'history' | 'verification' | 'practiceSetup';

function NormalApp() {
  const [page, setPage] = useState<Page>('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(2);
  const [questionCount, setQuestionCount] = useState(10);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [savedProblemTypes, setSavedProblemTypes] = useState<string[] | null>(null);
  const [scopeLoadError, setScopeLoadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startLockRef = useRef(false);
  const pageRef = useRef(page);
  pageRef.current = page;
  const isLearningPage = page === 'home' || page === 'history' || page === 'quiz';
  const canStartDailySync = useCallback(
    () => ['home', 'history', 'quiz'].includes(pageRef.current),
    [],
  );

  useEffect(() => {
    if (page !== 'home') return;
    let cancelled = false;
    setScopeLoadError(null);
    void getAdminPracticeTypes()
      .then((problemTypes) => {
        if (!cancelled) setSavedProblemTypes(problemTypes);
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

  useEffect(() => {
    if (!isLearningPage || !canStartDailySync()) return;

    const sync = () => {
      if (canStartDailySync()) void runDailyAnswerSync(canStartDailySync);
    };

    sync();
    window.addEventListener('online', sync);
    const interval = window.setInterval(sync, 60 * 1000);

    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(interval);
    };
  }, [canStartDailySync, isLearningPage]);

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
      const problemTypes = await getAdminPracticeTypes();
      setSavedProblemTypes(problemTypes);
      setScopeLoadError(null);
      if (problemTypes.length === 0) {
        setStartError('出題範囲が空です。管理者タブで出題範囲を設定してください。');
        setPage('home');
        return;
      }

      setSelectedCategory(category);
      setSelectedDifficulty(difficulty);
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

  const startReview = (category: Category, difficulty: number) => {
    void startQuiz(difficulty, category, REVIEW_QUESTION_COUNT);
  };

  return (
    <div className="app">
      {isLearningPage && <DailyProgressNotification />}
      <header className="app-header">
        <h1 className="app-title">小6数学トレーニング</h1>
        {isLearningPage && (
          <nav className="app-nav">
            <button
              className={`nav-button ${page === 'home' ? 'active' : ''}`}
              onClick={() => setPage('home')}
            >
              ホーム
            </button>
            <button
              className={`nav-button ${page === 'history' ? 'active' : ''}`}
              onClick={() => setPage('history')}
            >
              学習履歴
            </button>
          </nav>
        )}
      </header>

      <main className="app-main">
        {page === 'home' && (
          <HomePage
            onStartQuiz={(difficulty) => void startQuiz(difficulty)}
            onShowHistory={() => setPage('history')}
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
          />
        )}
        {page === 'quiz' && (
          <QuizPage
            category={selectedCategory}
            difficulty={selectedDifficulty}
            questionCount={questionCount}
            problemTypes={savedProblemTypes ?? []}
            canStartDailySync={canStartDailySync}
            onExit={() => setPage('home')}
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
            onSaved={(problemTypes) => {
              setSavedProblemTypes(problemTypes);
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
