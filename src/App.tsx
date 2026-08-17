import { useState } from 'react';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import HistoryPage from './pages/HistoryPage';
import type { Category } from './types/problem';

type Page = 'home' | 'quiz' | 'history';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(2);

  const startQuiz = (category: Category | null, difficulty: number) => {
    setSelectedCategory(category);
    setSelectedDifficulty(difficulty);
    setPage('quiz');
  };

  return (
    <div className="app">
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
            onExit={() => setPage('home')}
          />
        )}
        {page === 'history' && <HistoryPage />}
      </main>
    </div>
  );
}