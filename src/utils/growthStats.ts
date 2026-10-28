/**
 * 成長記録画面用の集計ユーティリティ
 *
 * データソース:
 * - 通常問題: IndexedDB `answers` ストア (AnswerRecord[])
 * - 朝の100問: IndexedDB `speedGateSessions` ストア (SpeedGateSession[])
 *
 * すべての日付は日本時間 (Asia/Tokyo) で集計する。
 * getStudyDateKey() を使用して端末のタイムゾーンに依存しない日付キーを生成する。
 */

import type { AnswerRecord } from '../types/history';
import type {
  SpeedGateDailyResult,
  DailyGrowth,
  GrowthData,
  GrowthPeriod,
  ProblemTypeAccuracy,
  PeriodComparison,
} from '../types/growth';
import type { SpeedGateSession } from '../types/speedGate';
import type { UnitStats, MasteryLevel } from '../types/unitHeatmap';
import { getStudyDateKey } from './dailyCount';
import { isSolvedRecord } from './solvedCount';
import { computeSpeedGateResult } from './speedGate';
import { listSpeedGateSessions, getAllAnswerRecords } from '../storage/db';
import { CATEGORY_LABELS } from './stats';
import {
  MIN_ATTEMPTS_FOR_MASTERY,
  MASTERED_ACCURACY_THRESHOLD,
  NEEDS_REVIEW_ACCURACY_THRESHOLD,
} from '../types/unitHeatmap';

/** 2重集計防止用のキー生成 (submissionId 優先, 無ければ problemId + answeredAt) */
function recordKey(record: AnswerRecord): string {
  if (record.submissionId) return `sub:${record.submissionId}`;
  return `ans:${record.problemId}:${record.answeredAt}`;
}

/** 重複を除去した AnswerRecord 配列を返す */
export function deduplicateAnswers(records: AnswerRecord[]): AnswerRecord[] {
  const seen = new Set<string>();
  const result: AnswerRecord[] = [];
  for (const record of records) {
    const key = recordKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(record);
  }
  return result;
}

/** 1日の集計を1件作成する */
export function buildDailyGrowth(
  dateKey: string,
  records: AnswerRecord[],
): DailyGrowth {
  const totalCount = records.length;
  const correctCount = records.filter((r) => r.isCorrect).length;
  const accuracyRate = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
  const solved = records.filter(isSolvedRecord);
  const averageTimeSec =
    solved.length > 0
      ? solved.reduce((sum, r) => sum + r.answerTimeSec, 0) / solved.length
      : 0;

  return {
    dateKey,
    questionCount: totalCount,
    correctCount,
    accuracyRate,
    averageTimeSec,
    hasLearned: totalCount > 0,
  };
}

/** 指定期間内の日別集計を返す (学習日のみ, 未学習日は含めない) */
function aggregateDailyGrowth(
  records: AnswerRecord[],
  periodDays: number,
  todayKey: string,
): DailyGrowth[] {
  const deduped = deduplicateAnswers(records);
  const byDate = new Map<string, AnswerRecord[]>();
  for (const record of deduped) {
    const date = new Date(record.answeredAt);
    if (Number.isNaN(date.getTime())) continue;
    const dk = getStudyDateKey(date);
    const list = byDate.get(dk) ?? [];
    list.push(record);
    byDate.set(dk, list);
  }

  const todayParts = todayKey.split('-').map(Number);
  const today = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]));

  const result: DailyGrowth[] = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const dk = getStudyDateKey(d);
    const dayRecords = byDate.get(dk) ?? [];
    if (dayRecords.length === 0) continue;
    result.push(buildDailyGrowth(dk, dayRecords));
  }
  return result;
}

