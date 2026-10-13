/**
 * 問題ごとの制限時間タイマー
 *
 * このファイルは 2 つの責務を一元管理する:
 *
 *  1. 制限時間ポリシー (難易度 + 問題形式 → 秒)
 *     - 秒数の調整は TIME_LIMIT_CONFIG の値を変えるだけでよい (一元管理)。
 *     - 全問題共通で必須。無効化する設定は持たない (仕様どおり)。
 *     - 問題ごとに個別の手当てはせず、既存メタデータ (difficulty / category /
 *       figure / image) から機械的に算出する。
 *
 *  2. カウントダウン機構
 *     - 残り時間は「経過時間 (実時間の壁時計 Date.now)」から算出する。
 *       setInterval の呼び出し回数には依存しないため、バックグラウンドタブや
 *       ブラウザー負荷でタイマーが遅れても、復帰時に正しく (期限切れなら 0 に)
 *       判定される。
 *     - タイマーは「問題ID」を鍵に期限 (絶対時刻ミリ秒) を保持する。同じ問題の
 *       再描画・再マウントでは既存の期限を再利用し、新しい問題IDのときだけ
 *       新しい期限を作る (再描画で時間がリセットされない)。
 */

import type { Problem } from '../types/problem';

/**
 * 制限時間 (秒) の一元設定。
 * 初期値は「学習可能性を重視した現実的な秒数」。難易度が基準、形式が加算する。
 * 各値の根拠は対応するコメントを参照 (後からここだけ変えれば全体に反映される)。
 */
export const TIME_LIMIT_CONFIG = {
  /**
   * 難易度別の基準秒数 (DifficultyLevel 1〜5)。
   * 単純計算を小学生が落ち着いて解く目安。
   * 1:30秒(1桁中心) / 2:45秒 / 3:60秒(標準) / 4:90秒(複数段階) / 5:120秒(長い論述・复杂)
   */
  baseSecondsByLevel: { 1: 30, 2: 45, 3: 60, 4: 90, 5: 120 } as Record<number, number>,
  /**
   * 難易度が取得できないときの安全な既定 (基準) 秒数。
   * 中程度の難易度 (level 3 相当) に相当する 60 秒を既定とする。
   */
  defaultBaseSeconds: 60,
  /** 文章を読んで解く問題 (文章題) に加算する秒。読解の時間を確保する。 */
  wordProblemBonusSeconds: 20,
  /** 図 (figure) を読む問題に加算する秒。図形の観察・読み取り用。 */
  figureBonusSeconds: 20,
  /** 下限 (秒)。単純計算でも極端に短くしない。 */
  minSeconds: 30,
  /** 上限 (秒)。極端に長くしない。 */
  maxSeconds: 300,
};

/**
 * 文章読解を要するカテゴリ (単純な計算入力より多めの時間を与える)。
 * ここに無い integer / decimal / fraction / numberTheory / expression は
 * 計算主体のため基準秒数のみを適用する。
 */
const WORD_PROBLEM_CATEGORIES: ReadonlySet<string> = new Set([
  'ratio',
  'speed',
  'geometry',
  'data',
  'combinatorics',
  'realWorld',
]);

/**
 * 時間切れ時に userAnswer へ記録する文字列。
 * ユーザーの入力を正答として扱わないよう、時間切れを明示的に区別する。
 */
export const TIME_OUT_USER_ANSWER = '（時間切れ）';

/** 判定に必要な問題メタデータの最小集合 (既存メタデータを優先して再利用) */
type TimeLimitProblem = Pick<Problem, 'difficulty' | 'category' | 'figure'>;

/**
 * 問題の制限時間 (秒) を算出する。
 * - 難易度が主体 (基準秒数)。
 * - 問題形式 (文章題 / 図) で加算し、読解問題に単純計算と同じ短い秒を与えない。
 * - difficulty が取得できない場合は安全な既定値を使う。
 * - 常に [minSeconds, maxSeconds] に収める。
 */
export function getTimeLimitSeconds(
  problem: TimeLimitProblem | null | undefined,
): number {
  const cfg = TIME_LIMIT_CONFIG;
  const level = problem?.difficulty?.level;
  const base = (level != null ? cfg.baseSecondsByLevel[level] : undefined) ?? cfg.defaultBaseSeconds;

  let total = base;
  if (problem && WORD_PROBLEM_CATEGORIES.has(problem.category)) {
    total += cfg.wordProblemBonusSeconds;
  }
  if (problem?.figure) total += cfg.figureBonusSeconds;

  return Math.min(cfg.maxSeconds, Math.max(cfg.minSeconds, total));
}

