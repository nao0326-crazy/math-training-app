/**
 * 問題ごとの制限時間タイマーのテスト
 *
 * 時間に関する挙動は Vitest のフェイクタイマー (setInterval / Date を差し替え) で
 * 実時間を待たずに検証する。制限時間ポリシー (難易度 + 形式) とカウントダウン機構
 * (経過時間ベース・期限は問題IDで管理) の両方を確認する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TIME_LIMIT_CONFIG,
  TIME_OUT_USER_ANSWER,
  computeRemainingSec,
  getTimeLimitSeconds,
  getActiveTimer,
  isDeadlineReached,
  resetTimerStore,
  startCountdown,
  startOrReuseTimer,
} from './quizTimer';

type TP = NonNullable<Parameters<typeof getTimeLimitSeconds>[0]>;

/** 制限時間算出に必要な最小メタデータの問題を生成する */
function makeProblem(
  opts: {
    level?: number;
    category?: string;
    hasFigure?: boolean;
    hasImage?: boolean;
    noDifficulty?: boolean;
  } = {},
): TP {
  const lv = opts.level ?? 3;
  const difficulty = opts.noDifficulty
    ? undefined
    : {
        level: lv,
        components: {
          calculationComplexity: lv,
          numberComplexity: lv,
          reasoningComplexity: lv,
          readingComplexity: lv,
        },
      };
  return {
    difficulty,
    category: opts.category ?? 'integer',
    figure: opts.hasFigure ? ({ figures: [] } as never) : undefined,
    image: opts.hasImage ? ({ src: '/x.svg', altText: 'x' } as never) : undefined,
  } as unknown as TP;
}

const ALL_LEVELS = [1, 2, 3, 4, 5] as const;

describe('制限時間ポリシー: 難易度 + 問題形式', () => {
  it('単純計算は難易度に応じた基準秒数になる', () => {
    expect(getTimeLimitSeconds(makeProblem({ level: 1, category: 'integer' }))).toBe(30);
    expect(getTimeLimitSeconds(makeProblem({ level: 2, category: 'integer' }))).toBe(45);
    expect(getTimeLimitSeconds(makeProblem({ level: 3, category: 'fraction' }))).toBe(60);
    expect(getTimeLimitSeconds(makeProblem({ level: 4, category: 'decimal' }))).toBe(90);
    expect(getTimeLimitSeconds(makeProblem({ level: 5, category: 'numberTheory' }))).toBe(120);
  });

  it('文章題カテゴリは読解時間を確保するため加算される', () => {
    const base = getTimeLimitSeconds(makeProblem({ level: 3, category: 'integer' }));
    for (const category of ['ratio', 'speed', 'geometry', 'data', 'combinatorics', 'realWorld']) {
      const t = getTimeLimitSeconds(makeProblem({ level: 3, category }));
      expect(t).toBe(base + TIME_LIMIT_CONFIG.wordProblemBonusSeconds);
    }
  });

  it('図 (figure) を読む問題は加算される', () => {
    const t = getTimeLimitSeconds(makeProblem({ level: 3, category: 'integer', hasFigure: true }));
    expect(t).toBe(60 + TIME_LIMIT_CONFIG.figureBonusSeconds);
  });

  it('写真・画像 (image) を読む問題は加算される', () => {
    const t = getTimeLimitSeconds(makeProblem({ level: 3, category: 'integer', hasImage: true }));
    expect(t).toBe(60 + TIME_LIMIT_CONFIG.imageBonusSeconds);
  });

  it('難易度が取得できない場合は安全な既定値を使う', () => {
    expect(getTimeLimitSeconds(makeProblem({ noDifficulty: true, category: 'integer' }))).toBe(
      TIME_LIMIT_CONFIG.defaultBaseSeconds,
    );
    expect(getTimeLimitSeconds(null)).toBe(TIME_LIMIT_CONFIG.defaultBaseSeconds);
    expect(getTimeLimitSeconds(undefined)).toBe(TIME_LIMIT_CONFIG.defaultBaseSeconds);
  });

  it('読解・図・写真の問題に、単純計算と同じ短い時間は与えられない', () => {
    for (const lv of ALL_LEVELS) {
      const simple = getTimeLimitSeconds(makeProblem({ level: lv, category: 'integer' }));
      const word = getTimeLimitSeconds(makeProblem({ level: lv, category: 'realWorld' }));
      const withImage = getTimeLimitSeconds(makeProblem({ level: lv, category: 'integer', hasImage: true }));
      const geometry = getTimeLimitSeconds(makeProblem({ level: lv, category: 'geometry', hasFigure: true }));
      expect(word).toBeGreaterThan(simple);
      expect(withImage).toBeGreaterThan(simple);
      expect(geometry).toBeGreaterThan(simple);
    }
  });

  it('制限時間は上下限 [minSeconds, maxSeconds] に収まる', () => {
    for (const lv of ALL_LEVELS) {
      for (const category of ['integer', 'realWorld', 'geometry', 'speed']) {
        const t = getTimeLimitSeconds(
          makeProblem({ level: lv, category, hasFigure: true, hasImage: true }),
        );
        expect(t).toBeGreaterThanOrEqual(TIME_LIMIT_CONFIG.minSeconds);
        expect(t).toBeLessThanOrEqual(TIME_LIMIT_CONFIG.maxSeconds);
      }
    }
  });
});

