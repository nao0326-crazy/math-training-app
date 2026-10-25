import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeedGateDateKey } from '../utils/speedGateTime';
import {
  generateSpeedGateProblems,
  judgeSpeedGateAnswer,
  computeSpeedGateResult,
  createEmptyAnswers,
} from '../utils/speedGate';
import {
  loadSpeedGateSession,
  saveSpeedGateSession,
  listSpeedGateSessions,
} from '../storage/speedGate';
import type {
  SpeedGateSession,
  SpeedGateProblem,
  SpeedGateAnswer,
  SpeedGateResult,
} from '../types/speedGate';

interface SpeedGatePageProps {
  dateKey?: string;
  onExit?: () => void;
  onCompleted?: (result: SpeedGateResult) => void;
}

const OPERATION_LABEL: Record<string, string> = {
  add: '足し算',
  subtract: '引き算',
  multiply: '掛け算',
  divide: '割り算',
};

export default function SpeedGatePage({
  dateKey = getSpeedGateDateKey(),
  onExit,
  onCompleted,
}: SpeedGatePageProps) {
  const [session, setSession] = useState<SpeedGateSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState<SpeedGateResult | null>(null);
  const [historyComparison, setHistoryComparison] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const questionStartRef = useRef<number>(Date.now());
  const scoringLockRef = useRef(false);
  const finalizingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        let s = await loadSpeedGateSession(dateKey);
        if (!s) {
          const problems = generateSpeedGateProblems(dateKey);
          s = {
            dateKey,
            startedAt: new Date().toISOString(),
            status: 'in_progress',
            problems,
            answers: createEmptyAnswers(problems.length),
            currentIndex: 0,
          };
          await saveSpeedGateSession(s);
        }
        if (cancelled) return;
        setSession(s);
        const idx = Math.min(s.currentIndex ?? 0, s.problems.length - 1);
        setCurrentIndex(idx);
        if (s.status === 'completed') {
          const r = computeSpeedGateResult(
            s.dateKey,
            s.problems,
            s.answers,
            s.startedAt,
            s.completedAt ?? new Date().toISOString(),
          );
          setResult(r);
        } else {
          const existing = s.answers[idx];
          if (existing) {
            setIsAnswered(true);
            setLastCorrect(existing.isCorrect);
          }
        }
      } catch {
        if (!cancelled) setError('ハイスピード計算の読み込みに失敗しました。');
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  useEffect(() => {
    setInput('');
    questionStartRef.current = Date.now();
    scoringLockRef.current = false;
    if (!session) {
      setIsAnswered(false);
      setLastCorrect(null);
      return;
    }
    const existing = session.answers[currentIndex];
    if (existing) {
      setIsAnswered(true);
      setLastCorrect(existing.isCorrect);
    } else {
      setIsAnswered(false);
      setLastCorrect(null);
    }
  }, [currentIndex, session]);
  const problem: SpeedGateProblem | null =
    session && currentIndex < session.problems.length ? session.problems[currentIndex] : null;

  const persistProgress = useCallback(
    async (nextIndex: number, answers: (SpeedGateAnswer | null)[]) => {
      if (!session) return;
      const updated: SpeedGateSession = {
        ...session,
        answers,
        currentIndex: nextIndex,
        status: 'in_progress',
      };
      setSession(updated);
      try {
        await saveSpeedGateSession(updated);
      } catch {
        // 保存失敗でも続行
      }
    },
    [session],
  );

  const finalize = useCallback(async () => {
    if (!session || finalizingRef.current) return;
    finalizingRef.current = true;
    const completedAt = new Date().toISOString();
    const updated: SpeedGateSession = {
      ...session,
      status: 'completed',
      completedAt,
      currentIndex: session.problems.length,
    };
    setSession(updated);
    try {
      await saveSpeedGateSession(updated);
    } catch {
      // ignore
    }
    const r = computeSpeedGateResult(
      updated.dateKey,
      updated.problems,
      updated.answers,
      updated.startedAt,
      completedAt,
    );
    setResult(r);

    try {
      const all = await listSpeedGateSessions();
      const prev = all
        .filter((s) => s.status === 'completed' && s.dateKey !== dateKey)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const lastResult = computeSpeedGateResult(
          last.dateKey,
          last.problems,
          last.answers,
          last.startedAt,
          last.completedAt ?? last.startedAt,
        );
        const diffMs = r.totalMs - lastResult.totalMs;
        const diffAcc = (r.accuracy - lastResult.accuracy).toFixed(1);
        setHistoryComparison(
          `前回: ${lastResult.totalMs}ms / 正答率${lastResult.accuracy}% → 今回: ${r.totalMs}ms / 正答率${r.accuracy}%（時間${diffMs >= 0 ? '+' : ''}${diffMs}ms、正答率${Number(diffAcc) >= 0 ? '+' : ''}${diffAcc}%）`,
        );
      } else {
        setHistoryComparison('初回記録です。');
      }
    } catch {
      setHistoryComparison('');
    }

    onCompleted?.(r);
  }, [session, dateKey, onCompleted]);

  const submitAnswer = useCallback(() => {
    if (!session || !problem || isAnswered || scoringLockRef.current) return;
    const trimmed = input.trim();
    if (trimmed === '') return;
    scoringLockRef.current = true;
    const elapsed = Date.now() - questionStartRef.current;
    const correct = judgeSpeedGateAnswer(problem, trimmed);
    const answer: SpeedGateAnswer = {
      index: currentIndex,
      userAnswer: trimmed,
      correctAnswer: problem.answer,
      isCorrect: correct,
      elapsedMs: elapsed,
      answeredAt: new Date().toISOString(),
    };
    const newAnswers = [...session.answers];
    newAnswers[currentIndex] = answer;
    setIsAnswered(true);
    setLastCorrect(correct);
    void persistProgress(currentIndex, newAnswers);
  }, [session, problem, isAnswered, input, currentIndex, persistProgress]);

  const handleNext = useCallback(() => {
    if (!session || !isAnswered) return;
    if (currentIndex + 1 >= session.problems.length) {
      void finalize();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [session, isAnswered, currentIndex, finalize]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      if (isAnswered) {
        handleNext();
      } else {
        submitAnswer();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAnswered, submitAnswer, handleNext]);

  if (error) {
    return (
      <div className="speed-gate-page">
        <p className="error-message" role="alert">{error}</p>
        <button className="secondary-button" onClick={onExit}>戻る</button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="speed-gate-page">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="speed-gate-page speed-gate-result">
        <h2>100問完了！</h2>
        <div className="speed-gate-result-summary">
          <p>正答率: {result.accuracy}% ({result.correctCount}/{result.totalCount})</p>
          <p>総所要時間: {result.totalMs} ms</p>
          <p>平均回答時間: {result.averageMs} ms</p>
        </div>
        <h3>計算種類別</h3>
        <ul>
          {Object.values(result.byOperation).map((s) => (
            <li key={s.operation}>
              {OPERATION_LABEL[s.operation]}: {s.correct}/{s.total} 正解 / 平均 {s.averageMs}ms / 正答率{s.accuracy}%
            </li>
          ))}
        </ul>
        {historyComparison && <p className="speed-gate-comparison">{historyComparison}</p>}
        <button className="primary-button" onClick={onExit}>通常学習へ</button>
      </div>
    );
  }

  const total = session.problems.length;
  const progressText = `${currentIndex + 1} / ${total} (残り ${total - currentIndex - 1})`;

  return (
    <div className="speed-gate-page">
      <div className="speed-gate-header">
        <h2>朝のハイスピード計算</h2>
        <p className="speed-gate-progress">{progressText}</p>
      </div>

      {problem && (
        <div className="speed-gate-question-card">
          <p className="speed-gate-question">{problem.question} = ?</p>
        </div>
      )}

      {!isAnswered && (
        <div className="speed-gate-answer-section">
          <input
            type="text"
            inputMode="numeric"
            className="speed-gate-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            aria-label="答え"
          />
          <button className="primary-button" onClick={submitAnswer} disabled={input.trim() === ''}>
            確定 (Enter)
          </button>
        </div>
      )}

      {isAnswered && (
        <div className={`speed-gate-feedback ${lastCorrect ? 'correct' : 'incorrect'}`}>
          <p>{lastCorrect ? 'せいかい！' : 'ざんねん...'}</p>
          {!lastCorrect && problem && (
            <p className="speed-gate-correct-answer">
              正解は <strong>{problem.answer}</strong> です
            </p>
          )}
          <button className="primary-button" onClick={handleNext}>
            {currentIndex + 1 >= total ? 'けっかをみる' : 'つぎへ (Enter)'}
          </button>
        </div>
      )}
    </div>
  );
}

