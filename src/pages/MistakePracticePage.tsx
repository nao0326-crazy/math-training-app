import { useCallback, useEffect, useRef, useState } from 'react';
import type { Problem } from '../types/problem';
import type { AnswerRecord, QuestionHistory } from '../types/history';
import AnswerInput from '../components/AnswerInput';
import FigureRenderer from '../components/FigureRenderer';
import ImageRenderer from '../components/ImageRenderer';
import SolutionDisplay from '../components/SolutionDisplay';
import QuizTimer from '../components/QuizTimer';
import ScratchPad from '../components/ScratchPad';
import { createScratchAttemptId } from '../types/scratch';
import { formatAnswer, judgeUserAnswer } from '../utils/answer';
import { getTimeLimitSeconds, TIME_OUT_USER_ANSWER } from '../utils/quizTimer';
import { resolveTimeLimitSeconds } from '../utils/adaptiveTimeLimit';
import { createDailyAnswerSubmissionId } from '../services/dailyAnswerSync';
import { loadQuizHistory, persistQuizAnswer, persistQuizQuestion } from '../services/quizPersistence';
import { deriveMetadata, fingerprintProblem } from '../engine/diversity/metadata';
import {
  loadDailyLearningState,
  saveDailyLearningState,
} from '../storage/db';
import {
  createEmptyDailyState,
  rolloverDailyState,
  getPracticeCandidates,
  registerMistake,
  removeType,
  recordStreak,
  isMasteredStreak,
  pickNextPracticeType,
  countsForMastery,
  applyTimeoutReward,
} from '../utils/dailyLearning';
import { FilteredSelector } from '../engine/selector/filteredSelector';
import { getStudyDateKey } from '../utils/dailyCount';

interface MistakePracticePageProps {
  practiceKind: 'prevDay' | 'today';
  onExit: () => void;
}

const DEFAULT_LIMIT_SEC = getTimeLimitSeconds(null);

