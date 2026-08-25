import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, Problem } from '../types/problem';
import { QuestionSelector } from '../engine/selector/questionSelector';
import { checkUserAnswer, formatAnswer } from '../utils/answer';
import { difficultyLabel } from '../engine/difficulty/difficulty';
import { categoryLabel } from '../utils/stats';
import {
  saveAnswerRecord,
  saveQuestionHistory,
  getAllAnswerRecords,
  getAllQuestionHistory,
} from '../storage/db';
import type { AnswerRecord, QuestionHistory } from '../types/history';
import AnswerInput from '../components/AnswerInput';
import SolutionDisplay from '../components/SolutionDisplay';
import { ANSWER_RECORDED_EVENT } from '../utils/dailyCount';

interface QuizPageProps {
  category: Category | null;
  difficulty: number;
  onExit: () => void;
}

interface QuizResult {
  totalCount: number;
  correctCount: number;
  totalTimeSec: number;
}

export default function QuizPage({ category, difficulty, onExit }: QuizPageProps) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectorRef = useRef<QuestionSelector | null>(null);
  const startTimeRef = useRef<number>(0);
  const historyRef = useRef<AnswerRecord[]>([]);
  const questionHistoryRef = useRef<QuestionHistory[]>([]);
  const resultRef = useRef<QuizResult>({ totalCount: 0, correctCount: 0, totalTimeSec: 0 });

  // 初期化
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [history, questionHistory] = await Promise.all([
          getAllAnswerRecords(),
          getAllQuestionHistory(),
        ]);
        if (cancelled) return;
        historyRef.current = history;
        questionHistoryRef.current = questionHistory;
        selectorRef.current = new QuestionSelector();
        loadNextQuestion();
      } catch {
        if (!cancelled) {
          setError('データの読み込みに失敗しました。');
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 次の問題を読み込む
   */
  const loadNextQuestion = useCallback(() => {
    if (!selectorRef.current) return;

    const nextProblem = selectorRef.current.selectNextQuestion(
      historyRef.current,
      questionHistoryRef.current,
      {
        difficultyLevel: difficulty,
        category,
      },
    );

    setProblem(nextProblem);
    setIsAnswered(false);
    setIsCorrect(false);
    setShowSolution(false);
    startTimeRef.current = Date.now();

    // 出題履歴に記録
    const record: QuestionHistory = {
      problemId: nextProblem.id,
      problemType: nextProblem.type,
      parameters: nextProblem.parameters,
      askedAt: new Date().toISOString(),
    };
    questionHistoryRef.current.push(record);
    void saveQuestionHistory(record);
  }, [category, difficulty]);

  /**
   * 回答を判定する
   * answerOverride が指定された場合はその値を使用する (Enterキー送信時の最新値)
   */
  const handleSubmit = useCallback(
    (rawAnswer: string) => {
      if (!problem || isAnswered) return;

      // 空回答は判定しない (AnswerInput 側でもバリデーション済み)
      if (rawAnswer.trim() === '') return;

      // 判定には正規化された値を使用する
      const correct = checkUserAnswer(rawAnswer, problem.answer);
      const answerTimeSec = (Date.now() - startTimeRef.current) / 1000;

      setIsCorrect(correct);
      setIsAnswered(true);

      // 履歴を更新
      // userAnswer にはユーザーが実際に入力した元の値を保存する
      const record: AnswerRecord = {
        problemId: problem.id,
        problemType: problem.type,
        category: problem.category,
        isCorrect: correct,
        answerTimeSec,
        answeredAt: new Date().toISOString(),
        difficultyLevel: problem.difficulty.level,
        question: problem.question,
        userAnswer: rawAnswer,
        correctAnswer: formatAnswer(problem.answer),
      };
      historyRef.current.push(record);
      void saveAnswerRecord(record);

      // 日次カウント更新イベントを発火
      window.dispatchEvent(new Event(ANSWER_RECORDED_EVENT));

      // 結果を更新
      resultRef.current = {
        totalCount: resultRef.current.totalCount + 1,
        correctCount: resultRef.current.correctCount + (correct ? 1 : 0),
        totalTimeSec: resultRef.current.totalTimeSec + answerTimeSec,
      };
    },
    [problem, isAnswered],
  );

  /**
   * 次の問題へ進む
   */
  const handleNext = useCallback(() => {
    if (questionNumber >= 10) {
      setResult(resultRef.current);
    } else {
      setQuestionNumber((n) => n + 1);
      loadNextQuestion();
    }
  }, [questionNumber, loadNextQuestion]);

  /**
   * もう一度挑戦する
   */
  const handleRetry = useCallback(() => {
    resultRef.current = { totalCount: 0, correctCount: 0, totalTimeSec: 0 };
    setQuestionNumber(1);
    setResult(null);
    loadNextQuestion();
  }, [loadNextQuestion]);

  if (error) {
    return (
      <div className="quiz-page">
        <div className="error-message">{error}</div>
        <button className="primary-button" onClick={onExit}>
          ホームに戻る
        </button>
      </div>
    );
  }

  // 結果表示
  if (result) {
    const accuracyRate = result.totalCount > 0 ? result.correctCount / result.totalCount : 0;
    const averageTime = result.totalCount > 0 ? result.totalTimeSec / result.totalCount : 0;

    return (
      <div className="quiz-page result-page">
        <h2>けっか</h2>
        <div className="result-card">
          <div className="result-score">
            <span className="result-number">{result.correctCount}</span>
            <span className="result-divider">/</span>
            <span className="result-number">{result.totalCount}</span>
            <span className="result-unit">問 せいかい</span>
          </div>
          <div className="result-stats">
            <div className="result-stat">
              <span className="stat-label">正答率</span>
              <span className="stat-value">{Math.round(accuracyRate * 100)}%</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">平均解答時間</span>
              <span className="stat-value">{Math.round(averageTime)}秒</span>
            </div>
          </div>
        </div>
        <div className="action-buttons">
          <button className="primary-button" onClick={handleRetry}>
            もういちど
          </button>
          <button className="secondary-button" onClick={onExit}>
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="quiz-page">
        <div className="loading-message">問題を準備しています...</div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <div className="quiz-progress">
          問題 {questionNumber} / 10
        </div>
        <div className="quiz-meta">
          <span className="quiz-category">{categoryLabel(problem.category)}</span>
          <span className="quiz-difficulty">
            {difficultyLabel(problem.difficulty.level)}
          </span>
        </div>
      </div>

      <div className="question-card">
        <p className="question-text">{problem.question}</p>
      </div>

      {/* 問題タイプに応じた専用入力UI (OSキーボードを表示しない) */}
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

          {/* 解き方 (途中式) — 答えを開示したときだけ表示する */}
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

          <button className="primary-button next-button" onClick={handleNext}>
            {questionNumber >= 10 ? 'けっかをみる' : 'つぎの問題へ'}
          </button>
        </div>
      )}
    </div>
  );
}