/**
 * 期限 (絶対時刻) と現在時刻から残り秒数を算出する。
 * 経過時間ベース (tick 回数に非依存)。0 秒以下は 0 に丸める (負値を出さない)。
 */
export function computeRemainingSec(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/** 期限に達しているか (絶対時刻ベース) */
export function isDeadlineReached(deadlineMs: number, nowMs: number): boolean {
  return nowMs >= deadlineMs;
}

export interface ActiveTimer {
  /** 期限を紐付ける問題の安定した識別子 */
  problemId: string;
  /** 絶対期限 (Date.now 基準のミリ秒) */
  deadlineMs: number;
  /** その問題の制限秒数 */
  limitSec: number;
}

/**
 * 現在表示中の問題タイマー (1 問分)。
 * 問題IDが変われば作り直し、同じ問題IDなら期限をそのまま再利用する。
 */
let activeTimer: ActiveTimer | null = null;

/**
 * 問題タイマーを開始 (または既存のものを再利用) する。
 * - 同一 problemId → 既存の期限を返す (再描画・再マウントで時間をリセットしない)。
 * - 新しい problemId → 新しい期限 (now + limit) を作る。
 */
export function startOrReuseTimer(
  problemId: string,
  limitSec: number,
  nowMs: number,
): ActiveTimer {
  if (activeTimer && activeTimer.problemId === problemId) {
    return activeTimer;
  }
  activeTimer = { problemId, deadlineMs: nowMs + limitSec * 1000, limitSec };
  return activeTimer;
}

/** 現在のアクティブタイマーを取得 (テスト・デバッグ用) */
export function getActiveTimer(): ActiveTimer | null {
  return activeTimer;
}

/** タイマーストアをリセット (テスト用) */
export function resetTimerStore(): void {
  activeTimer = null;
}

export interface CountdownController {
  /** タイマーを停止する (不要な間隔処理を残さない) */
  stop: () => void;
  /** 現在の残り秒を返す */
  getRemainingSec: () => number;
}

export interface StartCountdownOptions {
  deadlineMs: number;
  /** 残り秒数が変わるたびに呼ばれる (表示更新用) */
  onTick: (remainingSec: number) => void;
  /** 期限に達したときに 1 回だけ呼ばれる */
  onExpire: () => void;
  /**
   * 表示更新の間隔 (ミリ秒)。残り秒は毎回 wall clock から再計算するため、
   * この間隔は精度に影響しない (呼び出し回数で減算しない)。
   */
  intervalMs?: number;
  /** 時刻取得 (テスト差し替え用)。既定は Date.now (実時間の壁時計) */
  now?: () => number;
}

/**
 * カウントダウンを開始する (React 非依存の純粋ロジック)。
 * - 初回に即時 tick し、残り秒を通知する (すでに期限切れなら即 expiry)。
 * - interval ごとに wall clock から残り秒を再計算して通知する。
 * - 期限に達したら onExpire を 1 回だけ呼び、自ら停止する (負値通知なし)。
 */
export function startCountdown(options: StartCountdownOptions): CountdownController {
  const { deadlineMs, onTick, onExpire, intervalMs = 250 } = options;
  const now = options.now ?? (() => Date.now());

  let stopped = false;
  let fired = false;
  let handle: ReturnType<typeof setInterval> | null = null;

  const stop = (): void => {
    stopped = true;
    if (handle != null) {
      clearInterval(handle);
      handle = null;
    }
  };

  const tick = (): void => {
    if (stopped) return;
    const remaining = computeRemainingSec(deadlineMs, now());
    onTick(remaining);
    if (remaining <= 0 && !fired) {
      fired = true;
      stop();
      onExpire();
    }
  };

  handle = setInterval(tick, intervalMs);
  // 初回表示と「すでに期限切れ」の即時判定のため、開始時に一度だけ即時 tick する。
  tick();

  return {
    stop,
    getRemainingSec: () => computeRemainingSec(deadlineMs, now()),
  };
}
