import { useState } from 'react';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import HistoryPage from './pages/HistoryPage';
import DailyProgressNotification from './components/DailyProgressNotification';
import type { Category } from './types/problem';
import { REVIEW_QUESTION_COUNT } from './utils/weakAreas';

type Page = 'home' | 'quiz' | 'history';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(2);
  const [questionCount, setQuestionCount] = useState(10);

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