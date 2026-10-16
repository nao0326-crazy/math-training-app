import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, Problem } from '../types/problem';
import { NoWeakTargetError } from '../engine/selector/weakSelector';
import type { StudyMode } from '../engine/selector/types';
import type { QuestionFilter } from '../engine/selector/questionPool';
import { createQuizSelector, toDifficultyLevel } from './quizSelection';
import { formatAnswer, judgeUserAnswer, type AnswerJudgement } from '../utils/answer';
import { getTimeLimitSeconds, TIME_OUT_USER_ANSWER } from '../utils/quizTimer';
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
  /** 管理者演習かどうか。true の場合は通常学習データを読み書きしない */
  isAdminMode: boolean;
  /** モード切替後の遅延保存が同期を新規開始してよいかを動的に判定する */
  canStartNormalSync: () => boolean;
  onExit: () => void;
}

export default function QuizPage({
  category,
  difficulty,
  questionCount = 10,
  studyMode,
  filter = null,
  isAdminMode,
  canStartNormalSync,
  onExit,
}: QuizPageProps) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  /** 詳細判定結果 (数学的等価だが標準形でない回答などの区別用) */
  const [judgement, setJudgement] = useState<AnswerJudgement | null>(null);
  /** 時間切れで解答受付を打ち切ったか (通常の誤答と区別する) */
  const [timedOut, setTimedOut] = useState(false);
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
    setTimedOut(false);
    setShowSolution(false);
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
    // 絞り込み (filter / category) はセレクター生成時 (初期化) に確定するため、
    // 毎問変わるのは difficulty と studyMode だけ。
  }, [difficulty, isAdminMode, studyMode]);

  /**
   * 回答を判定する
   * answerOverride が指定された場合はその値を使用する (Enterキー送信時の最新値)
   */
  const handleSubmit = useCallback(
    (rawAnswer: string, options?: { timedOut?: boolean }) => {
      const timedOutSubmit = options?.timedOut === true;
      if (!problem || isAnswered || answerSubmitLockRef.current) return;

      // 空回答は判定しない (AnswerInput 側でもバリデーション済み)。
      // 時間切れは空入力でも成立するので、この空チェックの対象外にする。
      if (!timedOutSubmit && rawAnswer.trim() === '') return;

      // state更新を待たない同一イベント内の二重送信も防ぐ。
      // 時間切れと解答が競合しても、先に lock を立てた方が勝つ (二重記録しない)。
      answerSubmitLockRef.current = true;

      // 時間切れは通常の誤答と区別し、ユーザー入力を正答として扱わない。
      let correct: boolean;
      let nextJudgement: AnswerJudgement | null;
      if (timedOutSubmit) {
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
      const limitSec = getTimeLimitSeconds(problem);

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
          userAnswer: timedOutSubmit ? TIME_OUT_USER_ANSWER : rawAnswer,
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
    [canStartNormalSync, isAdminMode, problem, isAnswered, questionNumber],
  );

  /**
   * 時間切れ時の処理。
   * 既存の保存・集計経路を再利用するため、handleSubmit へ timedOut 付きで委譲する
   * (時間切れ専用の別ルートを作らない)。
   */
  const handleTimeout = useCallback(() => {
    // 空文字を渡し、timedOut フラグで「不正解確定 + 時間切れ記録」にする。
    handleSubmit('', { timedOut: true });
  }, [handleSubmit]);

  /**
   * 次の問題へ進む
   */
  const handleNext = useCallback(() => {
    // 終了判定は questionCount に従う (復習は5問・通常は10問)。
    // ハードコードの10だと復習モードで問題数が画面表示とずれる。
    if (questionNumber >= questionCount) {
      setResult(toSessionCounts(resultRef.current));
    } else {
      setQuestionNumber((n) => n + 1);
      loadNextQuestion();
    }
  }, [questionNumber, questionCount, loadNextQuestion]);

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
    <div className="quiz-page">
      <div className="quiz-header">
        {isAdminMode && <div className="quiz-admin-mode">管理者モード</div>}
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

      {/* 残り時間のカウントダウン。回答済み (解答・時間切れ後) は表示しない。
          期限は問題IDを鍵に管理し、新しい問題だけ新しい制限時間で始まる。 */}
      {!isAnswered && (
        <QuizTimer
          problemId={problem.id}
          limitSec={getTimeLimitSeconds(problem)}
          onExpire={handleTimeout}
        />
      )}

      <div className="question-card">
        <p className="question-text">{problem.question}</p>
        {/* 図形は figure を持つ問題でのみ描画される (未設定なら何も描かない) */}
        <FigureRenderer spec={problem.figure} />
        {/* 現実連動の写真は image を持つ問題でのみ描画される (未設定なら何も描かない)。
            読み込み失敗時は ImageRenderer 内で代替テキストを表示する。 */}
        <ImageRenderer spec={problem.image} />
      </div>

      {/* 手書き途中式ノート (解答の必須条件にはしない。出題ごとに attemptId で保存) */}
      <div className="scratch-section">
        <ScratchPad
          key={attemptId}
          meta={{
            attemptId,
            problemId: problem.id,
            problemType: problem.type,
            category: problem.category,
            question: problem.question,
          }}
        />
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
        <div
          className={`feedback ${isCorrect ? 'correct' : timedOut ? 'timed-out' : 'incorrect'}`}
        >
          <div className="feedback-title">
            {isCorrect
              ? '🎉 せいかい！'
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
