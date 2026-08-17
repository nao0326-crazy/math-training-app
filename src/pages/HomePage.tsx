import { useState } from 'react';
import type { Category } from '../types/problem';
import { difficultyLabel } from '../engine/difficulty/difficulty';

interface HomePageProps {
  onStartQuiz: (category: Category | null, difficulty: number) => void;
  onShowHistory: () => void;
}

const CATEGORIES: { value: Category | null; label: string; emoji: string }[] = [
  { value: null, label: 'すべて', emoji: '📚' },
  { value: 'integer', label: '整数', emoji: '🔢' },
  { value: 'numberTheory', label: '数の性質', emoji: '🧮' },
  { value: 'fraction', label: '分数', emoji: '🍕' },
  { value: 'decimal', label: '小数', emoji: '🔟' },
  { value: 'speed', label: '速さ', emoji: '🚗' },
  { value: 'geometry', label: '図形', emoji: '📐' },
  { value: 'ratio', label: '比・比例', emoji: '⚖️' },
  { value: 'expression', label: '文字と式', emoji: '🔤' },
  { value: 'combinatorics', label: '場合の数', emoji: '🔀' },
  { value: 'data', label: 'データ', emoji: '📊' },
];

const DIFFICULTIES = [1, 2, 3, 4, 5];

export default function HomePage({ onStartQuiz, onShowHistory }: HomePageProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(2);

  return (
    <div className="home-page">
      <section className="hero-section">
        <h2>ようこそ！</h2>
        <p>算数の問題をたくさんといて、じぶんの力をのばそう！</p>
      </section>

      <section className="settings-section">
        <h3>ぶんやをえらぶ</h3>
        <div className="category-buttons">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value ?? 'all'}
              className={`category-button ${selectedCategory === cat.value ? 'selected' : ''}`}
              onClick={() => setSelectedCategory(cat.value)}
            >
              <span className="category-emoji">{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>むずかしさをえらぶ</h3>
        <div className="difficulty-buttons">
          {DIFFICULTIES.map((level) => (
            <button
              key={level}
              className={`difficulty-button ${selectedDifficulty === level ? 'selected' : ''}`}
              onClick={() => setSelectedDifficulty(level)}
            >
              {difficultyLabel(level as 1 | 2 | 3 | 4 | 5)}
            </button>
          ))}
        </div>
      </section>

      <div className="action-buttons">
        <button
          className="primary-button start-button"
          onClick={() => onStartQuiz(selectedCategory, selectedDifficulty)}
        >
          学習をはじめる
        </button>
        <button className="secondary-button" onClick={onShowHistory}>
          学習履歴を見る
        </button>
      </div>
    </div>
  );
}