/** 朝の100問の日別集計を返す (完了日のみ) */
function aggregateSpeedGateDaily(
  sessions: SpeedGateSession[],
  periodDays: number,
  todayKey: string,
): SpeedGateDailyResult[] {
  const completed = sessions.filter((s) => s.status === 'completed' && s.completedAt);
  const byDate = new Map<string, SpeedGateSession[]>();
  for (const session of completed) {
    const list = byDate.get(session.dateKey) ?? [];
    list.push(session);
    byDate.set(session.dateKey, list);
  }

  const todayParts = todayKey.split('-').map(Number);
  const today = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]));

  const result: SpeedGateDailyResult[] = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const dk = getStudyDateKey(d);
    const daySessions = byDate.get(dk) ?? [];
    if (daySessions.length === 0) continue;
    const session = daySessions.reduce((latest, s) =>
      (s.completedAt ?? '') > (latest.completedAt ?? '') ? s : latest,
    );
    const r = computeSpeedGateResult(
      session.dateKey,
      session.problems,
      session.answers,
      session.startedAt,
      session.completedAt ?? '',
    );
    result.push({
      dateKey: r.dateKey,
      correctCount: r.correctCount,
      totalCount: r.totalCount,
      accuracyRate: r.accuracy,
      totalMs: r.totalMs,
      averageMs: r.averageMs,
      completed: true,
    });
  }
  return result;
}
/** 問題タイプ別正答率を集計する */
export function aggregateByProblemType(records: AnswerRecord[]): ProblemTypeAccuracy[] {
  const deduped = deduplicateAnswers(records);
  const byType = new Map<string, AnswerRecord[]>();
  for (const record of deduped) {
    const list = byType.get(record.problemType) ?? [];
    list.push(record);
    byType.set(record.problemType, list);
  }

  return [...byType.entries()]
    .map(([problemType, list]) => {
      const correctCount = list.filter((r) => r.isCorrect).length;
      const accuracyRate = list.length > 0 ? (correctCount / list.length) * 100 : 0;
      return {
        problemType,
        label: CATEGORY_LABELS[recordCategory(list[0])] ?? problemType,
        totalCount: list.length,
        correctCount,
        accuracyRate,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount || a.label.localeCompare(b.label, 'ja'));
}

/** 単元別(カテゴリ別)の統計を集計する */
export function aggregateByCategory(records: AnswerRecord[]): UnitStats[] {
  const deduped = deduplicateAnswers(records);
  const byCategory = new Map<string, AnswerRecord[]>();
  for (const record of deduped) {
    const category = record.category.trim() || '未分類';
    const list = byCategory.get(category) ?? [];
    list.push(record);
    byCategory.set(category, list);
  }

  // 11カテゴリすべてを表示対象に含める (回答数0も未学習として表示)
  const allCategories: string[] = Object.keys(CATEGORY_LABELS);
  const results: UnitStats[] = [];

  for (const category of allCategories) {
    const list = byCategory.get(category) ?? [];
    const correctCount = list.filter((r) => r.isCorrect).length;
    const totalCount = list.length;
    const accuracyRate = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
    const masteryLevel = classifyMastery(totalCount, accuracyRate);
    results.push({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      totalCount,
      correctCount,
      accuracyRate,
      masteryLevel,
    });
  }

  // 未知カテゴリ(未分類)が存在する場合は別途集計
  const unknownCategory = byCategory.get('未分類');
  if (unknownCategory && unknownCategory.length > 0) {
    const correctCount = unknownCategory.filter((r) => r.isCorrect).length;
    const totalCount = unknownCategory.length;
    const accuracyRate = (correctCount / totalCount) * 100;
    const masteryLevel = classifyMastery(totalCount, accuracyRate);
    results.push({
      category: '未分類',
      label: '分類不明',
      totalCount,
      correctCount,
      accuracyRate,
      masteryLevel,
    });
  }

  return results.sort((a, b) => b.totalCount - a.totalCount || a.label.localeCompare(b.label, 'ja'));
}

/** 習熟状態を判定する (weakAreas.ts の閾値と整合) */
function classifyMastery(totalCount: number, accuracyRate: number): MasteryLevel {
  if (totalCount === 0) return 'untaught';
  if (totalCount < MIN_ATTEMPTS_FOR_MASTERY) return 'insufficient';
  if (accuracyRate / 100 < NEEDS_REVIEW_ACCURACY_THRESHOLD) return 'needsReview';
  if (accuracyRate / 100 < MASTERED_ACCURACY_THRESHOLD) return 'improvable';
  return 'mastered';
}

/** レコードのカテゴリを取得 (フォールバック付き) */
function recordCategory(record: AnswerRecord): string {
  return record.category.trim() || record.problemType.trim();
}

/** 期間比較を計算する (前 N 日 vs 直近 N 日) */
function computePeriodComparison(
  records: AnswerRecord[],
  periodDays: number,
  todayKey: string,
): PeriodComparison {
  const deduped = deduplicateAnswers(records);
  const todayParts = todayKey.split('-').map(Number);
  const today = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]));

  const dateOf = (offsetDays: number) =>
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offsetDays));

  const recentStart = dateOf(periodDays - 1);
  const recentEnd = today;
  const prevStart = dateOf(periodDays * 2 - 1);
  const prevEnd = dateOf(periodDays);

  const inRange = (record: AnswerRecord, start: Date, end: Date): boolean => {
    const d = new Date(record.answeredAt);
    if (Number.isNaN(d.getTime())) return false;
    const dk = getStudyDateKey(d);
    const startKey = getStudyDateKey(start);
    const endKey = getStudyDateKey(end);
    return dk >= startKey && dk <= endKey;
  };

  const recentRecords = deduped.filter((r) => inRange(r, recentStart, recentEnd));
  const prevRecords = deduped.filter((r) => inRange(r, prevStart, prevEnd));

  const recentTotal = recentRecords.length;
  const recentCorrect = recentRecords.filter((r) => r.isCorrect).length;
  const recentSolved = recentRecords.filter(isSolvedRecord);
  const recentAvgTime =
    recentSolved.length > 0
      ? recentSolved.reduce((sum, r) => sum + r.answerTimeSec, 0) / recentSolved.length
      : 0;

  const prevTotal = prevRecords.length;
  const prevCorrect = prevRecords.filter((r) => r.isCorrect).length;
  const prevSolved = prevRecords.filter(isSolvedRecord);
  const prevAvgTime =
    prevSolved.length > 0
      ? prevSolved.reduce((sum, r) => sum + r.answerTimeSec, 0) / prevSolved.length
      : 0;

  return {
    prevAccuracyRate: prevTotal > 0 ? (prevCorrect / prevTotal) * 100 : null,
    recentAccuracyRate: recentTotal > 0 ? (recentCorrect / recentTotal) * 100 : null,
    prevAverageTimeSec: prevSolved.length > 0 ? prevAvgTime : null,
    recentAverageTimeSec: recentSolved.length > 0 ? recentAvgTime : null,
    prevQuestionCount: prevTotal,
    recentQuestionCount: recentTotal,
  };
}

