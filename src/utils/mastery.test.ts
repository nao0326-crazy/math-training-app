/**
 * 習熟度推定 (utils/mastery) のテスト
 *
 * 仕様の検証ケースとの対応:
 * 1. 初回利用で学習履歴がない場合
 * 2. 既存の学習履歴がある場合
 * 3. 特定の単元だけ正答率が高い場合
 * 4. 単元ごとに得意・不得意が異なる場合
 * 5. 正解と不正解が交互に発生する場合
 * 6. 目標レベルで連続して正解した場合
 * 7. 目標レベルで繰り返し不正解になった場合
 * 8. タイムアウトした場合
 * 9. 最高レベルに到達した場合
 * 10. 出題範囲・対応レベルが限られる場合 (resolveTargetLevel)
 * 11. アプリを再起動した場合 (純関数としての決定性)
 * 12. 既存 (任意フィールド欠損) の学習履歴データ
 */

import { describe, expect, it } from 'vitest';
import type { AnswerRecord } from '../types/history';
import type { DifficultyLevel, DifficultyRange } from '../types/problem';
import {
  HIGH_CONFIDENCE_ATTEMPTS,
  MASTERY_WINDOW,
  MAX_MASTERY_LEVEL,
  STABLE_MIN_ATTEMPTS,
  collectLevelEvidence,
  estimateMasteryLevel,
  estimateSkillMastery,
  isStableEvidence,
  isWeakEvidence,
  resolveTargetLevel,
} from './mastery';

/** 時系列に並ぶ回答記録を作る (answeredAt は呼び出しごとに進む) */
let timestampSeq = 0;
interface RecordSpec {
  /** 問題の内部難易度レベル */
  level: number;
  /** 正解か (既定 true) */
  correct?: boolean;
  /** タイムアウトか (true なら必ず不正解として記録される) */
  timedOut?: boolean;
  /** 技能キー (既定 fraction_add_sub) */
  type?: string;
  /** カテゴリ (既定 fraction) */
  category?: string;
  answerTimeSec?: number;
  timeLimitSec?: number;
}

function makeRecords(specs: RecordSpec[]): AnswerRecord[] {
  return specs.map((spec) => {
    timestampSeq += 1;
    const timedOut = spec.timedOut === true;
    const record: AnswerRecord = {
      problemId: `problem-${timestampSeq}`,
      problemType: spec.type ?? 'fraction_add_sub',
      category: spec.category ?? 'fraction',
      isCorrect: timedOut ? false : spec.correct !== false,
      answerTimeSec: spec.answerTimeSec ?? 10,
      answeredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, timestampSeq)).toISOString(),
      difficultyLevel: spec.level,
      question: 'question',
      userAnswer: 'answer',
      correctAnswer: 'answer',
    };
    if (timedOut) record.isTimedOut = true;
    if (spec.timeLimitSec !== undefined) record.timeLimitSec = spec.timeLimitSec;
    return record;
  });
}

/** count 問を level で正解した履歴の仕様 */
function correctAt(level: number, count: number, spec: Partial<RecordSpec> = {}): RecordSpec[] {
  return Array.from({ length: count }, () => ({ level, correct: true, ...spec }));
}

/** count 問を level で不正解した履歴の仕様 */
function wrongAt(level: number, count: number, spec: Partial<RecordSpec> = {}): RecordSpec[] {
  return Array.from({ length: count }, () => ({ level, correct: false, ...spec }));
}

const ALL_LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

