/**
 * 分野別・適応難易度の決定
 *
 * 通常モードは「分野 (curriculumScope.area) を選び、その分野の回答履歴に
 * よって難易度を毎回決める」方式。このモジュールは難易度決定の純関数だけ
 * を持つ (UI・セレクターから分離して、そのままテストできるようにする)。
 *
 * 決定ルール (シンプルなルールベース。統計モデルは作らない):
 *
 * - 評価対象は「その分野の直近 EVALUATION_WINDOW 問」。古い履歴は評価から
 *   自然に外れるため、難易度が永続固定されない。
 * - 昇格: 現在の難易度で MIN_SAMPLE_ATTEMPTS 問以上あり、正答率が
 *   PROMOTE_ACCURACY 以上で、直近 RECENT_TREND_WINDOW 問中
 *   RECENT_TREND_CORRECT 問以上正解 → その分野に生成できる難易度なら +1。
 * - 降格: 昇格で上がった先も含め、その難易度で MIN_SAMPLE_ATTEMPTS 問以上
 *   あり正答率が DEMOTE_ACCURACY 以下なら -1。
 * - 刻みは ±1。上下限は 1〜5。
 * - その分野で生成できない難易度へは最寄り (同距離なら低い方) に丸める。
 * - 履歴が無ければ INITIAL_ADAPTIVE_DIFFICULTY (= 2)。
 * - 分野ごとに独立して評価する (分野Aの成績は分野Bに影響しない)。
 * - リロード後の復元は行わない (QuizPage が読み込んだ履歴だけで評価する)。
 */

import type { AnswerRecord } from '../types/history';
import type { DifficultyLevel } from '../types/problem';
import { getCurriculumScope } from '../engine/curriculum/curriculumScope';
import { buildQuestionPool } from '../engine/selector/questionPool';

/** 履歴が無いときの初期難易度 */
export const INITIAL_ADAPTIVE_DIFFICULTY = 2;

/** 難易度を変える判断に必要な最低回答数 (評価窓内) */
export const MIN_SAMPLE_ATTEMPTS = 5;

/** 昇格に必要な正答率 */
export const PROMOTE_ACCURACY = 0.8;

/** 降格が起これる正答率 */
export const DEMOTE_ACCURACY = 0.4;

/** 昇格判断に使う「直近」の問数 */
export const RECENT_TREND_WINDOW = 5;

/** 直近 RECENT_TREND_WINDOW 問に必要な正解数 */
export const RECENT_TREND_CORRECT = 4;

/**
 * 評価に使う分野内の直近回答数
 *
 * Lv2→3→4→5 と上がるために必要な「各難易度5問 × 3段」= 15問を超えるため、
 * 20問にしている。これより古い履歴は評価対象外になる。
 */
export const EVALUATION_WINDOW = 20;

/** 問題タイプ → 分野 (curriculumScope.area)。未登録なら null */
export function areaOfProblemType(problemType: string): string | null {
  return getCurriculumScope(problemType)?.area ?? null;
}

/**
 * 通常モードに出す分野の一覧
 *
 * 母集団 (generatorRegistry) に登場する順に重複なしで並べる。
 * 統合はしない (例: 「数量の関係」は generator が1件でも別ボタンとして残す)。
 */
export function listLearningAreas(): string[] {
  const areas: string[] = [];
  const seen = new Set<string>();
  for (const entry of buildQuestionPool()) {
    const area = getCurriculumScope(entry.type)?.area;
    if (!area || seen.has(area)) continue;
    seen.add(area);
    areas.push(area);
  }
  return areas;
}

/** 分野内・難易度別の成績 (評価窓ベース) */
export interface LevelStats {
  level: number;
  /** 評価窓内の、その難易度の回答数 */
  total: number;
  /** うち正解数 */
  correct: number;
  /** 正答率 (回答0なら0) */
  accuracy: number;
  /** 直近 RECENT_TREND_WINDOW 問のうちの回答数 */
  recentTotal: number;
  /** 直近 RECENT_TREND_WINDOW 問のうち正解数 */
  recentCorrect: number;
}

/**
 * 分野に属する回答を時間順に並べ、直近 EVALUATION_WINDOW 問だけ残す
 *
 * 他の分野の回答は混ぜない (分野ごとに独立して評価するため)。
 */
export function evaluationWindow(
  area: string,
  records: readonly AnswerRecord[],
): AnswerRecord[] {
  return records
    .filter((r) => areaOfProblemType(r.problemType) === area)
    .slice()
    .sort((a, b) => (a.answeredAt < b.answeredAt ? -1 : a.answeredAt > b.answeredAt ? 1 : 0))
    .slice(-EVALUATION_WINDOW);
}

/** 評価窓内の、指定難易度の成績 */
export function levelStats(window: readonly AnswerRecord[], level: number): LevelStats {
  const atLevel = window.filter((r) => r.difficultyLevel === level);
  const recent = atLevel.slice(-RECENT_TREND_WINDOW);
  const correct = atLevel.filter((r) => r.isCorrect).length;
  return {
    level,
    total: atLevel.length,
    correct,
    accuracy: atLevel.length > 0 ? correct / atLevel.length : 0,
    recentTotal: recent.length,
    recentCorrect: recent.filter((r) => r.isCorrect).length,
  };
}

/** 昇格できるか (十分な回答数・高い正答率・直近の傾向も良い) */
export function canPromote(stats: LevelStats): boolean {
  return (
    stats.total >= MIN_SAMPLE_ATTEMPTS &&
    stats.accuracy >= PROMOTE_ACCURACY &&
    stats.recentCorrect >= RECENT_TREND_CORRECT
  );
}

/** 降格すべきか (十分な回答数があるのに正答率が低い) */
export function mustDemote(stats: LevelStats): boolean {
  return stats.total >= MIN_SAMPLE_ATTEMPTS && stats.accuracy <= DEMOTE_ACCURACY;
}

/** 生成できない難易度へは最寄り (同距離なら低い方) に丸める */
export function snapToAvailableLevel(
  level: number,
  availableLevels: readonly DifficultyLevel[],
): DifficultyLevel {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  const sorted = [...new Set(availableLevels)].sort((a, b) => a - b);
  if (sorted.length === 0) return clamped as DifficultyLevel;
  let best = sorted[0];
  let bestDistance = Math.abs(clamped - best);
  for (const candidate of sorted) {
    const distance = Math.abs(clamped - candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * 分野ごとの次の1問の難易度を決める (毎回・履歴から再評価)
 *
 * @param area           分野 (curriculumScope.area)
 * @param records        回答履歴 (分野はここで絞られる。他の分野は無視される)
 * @param availableLevels その分野で生成可能な難易度 (generator の supportedLevels の和集合)
 */
export function decideAdaptiveDifficulty(
  area: string,
  records: readonly AnswerRecord[],
  availableLevels: readonly DifficultyLevel[],
): DifficultyLevel {
  const window = evaluationWindow(area, records);
  const available = new Set<number>(availableLevels);

  let level: number = INITIAL_ADAPTIVE_DIFFICULTY;

  // 昇格: 上がれるだけ上がる (その分野に生成できる難易度であることが条件)
  while (level < 5 && canPromote(levelStats(window, level)) && available.has(level + 1)) {
    level += 1;
  }

  // 降格: 上がった先も含めて、低い正答率の難易度には留まらない
  while (level > 1 && mustDemote(levelStats(window, level))) {
    level -= 1;
  }

  return snapToAvailableLevel(level, availableLevels);
}