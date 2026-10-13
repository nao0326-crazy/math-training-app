/**
 * 1セッション (1回のクイズ) の問題数カウント
 *
 * 「解いた問題数」と「正答率の分母」を混同しないことを目的に、
 * 4つの概念を別フィールドで保持する:
 * - totalCount   : 出題数 (時間切れを含む回答記録数) = 正答率の分母
 * - solvedCount  : 解いた問題数 (制限時間内に解答を完了したもののみ)
 * - correctCount : 正答数
 * - timedOutCount: 時間切れ数
 *
 * 正答率は既存仕様どおり「時間切れを誤答として分母 (totalCount) に含める」。
 * したがって正答率 = correctCount / totalCount は時間切れの影響を受けない。
 *
 * 二重加算ガード: 各問題は `key` (QuizPage では問題番号) を1回だけ適用できる。
 * 時間切れと解答送信が競合して同一キーで2回呼ばれても、加算は最大でも1回。
 */

export interface SessionCounts {
  /** 出題数 (時間切れを含む回答記録数)。正答率の分母。 */
  totalCount: number;
  /** 解いた問題数 (制限時間内に解答を完了したもののみ。時間切れは含めない)。 */
  solvedCount: number;
  /** 正答数 */
  correctCount: number;
  /** 時間切れ数 */
  timedOutCount: number;
  /** 合計解答時間 (秒) */
  totalTimeSec: number;
}

export interface SessionOutcome {
  /** 時間切れで解答受付を打ち切ったか */
  timedOut: boolean;
  /** 正答だったか (時間切れなら false) */
  correct: boolean;
  /** この問題の解答時間 (秒) */
  answerTimeSec: number;
}

export interface SessionTally extends SessionCounts {
  /** 確定済みの問題キー。同一キーの二重適用を防ぐ (二重加算ガード)。 */
  countedKeys: string[];
}

/** 空のセッションカウントを作成する */
export function createSessionTally(): SessionTally {
  return {
    totalCount: 0,
    solvedCount: 0,
    correctCount: 0,
    timedOutCount: 0,
    totalTimeSec: 0,
    countedKeys: [],
  };
}

/**
 * 1問の解答結果をセッションカウントに適用する。
 *
 * - 時間内正答: solvedCount +1, correctCount +1, totalCount +1
 * - 時間内誤答: solvedCount +1, totalCount +1
 * - 時間切れ  : solvedCount +0 (時間切れ数 +1, totalCount +1)
 * - 同一キーの再適用 (二重送信・時間切れと解答の競合・時間切れ後の再発火):
 *   何も加算しない (状態をそのまま返す)
 */
export function applyOutcome(
  state: SessionTally,
  key: string,
  outcome: SessionOutcome,
): SessionTally {
  // 同一問題の二重加算ガード
  if (state.countedKeys.includes(key)) return state;

  // 時間切れは「解いた問題数」にカウントしない (仕様確定)。
  // 時間切れは正答にもならない (userId 入力を正答として扱わない)。
  const solved = !outcome.timedOut;
  const countsAsCorrect = outcome.correct && !outcome.timedOut;

  return {
    totalCount: state.totalCount + 1,
    solvedCount: state.solvedCount + (solved ? 1 : 0),
    correctCount: state.correctCount + (countsAsCorrect ? 1 : 0),
    timedOutCount: state.timedOutCount + (outcome.timedOut ? 1 : 0),
    totalTimeSec: state.totalTimeSec + outcome.answerTimeSec,
    countedKeys: [...state.countedKeys, key],
  };
}

/** 表示用に内部フィールド (countedKeys) を除いたカウントを返す */
export function toSessionCounts(tally: SessionTally): SessionCounts {
  const { totalCount, solvedCount, correctCount, timedOutCount, totalTimeSec } = tally;
  return { totalCount, solvedCount, correctCount, timedOutCount, totalTimeSec };
}
