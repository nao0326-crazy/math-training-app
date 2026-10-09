import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, Problem } from '../types/problem';
import { NoWeakTargetError } from '../engine/selector/weakSelector';
import type { StudyMode } from '../engine/selector/types';
import type { QuestionFilter } from '../engine/selector/questionPool';
import { createQuizSelector, toDifficultyLevel } from './quizSelection';
import { formatAnswer, judgeUserAnswer, type AnswerJudgement } from '../utils/answer';
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
import FigureRenderer from '../components/FigureRenderer';
import SolutionDisplay from '../components/SolutionDisplay';
import { ANSWER_RECORDED_EVENT } from '../utils/dailyCount';
import {
  createDailyAnswerSubmissionId,
  runDailyAnswerSync,
} from '../services/dailyAnswerSync';
import { deriveMetadata, fingerprintProblem } from '../engine/diversity/metadata';

interface QuizPageProps {
  /**
   * 旧セレクター互換のカテゴリ指定。
   * 通常モードでは常に null (分野選択は管理者モードにのみ存在する)。
   */
  category: Category | null;
  /** 難易度。full-random / adaptive では選出条件に使われない ( adaptive は履歴から決まる。値は表示用ダミー) */
  difficulty: number;
  /** 出題する問題数 (省略時は10問。苦手分野の復習では5問) */
  questionCount?: number;
  /**
   * 学習モード。
   * - full-random : 通常モードの標準。全出題可能母集団からランダム
   * - filtered    : 管理者モード。filter で母集団を絞る
   * - weak        : WeakSelector (回答履歴から苦手 problemType x difficulty を抽出)
   * - random      : RandomSelector (指定難易度の全カテゴリ横断)
   * - category    : 旧 QuestionSelector
   */
  studyMode?: StudyMode;
  /** 管理者モード用の絞り込み条件 (通常モードでは null) */
  filter?: QuestionFilter | null;
  onExit: () => void;
}

interface QuizResult {
  totalCount: number;
  correctCount: number;
  totalTimeSec: number;
}

export default function QuizPage({
  category,
  difficulty,
  questionCount = 10,
  studyMode,
  filter = null,
  onExit,
}: QuizPageProps) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  /** 詳細判定結果 (数学的等価だが標準形でない回答などの区別用) */
  const [judgement, setJudgement] = useState<AnswerJudgement | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectorRef = useRef<ReturnType<typeof createQuizSelector> | null>(null);
  const startTimeRef = useRef<number>(0);
  /** 同一問題の回答確定を同一イベントループ内でも二重実行しない */
  const answerSubmitLockRef = useRef(false);
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
        selectorRef.current = createQuizSelector({ studyMode, category, difficulty, filter });
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

    const selector = selectorRef.current;
    const level = toDifficultyLevel(difficulty);
    let nextProblem: Problem;
    try {
      nextProblem = selector.selectNextQuestion(
        historyRef.current,
        questionHistoryRef.current,
        {
          mode: studyMode ?? { kind: 'full-random' },
          difficulty: level,
        },
      );
    } catch (e) {
      // 復習対象が0件 (履歴がない / 全問正解) の場合は画面を壊さず、
      // エラーメッセージを表示して安全に終了できるようにする。
      if (e instanceof NoWeakTargetError) {
        setError(e.message);
        return;
      }
      setError('問題の生成に失敗しました。');
      return;
    }

    setProblem(nextProblem);
    setIsAnswered(false);
    setIsCorrect(false);
    setJudgement(null);
    setShowSolution(false);
    startTimeRef.current = Date.now();
    answerSubmitLockRef.current = false;

    // 出題履歴に記録
    // metadata + fingerprint を添えておくと、次問の多様性制御・重複検出に使える
    const record: QuestionHistory = {
      problemId: nextProblem.id,
      problemType: nextProblem.type,
      parameters: nextProblem.parameters,
      askedAt: new Date().toISOString(),
      metadata: deriveMetadata(nextProblem),
      fingerprint: fingerprintProblem(nextProblem),
    };
    questionHistoryRef.current.push(record);
    void saveQuestionHistory(record);
    // 絞り込み (filter / category) はセレクター生成時 (初期化) に確定するため、
    // 毎問変わるのは difficulty と studyMode だけ。
  }, [difficulty, studyMode]);

  /**
   * 回答を判定する
   * answerOverride が指定された場合はその値を使用する (Enterキー送信時の最新値)
   */
  const handleSubmit = useCallback(
    (rawAnswer: string) => {
      if (!problem || isAnswered || answerSubmitLockRef.current) return;

      // 空回答は判定しない (AnswerInput 側でもバリデーション済み)
      if (rawAnswer.trim() === '') return;

      // state更新を待たない同一イベント内の二重送信も防ぐ
      answerSubmitLockRef.current = true;

      // 判定には正規化された値を使用する
      // judgeUserAnswer は数学的等価性と教育上の標準形を区別して判定する
      const result = judgeUserAnswer(rawAnswer, problem.answer);
      const correct = result.status === 'correct';
      const answerTimeSec = (Date.now() - startTimeRef.current) / 1000;

      setIsCorrect(correct);
      setJudgement(result);
      setIsAnswered(true);

      // 履歴を更新
      // userAnswer にはユーザーが実際に入力した元の値を保存する
      // equivalent-not-canonical (通分は合っているが最小公倍数でない) は不正解として記録する
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
        submissionId: createDailyAnswerSubmissionId(),
      };
      historyRef.current.push(record);
      void saveAnswerRecord(record).then(() => runDailyAnswerSync());

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
    // 終了判定は questionCount に従う (復習は5問・通常は10問)。
    // ハードコードの10だと復習モードで問題数が画面表示とずれる。
    if (questionNumber >= questionCount) {
      setResult(resultRef.current);
    } else {
      setQuestionNumber((n) => n + 1);
      loadNextQuestion();
    }
  }, [questionNumber, questionCount, loadNextQuestion]);

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
          問題 {questionNumber} / {questionCount}
        </div>
        <div className="quiz-meta">
          {studyMode?.kind === 'adaptive' && (
            <span className="quiz-area">分野: {studyMode.area}</span>
          )}
          <span className="quiz-category">{categoryLabel(problem.category)}</span>
          <span className="quiz-difficulty">
            {difficultyLabel(problem.difficulty.level)}
          </span>
        </div>
      </div>

      <div className="question-card">
        <p className="question-text">{problem.question}</p>
        {/* 図形は figure を持つ問題でのみ描画される (未設定なら何も描かない) */}
        <FigureRenderer spec={problem.figure} />
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
            {isCorrect
              ? '🎉 せいかい！'
              : judgement?.status === 'equivalent-not-canonical'
                ? '⭕ 計算は合っています！'
                : '❌ ざんねん...'}
          </div>
          {judgement?.status === 'equivalent-not-canonical' && (
            <div className="feedback-explanation">{judgement.message}</div>
          )}
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
            {questionNumber >= questionCount ? 'けっかをみる' : 'つぎの問題へ'}
          </button>
        </div>
      )}
    </div>
  );
}
