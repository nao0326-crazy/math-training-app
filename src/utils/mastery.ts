/**
 * 単元・技能ごとの習熟度推定と出題目標レベルの決定 (適応型出題)
 *
 * あらかじめ設定された難易度を基準に出題する従来方式を廃止し、
 * 学習履歴 (AnswerRecord) から「現在安定して解けるレベル」を
 * 技能 (problemType) ごとに独立に推定し、その一段上を出題する。
 *
 * 設計の約束:
 * - 純粋関数 (同じ履歴から常に同じ結果)。習熟度は別途の保存を持たず、
 *   既存の IndexedDB `answers` (AnswerRecord) から導出する。
 *   そのため再起動・端末移行・既存履歴の移行でも自動的に維持される。
 * - 評価は技能 (problemType) 単位が基本。技能の記録が無いときだけ、
 *   同じカテゴリ (分数・割合など) の記録を暫定値 (確信度 low) として使う。
 *   A 単元の得意不得意が B 単元の出題レベルに影響しない。
 * - 判定には「評価窓内の累積」と「直近 TREND_WINDOW 問の傾向」の両方を使う。
 *   1回の連続正解で急上昇せず、1回の不正解でも大きく下がらない。
 * - 解答時間は補助指標 (averageTimeRatio) として証拠に含めるだけで、
 *   正解・不正解の判定には使わない。タイムアウトは AnswerRecord 側で
 *   isCorrect=false として記録されるため、正解として数えられない。
 * - 出題目標 = 現在の習熟レベル + 1。最高レベル (5) に達した場合は
 *   存在しないレベル6を出さず、最高レベルを出題し続ける。
 */

import type { AnswerRecord } from '../types/history';
import type { DifficultyLevel, DifficultyRange } from '../types/problem';

/** 技能ごとに習熟度判定へ使う直近回答数 (これより古い履歴は評価対象外) */
export const MASTERY_WINDOW = 20;

/** 「安定して解けている」と判定する最低回答数 (そのレベルで) */
export const STABLE_MIN_ATTEMPTS = 5;

/** 安定判定に必要な累積正答率 */
export const STABLE_ACCURACY = 0.8;

/** 安定・苦手判定で見る「直近」の問数 (そのレベルで) */
export const TREND_WINDOW = 5;

/** 安定判定に必要な直近 TREND_WINDOW 問中の正解数 */
export const TREND_MIN_CORRECT = 4;

/** 「持続的に解けていない (苦手)」と判定する最低回答数 (そのレベルで) */
export const WEAK_MIN_ATTEMPTS = 5;

/** 苦手判定の累積正答率しきい値 (この値以下なら苦手) */
export const WEAK_ACCURACY = 0.4;

/** 苦手判定の直近 TREND_WINDOW 問中の正解数上限 (この値以下なら苦手) */
export const WEAK_TREND_MAX_CORRECT = 1;

/** 内部的な問題難易度の上限 */
export const MAX_MASTERY_LEVEL = 5;

/** 履歴が無く習熟度を推定できない状態のレベル (出題は基礎レベルから開始) */
export const UNASSESSED_LEVEL = 0;

/** 確信度 high と判定する評価窓内の回答数 */
export const HIGH_CONFIDENCE_ATTEMPTS = 12;

/**
 * レベル別に集計した証拠 (評価窓ベース)
 */
export interface LevelEvidence {
  /** 問題の内部難易度レベル (1〜5) */
  level: number;
  /** 評価窓内・そのレベルの回答数 */
  total: number;
  /** うち正解数 (タイムアウトは AnswerRecord 上 isCorrect=false なので含まれない) */
  correct: number;
  /** 正答率 (回答0なら0) */
  accuracy: number;
  /** 直近 TREND_WINDOW 問のうちの回答数 */
  recentTotal: number;
  /** 直近 TREND_WINDOW 問のうち正解数 */
  recentCorrect: number;
  /** うちタイムアウトの回答数 */
  timedOutCount: number;
  /**
   * 制限時間に対する解答時間の平均比率 (0〜1超もあり得る)。
   * timeLimitSec の無い記録は平均から除外し、全件無い場合は null。
   * 補助指標であり正誤判定には使わない。
   */
  averageTimeRatio: number | null;
}

function clampLevelValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(1, Math.min(MAX_MASTERY_LEVEL, Math.round(value)));
}

/**
 * 履歴からレベル別証拠を集計する
 *
 * - answeredAt で時系列に並べ、直近 MASTERY_WINDOW 件だけを対象にする
 *   (古い履歴は評価から自然に外れ、推定が永続固定されない)。
 * - レベル1〜5 の範囲外の difficultyLevel は集計対象外にする。
 */
export function collectLevelEvidence(
  records: readonly AnswerRecord[],
): LevelEvidence[] {
  const window = records
    .slice()
    .sort((a, b) => (a.answeredAt < b.answeredAt ? -1 : a.answeredAt > b.answeredAt ? 1 : 0))
    .slice(-MASTERY_WINDOW);

  const byLevel = new Map<number, AnswerRecord[]>();
  for (const record of window) {
    const level = clampLevelValue(record.difficultyLevel);
    if (level === 0) continue;
    const list = byLevel.get(level);
    if (list) list.push(record);
    else byLevel.set(level, [record]);
  }

  const evidence: LevelEvidence[] = [];
  for (const [level, levelRecords] of byLevel) {
    const correct = levelRecords.filter((r) => r.isCorrect).length;
    const recent = levelRecords.slice(-TREND_WINDOW);
    const timeRatios = levelRecords
      .filter((r) => typeof r.timeLimitSec === 'number' && r.timeLimitSec > 0)
      .map((r) => r.answerTimeSec / r.timeLimitSec!);
    evidence.push({
      level,
      total: levelRecords.length,
      correct,
      accuracy: levelRecords.length > 0 ? correct / levelRecords.length : 0,
      recentTotal: recent.length,
      recentCorrect: recent.filter((r) => r.isCorrect).length,
      timedOutCount: levelRecords.filter((r) => r.isTimedOut === true).length,
      averageTimeRatio:
        timeRatios.length > 0
          ? timeRatios.reduce((sum, ratio) => sum + ratio, 0) / timeRatios.length
          : null,
    });
  }
  evidence.sort((a, b) => a.level - b.level);
  return evidence;
}

/**
 * そのレベルを「安定して解けている」と判定する
 *
 * 十分な回答数・高い累積正答率・直近の良い傾向のすべてが必要。
 * (直近 TREND_WINDOW 問は評価窓のため必ず揃う)
 */
export function isStableEvidence(evidence: LevelEvidence): boolean {
  return (
    evidence.total >= STABLE_MIN_ATTEMPTS &&
    evidence.accuracy >= STABLE_ACCURACY &&
    evidence.recentCorrect >= TREND_MIN_CORRECT
  );
}

/**
 * そのレベルを「持続的に解けていない」と判定する
 *
 * 累積正答率が低い、または直近 TREND_WINDOW 問がほぼ全て不正解のとき。
 * 1回や数回の不正解では成立しない (回答数の下限があるため)。
 */
export function isWeakEvidence(evidence: LevelEvidence): boolean {
  if (evidence.total < WEAK_MIN_ATTEMPTS) return false;
  return (
    evidence.accuracy <= WEAK_ACCURACY ||
    evidence.recentCorrect <= WEAK_TREND_MAX_CORRECT
  );
}