export default function MistakePracticePage({ practiceKind, onExit }: MistakePracticePageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [state, setState] = useState<ReturnType<typeof createEmptyDailyState> | null>(null);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [limitSec, setLimitSec] = useState<number>(DEFAULT_LIMIT_SEC);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [expired, setExpired] = useState(false);
  const [currentType, setCurrentType] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);

  const historyRef = useRef<AnswerRecord[]>([]);
  const questionHistoryRef = useRef<QuestionHistory[]>([]);
  const startTimeRef = useRef<number>(0);
  const limitSecRef = useRef<number>(DEFAULT_LIMIT_SEC);
  const answerSubmitLockRef = useRef(false);
  const attemptIdRef = useRef<string>(createScratchAttemptId());
  const [attemptId, setAttemptId] = useState<string>(attemptIdRef.current);
  const persistState = useCallback(async (next: ReturnType<typeof createEmptyDailyState>) => {
    await saveDailyLearningState(next);
  }, []);

  const loadProblem = useCallback(async (type: string) => {
    try {
      const selector = new FilteredSelector({ types: [type] });
      const nextProblem = selector.selectNextQuestion(historyRef.current, questionHistoryRef.current);
      const nextLimitSec = resolveTimeLimitSeconds(nextProblem, historyRef.current);
      limitSecRef.current = nextLimitSec;
      setLimitSec(nextLimitSec);
      setProblem(nextProblem);
      setIsAnswered(false);
      setIsCorrect(false);
      setTimedOut(false);
      setExpired(false);
      answerSubmitLockRef.current = false;
      startTimeRef.current = Date.now();
      const newAttemptId = createScratchAttemptId();
      attemptIdRef.current = newAttemptId;
      setAttemptId(newAttemptId);

      const record: QuestionHistory = {
        problemId: nextProblem.id,
        problemType: nextProblem.type,
        parameters: nextProblem.parameters,
        askedAt: new Date().toISOString(),
        metadata: deriveMetadata(nextProblem),
        fingerprint: fingerprintProblem(nextProblem),
      };
      questionHistoryRef.current.push(record);
      void persistQuizQuestion(false, record);
    } catch (e) {
      setError(e instanceof Error ? e.message : '問題の生成に失敗しました。');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const todayKey = getStudyDateKey();
        let loaded = await loadDailyLearningState();
        if (!loaded) loaded = createEmptyDailyState(todayKey);
        const rolled = rolloverDailyState(loaded, todayKey);
        if (cancelled) return;
        const { answers, questions } = await loadQuizHistory(false);
        if (cancelled) return;
        historyRef.current = answers;
        questionHistoryRef.current = questions;
        setState(rolled);
        const cands = getPracticeCandidates(rolled, practiceKind);
        setCandidates(cands);
        await saveDailyLearningState(rolled);
        if (cands.length === 0) {
          setCompleted(true);
          setLoading(false);
          return;
        }
        const type = pickNextPracticeType(cands, rolled.lastPracticeType);
        setCurrentType(type);
        if (type) await loadProblem(type);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '読み込みに失敗しました。');
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [practiceKind, loadProblem]);

  const handleSubmit = useCallback(
    (rawAnswer: string, options?: { timedOut?: boolean }) => {
      if (!problem || !state || !currentType || isAnswered || answerSubmitLockRef.current) return;
      const timedOutSubmit = options?.timedOut === true || expired;
      if (!timedOutSubmit && rawAnswer.trim() === '') return;
      answerSubmitLockRef.current = true;

      let correct: boolean;
      if (timedOutSubmit && rawAnswer.trim() === '') {
        correct = false;
      } else {
        const result = judgeUserAnswer(rawAnswer, problem.answer);
        correct = result.status === 'correct';
      }
      const answerTimeSec = (Date.now() - startTimeRef.current) / 1000;
      const limitSecValue = limitSecRef.current;

      setIsCorrect(correct);
      setIsAnswered(true);
      setTimedOut(timedOutSubmit);

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
        isTimedOut: timedOutSubmit || undefined,
        timeLimitSec: limitSecValue,
        scratchAttemptId: attemptId,
      };
      historyRef.current.push(record);
      void persistQuizAnswer(false, record, () => true);

      const inTimeCorrect = countsForMastery(correct, timedOutSubmit);
      const next = { ...state };
      next.prevStreaks = { ...state.prevStreaks };
      next.todayStreaks = { ...state.todayStreaks };
      next.prevDayTypes = [...state.prevDayTypes];
      next.todayTypes = [...state.todayTypes];
      next.prevPhase = { ...state.prevPhase };

      if (practiceKind === 'prevDay') {
        const phase = state.prevPhase[currentType] ?? 'pending';
        if (phase === 'pending') {
          if (inTimeCorrect) {
            next.prevPhase[currentType] = 'done';
            next.prevDayTypes = removeType(next.prevDayTypes, currentType);
          } else {
            next.prevPhase[currentType] = 'mastering';
            next.prevStreaks = recordStreak(next.prevStreaks, currentType, false);
            if (!correct) {
              next.todayTypes = registerMistake(next.todayTypes, currentType);
            }
          }
        } else {
          const updated = recordStreak(next.prevStreaks, currentType, inTimeCorrect);
          next.prevStreaks = updated;
          if (isMasteredStreak(updated, currentType)) {
            next.prevPhase[currentType] = 'done';
            next.prevDayTypes = removeType(next.prevDayTypes, currentType);
          } else if (!correct) {
            next.todayTypes = registerMistake(next.todayTypes, currentType);
          }
        }
      } else {
        const updated = recordStreak(next.todayStreaks, currentType, inTimeCorrect);
        next.todayStreaks = updated;
        if (isMasteredStreak(updated, currentType)) {
          next.todayTypes = removeType(next.todayTypes, currentType);
        }
      }

      if (timedOutSubmit && correct) {
        const reward = applyTimeoutReward(next.timeoutRewardProgress, 1);
        next.timeoutRewardProgress = reward.progress;
        next.timeoutRewardsEarned = (next.timeoutRewardsEarned ?? 0) + reward.rewardsGranted;
      }

      next.lastPracticeType = currentType;
      setState(next);
      void persistState(next);
      const newCandidates = getPracticeCandidates(next, practiceKind);
      setCandidates(newCandidates);
    },
    [problem, state, currentType, isAnswered, expired, practiceKind, attemptId, persistState],
  );

  const handleTimeout = useCallback(() => {
    setExpired(true);
    setTimedOut(false);
  }, []);

  const handleNext = useCallback(async () => {
    if (!state) return;
    const newCandidates = getPracticeCandidates(state, practiceKind);
    if (newCandidates.length === 0) {
      setCompleted(true);
      setProblem(null);
      return;
    }
    const nextType = pickNextPracticeType(newCandidates, currentType ?? state.lastPracticeType);
    setCurrentType(nextType);
    if (nextType) await loadProblem(nextType);
  }, [state, practiceKind, currentType, loadProblem]);

  if (loading) {
    return <div className="quiz-page"><p>読み込み中...</p></div>;
  }
  if (error) {
    return (
      <div className="quiz-page">
        <p className="error-message">{error}</p>
        <button className="secondary-button" onClick={onExit}>戻る</button>
      </div>
    );
  }
  if (completed) {
    return (
      <div className="quiz-page result-page">
        <h2>完了</h2>
        <p>{practiceKind === 'prevDay' ? '前日に間違えた問題をすべてクリアしました。' : '今日間違えた問題をすべてクリアしました。'}</p>
        <button className="primary-button" onClick={onExit}>ホームに戻る</button>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <span className="quiz-progress">
          {practiceKind === 'prevDay' ? '前日ミス復習' : '今日ミス克服'}: 残り {candidates.length} 種類
        </span>
        <span className="timeout-reward-status" role="status">
          報酬: {state?.timeoutRewardsEarned ?? 0}回分（蓄積 {state?.timeoutRewardProgress ?? 0}/3）
        </span>
        <button className="secondary-button" onClick={onExit}>終了</button>
      </div>

      {problem && (
        <>
          <QuizTimer
            problemId={problem.id}
            limitSec={limitSec}
            onExpire={handleTimeout}
          />
          {expired && !isAnswered && (
            <p className="timeout-notice" role="status">⏰ 時間切れ！続けて解答できます。</p>
          )}
          <div className="question-card">
            <p className="question-text">{problem.question}</p>
            <FigureRenderer spec={problem.figure} />
            <ImageRenderer spec={problem.image} />
          </div>
          {!isAnswered && (
            <div className="scratch-section">
              <ScratchPad key={attemptId} disabled={false} meta={{ attemptId, problemId: problem.id, problemType: problem.type, category: problem.category, question: problem.question }} />
            </div>
          )}
          {!isAnswered && (
            <div className="answer-section">
              <AnswerInput key={problem.id} problem={problem} disabled={isAnswered} onSubmit={(value) => handleSubmit(value)} />
            </div>
          )}
          {isAnswered && (
            <div className={`feedback ${isCorrect ? 'correct' : timedOut ? 'timed-out' : 'incorrect'}`}>
              <div className="feedback-title">
                {isCorrect ? (timedOut ? '🎉 せいかい！（時間切れ後）' : '🎉 せいかい！') : timedOut ? '⏰ 時間切れ！' : '❌ ざんねん...'}
              </div>
              {!isCorrect && <div className="feedback-answer">正解は <strong>{formatAnswer(problem.answer)}</strong> です</div>}
              {problem.explanation && <div className="feedback-explanation">{problem.explanation}</div>}
              {!isCorrect && <SolutionDisplay solutionSteps={problem.solutionSteps} answer={problem.answer} />}
              <button className="primary-button next-button" onClick={() => void handleNext()}>
                {candidates.length <= 1 ? 'けっかをみる' : 'つぎの問題へ'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
