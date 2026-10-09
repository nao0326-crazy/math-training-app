import { useEffect, useState } from 'react';
import type { DifficultyLevel, DifficultyRange } from '../types/problem';
import { difficultyLabel } from '../engine/difficulty/difficulty';

interface HomePageProps {
  onStartQuiz: (difficulty: number) => void;
  onShowHistory: () => void;
  onOpenVerification: () => void;
  onOpenPracticeSetup: () => void;
  onCloseAdminSettings: () => void;
  isAdminAuthenticated: boolean;
  savedProblemTypeCount: number | null;
  savedDifficultyRange: DifficultyRange | null;
  scopeLoadError: string | null;
  startError: string | null;
  isStarting: boolean;
}

const DIFFICULTIES: DifficultyLevel[] = [1, 2, 3, 4, 5];

export default function HomePage({
  onStartQuiz,
  onShowHistory,
  onOpenVerification,
  onOpenPracticeSetup,
  onCloseAdminSettings,
  isAdminAuthenticated,
  savedProblemTypeCount,
  savedDifficultyRange,
  scopeLoadError,
  startError,
  isStarting,
}: HomePageProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(2);

  useEffect(() => {
    if (!savedDifficultyRange) return;
    if (selectedDifficulty < savedDifficultyRange.min || selectedDifficulty > savedDifficultyRange.max) {
      setSelectedDifficulty(savedDifficultyRange.min);
    }
  }, [savedDifficultyRange, selectedDifficulty]);

  const selectableDifficulties = savedDifficultyRange
    ? DIFFICULTIES.filter(
        (level) => level >= savedDifficultyRange.min && level <= savedDifficultyRange.max,
      )
    : DIFFICULTIES;

  return (
    <div className="home-page">
      <section className="hero-section">
        <h2>ようこそ！</h2>
        <p>算数の問題をたくさんといて、じぶんの力をのばそう！</p>
      </section>

      <section className="settings-section">
        <h3>問題のむずかしさ</h3>
        <div className="difficulty-buttons">
          {selectableDifficulties.map((level) => (
            <button
              key={level}
              type="button"
              className={`difficulty-button ${selectedDifficulty === level ? 'selected' : ''}`}
              onClick={() => setSelectedDifficulty(level)}
            >
              {difficultyLabel(level)}
            </button>
          ))}
        </div>
        <p aria-live="polite">
          {savedProblemTypeCount === null
            ? '保存済みの出題範囲を確認しています...'
            : `出題範囲：${savedProblemTypeCount}種類`}
        </p>
        {savedDifficultyRange && (
          <p aria-live="polite">
            出題難易度：Lv{savedDifficultyRange.min}〜Lv{savedDifficultyRange.max}
          </p>
        )}
        {(savedProblemTypeCount === 0 || scopeLoadError) && (
          <p className="error-message" role="status">
            {scopeLoadError ?? '出題範囲が空です。管理者タブで範囲を設定してください。'}
          </p>
        )}
        {startError && <p className="error-message" role="alert">{startError}</p>}
      </section>

      <div className="action-buttons">
        <button
          className="primary-button start-button"
          disabled={isStarting}
          onClick={() => onStartQuiz(selectedDifficulty)}
        >
          {isStarting ? '設定を読み込んでいます...' : '問題を解く'}
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
