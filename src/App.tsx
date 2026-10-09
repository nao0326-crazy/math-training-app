import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import HistoryPage from './pages/HistoryPage';
import DailyProgressNotification from './components/DailyProgressNotification';
import type { Category } from './types/problem';
import { REVIEW_QUESTION_COUNT } from './utils/weakAreas';
import { runDailyAnswerSync } from './services/dailyAnswerSync';
import MaintenancePage from './components/MaintenancePage';
import { isMaintenanceMode } from './utils/maintenanceMode';
import { isAdminUnlocked } from './utils/adminMode';
import type { QuizSelection } from './pages/quizSelection';

type Page = 'home' | 'quiz' | 'history';

function NormalApp() {
  const [page, setPage] = useState<Page>('home');
  // 通常モードは「分野 (adaptive)」の学習。開始時に分野を明示的に設定する。
  // 初期値 full-random は開始前の状態表示に使われるだけで、出題には使われない。
  const [selection, setSelection] = useState<QuizSelection>({
    studyMode: { kind: 'full-random' },
    category: null,
    difficulty: 2,
    filter: null,
  });
  const [questionCount, setQuestionCount] = useState(10);
  const [adminUnlocked, setAdminUnlocked] = useState(() => isAdminUnlocked());

  // 回答送信直後の同期を、Web の再接続・次回起動時にも補う。
  // Supabase 未設定時は既存 IndexedDB だけで動作する。
  useEffect(() => {
    const sync = () => {
      void runDailyAnswerSync();
    };

    sync();
    window.addEventListener('online', sync);
    const interval = window.setInterval(sync, 60 * 1000);

    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(interval);
    };
  }, []);

  /**
   * 通常モードで学習を始める (分野指定つきの適応難易度)
   *
   * selection を明示的に adaptive に戻す。管理者モードで指定して開始した
   * 直後でも、分野を選ぶと通常モードの分野別学習に戻る
   * (管理者の絞り込みが残り続けない)。
   */
  const startAreaQuiz = (area: string) => {
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
    setPage('quiz');
  };

  /**
   * 学習履歴ページから苦手復習を開始する
   *
   * weak モードで開始する。WeakSelector は復習対象の
   * problemType x difficulty を回答履歴から決めるため、
   * QuestionSelector に Fallback しない。
   */
  const startReview = (_category: Category, difficulty: number) => {
    setSelection({ studyMode: { kind: 'weak', types: [] }, category: null, difficulty, filter: null });
    setQuestionCount(REVIEW_QUESTION_COUNT);
    setPage('quiz');
  };

  return (
    <div className="app">
      <DailyProgressNotification />
      <header className="app-header">
        <h1 className="app-title">小6数学トレーニング</h1>
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
      </header>

      <main className="app-main">
        {page === 'home' && (
          <HomePage
            onStartArea={startAreaQuiz}
            onShowHistory={() => setPage('history')}
            adminUnlocked={adminUnlocked}
            onAdminUnlockedChange={setAdminUnlocked}
            onStartAdminQuiz={startAdminQuiz}
          />
        )}
        {page === 'quiz' && (
          <QuizPage
            category={selection.category}
            difficulty={selection.difficulty}
            questionCount={questionCount}
            studyMode={selection.studyMode}
            filter={selection.filter}
            onExit={() => setPage('home')}
          />
        )}
        {page === 'history' && <HistoryPage onStartReview={startReview} />}
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
