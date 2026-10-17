import { describe, expect, it } from 'vitest';
import type { AnswerRecord } from '../types/history';
import type { Problem } from '../types/problem';
import {
  ADAPTIVE_TIME_LIMIT_CONFIG,
  getTimeLimitSeconds,
  TIME_LIMIT_CONFIG,
} from './quizTimer';
import {
  computeAdaptiveLimitSeconds,
  computeTimeoutReliefSeconds,
  countRecentTimeouts,
  filterOutliersIqr,
  isValidAnswerTime,
  isValidSampleRecord,
  meanOf,
  quantileLinear,
  resolveTimeLimitSeconds,
  selectAdaptiveSampleTimes,
} from './adaptiveTimeLimit';

let seq = 0;

/**
 * 履歴レコードを生成する。
 * id と answeredAt は自動採番され、配列に追加した順が時系列順になる。
 * partial で明示指定した場合はその値が優先される。
 */
function record(partial: Partial<AnswerRecord> = {}): AnswerRecord {
  seq += 1;
  return {
    id: seq,
    problemId: `prob_${seq}`,
    problemType: 'integer-add',
    category: 'integer',
    isCorrect: true,
    answerTimeSec: 10,
    answeredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + seq * 1000).toISOString(),
    difficultyLevel: 3,
    question: '問題',
    userAnswer: '1',
    correctAnswer: '1',
    ...partial,
  };
}

/** 指定した解答時間の正答記録を n 件作る */
function correctRecords(times: number[]): AnswerRecord[] {
  return times.map((timeSec) => record({ answerTimeSec: timeSec }));
}

const TYPE = 'integer-add';
const LEVEL = 3;

/** 現行ポリシーの初期時間と一致することを確かめるヘルパー */
function expectInitialLimit(problem: Problem): void {
  expect(resolveTimeLimitSeconds(problem, [])).toBe(getTimeLimitSeconds(problem));
  expect(resolveTimeLimitSeconds(problem, null)).toBe(getTimeLimitSeconds(problem));
  expect(resolveTimeLimitSeconds(problem, undefined)).toBe(getTimeLimitSeconds(problem));
}

function problem(partial: Partial<Problem> = {}): Problem {
  return {
    id: 'prob_test',
    type: TYPE,
    category: 'integer',
    difficulty: {
      level: LEVEL,
      components: {
        calculationComplexity: 3,
        numberComplexity: 3,
        reasoningComplexity: 3,
        readingComplexity: 3,
      },
    },
    question: '問題',
    answer: { kind: 'integer', value: 1 },
    parameters: {},
    ...partial,
  };
}

describe('設定値 (既存ポリシーの維持)', () => {
  it('TIME_LIMIT_CONFIG の初期値は変更しない', () => {
    expect(TIME_LIMIT_CONFIG.baseSecondsByLevel).toEqual({
      1: 30,
      2: 45,
      3: 60,
      4: 90,
      5: 120,
    });
    expect(TIME_LIMIT_CONFIG.defaultBaseSeconds).toBe(60);
    expect(TIME_LIMIT_CONFIG.wordProblemBonusSeconds).toBe(20);
    expect(TIME_LIMIT_CONFIG.figureBonusSeconds).toBe(20);
    expect(TIME_LIMIT_CONFIG.minSeconds).toBe(30);
    expect(TIME_LIMIT_CONFIG.maxSeconds).toBe(300);
  });

  it('ADAPTIVE_TIME_LIMIT_CONFIG の仕様値', () => {
    expect(ADAPTIVE_TIME_LIMIT_CONFIG).toEqual({
      evaluationWindow: 20,
      minSamples: 8,
      minKeptSamples: 3,
      factor: 0.9,
      minSeconds: 20,
      maxSeconds: 300,
      timeoutRelief: {
        window: 10,
        minTimeouts: 3,
        factor: 1.5,
      },
    });
  });
});