describe('残り時間の算出 (経過時間ベース)', () => {
  it('未来の期限は正の残り秒になる (切り上げ)', () => {
    expect(computeRemainingSec(10000, 0)).toBe(10);
    expect(computeRemainingSec(10500, 0)).toBe(11);
    expect(computeRemainingSec(10000, 9000)).toBe(1);
    expect(computeRemainingSec(10000, 9500)).toBe(1);
  });

  it('期限ちょうど・超過は 0 になり、負値にならない', () => {
    expect(computeRemainingSec(10000, 10000)).toBe(0);
    expect(computeRemainingSec(10000, 10001)).toBe(0);
    expect(computeRemainingSec(10000, 99999999)).toBe(0);
  });

  it('期限到達の判定は絶対時刻ベース', () => {
    expect(isDeadlineReached(10000, 9999)).toBe(false);
    expect(isDeadlineReached(10000, 10000)).toBe(true);
    expect(isDeadlineReached(10000, 10001)).toBe(true);
  });
});

describe('期限は問題IDで管理される (再描画でリセットしない)', () => {
  beforeEach(() => resetTimerStore());
  afterEach(() => resetTimerStore());

  it('同じ問題IDなら時間を進めて再取得しても期限を再利用する', () => {
    const t1 = startOrReuseTimer('a', 30, 1000);
    expect(t1.deadlineMs).toBe(31000);
    // 時間が進んだ状態で同じ問題を再取得 (再描画・再マウント相当) → 期限は据え置き
    const t2 = startOrReuseTimer('a', 30, 9000);
    expect(t2.deadlineMs).toBe(31000);
    expect(getActiveTimer()).toBe(t2);
  });

  it('新しい問題IDでは新しい制限時間で始まる', () => {
    startOrReuseTimer('a', 30, 1000);
    const b = startOrReuseTimer('b', 45, 2000);
    expect(b.deadlineMs).toBe(2000 + 45 * 1000);
    expect(b.deadlineMs).not.toBe(31000);
  });

  it('resetTimerStore で状態をリセットできる', () => {
    startOrReuseTimer('a', 30, 1000);
    resetTimerStore();
    expect(getActiveTimer()).toBeNull();
  });
});

