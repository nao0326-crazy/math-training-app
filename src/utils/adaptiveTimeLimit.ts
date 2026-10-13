/**
 * 適応型制限時間 (本人の解答履歴から制限時間を自動調整する)
 *
 * 仕様:
 * - 集計単位は problemType × difficultyLevel (AnswerRecord に実在する値)。
 *   問題単位の fingerprint は AnswerRecord に保存されないため使わない。
 * - 対象は「同一グループの直近 20 件の有効な正答記録」。
 *   有効 = answerTimeSec が有限の正数 かつ isCorrect === true かつ isTimedOut !== true。
 * - 有効記録が 8 未満なら null を返し、呼び出し側が現行の初期時間
 *   (getTimeLimitSeconds / TIME_LIMIT_CONFIG) を使う。
 * - 8 件以上なら IQR 方式で外れ値を除外し、残りの平均 × 0.9 を切り上げ、
 *   [20, 300] 秒に収める。
 * - 四分位数は線形補間 ((n-1)×p 方式)。IQR が 0 なら外れ値除外をしない。
 * - 除外後の件数が 3 未満なら、除外前の記録で平均する。
 * - すべての計算に失敗したら null (呼び出し側が初期時間にフォールバック)。
 *
 * このモジュールは履歴を読み取り専用で扱う (書き換え・削除をしない)。
 * 学習履歴の統計 (stats / solvedCount / dailyCount) の集計仕様にも影響しない。
 *
 * 注意: adaptiveDifficulty.ts は難易度の自動昇降を行う別機能。混同しないこと。
 */
import type { AnswerRecord } from '../types/history';
import type { Problem } from '../types/problem';
import { ADAPTIVE_TIME_LIMIT_CONFIG, getTimeLimitSeconds } from './quizTimer';

/**
 * 解答時間が「有限の正数」か (0・負数・NaN・Infinity・欠損を除外する)。
 * 履歴レコードの不正データを適応計算に入れないための入口。
 */
export function isValidAnswerTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 集計対象になる「有効な正答記録」か。
 * 時間切れは「制限時間ちょうどの時間」になるため解答時間の標本にしない。
 * 既存の正答率・時間切れ集計 (isCorrect / isTimedOut) の仕様はここでは変更しない。
 */
export function isValidSampleRecord(record: AnswerRecord): boolean {
  return (
    record.isCorrect === true &&
    record.isTimedOut !== true &&
    isValidAnswerTime(record.answerTimeSec)
  );
}

/**
 * ソート済み配列に対する線形補間方式の分位数 (R-7 / Excel PERCENTILE.INC 相当)。
 * 位置 = (n - 1) × p。端数は隣接 2 値の間を補間する。
 */
export function quantileLinear(sortedValues: readonly number[], p: number): number {
  const n = sortedValues.length;
  if (n === 0) {
    throw new Error('quantileLinear: 値がありません');
  }
  if (n === 1) return sortedValues[0];
  const pos = (n - 1) * p;
  const lowerIndex = Math.floor(pos);
  const upperIndex = Math.ceil(pos);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = pos - lowerIndex;
  return (
    sortedValues[lowerIndex] +
    (sortedValues[upperIndex] - sortedValues[lowerIndex]) * weight
  );
}

/** 単純平均 (空配列はエラー。呼び出し側でフォールバックする) */
export function meanOf(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('meanOf: 値がありません');
  }
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/**
 * IQR 方式で外れ値を除外する (元の記録は一切削除・書き換えない。配列を返すだけ)。
 * - Q1 - 1.5×IQR 未満、Q3 + 1.5×IQR 超を除外する (境界値そのものは除外しない)
 * - IQR が 0 なら判定せず全件を採用する
 * - 除外後の件数が minKeptSamples (3) 未満なら、除外前の全件を返す
 *
 * 補足: Q1/Q3 は分布の中央寄りを指すため、8 件以上で除外後 3 件未満になることは
 * 構造上ほぼ起きないが、仕様どおり防御として実装する。
 */