describe('isValidAnswerTime', () => {
  it('有限の正数だけを有効にする (0・負数・NaN・Infinity・欠損を除外)', () => {
    expect(isValidAnswerTime(1)).toBe(true);
    expect(isValidAnswerTime(0.1)).toBe(true);
    expect(isValidAnswerTime(0)).toBe(false);
    expect(isValidAnswerTime(-1)).toBe(false);
    expect(isValidAnswerTime(-Infinity)).toBe(false);
    expect(isValidAnswerTime(Infinity)).toBe(false);
    expect(isValidAnswerTime(NaN)).toBe(false);
    expect(isValidAnswerTime(undefined)).toBe(false);
    expect(isValidAnswerTime(null)).toBe(false);
    expect(isValidAnswerTime('10')).toBe(false);
  });
});

describe('isValidSampleRecord', () => {
  it('正答かつ時間切れでない記録だけを採用する', () => {
    expect(isValidSampleRecord(record())).toBe(true);
    expect(isValidSampleRecord(record({ isCorrect: false }))).toBe(false);
    expect(isValidSampleRecord(record({ isTimedOut: true, isCorrect: false }))).toBe(false);
    // 時間切れは isCorrect=false だが、フラグだけ立った記録も除外する
    expect(isValidSampleRecord(record({ isTimedOut: true, isCorrect: true }))).toBe(false);
    expect(isValidSampleRecord(record({ answerTimeSec: 0 }))).toBe(false);
    expect(isValidSampleRecord(record({ answerTimeSec: NaN }))).toBe(false);
    expect(
      isValidSampleRecord(record({ answerTimeSec: undefined as unknown as number })),
    ).toBe(false);
  });
});