describe('collectLevelEvidence: レベル別証拠の集計', () => {
  it('レベルごとに回答数・正解数・正答率・直近傾向を集計する', () => {
    const evidence = collectLevelEvidence(
      makeRecords([
        { level: 3, correct: false },
        { level: 3 },
        { level: 3 },
        { level: 3 },
        { level: 3 },
      ]),
    );
    expect(evidence).toHaveLength(1);
    const lv3 = evidence[0];
    expect(lv3.level).toBe(3);
    expect(lv3.total).toBe(5);
    expect(lv3.correct).toBe(4);
    expect(lv3.accuracy).toBeCloseTo(0.8);
    expect(lv3.recentTotal).toBe(5);
    expect(lv3.recentCorrect).toBe(4);
    expect(lv3.timedOutCount).toBe(0);
  });

  it('複数レベルをまたいで独立に集計する', () => {
    const evidence = collectLevelEvidence(
      makeRecords([...correctAt(2, 3), ...correctAt(4, 2)]),
    );
    expect(evidence.map((ev) => [ev.level, ev.total])).toEqual([
      [2, 3],
      [4, 2],
    ]);
  });

  it('評価窓を超える古い履歴は集計対象外になる', () => {
    // 25問 (誤答10 + 正解15) → 直近20問だけが評価対象
    //   = 誤答5 + 正解15 (古い誤答5件は窓から外れる)
    const specs = [...wrongAt(2, 10), ...correctAt(2, MASTERY_WINDOW + 5 - 10)];
    const evidence = collectLevelEvidence(makeRecords(specs));
    expect(evidence[0].total).toBe(MASTERY_WINDOW);
    expect(evidence[0].correct).toBe(15);
    expect(evidence[0].accuracy).toBeCloseTo(15 / MASTERY_WINDOW);
  });

  it('解答時間は制限時間比 (補助指標) として、制限時間のある記録だけを集計する', () => {
    const evidence = collectLevelEvidence(
      makeRecords([
        { level: 2, answerTimeSec: 30, timeLimitSec: 60 },
        { level: 2, answerTimeSec: 45, timeLimitSec: 60 },
        { level: 2, answerTimeSec: 99 },
      ]),
    );
    expect(evidence[0].averageTimeRatio).toBeCloseTo((0.5 + 0.75) / 2);
  });

  it('制限時間の記録が無ければ平均比率は null (判定には使わない)', () => {
    const evidence = collectLevelEvidence(makeRecords(correctAt(2, 3)));
    expect(evidence[0].averageTimeRatio).toBeNull();
  });
});

describe('isStableEvidence / isWeakEvidence: 判定条件', () => {
  it('十分な回答数・正答率・直近傾向が揃えば安定', () => {
    const stable = collectLevelEvidence(makeRecords(correctAt(3, 5)))[0];
    expect(isStableEvidence(stable)).toBe(true);
  });

  it('回答数不足・正答率不足・直近傾向不足では安定しない', () => {
    const fewAttempts = collectLevelEvidence(
      makeRecords(correctAt(3, STABLE_MIN_ATTEMPTS - 1)),
    )[0];
    expect(isStableEvidence(fewAttempts)).toBe(false);

    // 累積 3/6 = 0.5 だが直近5問は 1/5 → 安定しない
    const badTrend = collectLevelEvidence(
      makeRecords([
        { level: 3 },
        { level: 3 },
        { level: 3 },
        { level: 3, correct: false },
        { level: 3, correct: false },
        { level: 3, correct: false },
      ]),
    )[0];
    expect(isStableEvidence(badTrend)).toBe(false);
  });

  it('回答数が下限未満なら苦手とも安定とも判定しない (推定は確定しない)', () => {
    const failing = collectLevelEvidence(makeRecords(wrongAt(3, 4)))[0];
    expect(isWeakEvidence(failing)).toBe(false);
    expect(isStableEvidence(failing)).toBe(false);
  });

  it('累積正答率が低ければ苦手と判定する', () => {
    const weak = collectLevelEvidence(makeRecords([...wrongAt(3, 3), ...correctAt(3, 2)]))[0];
    expect(weak.accuracy).toBeCloseTo(0.4);
    expect(isWeakEvidence(weak)).toBe(true);
  });

  it('直近5問がほぼ全て不正解なら、古い正解があっても苦手と判定する', () => {
    const regression = collectLevelEvidence(
      makeRecords([...correctAt(3, 10), ...wrongAt(3, 5)]),
    )[0];
    // 累積 10/15 = 0.667 だが直近5問は 0/5
    expect(regression.accuracy).toBeGreaterThan(0.4);
    expect(regression.recentCorrect).toBe(0);
    expect(isWeakEvidence(regression)).toBe(true);
  });
});

