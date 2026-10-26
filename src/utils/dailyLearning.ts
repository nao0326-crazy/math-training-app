/**
 * 日次学習 (前日ミス / 今日ミス / ノーマル110問) の状態管理ユーティリティ。
 *
 * 純粋関数のみ。永続化・UI は呼び出し側が担当する。
 */

/** 問題タイプの配列を重複除去して返す (順序は先頭優先) */
export function dedupeTypes(types: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of types) {
    if (typeof t !== 'string' || t === '') continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 問題タイプを苦手一覧へ登録する (重複登録しない) */
export function registerMistake(types: readonly string[], type: string): string[] {
  if (typeof type !== 'string' || type === '') return [...types];
  if (types.includes(type)) return [...types];
  return [...types, type];
}

/** 問題タイプを一覧から外す */
export function removeType(types: readonly string[], type: string): string[] {
  return types.filter((t) => t !== type);
}

/** 種類ごとの連続正解数を更新する。時間内正解で+1、それ以外は0にリセット。 */
export function recordStreak(
  streaks: Readonly<Record<string, number>>,
  type: string,
  inTimeCorrect: boolean,
): Record<string, number> {
  const next = { ...streaks };
  if (inTimeCorrect) {
    next[type] = (next[type] ?? 0) + 1;
  } else {
    next[type] = 0;
  }
  return next;
}

/** 3回連続正解に到達したかどうか */
export function isMasteredStreak(
  streaks: Readonly<Record<string, number>>,
  type: string,
): boolean {
  return (streaks[type] ?? 0) >= 3;
}

/**
 * 次に出題する苦手タイプを選ぶ。
 * - 候補が空なら null
 * - 候補が1種類のみならそれを返す (安全に継続)
 * - それ以外は直前と異なるタイプを候補からランダムに選ぶ
 */
export function pickNextPracticeType(
  candidates: readonly string[],
  lastType: string | null,
  rng: () => number = Math.random,
): string | null {
  const unique = dedupeTypes(candidates);
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];
  const pool = lastType ? unique.filter((t) => t !== lastType) : unique;
  const source = pool.length > 0 ? pool : unique;
  const idx = Math.floor(rng() * source.length);
  return source[Math.max(0, Math.min(source.length - 1, idx))];
}

/** 今日間違えた種類から翌日の前日ミス対象を構築する (重複除去) */
export function buildPrevDayFromToday(todayTypes: readonly string[]): string[] {
  return dedupeTypes(todayTypes);
}

/** 2つの苦手種類リストを結合して重複除去する */
export function mergeMistakeTypes(
  existing: readonly string[],
  incoming: readonly string[],
): string[] {
  return dedupeTypes([...existing, ...incoming]);
}

/** 時間内正解かつ時間切れでない場合のみ克服カウント対象 */
export function countsForMastery(correct: boolean, timedOut: boolean): boolean {
  return correct && !timedOut;
}

/**
 * 時間切れ後正解の報酬蓄積。
 * 3回分で通常正解1回分の報酬を付与する。
 */
export interface TimeoutRewardResult {
  /** 更新後の蓄積数 (0..2) */
  progress: number;
  /** 今回付与された報酬回数 (0 or 1) */
  rewardsGranted: number;
}

export function applyTimeoutReward(
  currentProgress: number,
  timeoutCorrectCount: number = 1,
): TimeoutRewardResult {
  let progress = Math.max(0, Math.min(2, Math.floor(currentProgress)));
  let rewards = 0;
  for (let i = 0; i < timeoutCorrectCount; i++) {
    progress += 1;
    if (progress >= 3) {
      rewards += 1;
      progress -= 3;
    }
  }
  return { progress, rewardsGranted: rewards };
}

/** 前日ミスの初回判定結果に応じた次フェーズ */
export type PrevDayPhase = 'pending' | 'mastering' | 'done';

export function nextPrevDayPhase(
  current: PrevDayPhase,
  firstAttemptCorrect: boolean,
): PrevDayPhase {
  if (current === 'done') return 'done';
  if (current === 'pending') {
    return firstAttemptCorrect ? 'done' : 'mastering';
  }
  // mastering: 3連続正解で done (呼び出し側で streak 判定)
  return current;
}
export interface DailyLearningState {
  dateKey: string;
  prevDayTypes: string[];
  todayTypes: string[];
  prevStreaks: Record<string, number>;
  todayStreaks: Record<string, number>;
  prevPhase: Record<string, PrevDayPhase>;
  normalSolvedCount?: number;
  timeoutRewardProgress: number;
  timeoutRewardsEarned?: number;
  lastPracticeType: string | null;
  normalCompletedDateKey?: string;
}

export interface DailyLearningStateRecord extends DailyLearningState {
  key: 'daily-learning-state-v1';
}

export function createEmptyDailyState(dateKey: string): DailyLearningState {
  return {
    dateKey,
    prevDayTypes: [],
    todayTypes: [],
    prevStreaks: {},
    todayStreaks: {},
    prevPhase: {},
    normalSolvedCount: 0,
    timeoutRewardProgress: 0,
    timeoutRewardsEarned: 0,
    lastPracticeType: null,
  };
}

export function rolloverDailyState(
  state: DailyLearningState,
  todayKey: string,
): DailyLearningState {
  if (state.dateKey === todayKey) {
    return {
      ...state,
      prevPhase: state.prevPhase ?? {},
      normalSolvedCount: state.normalSolvedCount ?? 0,
      timeoutRewardProgress: state.timeoutRewardProgress ?? 0,
      timeoutRewardsEarned: state.timeoutRewardsEarned ?? 0,
      prevDayTypes: dedupeTypes(state.prevDayTypes ?? []),
      todayTypes: dedupeTypes(state.todayTypes ?? []),
    };
  }
  const carriedPrevTypes = dedupeTypes([
    ...state.prevDayTypes.filter((type) => state.prevPhase[type] !== 'done'),
    ...state.todayTypes,
  ]);
  const carriedPrevPhase: Record<string, PrevDayPhase> = {};
  const carriedPrevStreaks: Record<string, number> = {};
  for (const type of carriedPrevTypes) {
    if (state.todayTypes.includes(type) && !state.prevDayTypes.includes(type)) {
      carriedPrevPhase[type] = 'pending';
      carriedPrevStreaks[type] = 0;
    } else {
      carriedPrevPhase[type] = state.prevPhase[type] ?? 'pending';
      if (state.prevStreaks[type] !== undefined) {
        carriedPrevStreaks[type] = state.prevStreaks[type];
      }
    }
  }
  return {
    dateKey: todayKey,
    prevDayTypes: carriedPrevTypes,
    todayTypes: [],
    prevStreaks: carriedPrevStreaks,
    todayStreaks: {},
    prevPhase: carriedPrevPhase,
    timeoutRewardProgress: state.timeoutRewardProgress ?? 0,
    timeoutRewardsEarned: state.timeoutRewardsEarned ?? 0,
    lastPracticeType: null,
    normalCompletedDateKey: undefined,
    normalSolvedCount: 0,
  };
}

export function getPracticeCandidates(
  state: DailyLearningState,
  kind: 'prevDay' | 'today',
): string[] {
  return kind === 'prevDay' ? [...state.prevDayTypes] : [...state.todayTypes];
}
