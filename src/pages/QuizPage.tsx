import { useCallback, useEffect, useRef, useState } from 'react';
import type { Problem } from '../types/problem';
import { NoWeakTargetError } from '../engine/selector/weakSelector';
import { EmptyQuestionPoolError } from '../engine/selector/questionPool';
import type { StudyMode } from '../engine/selector/types';
import type { QuestionFilter } from '../engine/selector/questionPool';
import { createQuizSelector, toDifficultyLevel } from './quizSelection';
import { formatAnswer, judgeUserAnswer, type AnswerJudgement } from '../utils/answer';
import { getProblemInputType } from '../utils/inputType';
import { getTimeLimitSeconds, TIME_OUT_USER_ANSWER } from '../utils/quizTimer';
import { resolveTimeLimitSeconds } from '../utils/adaptiveTimeLimit';
import {
  applyOutcome,
  createSessionTally,
  toSessionCounts,
  type SessionCounts,
  type SessionTally,
} from '../utils/sessionTally';
import { difficultyLabel } from '../engine/difficulty/difficulty';
import { categoryLabel } from '../utils/stats';
import type { AnswerRecord, QuestionHistory } from '../types/history';
import AnswerInput from '../components/AnswerInput';
import FigureRenderer from '../components/FigureRenderer';
import ImageRenderer from '../components/ImageRenderer';
import SolutionDisplay from '../components/SolutionDisplay';
import QuizTimer from '../components/QuizTimer';
import { createDailyAnswerSubmissionId } from '../services/dailyAnswerSync';
import {
  loadQuizHistory,
  persistQuizAnswer,
  persistQuizQuestion,
} from '../services/quizPersistence';
import { deriveMetadata, fingerprintProblem } from '../engine/diversity/metadata';
import ScratchPad from '../components/ScratchPad';
import { createScratchAttemptId } from '../types/scratch';