describe('estimateMasteryLevel: 習熟レベルの更新条件', () => {
  it('[1] 履歴が無いときは未評価 (レベル0) で、出題は基礎レベルから始まる', () => {
    expect(estimateMasteryLevel([])).toBe(0);
    expect(resolveTargetLevel(ALL_LEVELS, estimateMasteryLevel([]))).toBe(1);
  });

  it('[2] 既存の学習履歴から初期習熟度を推定できる', () => {
    // Lv3 を安定して解いた履歴 (8問中7問正解・直近も良い) → 習熟3
    const history = makeRecords([
      ...correctAt(3, 7),
      { level: 3, correct: false },
      ...correctAt(3, 6),
    ]);
    expect(estimateMasteryLevel(history)).toBe(3);
  });

  it('[5] 正解と不正解が交互に発生しても習熟レベルは急変しない', () => {
    const history = makeRecords([
      ...correctAt(2, STABLE_MIN_ATTEMPTS),
      { level: 3 },
      { level: 3, correct: false },
      { level: 3 },
      { level: 3, correct: false },
      { level: 3 },
      { level: 3, correct: false },
    ]);
    // Lv2 は安定のまま、Lv3 は混在 → 習熟は 2 のまま (急上昇・急降下しない)
    expect(estimateMasteryLevel(history)).toBe(2);
  });

  it('[6] 目標レベルで連続して正解すると習熟レベルが一段上がる', () => {
    const before = makeRecords([...correctAt(2, STABLE_MIN_ATTEMPTS)]);
    expect(estimateMasteryLevel(before)).toBe(2);

    const after = makeRecords([
      ...correctAt(2, STABLE_MIN_ATTEMPTS),
      ...correctAt(3, STABLE_MIN_ATTEMPTS + 1),
    ]);
    expect(estimateMasteryLevel(after)).toBe(3);
  });

  it('[7] 目標レベルで繰り返し不正解すると習熟レベルが下がり、目標も下がる', () => {
    const history = makeRecords([
      ...correctAt(2, STABLE_MIN_ATTEMPTS),
      ...wrongAt(3, STABLE_MIN_ATTEMPTS),
    ]);
    // Lv3 が苦手 → Lv2 も「一段上が苦手」のため確定扱いにせず、
    // 暫定値 (苦手でない最高レベル 2 の一段下 = 1) に下がる
    expect(estimateMasteryLevel(history)).toBe(1);
    // 出題目標も 3 → 2 に下がる
    expect(resolveTargetLevel(ALL_LEVELS, estimateMasteryLevel(history))).toBe(2);
  });

  it('[7] 一度の不正解では習熟レベルは下がらない', () => {
    const history = makeRecords([
      ...correctAt(3, 6),
      { level: 3, correct: false },
    ]);
    expect(estimateMasteryLevel(history)).toBe(3);
  });

  it('[8] タイムアウトは不正解として扱われ、正解に数えられない', () => {
    const allTimedOut = makeRecords(
      Array.from({ length: 5 }, () => ({ level: 2, timedOut: true })),
    );
    const evidence = collectLevelEvidence(allTimedOut)[0];
    expect(evidence.timedOutCount).toBe(5);
    expect(evidence.correct).toBe(0);
    expect(isStableEvidence(evidence)).toBe(false);
    // 習熟は上がらず、出題は基礎レベルのまま
    expect(estimateMasteryLevel(allTimedOut)).toBe(0);
    expect(resolveTargetLevel(ALL_LEVELS, 0)).toBe(1);

    // タイムアウトを含む場合も正解数には加算されない (4正解 + 1タイムアウト = 正解4)
    const mixed = collectLevelEvidence(
      makeRecords([
        { level: 2 },
        { level: 2 },
        { level: 2 },
        { level: 2 },
        { level: 2, timedOut: true },
      ]),
    )[0];
    expect(mixed.correct).toBe(4);
  });

  it('[9] 最高レベルで安定しても、存在しないレベルを超えない', () => {
    const history = makeRecords(correctAt(5, 8));
    expect(estimateMasteryLevel(history)).toBe(5);
    expect(resolveTargetLevel(ALL_LEVELS, estimateMasteryLevel(history))).toBe(5);
    // 目標レベルの表現も5で頭打ち (6 を作らない)
    const mastery = estimateSkillMastery(history, 'fraction_add_sub', 'fraction');
    expect(mastery.targetLevel).toBeLessThanOrEqual(MAX_MASTERY_LEVEL);
  });

  it('[11] 同じ履歴なら常に同じ結果を返す (再起動・再読込でも復元できる)', () => {
    const history = makeRecords([
      ...correctAt(2, 6),
      ...correctAt(3, 4),
      ...wrongAt(4, 2),
    ]);
    const first = estimateMasteryLevel(history);
    // 配列の並び順が変わっても (保存 → 再読込で時系列ソートされる) 同じ結果
    const shuffled = [...history].reverse();
    expect(estimateMasteryLevel(shuffled)).toBe(first);
    expect(estimateMasteryLevel(structuredClone(history))).toBe(first);
  });

  it('[12] 既存形式の履歴 (任意フィールド欠損) でも推定できる', () => {
    // 旧レコード: isTimedOut / timeLimitSec / scratchAttemptId / submissionId が無い
    const legacy: AnswerRecord[] = Array.from({ length: 6 }, (_, index) => ({
      problemId: `legacy-${index}`,
      problemType: 'integer_addition',
      category: 'integer',
      isCorrect: true,
      answerTimeSec: 8,
      answeredAt: new Date(Date.UTC(2025, 5, 1, 0, 0, index)).toISOString(),
      difficultyLevel: 2,
      question: '1 + 1',
      userAnswer: '2',
      correctAnswer: '2',
    }));
    expect(estimateMasteryLevel(legacy)).toBe(2);
  });
});