export function filterOutliersIqr(values: readonly number[]): number[] {
  if (values.length < ADAPTIVE_TIME_LIMIT_CONFIG.minKeptSamples) {
    return [...values];
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantileLinear(sorted, 0.25);
  const q3 = quantileLinear(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return [...values];
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const kept = values.filter((value) => value >= lowerBound && value <= upperBound);
  if (kept.length < ADAPTIVE_TIME_LIMIT_CONFIG.minKeptSamples) {
    return [...values];
  }
  return kept;
}

/**
 * 履歴から対象グループの有効な解答時間を「時系列順の直近 N 件」で取り出す。
 * - problemType と difficultyLevel の両方が一致する記録だけ
 * - 有効条件 (正答・非時間切れ・有限の正数) を満たすものだけ
 * - 同一レコード (同一 id) の二重計上を防ぐ
 * - answeredAt 昇順に並べてから evaluationWindow (20) 件に絞る
 *   (全履歴からグループを抽出してから時系列で並べて 20 件に絞す)
 */
export function selectAdaptiveSampleTimes(
  records: readonly AnswerRecord[],
  problemType: string,
  difficultyLevel: number,
): number[] {
  const seenIds = new Set<number>();
  const samples: {
    answeredAt: string;
    id: number | null;
    order: number;
    timeSec: number;
  }[] = [];

  records.forEach((record, index) => {
    if (record.problemType !== problemType) return;
    if (record.difficultyLevel !== difficultyLevel) return;
    if (!isValidSampleRecord(record)) return;
    if (record.id != null) {
      if (seenIds.has(record.id)) return;
      seenIds.add(record.id);
    }
    samples.push({
      answeredAt: record.answeredAt,
      id: record.id ?? null,
      order: index,
      timeSec: record.answerTimeSec,
    });
  });

  samples.sort((a, b) => {
    if (a.answeredAt !== b.answeredAt) return a.answeredAt < b.answeredAt ? -1 : 1;
    if (a.id != null && b.id != null && a.id !== b.id) return a.id - b.id;
    return a.order - b.order;
  });

  const recent = samples.slice(-ADAPTIVE_TIME_LIMIT_CONFIG.evaluationWindow);
  return recent.map((sample) => sample.timeSec);
}

/**
 * 対象グループの適応型制限時間を計算する。
 * 有効記録が minSamples (8) 未満、または計算不能なら null (初期時間へフォールバック)。
 *
 * @returns 秒数 (20〜300)。フォールバックが必要なときは null
 */
export function computeAdaptiveLimitSeconds(
  records: readonly AnswerRecord[],
  problemType: string,
  difficultyLevel: number,
): number | null {
  const samples = selectAdaptiveSampleTimes(records, problemType, difficultyLevel);
  if (samples.length < ADAPTIVE_TIME_LIMIT_CONFIG.minSamples) return null;

  const kept = filterOutliersIqr(samples);
  const averageSec = meanOf(kept);
  const scaled = Math.ceil(averageSec * ADAPTIVE_TIME_LIMIT_CONFIG.factor);
  return Math.min(
    ADAPTIVE_TIME_LIMIT_CONFIG.maxSeconds,
    Math.max(ADAPTIVE_TIME_LIMIT_CONFIG.minSeconds, scaled),
  );
}

/**
 * タイマー表示・時間切れ判定・履歴保存で使う制限時間 (秒) を決定する純関数。
 *
 * - 履歴が使えない・件数不足・計算に失敗した場合は、必ず現行の初期時間
 *   (getTimeLimitSeconds。難易度別初期値 + 文章題/図の加算 + [30,300]) を返す。
 * - 状態を持たず、同じ入力なら常に同じ値を返す
 *   (1 問ごとに一度だけ呼び、表示と保存を同じ値で共有するため)。
 */
export function resolveTimeLimitSeconds(
  problem: Problem,
  records: readonly AnswerRecord[] | null | undefined,
): number {
  try {
    const level = problem?.difficulty?.level;
    if (level == null || !Array.isArray(records)) {
      return getTimeLimitSeconds(problem);
    }
    const adaptive = computeAdaptiveLimitSeconds(records, problem.type, level);
    return adaptive ?? getTimeLimitSeconds(problem);
  } catch {
    return getTimeLimitSeconds(problem);
  }
}