/**
 * 技能の履歴から現在の習熟レベル (0〜5) を推定する
 *
 * 0 は「未評価 (履歴が無い / 根拠が揃っていない)」を表し、
 * 出題目標は resolveTargetLevel により基礎レベルから始まる。
 *
 * 判定順:
 * 1. 高いレベルから見て、「安定している」最上位レベルを選ぶ。
 *    ただし一段上が持続的に解けない場合はそのレベルを確定扱いにしない
 *    (目標レベルで繰り返し失敗したら習熟度を下げ、目標も下げる)。
 * 2. 安定証拠が無いレベルは、記録があるレベルのうち「苦手でない」
 *    最高レベルの一段下を暫定値にする (評価途中の誤った急落を防ぐ)。
 * 3. 1 と 2 の大きい方を採用する (最高5で頭打ち)。
 */
export function estimateMasteryLevel(records: readonly AnswerRecord[]): number {
  if (records.length === 0) return UNASSESSED_LEVEL;
  const byLevel = new Map(collectLevelEvidence(records).map((ev) => [ev.level, ev]));

  // 1) 安定している最上位レベル (一段上が苦手なら見送り)
  let gated = UNASSESSED_LEVEL;
  for (let level = MAX_MASTERY_LEVEL; level >= 1; level--) {
    const evidence = byLevel.get(level);
    if (!evidence || !isStableEvidence(evidence)) continue;
    const above = byLevel.get(level + 1);
    if (level < MAX_MASTERY_LEVEL && above && isWeakEvidence(above)) continue;
    gated = level;
    break;
  }

  // 2) 暫定値 (安定証拠が無い・不十分な場合の保険)
  let provisional = UNASSESSED_LEVEL;
  const attemptedLevels = [...byLevel.keys()].sort((a, b) => b - a);
  for (const level of attemptedLevels) {
    const evidence = byLevel.get(level);
    if (!evidence || isWeakEvidence(evidence)) continue;
    provisional = Math.max(UNASSESSED_LEVEL, level - 1);
    break;
  }

  return Math.min(MAX_MASTERY_LEVEL, Math.max(gated, provisional));
}

/** 習熟度推定の結果 */
export interface SkillMastery {
  /** 技能キー (problemType) */
  skillKey: string;
  /** 現在の習熟レベル (0 = 未評価) */
  level: number;
  /**
   * 出題目標レベル (習熟 +1。最高レベルでは 5 で頭打ち)。
   * 実際の出題では型の対応レベル・絞り込み条件を resolveTargetLevel で考慮する。
   */
  targetLevel: number;
  /** 推定の確信度 (履歴が少ないほど低い) */
  confidence: 'none' | 'low' | 'medium' | 'high';
  /** 推定の根拠に使った範囲 */
  source: 'skill' | 'category' | 'none';
  /** 評価窓内の技能別回答数 */
  attempts: number;
  /** 技能ごとのレベル別証拠 (最高レベルの成長評価にも使える) */
  evidence: LevelEvidence[];
}

/**
 * 1つの技能 (problemType) の習熟度を推定する
 *
 * - 技能の記録があればそれだけで推定する (source: 'skill')。
 * - 技能の記録が1件も無く、カテゴリの記録がある場合は、そのカテゴリの
 *   推定を暫定値として使う (source: 'category', confidence: low)。
 *   既存の学習履歴を活かしてゼロから学習し直さないための初期値で、
 *   技能の記録が1件でも増えたら技能側の推定に切り替わる。
 * - どちらも無ければ level 0 (未評価)。出題は基礎レベルから始まる。
 */