describe('resolveTargetLevel: 出題目標レベルの決定 (習熟 + 1)', () => {
  /** リテラルのレベル配列を型付きで渡すためのヘルパー */
  const levels = (...values: number[]): DifficultyLevel[] =>
    values as DifficultyLevel[];

  it('習熟レベルの一段上を出題する (基本ルート)', () => {
    expect(resolveTargetLevel(ALL_LEVELS, 0)).toBe(1);
    expect(resolveTargetLevel(ALL_LEVELS, 2)).toBe(3);
    expect(resolveTargetLevel(ALL_LEVELS, 4)).toBe(5);
  });

  it('[9] 最高レベルでは存在しないレベルを作らず最高を出し続ける', () => {
    expect(resolveTargetLevel(ALL_LEVELS, 5)).toBe(5);
  });

  it('[10] 型が対応しないレベルは出さない (下位型は最高・上位型は最下位へ)', () => {
    // 上限が Lv2 の型: 習熟3 でも Lv3 は存在せず、最高の Lv2 を出し続ける
    expect(resolveTargetLevel(levels(1, 2), 3)).toBe(2);
    // 下限が Lv3 の型: 習熟0 でも存在しない Lv1 を出さず Lv3 から評価を始める
    expect(resolveTargetLevel(levels(3, 4, 5), 0)).toBe(3);
  });

  it('[10] 絞り込み条件 (bounds) がある場合はその範囲内に収める', () => {
    const range: DifficultyRange = { min: 3, max: 5 };
    expect(resolveTargetLevel(ALL_LEVELS, 0, range)).toBe(3);
    expect(resolveTargetLevel(ALL_LEVELS, 2, range)).toBe(3);
    expect(resolveTargetLevel(ALL_LEVELS, 4, range)).toBe(5);
    const lowRange: DifficultyRange = { min: 1, max: 2 };
    expect(resolveTargetLevel(ALL_LEVELS, 4, lowRange)).toBe(2);
  });

  it('[10] 絞り込みと対応レベルが交わらない場合は最も近いレベルに寄せる', () => {
    expect(resolveTargetLevel(levels(4, 5), 0, { min: 1, max: 2 })).toBe(4);
  });

  it('[10] 不正な絞り込み条件は無効扱い (Lv1〜5 として扱う)', () => {
    const invalid = { min: 4, max: 2 } as DifficultyRange;
    expect(resolveTargetLevel(ALL_LEVELS, 0, invalid)).toBe(1);
  });
});

