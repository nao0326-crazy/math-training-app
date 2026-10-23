/**
 * 管理者専用: 全問題タイプ手動検証モード
 */
import { useCallback, useMemo, useState } from 'react';
import type { Problem, DifficultyLevel } from '../types/problem';
import { getAllGenerators } from '../engine/selector/generatorRegistry';
import { generateProblem } from '../engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../engine/diversity/metadata';
import { formatAnswer, judgeUserAnswer } from '../utils/answer';
import { categoryLabel } from '../utils/stats';
import AnswerInput from '../components/AnswerInput';
import FigureRenderer from '../components/FigureRenderer';
import ImageRenderer from '../components/ImageRenderer';
import SolutionDisplay from '../components/SolutionDisplay';
import ScratchPad from '../components/ScratchPad';
import { createScratchAttemptId } from '../types/scratch';

interface VerificationEntry {
  type: string;
  description: string;
  category: string;
  supportedLevels: number[];
}

interface AdminVerificationPageProps {
  onExit: () => void;
}

const STORAGE_KEY = 'adminVerificationIndex';

function pickLevel(levels: number[]): number {
  const sorted = [...levels].sort((a, b) => a - b);
  if (sorted.includes(2)) return 2;
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0] ?? 1;
}

export default function AdminVerificationPage({ onExit }: AdminVerificationPageProps) {
  const entries = useMemo<VerificationEntry[]>(() => {
    return getAllGenerators()
      .filter((generator) => getTypeSupportedLevels(generator.type).length > 0)
      .map((generator) => ({
        type: generator.type,
        description: generator.description,
        category: generator.category,
        supportedLevels: [...getTypeSupportedLevels(generator.type)],
      }));
  }, []);

  const total = entries.length;

  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(n) && n >= 0 && n < total) return n;
    } catch {
      /* ignore */
    }
    return 0;
  });

  const [problem, setProblem] = useState<Problem | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [attemptId, setAttemptId] = useState<string>(() => createScratchAttemptId());
  const [failures, setFailures] = useState<{ type: string; reason: string }[]>([]);

  const loadIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(total - 1, i));
      setIndex(clamped);
      try {
        window.localStorage.setItem(STORAGE_KEY, String(clamped));
      } catch {
        /* ignore */
      }
      setIsAnswered(false);
      setIsCorrect(false);
      setShowSolution(false);
      setAttemptId(createScratchAttemptId());
      const entry = entries[clamped];
      try {
        const level = pickLevel(entry.supportedLevels);
        const next = generateProblem({ type: entry.type, difficulty: level as DifficultyLevel });
        setProblem(next);
        setGenError(null);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        setProblem(null);
        setGenError(reason);
        setFailures((prev) => {
          if (prev.some((f) => f.type === entry.type)) {
            return prev.map((f) => (f.type === entry.type ? { ...f, reason } : f));
          }
          return [...prev, { type: entry.type, reason }];
        });
      }
    },
    [entries, total],
  );

  const handleStart = useCallback(() => {
    setStarted(true);
    loadIndex(index);
  }, [index, loadIndex]);

  const handlePrev = useCallback(() => {
    if (index > 0) loadIndex(index - 1);
  }, [index, loadIndex]);

  const handleNext = useCallback(() => {
    if (index < total - 1) loadIndex(index + 1);
  }, [index, total, loadIndex]);

  const handleRegenerate = useCallback(() => {
    loadIndex(index);
  }, [index, loadIndex]);

  const handleEnd = useCallback(() => {
    onExit();
  }, [onExit]);

  const handleSubmit = useCallback(
    (rawAnswer: string) => {
      if (!problem || isAnswered) return;
      const result = judgeUserAnswer(rawAnswer, problem.answer);
      const correct = result.status === 'correct';
      setIsCorrect(correct);
      setIsAnswered(true);
    },
    [problem, isAnswered],
  );

  if (!started) {
    return (
      <div className="quiz-page">
        <section className="settings-section">
          <h2>全問題タイプ手動検証モード</h2>
          <p>登録されている全問題タイプを 1 タイプ 1 問ずつ出題します。</p>
          <p aria-live="polite">検証対象：{total}種類</p>
          {index > 0 && (
            <p aria-live="polite">
              前回の続き：{index + 1} / {total}
            </p>
          )}
        </section>
        <div className="action-buttons">
          <button className="primary-button" type="button" onClick={handleStart}>
            開始
          </button>
          <button className="secondary-button" type="button" onClick={handleEnd}>
            終了
          </button>
        </div>
      </div>
    );
  }

  const entry = entries[index];
  const percent = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <div className="quiz-admin-mode">検証モード</div>
        <div className="quiz-progress">
          問題 {index + 1} / {total} ({percent}%)
        </div>
        <div className="quiz-meta">
          <span className="quiz-category">{categoryLabel(entry.category)}</span>
          <span className="quiz-difficulty">{entry.description}</span>
        </div>
        <div className="quiz-meta">
          <span className="quiz-type">{entry.type}</span>
        </div>
      </div>

      {genError && (
        <div className="error-message" role="alert">
          生成失敗 ({entry.type}): {genError}
        </div>
      )}

      {problem && !genError && (
        <>
          {!isAnswered && (
            <div className="question-card">
              <p className="question-text">{problem.question}</p>
              <FigureRenderer spec={problem.figure} />
              <ImageRenderer spec={problem.image} />
            </div>
          )}

          {!isAnswered && (
            <div className="scratch-section">
              <ScratchPad
                key={attemptId}
                disabled={false}
                meta={{
                  attemptId,
                  problemId: problem.id,
                  problemType: problem.type,
                  category: problem.category,
                  question: problem.question,
                }}
              />
            </div>
          )}

          {!isAnswered && (
            <div className="answer-section">
              <AnswerInput
                key={problem.id}
                problem={problem}
                disabled={isAnswered}
                onSubmit={(value) => handleSubmit(value)}
              />
            </div>
          )}

          {isAnswered && (
            <div className={`feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
              <div className="feedback-title">
                {isCorrect ? '🎉 せいかい！' : '❌ ざんねん...'}
              </div>
              {!isCorrect && (
                <div className="feedback-answer">
                  正解は <strong>{formatAnswer(problem.answer)}</strong> です
                </div>
              )}
              {problem.explanation && (
                <div className="feedback-explanation">{problem.explanation}</div>
              )}
              {!isCorrect && (
                <SolutionDisplay
                  solutionSteps={problem.solutionSteps}
                  answer={problem.answer}
                />
              )}
              {isCorrect && !showSolution && (
                <button
                  type="button"
                  className="secondary-button toggle-solution-btn"
                  onClick={() => setShowSolution(true)}
                >
                  答えと解き方をみる
                </button>
              )}
              {isCorrect && showSolution && (
                <SolutionDisplay
                  solutionSteps={problem.solutionSteps}
                  answer={problem.answer}
                />
              )}
              <button
                className="primary-button next-button"
                type="button"
                onClick={index < total - 1 ? handleNext : handleEnd}
              >
                {index < total - 1 ? 'つぎの問題へ' : '終了'}
              </button>
            </div>
          )}
        </>
      )}

      <div className="action-buttons">
        <button
          className="secondary-button"
          type="button"
          disabled={index === 0}
          onClick={handlePrev}
        >
          前へ
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={handleRegenerate}
        >
          再生成
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={index >= total - 1}
          onClick={handleNext}
        >
          次へ
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={handleEnd}
        >
          終了
        </button>
      </div>

      {failures.length > 0 && (
        <section className="settings-section">
          <h3>生成失敗タイプ ({failures.length}件)</h3>
          <ul>
            {failures.map((f) => (
              <li key={f.type}>
                {f.type}: {f.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