export function estimateSkillMastery(
  history: readonly AnswerRecord[],
  problemType: string,
  category?: string | null,
): SkillMastery {
  const skillRecords = history.filter((record) => record.problemType === problemType);
  const evidence = collectLevelEvidence(skillRecords);
  const attempts = evidence.reduce((sum, item) => sum + item.total, 0);

  const confidenceOf = (attemptCount: number): SkillMastery['confidence'] => {
    if (attemptCount >= HIGH_CONFIDENCE_ATTEMPTS) return 'high';
    if (attemptCount >= STABLE_MIN_ATTEMPTS) return 'medium';
    return 'low';
  };

  if (skillRecords.length > 0) {
    const level = estimateMasteryLevel(skillRecords);
    return {
      skillKey: problemType,
      level,
      targetLevel: Math.min(MAX_MASTERY_LEVEL, level + 1),
      confidence: confidenceOf(attempts),
      source: 'skill',
      attempts,
      evidence,
    };
  }

  if (category) {
    const parentRecords = history.filter((record) => record.category === category);
    if (parentRecords.length > 0) {
      const level = estimateMasteryLevel(parentRecords);
      return {
        skillKey: problemType,
        level,
        targetLevel: Math.min(MAX_MASTERY_LEVEL, level + 1),
        confidence: level > UNASSESSED_LEVEL ? 'low' : 'none',
        source: level > UNASSESSED_LEVEL ? 'category' : 'none',
        attempts: 0,
        evidence,
      };
    }
  }

  return {
    skillKey: problemType,
    level: UNASSESSED_LEVEL,
    targetLevel: UNASSESSED_LEVEL + 1,
    confidence: 'none',
    source: 'none',
    attempts: 0,
    evidence,
  };
}

function normalizeBounds(bounds: DifficultyRange | null | undefined): {
  min: number;
  max: number;
} {
  const isValidLevel = (value: unknown): value is DifficultyLevel =>
    value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
  if (
    bounds &&
    isValidLevel(bounds.min) &&
    isValidLevel(bounds.max) &&
    bounds.min <= bounds.max
  ) {
    return { min: bounds.min, max: bounds.max };
  }
  return { min: 1, max: MAX_MASTERY_LEVEL };
}

/**
 * 習熟レベルから「次に出題するレベル」を決定する (出題目標 = 習熟 + 1)
 *
 * - 習熟レベル+1 が候補にあれば、それを出題する (ちょうど一段上)。
 * - 候補が習熟+1 より上しかない型・条件では、存在しないレベルを
 *   作らずに最も低い該当候補を出題する。
 * - 習熟+1 より上に候補が無い型 (最高レベル到達・型の上限) では、
 *   最も高い候補を出題し続ける (レベル6のような存在しないレベルを出さない)。
 * - bounds (絞り込み条件。旧・管理者難易度範囲など) が指定されていれば
 *   その範囲内に収める。範囲内に候補が無い場合は最も近い候補に
 *   (同距離なら低い方) 寄せる。
 * - 履歴が無い (習熟 0) なら、条件の基礎レベルから出題される。
 */
export function resolveTargetLevel(
  supportedLevels: readonly DifficultyLevel[],
  masteryLevel: number,
  bounds?: DifficultyRange | null,
): DifficultyLevel {
  const roundedMastery = Number.isFinite(masteryLevel)
    ? Math.max(UNASSESSED_LEVEL, Math.round(masteryLevel))
    : UNASSESSED_LEVEL;
  const desired = Math.min(
    MAX_MASTERY_LEVEL + 1,
    Math.max(UNASSESSED_LEVEL + 1, roundedMastery + 1),
  );
  const limit = normalizeBounds(bounds);

  const available = [...new Set(supportedLevels)]
    .filter((level) => level >= limit.min && level <= limit.max)
    .sort((a, b) => a - b);

  if (available.length > 0) {
    const above = available.find((level) => level >= desired);
    return (above ?? available[available.length - 1]) as DifficultyLevel;
  }

  // 絞り込み条件と生成可能レベルが交わらない場合 (防御処理)。
  // 目標レベルに最寄りの生成可能レベルへ寄せる (同距離なら低い方)。
  const all = [...new Set(supportedLevels)].sort((a, b) => a - b);
  if (all.length === 0) return desired as DifficultyLevel;
  let best = all[0];
  let bestDistance = Math.abs(best - desired);
  for (const level of all) {
    const distance = Math.abs(level - desired);
    if (distance < bestDistance) {
      best = level;
      bestDistance = distance;
    }
  }
  return best as DifficultyLevel;
}