/** 成長記録画面用のすべてのデータを集計する */
export async function aggregateGrowthData(
  period: GrowthPeriod = 7,
): Promise<GrowthData> {
  const [answerRecords, speedGateSessions] = await Promise.all([
    getAllAnswerRecords(),
    listSpeedGateSessions(),
  ]);

  const todayKey = getStudyDateKey();
  const dedupedAnswers = deduplicateAnswers(answerRecords);

  // 日別集計 (通常問題)
  const dailyGrowth = aggregateDailyGrowth(dedupedAnswers, period, todayKey);

  // 日別集計 (朝100問)
  const dailySpeedGate = aggregateSpeedGateDaily(speedGateSessions, period, todayKey);

  // 今日の集計
  const todayRecords = dedupedAnswers.filter((r) => {
    const d = new Date(r.answeredAt);
    if (Number.isNaN(d.getTime())) return false;
    return getStudyDateKey(d) === todayKey;
  });
  const today: DailyGrowth | null = todayRecords.length > 0
    ? buildDailyGrowth(todayKey, todayRecords)
    : null;

  // 今日の朝100問
  const todaySessions = speedGateSessions.filter(
    (s) => s.dateKey === todayKey && s.status === 'completed' && s.completedAt,
  );
  const todaySpeedGate: SpeedGateDailyResult | null = todaySessions.length > 0
    ? (() => {
        const latest = todaySessions.reduce((a, b) =>
          (b.completedAt ?? '') > (a.completedAt ?? '') ? b : a,
        );
        const r = computeSpeedGateResult(
          latest.dateKey,
          latest.problems,
          latest.answers,
          latest.startedAt,
          latest.completedAt ?? '',
        );
        return {
          dateKey: r.dateKey,
          correctCount: r.correctCount,
          totalCount: r.totalCount,
          accuracyRate: r.accuracy,
          totalMs: r.totalMs,
          averageMs: r.averageMs,
          completed: true,
        };
      })()
    : null;

  // 問題タイプ別
  const byProblemType = aggregateByProblemType(dedupedAnswers);

  // 期間比較
  const comparison = computePeriodComparison(dedupedAnswers, period, todayKey);

  // 期間内の総計
  const parts = todayKey.split('-').map(Number);
  const periodStart = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - (period - 1)));
  const periodStartKey = getStudyDateKey(periodStart);
  const periodRecords = dedupedAnswers.filter((r) => {
    const d = new Date(r.answeredAt);
    if (Number.isNaN(d.getTime())) return false;
    const dk = getStudyDateKey(d);
    return dk >= periodStartKey && dk <= todayKey;
  });
  const periodSolved = periodRecords.filter(isSolvedRecord);
  const totalAverageTimeSec =
    periodSolved.length > 0
      ? periodSolved.reduce((sum, r) => sum + r.answerTimeSec, 0) / periodSolved.length
      : 0;

  const hasData = dedupedAnswers.length > 0 || speedGateSessions.length > 0;

  return {
    today,
    todaySpeedGate,
    dailyGrowth,
    dailySpeedGate,
    byProblemType,
    comparison,
    totalQuestionCount: periodRecords.length,
    totalCorrectCount: periodRecords.filter((r) => r.isCorrect).length,
    totalAverageTimeSec,
    hasData,
  };
}

/** 正答率を0-100の整数でフォーマット (0-1の比率または0-100のパーセント値の両方を受け付ける) */
export function formatAccuracy(rate: number | null): string {
  if (rate === null) return '未学習';
  const percent = rate <= 1 ? rate * 100 : rate;
  return `${Math.round(percent)}%`;
}

/** 平均回答時間をフォーマット (秒) */
export function formatAverageTime(seconds: number | null): string {
  if (seconds === null) return '未学習';
  const s = Math.round(seconds);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest > 0 ? `${m}分${rest}秒` : `${m}分`;
}

/** ミリ秒をフォーマット */
export function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest > 0 ? `${m}分${rest}秒` : `${m}分`;
}

/** 期間ラベル */
export function formatPeriodLabel(period: GrowthPeriod): string {
  return { 7: '7日間', 30: '30日間', 90: '90日間' }[period];
}