interface QuizPageProps {
  /** 難易度 */
  difficulty: number;
  questionCount?: number;
  /** 学習モード (常に 'filtered') */
  studyMode: StudyMode;
  /** 絞り込み条件 (管理者が設定した出題範囲) */
  filter: QuestionFilter | null;
  /** 管理者演習かどうか。true の場合は通常学習データを読み書きしない */
  isAdminMode: boolean;
  /** モード切替後の遅延保存が同期を新規開始してよいかを動的に判定する */
  canStartNormalSync: () => boolean;
  onExit: () => void;
  /** セッション完了時のコールバック (任意) */
  onCompleted?: () => void;
}
const DEFAULT_LIMIT_SEC = getTimeLimitSeconds(null);
export default function QuizPage({
  difficulty,
  questionCount = 10,
  studyMode,
  filter = null,
  isAdminMode,
  canStartNormalSync,
  onExit,
  onCompleted,
}: QuizPageProps) {
  const [problem, setProblem] = useState<Problem | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV && problem) {
      (window as unknown as { __currentProblem?: Problem }).__currentProblem = problem;
    }
  }, [problem]);
  /**
   * 現在の問題の制限時間 (秒)。
   * 1 問ごとに loadNextQuestion 内で一度だけ決定し、
   * タイマー表示・時間切れ判定・履歴保存 (timeLimitSec) がすべて同じ値を使う。
   * 表示中に再レンダリングで再計算・変化させない。
   */
  const [limitSec, setLimitSec] = useState<number>(DEFAULT_LIMIT_SEC);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  /** 詳細判定結果 (数学的等価だが標準形でない回答などの区別用) */
  const [judgement, setJudgement] = useState<AnswerJudgement | null>(null);
  /** 時間切れで解答受付を打ち切ったか (通常の誤答と区別する) */
  const [timedOut, setTimedOut] = useState(false);
  /** 制限時間を超過したが、回答入力は継続可能 (時間切れ後解答モード) */
  const [expired, setExpired] = useState(false);
  /** 問題をスキップして次へ進む遷移中か (二重遷移防止・タイマー停止用) */
  const [isSkipped, setIsSkipped] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [result, setResult] = useState<SessionCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * 現在の出題インスタンスを識別するID (途中式ノートの保存単位)。
   * 出題のたびに新しく生成し、同じ問題を再解答しても過去の途中式と上書きし合わない。
   */
  const [attemptId, setAttemptId] = useState<string>(() => createScratchAttemptId());

    const selectorRef = useRef<ReturnType<typeof createQuizSelector> | null>(null);
  const startTimeRef = useRef<number>(0);
  /** 確定した制限時間の ref 値 (回答確定時の保存に使う。表示と同じ値) */
  const limitSecRef = useRef<number>(DEFAULT_LIMIT_SEC);
  /** 同一問題の回答確定を同一イベントループ内でも二重実行しない */
  const answerSubmitLockRef = useRef(false);
  const historyRef = useRef<AnswerRecord[]>([]);
  const questionHistoryRef = useRef<QuestionHistory[]>([]);
  const resultRef = useRef<SessionTally>(createSessionTally());

  // 初期化
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { answers: history, questions: questionHistory } = await loadQuizHistory(isAdminMode);
        if (cancelled) return;
        historyRef.current = history;
        questionHistoryRef.current = questionHistory;
        // すべての学習で管理者が設定した出題範囲 (filter) を厳密に適用する。
        selectorRef.current = createQuizSelector({ studyMode, difficulty, filter });
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
    let nextProblem: Problem;
    try {
      if (!selectorRef.current) return;
      // 出題範囲 (filter) 内から、技能ごとの習熟度にもとづく
      // 目標レベル (習熟 +1) で問題を選出する。
      nextProblem = selectorRef.current.selectNextQuestion(
        historyRef.current,
        questionHistoryRef.current,
        {
          mode: studyMode,
          difficulty: toDifficultyLevel(difficulty),
        },
      );
    } catch (e) {
      // 条件に一致する問題が0件の場合は、条件を緩和せずエラーを表示する。
      if (e instanceof EmptyQuestionPoolError) {
        setError(e.message);
        return;
      }
      // 復習対象が0件 (履歴がない / 全問正解) の場合は画面を壊さず、
      // エラーメッセージを表示して安全に終了できるようにする。
      if (e instanceof NoWeakTargetError) {
        setError(e.message);
        return;
      }
      if (e instanceof Error) {
        setError(e.message);
        return;
      }
      setError('問題の生成に失敗しました。');
      return;
    }
    // 1 問ごとの制限時間をここで一度だけ決定する (適応型。記録不足時は現行の初期時間)。
    // タイマー表示・時間切れ判定・履歴保存はすべてこの値を使う。
    // setProblem より先に設定し、問題が表示される最初のレンダリングで確定させることで
    // 表示中に制限時間が変わったり、期限が作り直されたりしない。
    const nextLimitSec = resolveTimeLimitSeconds(nextProblem, historyRef.current);
    limitSecRef.current = nextLimitSec;
    setLimitSec(nextLimitSec);

    setProblem(nextProblem);
    setIsAnswered(false);
    setIsCorrect(false);
    setJudgement(null);
    setTimedOut(false);
    setExpired(false);
    setShowSolution(false);
    setIsSkipped(false);
    // 次の出題ごとに途中式の保存単位 (attemptId) を新しくする
    setAttemptId(createScratchAttemptId());
    startTimeRef.current = Date.now();
    answerSubmitLockRef.current = false;

    // 問題の重複防止用に履歴を更新し、通常モードだけ永続化する。
    // metadata + fingerprint は次問の多様性制御・重複検出に使う。
    const record: QuestionHistory = {
      problemId: nextProblem.id,
      problemType: nextProblem.type,
      parameters: nextProblem.parameters,
      askedAt: new Date().toISOString(),
      metadata: deriveMetadata(nextProblem),
      fingerprint: fingerprintProblem(nextProblem),
    };
    questionHistoryRef.current.push(record);
    void persistQuizQuestion(isAdminMode, record);
    // 絞り込み (filter) はセレクター生成時 (初期化) に確定する。
    // 出題レベルは毎問ごとに、直近までの履歴から習熟度を再評価して決まる。
  }, [difficulty, isAdminMode, studyMode]);

  /**
   * 回答を判定する
   * answerOverride が指定された場合はその値を使用する (Enterキー送信時の最新値)
   */
  const handleSubmit = useCallback(
    (rawAnswer: string, options?: { timedOut?: boolean }) => {
      const timedOutSubmit = options?.timedOut === true || expired;
      if (!problem || isAnswered || answerSubmitLockRef.current) return;

      // 空回答は判定しない (AnswerInput 側でもバリデーション済み)。
      // 時間切れは空入力でも成立するので、この空チェックの対象外にする。
      if (!timedOutSubmit && rawAnswer.trim() === '') return;

      // state更新を待たない同一イベント内の二重送信も防ぐ。
      // 時間切れと解答が競合しても、先に lock を立てた方が勝つ (二重記録しない)。
      answerSubmitLockRef.current = true;

      // 時間切れは通常の誤答と区別し、ユーザー入力を正答として扱わない。
      // ただし時間切れ後も回答を続けられるため、ユーザーが入力した回答は
      // 正誤判定する (isTimedOut=true のまま記録)。
      let correct: boolean;
      let nextJudgement: AnswerJudgement | null;
      if (timedOutSubmit && rawAnswer.trim() === '') {
        correct = false;
        nextJudgement = null;
      } else {
        // 判定には正規化された値を使用する
        // judgeUserAnswer は数学的等価性と教育上の標準形を区別して判定する
        const result = judgeUserAnswer(rawAnswer, problem.answer);
        correct = result.status === 'correct';
        nextJudgement = result;
      }
      const answerTimeSec = (Date.now() - startTimeRef.current) / 1000;
      // 制限時間は問題表示時に一度だけ決定した値をそのまま保存する (画面表示と必ず一致)。
      // 描画中の getTimeLimitSeconds など別の再計算は使わない。
      const limitSec = limitSecRef.current;

      setIsCorrect(correct);
      setJudgement(nextJudgement);
      setIsAnswered(true);
      setTimedOut(timedOutSubmit);

      // 通常モードの履歴を更新する。
      // userAnswer にはユーザーが実際に入力した元の値を保存する
      // equivalent-not-canonical (通分は合っているが最小公倍数でない) は不正解として記録する
      if (!isAdminMode) {
        const record: AnswerRecord = {
          problemId: problem.id,
          problemType: problem.type,
          category: problem.category,
          isCorrect: correct,
          answerTimeSec,
          answeredAt: new Date().toISOString(),
          difficultyLevel: problem.difficulty.level,
          question: problem.question,
          userAnswer: timedOutSubmit ? (rawAnswer.trim() !== '' ? rawAnswer : TIME_OUT_USER_ANSWER) : rawAnswer,
          correctAnswer: formatAnswer(problem.answer),
          submissionId: createDailyAnswerSubmissionId(),
          // 時間切れの区別用 (任意フィールド。通常回答では undefined のまま)
          isTimedOut: timedOutSubmit || undefined,
          timeLimitSec: limitSec,
          // 復習画面で途中式ノートと解答記録を紐付ける (任意・既存集計は変えない)
          scratchAttemptId: attemptId,
        };
        historyRef.current.push(record);
        void persistQuizAnswer(isAdminMode, record, canStartNormalSync);
      }

      // 結果を更新。
      // 制限時間内に解答を完了した問題だけを「解いた問題数」(solvedCount) に加算し、
      // 時間切れは加算しない。同一問題 (同じ questionNumber) の二重適用は
      // applyOutcome 内のキードガードで抑止 (二重加算しない)。
      resultRef.current = applyOutcome(
        resultRef.current,
        String(questionNumber),
        { timedOut: timedOutSubmit, correct, answerTimeSec },
      );
    },
    [canStartNormalSync, isAdminMode, problem, isAnswered, questionNumber, attemptId, expired],
  );

  /**
   * 時間切れ時の処理。
   * 既存の保存・集計経路を再利用するため、handleSubmit へ timedOut 付きで委譲する
   * (時間切れ専用の別ルートを作らない)。
   */
  const handleTimeout = useCallback(() => {
    // 時間切れ表示を行い、回答入力は継続可能にする (自動確定しない)。
    setExpired(true);
    setTimedOut(false);
  }, []);

  /**
   * 問題をスキップする。
   * 解答処理 (handleSubmit) は呼ばない。正誤判定・履歴保存・適応型難易度・
   * 正答率・連続正解/不正解数の更新を一切行わない。
   * 二重遷移は answerSubmitLockRef と isSkipped で防止する。
   */
  const handleSkip = useCallback(() => {
    if (!problem || isAnswered || isSkipped || answerSubmitLockRef.current) return;
    // タイムアウトと競合した場合は、先に lock を立てた側が勝つ。
    answerSubmitLockRef.current = true;
    setIsSkipped(true);

    if (questionNumber >= questionCount) {
      setResult(toSessionCounts(resultRef.current));
      answerSubmitLockRef.current = false;
    } else {
      setQuestionNumber((n) => n + 1);
      loadNextQuestion();
    }
  }, [problem, isAnswered, isSkipped, questionNumber, questionCount, loadNextQuestion]);

  /** E2E/開発時のみ: 現在の問題と入力種別を window に公開する (本番ビルドでは無効) */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__E2E_CURRENT_PROBLEM__ = problem;
    w.__E2E_CURRENT_INPUT_TYPE__ = problem ? getProblemInputType(problem) : null;
    w.__E2E_EXPECTED_ANSWER__ = problem ? formatAnswer(problem.answer) : null;
    w.__E2E_SUBMIT__ = problem
      ? (value: string) => {
          handleSubmit(value);
        }
      : null;
  }, [problem, handleSubmit]);

  /**
   * 次の問題へ進む
   */
  const handleNext = useCallback(() => {
    // 終了判定は questionCount に従う (復習は5問・通常は10問)。
    // ハードコードの10だと復習モードで問題数が画面表示とずれる。
    if (questionNumber >= questionCount) {
      setResult(toSessionCounts(resultRef.current));
      if (onCompleted) onCompleted();
    } else {
      setQuestionNumber((n) => n + 1);
      loadNextQuestion();
    }
  }, [questionNumber, questionCount, loadNextQuestion, onCompleted]);

  /**
   * もう一度挑戦する
   */
  const handleRetry = useCallback(() => {
    resultRef.current = createSessionTally();
    setQuestionNumber(1);
    setResult(null);
    loadNextQuestion();
  }, [loadNextQuestion]);

  if (error) {
    return (
      <div className="quiz-page">
        <div className="error-message">{error}</div>
        <button className="primary-button" onClick={onExit}>
          {isAdminMode ? '通常モードへ戻る' : 'ホームに戻る'}
        </button>
      </div>
    );
  }

  // 結果表示
  if (result) {
    // 正答率・平均解答時間は既存仕様どおり分母 = totalCount (時間切れを含む)。
    // 「せいかい N問」の N は解いた問題数 (時間切れを除く) で表示する。
    const accuracyRate = result.totalCount > 0 ? result.correctCount / result.totalCount : 0;
    const averageTime = result.totalCount > 0 ? result.totalTimeSec / result.totalCount : 0;

    return (
      <div className="quiz-page result-page">
        <h2>けっか</h2>
        <div className="result-card">
          <div className="result-score">
            <span className="result-number">{result.correctCount}</span>
            <span className="result-divider">/</span>
            {/* 分母は解いた問題数 (時間切れを除く) */}
            <span className="result-number">{result.solvedCount}</span>
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
            <div className="result-stat">
              <span className="stat-label">時間切れ</span>
              <span className="stat-value">{result.timedOutCount}問</span>
            </div>
          </div>
        </div>
        <div className="action-buttons">
          <button className="primary-button" onClick={handleRetry}>
            もういちど
          </button>
          <button className="secondary-button" onClick={onExit}>
            {isAdminMode ? '通常モードへ戻る' : 'ホームに戻る'}
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
    <div className="quiz-page" data-difficulty-level={problem.difficulty.level}>
      {/* ヘッダー：問題番号・進捗・カテゴリ・難易度（解答中のみ表示。解答後は非表示） */}
      {!isAnswered && (
        <div className="quiz-header">
          {isAdminMode && <div className="quiz-admin-mode">管理者モード</div>}
          <div className="quiz-progress">
            問題 {questionNumber} / {questionCount}
          </div>
          <div className="quiz-meta">
            <span className="quiz-category">{categoryLabel(problem.category)}</span>
            {isAdminMode && (
              <span className="quiz-difficulty">
                {difficultyLabel(problem.difficulty.level)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 残り時間のカウントダウン。回答済み (解答・時間切れ後) は表示しない。
          期限は問題IDを鍵に管理し、新しい問題だけ新しい制限時間で始まる。 */}
      {!isAnswered && !isSkipped && (
        <QuizTimer
          problemId={problem.id}
          limitSec={limitSec}
          onExpire={handleTimeout}
        />
      )}

      {expired && !isAnswered && !isSkipped && (
        <div className="timeout-notice" role="status">
          ⏰ 時間切れ！続けて解答できます。
        </div>
      )}

      {/* 問題文・図表（解答中のみ表示。解答後は非表示。
          解説に必要な問題文や図表は SolutionDisplay 側で個別に表示する） */}
      {!isAnswered && !isSkipped && (
        <div className="question-card">
          <p className="question-text">{problem.question}</p>
          {/* 図形は figure を持つ問題でのみ描画される (未設定なら何も描かない) */}
          <FigureRenderer spec={problem.figure} />
          {/* 現実連動の写真は image を持つ問題でのみ描画される (未設定なら何も描かない)。
              読み込み失敗時は ImageRenderer 内で代替テキストを表示する。 */}
          <ImageRenderer spec={problem.image} />
        </div>
      )}

      {/* 手書き途中式ノート (解答中のみ表示。解答後は非表示にして操作不可にする) */}
      {!isAnswered && !isSkipped && (
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

      {/* 問題タイプに応じた専用入力UI (OSキーボードを表示しない) */}
      {!isAnswered && !isSkipped && (
        <div className="answer-section">
          <AnswerInput
            key={problem.id}
            problem={problem}
            disabled={isAnswered}
            onSubmit={(value) => handleSubmit(value)}
          />
          <button
            type="button"
            className="secondary-button skip-button"
            onClick={handleSkip}
            disabled={isAnswered || isSkipped}
          >
            問題をスキップ
          </button>
        </div>
      )}

      {isAnswered && (
        <div className={`feedback ${isCorrect ? 'correct' : timedOut ? 'timed-out' : 'incorrect'}`}>
          <div className="feedback-title">
            {isCorrect
              ? timedOut
                ? '🎉 せいかい！（時間切れ後）'
                : '🎉 せいかい！'
              : timedOut
                ? '⏰ 時間切れ！'
                : judgement?.status === 'equivalent-not-canonical'
                  ? '⭕ 計算は合っています！'
                  : '❌ ざんねん...'}
          </div>
          {timedOut && (
            <div className="feedback-explanation">制限時間内に解けませんでした。</div>
          )}
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
