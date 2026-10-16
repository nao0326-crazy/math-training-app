import { useEffect, useRef, useState } from 'react';
import { computeRemainingSec, startCountdown, startOrReuseTimer } from '../utils/quizTimer';

interface QuizTimerProps {
  /** 期限を紐付ける問題ID (既存の安定した識別子) */
  problemId: string;
  /** この問題の制限秒数 */
  limitSec: number;
  /** 期限に達したときに 1 回だけ呼ばれる */
  onExpire: () => void;
}

/** 残り時間がこれ以下で警告色になる目安 (秒) */
const URGENT_THRESHOLD_SEC = 10;
/** 残り時間がこれ以下で強い警告 (脈打ち) になる目安 (秒) */
const CRITICAL_THRESHOLD_SEC = 5;

/**
 * 残り時間のカウントダウン表示。
 *
 * 毎秒の再描画はこの小さなコンポーネント内に閉じる (QuizPage 全体を毎秒
 * 再描画しない)。残り秒は経過時間 (壁時計) から算出するため、タブ切り替えや
 * 負荷で時間が不正に延長されない。回答後は親がアンマウントし、interval は
 * クリーンアップで確実に停止する。
 */
export default function QuizTimer({ problemId, limitSec, onExpire }: QuizTimerProps) {
  const [remainingSec, setRemainingSec] = useState(limitSec);
  // onExpire は毎レンダリング変わる可能性があるため ref で最新を保持する。
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    // 同一問題なら既存の期限を再利用し、新しい問題だけ新しい期限を作る。
    const timer = startOrReuseTimer(problemId, limitSec, Date.now());
    setRemainingSec(computeRemainingSec(timer.deadlineMs, Date.now()));

    // 残り時間は wall clock から算出。interval は表示更新にだけ使う。
    // 期限到達で onExpire を 1 回だけ呼び、以後は自ら停止する。
    const controller = startCountdown({
      deadlineMs: timer.deadlineMs,
      onTick: setRemainingSec,
      onExpire: () => onExpireRef.current(),
    });

    return () => {
      // アンマウント (回答済み表示へ切り替え) で interval を確実に止める。
      controller.stop();
    };
  }, [problemId, limitSec]);

  const urgent = remainingSec <= URGENT_THRESHOLD_SEC;
  const critical = remainingSec <= CRITICAL_THRESHOLD_SEC;

  return (
    <div
      className={
        'quiz-timer' +
        (urgent ? ' quiz-timer-urgent' : '') +
        (critical ? ' quiz-timer-critical' : '')
      }
      role="timer"
      aria-live="polite"
      data-testid="quiz-timer"
    >
      <span className="quiz-timer-label">のこり</span>
      <span className="quiz-timer-value">{remainingSec}</span>
      <span className="quiz-timer-unit">秒</span>
    </div>
  );
}
