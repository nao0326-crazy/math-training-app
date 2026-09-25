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

type Page = 'home' | 'quiz' | 'history';

function NormalApp() {
  const [page, setPage] = useState<Page>('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(2);
  const [questionCount, setQuestionCount] = useState(10);

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

  const startQuiz = (category: Category | null, difficulty: number) => {
    setSelectedCategory(category);
    setSelectedDifficulty(difficulty);
    setQuestionCount(10);
    setPage('quiz');
  };

  /**
   * 苦手分野の復習を開始する
   * 既存の問題生成システム (QuestionSelector) をそのまま使い、
   * 問題数だけ REVIEW_QUESTION_COUNT 問にする
   */
  const startReview = (category: Category, difficulty: number) => {
    setSelectedCategory(category);
    setSelectedDifficulty(difficulty);
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
            onStartQuiz={startQuiz}
            onShowHistory={() => setPage('history')}
          />
        )}
        {page === 'quiz' && (
          <QuizPage
            category={selectedCategory}
            difficulty={selectedDifficulty}
            questionCount={questionCount}
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