describe('estimateSkillMastery: 技能ごとの独立推定', () => {
  it('[3][4] 単元ごとの得意・不得意が独立して推定される', () => {
    const history = makeRecords([
      // 分数の計算: Lv4 を安定して正解
      ...correctAt(4, 8, { type: 'fraction_add_sub', category: 'fraction' }),
      // 割合: Lv2 で繰り返し不正解
      ...wrongAt(2, 5, { type: 'percentage', category: 'ratio' }),
    ]);
    const fraction = estimateSkillMastery(history, 'fraction_add_sub', 'fraction');
    const ratio = estimateSkillMastery(history, 'percentage', 'ratio');

    expect(fraction.level).toBe(4);
    expect(fraction.targetLevel).toBe(5);
    expect(ratio.level).toBe(0);
    expect(ratio.targetLevel).toBe(1);
    // 分数の成績が割合の推定に影響しない
    expect(ratio.source).toBe('skill');
  });

  it('[2][5] 履歴の無い技能は同カテゴリの推定を暫定値にする (確信度 low)', () => {
    const history = makeRecords(
      correctAt(3, 8, { type: 'fraction_add_sub', category: 'fraction' }),
    );
    const sibling = estimateSkillMastery(history, 'fraction_reduce', 'fraction');
    expect(sibling.source).toBe('category');
    expect(sibling.level).toBe(3);
    expect(sibling.confidence).toBe('low');
    expect(sibling.attempts).toBe(0);

    // 履歴がある技能は自分の記録で推定する (source: skill)
    const own = estimateSkillMastery(history, 'fraction_add_sub', 'fraction');
    expect(own.source).toBe('skill');
    expect(own.level).toBe(3);
  });

  it('[1] 履歴が1件も無ければ未評価 (出題は基礎レベルから始まる)', () => {
    const mastery = estimateSkillMastery([], 'fraction_add_sub', 'fraction');
    expect(mastery).toMatchObject({
      level: 0,
      targetLevel: 1,
      confidence: 'none',
      source: 'none',
      attempts: 0,
    });
    expect(resolveTargetLevel(ALL_LEVELS, mastery.level)).toBe(1);
  });

  it('解答回数が少ないほど確信度が低く、増えると上がって行く', () => {
    const few = estimateSkillMastery(
      makeRecords(correctAt(1, STABLE_MIN_ATTEMPTS - 2)),
      'fraction_add_sub',
      'fraction',
    );
    expect(few.confidence).toBe('low');

    const medium = estimateSkillMastery(
      makeRecords(correctAt(1, STABLE_MIN_ATTEMPTS + 1)),
      'fraction_add_sub',
      'fraction',
    );
    expect(medium.confidence).toBe('medium');

    const many = estimateSkillMastery(
      makeRecords(correctAt(1, HIGH_CONFIDENCE_ATTEMPTS)),
      'fraction_add_sub',
      'fraction',
    );
    expect(many.confidence).toBe('high');
    expect(many.attempts).toBe(HIGH_CONFIDENCE_ATTEMPTS);
  });

  it('[9] 最高レベルの証拠 (正答率・解答時間) は evidence から参照できる', () => {
    const history = makeRecords(
      correctAt(5, 6, { answerTimeSec: 30, timeLimitSec: 60 }),
    );
    const mastery = estimateSkillMastery(history, 'fraction_add_sub', 'fraction');
    expect(mastery.level).toBe(MAX_MASTERY_LEVEL);
    expect(mastery.targetLevel).toBe(MAX_MASTERY_LEVEL);
    const maxEvidence = mastery.evidence.find((ev) => ev.level === MAX_MASTERY_LEVEL);
    expect(maxEvidence?.accuracy).toBe(1);
    expect(maxEvidence?.averageTimeRatio).toBeCloseTo(0.5);
  });
});