describe('quantileLinear (線形補間)', () => {
  it('位置 (n-1)×p の線形補間で四分位数を求める', () => {
    const sorted = [10, 11, 12, 13, 14, 15, 16, 90];
    expect(quantileLinear(sorted, 0.25)).toBeCloseTo(11.75, 10);
    expect(quantileLinear(sorted, 0.75)).toBeCloseTo(15.25, 10);
  });

  it('n=1 はその値を返す', () => {
    expect(quantileLinear([7], 0.25)).toBe(7);
    expect(quantileLinear([7], 0.75)).toBe(7);
  });

  it('位置が整数なら補間しない', () => {
    // n=5 → pos = 4×0.25 = 1 (整数) → 2番目
    expect(quantileLinear([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });

  it('空配列はエラー (呼び出し側で初期時間にフォールバック)', () => {
    expect(() => quantileLinear([], 0.25)).toThrow();
  });
});

describe('meanOf', () => {
  it('単純平均を返す', () => {
    expect(meanOf([10, 11, 12, 13, 14, 15, 16])).toBe(13);
    expect(meanOf([3])).toBe(3);
  });

  it('空配列はエラー', () => {
    expect(() => meanOf([])).toThrow();
  });
});

describe('filterOutliersIqr (外れ値除外)', () => {
  it('指定の計算例: [10,11,12,13,14,15,16,90] から 90 を除外する', () => {
    const kept = filterOutliersIqr([10, 11, 12, 13, 14, 15, 16, 90]);
    expect(kept).toEqual([10, 11, 12, 13, 14, 15, 16]);
    // 残り7件の平均 = 13、13×0.9 = 11.7、切り上げ = 12
    expect(meanOf(kept)).toBe(13);
    expect(Math.ceil(meanOf(kept) * ADAPTIVE_TIME_LIMIT_CONFIG.factor)).toBe(12);
  });

  it('上側・下側の両方の外れ値を除外する', () => {
    // Q1=10.75, Q3=15.25, IQR=4.5 → lower=4.0, upper=22.0 → 1 と 90 を除外
    const kept = filterOutliersIqr([1, 10, 11, 12, 13, 14, 15, 16, 90]);
    expect(kept).toEqual([10, 11, 12, 13, 14, 15, 16]);
  });

  it('IQR が 0 のときは外れ値除外をしない (全件採用)', () => {
    const values = [20, 20, 20, 20, 20, 20, 20, 20];
    expect(filterOutliersIqr(values)).toEqual(values);
  });

  it('IQR 境界値そのものは除外しない (下限・上限ちょうどを保持)', () => {
    // n=8 → Q1=2.75, Q3=6.25, IQR=3.5 → lower=-2.5, upper=11.5
    const boundary = [1, 2, 3, 4, 5, 6, 7, 11.5];
    expect(filterOutliersIqr(boundary)).toEqual(boundary);
    // 境界を 0.5 超えた値だけ除外する
    expect(filterOutliersIqr([1, 2, 3, 4, 5, 6, 7, 12])).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('除外後の件数が minKeptSamples (3) 未満なら除外前の記録を返す', () => {
    // 8 件以上では Q1/Q3 の位置関係上ほぼ発生しないが、仕様どおり防御する。
    // 入力自体が 3 件未満の場合に「除外後 3 件未満 → 除外前」が成立することを確認。
    expect(filterOutliersIqr([10, 1000])).toEqual([10, 1000]);
    expect(filterOutliersIqr([100])).toEqual([100]);
  });

  it('元の配列を書き換えない (履歴データを破壊しない)', () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 90];
    const copy = [...values];
    filterOutliersIqr(values);
    expect(values).toEqual(copy);
  });
});

describe('selectAdaptiveSampleTimes (グループ抽出と直近20件)', () => {
  it('problemType と difficultyLevel の両方が一致する記録だけを集める', () => {
    const records = [
      ...correctRecords([10, 10, 10, 10, 10, 10, 10, 10]),
      record({ problemType: 'other-type', answerTimeSec: 900 }),
      record({ difficultyLevel: 2, answerTimeSec: 900 }),
      record({ difficultyLevel: 5, answerTimeSec: 900 }),
    ];
    const times = selectAdaptiveSampleTimes(records, TYPE, LEVEL);
    expect(times).toHaveLength(8);
    expect(times.every((time) => time === 10)).toBe(true);
  });

  it('時系列 (answeredAt) 昇順に並べてから直近 20 件に絞る', () => {
    // 古い 5 件 (300秒) + 新しい 20 件 (100秒)。配列は時系列と逆順に入れる。
    const oldRecords = [...Array(5)].map(() => record({ answerTimeSec: 300 }));
    const newRecords = [...Array(20)].map(() => record({ answerTimeSec: 100 }));
    const records = [...newRecords, ...oldRecords]; // 入力順は新しいものが先頭
    const times = selectAdaptiveSampleTimes(records, TYPE, LEVEL);
    expect(times).toHaveLength(20);
    // 直近 20 件 = 新しい 20 件 (古い 300 秒は選ばれない)
    expect(times.every((time) => time === 100)).toBe(true);
  });

  it('直近 20 件を超える古い記録は切り捨てる (件数境界)', () => {
    const records = [...Array(20)].map(() => record({ answerTimeSec: 100 }));
    expect(selectAdaptiveSampleTimes(records, TYPE, LEVEL)).toHaveLength(20);
    const over = [...records, record({ answerTimeSec: 300 })];
    expect(selectAdaptiveSampleTimes(over, TYPE, LEVEL)).toHaveLength(20);
  });

  it('同じ解答記録 (同一 id) を二重に数えない', () => {
    const duplicated = record({ answerTimeSec: 10 });
    const records = Array.from({ length: 8 }, () => duplicated);
    // 8 回入っているが同一レコードなので 1 件
    expect(selectAdaptiveSampleTimes(records, TYPE, LEVEL)).toHaveLength(1);

    const eight = [...Array(8)].map(() => record({ answerTimeSec: 10 }));
    const withDuplicate = [...eight, eight[0], eight[3]];
    expect(selectAdaptiveSampleTimes(withDuplicate, TYPE, LEVEL)).toHaveLength(8);
  });

  it('不正解・時間切れ・無効な時間の記録は候補にしない', () => {
    const records = [
      ...correctRecords([10, 10, 10, 10]),
      record({ isCorrect: false, answerTimeSec: 10 }),
      record({ isTimedOut: true, isCorrect: false, answerTimeSec: 45 }),
      record({ answerTimeSec: 0 }),
      record({ answerTimeSec: NaN }),
      record({ answerTimeSec: -5 }),
      record({ answerTimeSec: Infinity }),
      record({ answerTimeSec: undefined as unknown as number }),
    ];
    expect(selectAdaptiveSampleTimes(records, TYPE, LEVEL)).toEqual([10, 10, 10, 10]);
  });
});

describe('computeAdaptiveLimitSeconds (適応型制限時間の計算)', () => {
  it('履歴 0 件は null (初期時間へフォールバック)', () => {
    expect(computeAdaptiveLimitSeconds([], TYPE, LEVEL)).toBeNull();
  });

  it('7 件は null、8 件で適応計算する (件数境界)', () => {
    expect(
      computeAdaptiveLimitSeconds(correctRecords([10, 11, 12, 13, 14, 15, 16]), TYPE, LEVEL),
    ).toBeNull();
    const eight = correctRecords([10, 11, 12, 13, 14, 15, 16, 90]);
    expect(eight).toHaveLength(8);
    // 90 を外れ値除外 → 平均 13 → ceil(13×0.9) = 12 → 下限 20 秒で 20
    expect(computeAdaptiveLimitSeconds(eight, TYPE, LEVEL)).toBe(20);
  });

  it('指定の計算例: 90 秒を外れ値として除外し、残り 7 件の平均 × 0.9 を切り上げる', () => {
    const records = correctRecords([10, 11, 12, 13, 14, 15, 16, 90]);
    // 除外 → 平均 13 → 13×0.9 = 11.7 → 切り上げ = 12 (中間計算)
    const kept = filterOutliersIqr(records.map((r) => r.answerTimeSec));
    expect(kept).toEqual([10, 11, 12, 13, 14, 15, 16]);
    expect(Math.ceil(meanOf(kept) * 0.9)).toBe(12);
    // 下限 20 秒を適用した最終値が適応型制限時間 (仕様: 下限は 20 秒)
    expect(computeAdaptiveLimitSeconds(records, TYPE, LEVEL)).toBe(20);
  });

  it('ceil による端数処理 (切り上げ)', () => {
    // 90 を除外 → 平均 23 → 23×0.9 = 20.7 → 切り上げ 21 (切り捨てなら 20)
    const records = correctRecords([20, 21, 22, 23, 24, 25, 26, 90]);
    expect(computeAdaptiveLimitSeconds(records, TYPE, LEVEL)).toBe(21);
  });

  it('不正解・時間切れは集計から除外する (件数が減る)', () => {
    // 正答 8 件 + 不正解 2 件 → 正答 8 件だけが対象
    const records = [
      ...correctRecords([100, 100, 100, 100, 100, 100, 100, 100]),
      record({ isCorrect: false, answerTimeSec: 500 }),
      record({ isTimedOut: true, isCorrect: false, answerTimeSec: 45 }),
    ];
    expect(computeAdaptiveLimitSeconds(records, TYPE, LEVEL)).toBe(90);

    // 正答 7 件 + 不正解 1 件 → 有効 7 件 < 8 → 初期時間 (null)
    const sevenOnly = [
      ...correctRecords([100, 100, 100, 100, 100, 100, 100]),
      record({ isCorrect: false, answerTimeSec: 500 }),
    ];
    expect(computeAdaptiveLimitSeconds(sevenOnly, TYPE, LEVEL)).toBeNull();
  });

  it('0・負数・NaN・Infinity・欠損の時間データを除外する', () => {
    const invalid = [
      ...correctRecords([100, 100, 100, 100, 100, 100, 100]),
      record({ answerTimeSec: 0 }),
      record({ answerTimeSec: -30 }),
      record({ answerTimeSec: NaN }),
      record({ answerTimeSec: Infinity }),
      record({ answerTimeSec: undefined as unknown as number }),
    ];
    // 有効は 7 件 → 初期時間へ
    expect(computeAdaptiveLimitSeconds(invalid, TYPE, LEVEL)).toBeNull();

    // 有効 8 件 + 無効 4 件 → 有効 8 件だけで計算
    const withValid = [...invalid, record({ answerTimeSec: 100 })];
    expect(computeAdaptiveLimitSeconds(withValid, TYPE, LEVEL)).toBe(90);
  });

  it('IQR が 0 (全件同値) のときも平均を計算する', () => {
    expect(
      computeAdaptiveLimitSeconds(correctRecords([20, 20, 20, 20, 20, 20, 20, 20]), TYPE, LEVEL),
    ).toBe(20);
    expect(
      computeAdaptiveLimitSeconds(correctRecords([100, 100, 100, 100, 100, 100, 100, 100]), TYPE, LEVEL),
    ).toBe(90);
  });

  it('問題タイプや難易度が異なる履歴を混ぜない', () => {
    const records = [
      ...correctRecords([100, 100, 100, 100, 100, 100, 100, 100]),
      ...[...Array(8)].map(() => record({ problemType: 'other-type', answerTimeSec: 300 })),
      ...[...Array(8)].map(() => record({ difficultyLevel: 2, answerTimeSec: 300 })),
    ];
    // 対象グループ 8 件の 100 秒だけ → 90。他のグループの 300 秒が混入していれば別の値になる
    expect(computeAdaptiveLimitSeconds(records, TYPE, LEVEL)).toBe(90);
    // グループごとに独立して計算される
    expect(computeAdaptiveLimitSeconds(records, 'other-type', LEVEL)).toBe(270);
    expect(computeAdaptiveLimitSeconds(records, TYPE, 2)).toBe(270);
    // グループが存在しないキーは件数不足で初期時間へ
    expect(computeAdaptiveLimitSeconds(records, 'unknown-type', LEVEL)).toBeNull();
    expect(computeAdaptiveLimitSeconds(records, TYPE, 4)).toBeNull();
  });

  it('グループ内の直近 20 件だけで計算する', () => {
    // 古い 5 件 (5 秒) + 新しい 20 件 (100 秒)。入力は時系列と逆順。
    const oldRecords = [...Array(5)].map(() => record({ answerTimeSec: 5 }));
    const newRecords = [...Array(20)].map(() => record({ answerTimeSec: 100 }));
    const records = [...newRecords, ...oldRecords];
    // 直近 20 件 = 100 秒 → 90。古い 5 秒が混ざれば別の値になる
    expect(computeAdaptiveLimitSeconds(records, TYPE, LEVEL)).toBe(90);
  });

  it('下限 20 秒の適用', () => {
    // 平均 5 秒 → ceil(4.5) = 5 → 下限 20
    expect(
      computeAdaptiveLimitSeconds(correctRecords([5, 5, 5, 5, 5, 5, 5, 6]), TYPE, LEVEL),
    ).toBe(20);
    // 平均 22 秒 → ceil(19.8) = 20 → 下限ちょうど
    expect(
      computeAdaptiveLimitSeconds(correctRecords([22, 22, 22, 22, 22, 22, 22, 22]), TYPE, LEVEL),
    ).toBe(20);
    // 平均 23 秒 → ceil(20.7) = 21 → 下限を上回る
    expect(
      computeAdaptiveLimitSeconds(correctRecords([23, 23, 23, 23, 23, 23, 23, 23]), TYPE, LEVEL),
    ).toBe(21);
  });

  it('上限 300 秒の適用', () => {
    // 平均 400 秒 → 360 → 上限 300
    expect(
      computeAdaptiveLimitSeconds(
        correctRecords([400, 400, 400, 400, 400, 400, 400, 400]),
        TYPE,
        LEVEL,
      ),
    ).toBe(300);
    // 遅いユーザーには初期値より長く与える (平均 100 秒 → 90 秒)
    expect(
      computeAdaptiveLimitSeconds(
        correctRecords([100, 100, 100, 100, 100, 100, 100, 100]),
        TYPE,
        LEVEL,
      ),
    ).toBe(90);
  });
});

describe('resolveTimeLimitSeconds (表示・保存で使う決定)', () => {
  it('履歴 0 件・null・undefined のときは現行の初期時間と同じ', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const target = problem({
        difficulty: {
          level: level as 1,
          components: {
            calculationComplexity: 1,
            numberComplexity: 1,
            reasoningComplexity: 1,
            readingComplexity: 1,
          },
        },
      });
      expectInitialLimit(target);
      // 難易度別初期値そのもの (レベル別)
      expect(resolveTimeLimitSeconds(target, [])).toBe(
        TIME_LIMIT_CONFIG.baseSecondsByLevel[level],
      );
    }
  });

  it('初期時間の文章題・図の加算ポリシーもそのまま維持する', () => {
    const wordProblem = problem({ category: 'ratio' });
    expect(resolveTimeLimitSeconds(wordProblem, [])).toBe(
      TIME_LIMIT_CONFIG.baseSecondsByLevel[LEVEL] + TIME_LIMIT_CONFIG.wordProblemBonusSeconds,
    );
    const figureProblem = problem();
    expect(resolveTimeLimitSeconds(figureProblem, [])).toBe(getTimeLimitSeconds(figureProblem));
  });

  it('有効記録が 7 件までは初期時間、8 件で適応値になる', () => {
    const target = problem();
    const seven = correctRecords([100, 100, 100, 100, 100, 100, 100]);
    expect(resolveTimeLimitSeconds(target, seven)).toBe(getTimeLimitSeconds(target));
    const eight = [...seven, record({ answerTimeSec: 100 })];
    expect(resolveTimeLimitSeconds(target, eight)).toBe(90);
  });

  it('計算に失敗しても初期時間にフォールバックする', () => {
    const broken = { ...problem(), difficulty: undefined } as unknown as Problem;
    const eight = correctRecords([100, 100, 100, 100, 100, 100, 100, 100]);
    expect(resolveTimeLimitSeconds(broken, eight)).toBe(getTimeLimitSeconds(broken));
    expect(resolveTimeLimitSeconds(broken, [])).toBe(getTimeLimitSeconds(broken));
  });

  it('同じ入力なら常に同じ値を返す (画面表示と保存値を一致させる)', () => {
    const target = problem();
    const eight = correctRecords([100, 100, 100, 100, 100, 100, 100, 100]);
    const first = resolveTimeLimitSeconds(target, eight);
    expect(first).toBe(90);
    expect(resolveTimeLimitSeconds(target, eight)).toBe(first);
    expect(resolveTimeLimitSeconds(target, eight)).toBe(first);
  });

  it('履歴を書き換えない (読み取り専用)', () => {
    const records = correctRecords([100, 100, 100, 100, 100, 100, 100, 900]);
    const snapshot = JSON.stringify(records);
    resolveTimeLimitSeconds(problem(), records);
    expect(JSON.stringify(records)).toBe(snapshot);
  });
});

describe('countRecentTimeouts (直近の時間切れを数える)', () => {
  it('同一 (problemType, difficultyLevel) の時間切れだけを数える', () => {
    const records = [
      record({ isTimedOut: true }),
      record({ isTimedOut: true }),
      record({ isCorrect: false }), // 通常の誤答は数えない
      record({ problemType: 'other-type', isTimedOut: true }), // 型が違う
      record({ difficultyLevel: 2, isTimedOut: true }), // 難易度が違う
    ];
    expect(countRecentTimeouts(records, TYPE, LEVEL)).toBe(2);
  });

  it('時系列順で直近 window (10件) に絞って数える', () => {
    // window より多い 12 件の時間切れを作るが、直近10件だけが対象
    const records = Array.from({ length: 12 }, () => record({ isTimedOut: true }));
    expect(countRecentTimeouts(records, TYPE, LEVEL)).toBe(
      ADAPTIVE_TIME_LIMIT_CONFIG.timeoutRelief.window,
    );
  });

  it('時間切れが無ければ 0', () => {
    expect(countRecentTimeouts(correctRecords([10, 20, 30]), TYPE, LEVEL)).toBe(0);
  });

  it('入力配列を書き換えない (読み取り専用)', () => {
    const records = [record({ isTimedOut: true }), record({ isTimedOut: true })];
    const snapshot = JSON.stringify(records);
    countRecentTimeouts(records, TYPE, LEVEL);
    expect(JSON.stringify(records)).toBe(snapshot);
  });
});

describe('computeTimeoutReliefSeconds (時間切れ続時の緩和)', () => {
  it('時間切れが minTimeouts 未満なら null (緩和しない)', () => {
    const two = [record({ isTimedOut: true }), record({ isTimedOut: true })];
    expect(computeTimeoutReliefSeconds(problem(), two)).toBeNull();
    expect(computeTimeoutReliefSeconds(problem(), [])).toBeNull();
  });

  it('時間切れが minTimeouts 以上なら初期値 × factor を返す', () => {
    const three = [
      record({ isTimedOut: true }),
      record({ isTimedOut: true }),
      record({ isTimedOut: true }),
    ];
    const base = getTimeLimitSeconds(problem()); // lv3 integer = 60
    expect(computeTimeoutReliefSeconds(problem(), three)).toBe(
      Math.ceil(base * ADAPTIVE_TIME_LIMIT_CONFIG.timeoutRelief.factor),
    );
  });

  it('他の型・難易度の時間切れは数えず null', () => {
    const otherType = Array.from({ length: 4 }, () =>
      record({ problemType: 'other-type', isTimedOut: true }),
    );
    expect(computeTimeoutReliefSeconds(problem(), otherType)).toBeNull();
  });

  it('履歴が null・undefined・空なら null', () => {
    expect(computeTimeoutReliefSeconds(problem(), null)).toBeNull();
    expect(computeTimeoutReliefSeconds(problem(), undefined)).toBeNull();
    expect(computeTimeoutReliefSeconds(problem(), [])).toBeNull();
  });
});

describe('resolveTimeLimitSeconds (時間切れ緩和の統合)', () => {
  it('正答標本が不足でも時間切れが続けば初期値を緩和する', () => {
    // 3件だけの時間切れ (適応計算は発動せず、緩和だけが効く)
    const timeouts = [
      record({ isTimedOut: true }),
      record({ isTimedOut: true }),
      record({ isTimedOut: true }),
    ];
    const resolved = resolveTimeLimitSeconds(problem(), timeouts);
    const base = getTimeLimitSeconds(problem());
    expect(resolved).toBe(Math.ceil(base * ADAPTIVE_TIME_LIMIT_CONFIG.timeoutRelief.factor));
    // 初期値そのものではない (緩和されている)
    expect(resolved).not.toBe(base);
  });

  it('正答標本が十分 (8件以上) なら適応値を優先し緩和を使わない', () => {
    // 十分な正答標本 + その上での時間切れ → 通常の適応値 (90) が使われる
    const eight = correctRecords([100, 100, 100, 100, 100, 100, 100, 100]);
    const withTimeouts = [...eight, ...Array.from({ length: 5 }, () => record({ isTimedOut: true }))];
    expect(resolveTimeLimitSeconds(problem(), withTimeouts)).toBe(90);
  });

  it('時間切れが少なければ初期値に戻る', () => {
    const one = [record({ isTimedOut: true })];
    expect(resolveTimeLimitSeconds(problem(), one)).toBe(getTimeLimitSeconds(problem()));
  });
});