describe('カウントダウン機構 (フェイクタイマー)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    resetTimerStore();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetTimerStore();
  });

  it('問題表示時に開始し、残り秒を通知する', () => {
    vi.setSystemTime(1_000_000);
    const onTick = vi.fn();
    const onExpire = vi.fn();
    startCountdown({ deadlineMs: 1_000_000 + 30_000, onTick, onExpire, intervalMs: 250 });
    expect(onTick).toHaveBeenLastCalledWith(30);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('時間が経過すると残り秒が減る (経過時間から算出)', () => {
    vi.setSystemTime(1_000_000);
    const onTick = vi.fn();
    const onExpire = vi.fn();
    startCountdown({ deadlineMs: 1_000_000 + 30_000, onTick, onExpire, intervalMs: 250 });

    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenLastCalledWith(29);

    vi.advanceTimersByTime(5000);
    expect(onTick).toHaveBeenLastCalledWith(24);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('制限時間 0 では即座に時間切れになる', () => {
    vi.setSystemTime(1_000_000);
    const onTick = vi.fn();
    const onExpire = vi.fn();
    startCountdown({ deadlineMs: 1_000_000, onTick, onExpire, intervalMs: 250 });
    expect(onTick).toHaveBeenLastCalledWith(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('時間切れ後も負の残り秒を通知しない', () => {
    vi.setSystemTime(1_000_000);
    const onTick = vi.fn();
    const onExpire = vi.fn();
    startCountdown({ deadlineMs: 1_000_000 + 3_000, onTick, onExpire, intervalMs: 250 });
    vi.advanceTimersByTime(60_000);
    expect(onTick).toHaveBeenLastCalledWith(0);
    for (const [remaining] of onTick.mock.calls) {
      expect(remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('時間切れ処理が二重実行されない', () => {
    vi.setSystemTime(1_000_000);
    const onTick = vi.fn();
    const onExpire = vi.fn();
    startCountdown({ deadlineMs: 1_000_000 + 2_000, onTick, onExpire, intervalMs: 250 });
    vi.advanceTimersByTime(2_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('停止 (stop) 後は不要な処理が残らない', () => {
    vi.setSystemTime(1_000_000);
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const controller = startCountdown({
      deadlineMs: 1_000_000 + 30_000,
      onTick,
      onExpire,
      intervalMs: 250,
    });
    const callsBefore = onTick.mock.calls.length;
    controller.stop();
    vi.advanceTimersByTime(60_000);
    expect(onTick.mock.calls.length).toBe(callsBefore);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('同じ問題への再マウントでも残り時間をリセットしない (期限を継続)', () => {
    vi.setSystemTime(0);
    const timer = startOrReuseTimer('a', 5, Date.now()); // 期限 = 5000
    vi.advanceTimersByTime(3000); // 残り 2 秒

    // 同一 problemId で期限を再取得 → 残りは wall clock から (2 秒) で始まる
    const remounted = startOrReuseTimer('a', 5, Date.now());
    expect(remounted.deadlineMs).toBe(timer.deadlineMs);
    expect(computeRemainingSec(remounted.deadlineMs, Date.now())).toBe(2);
  });

  it('次の問題では新しい制限時間 (全秒) で再開する', () => {
    vi.setSystemTime(0);
    const a = startOrReuseTimer('a', 5, Date.now()); // 期限 = 5000
    vi.setSystemTime(6000); // a は期限切れ
    expect(computeRemainingSec(a.deadlineMs, Date.now())).toBe(0);

    const b = startOrReuseTimer('b', 10, Date.now()); // 新しい問題 = 期限 16000
    expect(computeRemainingSec(b.deadlineMs, Date.now())).toBe(10);
    expect(b.deadlineMs).toBe(16000);
  });

  it('getRemainingSec は wall clock から常に最新の残り秒を返す', () => {
    vi.setSystemTime(1_000_000);
    const controller = startCountdown({
      deadlineMs: 1_000_000 + 30_000,
      onTick: () => {},
      onExpire: () => {},
      intervalMs: 250,
    });
    expect(controller.getRemainingSec()).toBe(30);
    vi.setSystemTime(1_010_000);
    expect(controller.getRemainingSec()).toBe(20);
    controller.stop();
  });
});

describe('時間切れ記録の区別用ユーティリティ', () => {
  it('時間切れの userAnswer は通常の入力と区別される文字列である', () => {
    expect(TIME_OUT_USER_ANSWER).toContain('時間切れ');
  });
});
