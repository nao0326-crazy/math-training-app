import type { AnswerRecord } from '../types/history';
import { getStudyDateKey } from './dailyCount';
import { CATEGORY_LABELS, categoryLabel } from './stats';

export interface StudyMonth {
  year: number;
  /** 1〜12 */
  month: number;
}

export interface CalendarDay {
  dateKey: string;
  day: number;
  isToday: boolean;
}

export interface UnitSummary {
  key: string;
  label: string;
  count: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDateKey(dateKey: string): StudyMonth & { day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`不正な学習日です: ${dateKey}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`不正な学習日です: ${dateKey}`);
  }
  return { year, month, day };
}

export function toStudyDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function getStudyMonth(dateKey: string): StudyMonth {
  const { year, month } = parseDateKey(dateKey);
  return { year, month };
}

export function shiftStudyMonth(month: StudyMonth, delta: number): StudyMonth {
  const shifted = new Date(Date.UTC(month.year, month.month - 1 + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export function formatStudyMonth(month: StudyMonth): string {
  return `${month.year}年${month.month}月`;
}

export function formatStudyDateLabel(dateKey: string): string {
  const { month, day } = parseDateKey(dateKey);
  return `${month}月${day}日の学習`;
}

/** 月曜始まりの6週間分のカレンダーセルを返す。 */
export function buildCalendarDays(month: StudyMonth, todayKey: string): (CalendarDay | null)[] {
  const firstWeekday = (new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return null;

    const dateKey = toStudyDateKey(month.year, month.month, day);
    return { dateKey, day, isToday: dateKey === todayKey };
  });
}

/** AnswerRecord.answeredAtを、既存の日本時間基準で日付ごとにまとめる。 */
export function groupRecordsByStudyDate(records: AnswerRecord[]): Map<string, AnswerRecord[]> {
  const grouped = new Map<string, AnswerRecord[]>();
  for (const record of records) {
    const date = new Date(record.answeredAt);
    if (Number.isNaN(date.getTime())) continue;
    const dateKey = getStudyDateKey(date);
    const dayRecords = grouped.get(dateKey) ?? [];
    dayRecords.push(record);
    grouped.set(dateKey, dayRecords);
  }
  return grouped;
}

function isKnownCategory(category: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, category);
}

export function getRecordUnitLabel(record: AnswerRecord): string {
  const category = record.category.trim();
  if (isKnownCategory(category)) return categoryLabel(category);

  const problemType = record.problemType.trim();
  return problemType || 'その他';
}

/**
 * 通常の回答はcategoryで集約する。旧履歴などcategoryがない場合は
 * problemTypeへフォールバックし、問題数が大きい順に並べる。
 */
export function summarizeRecordUnits(records: AnswerRecord[]): UnitSummary[] {
  const summary = new Map<string, UnitSummary>();
  for (const record of records) {
    const category = record.category.trim();
    const problemType = record.problemType.trim();
    const key = isKnownCategory(category)
      ? `category:${category}`
      : problemType
        ? `type:${problemType}`
        : 'other';
    const current = summary.get(key);
    summary.set(key, {
      key,
      label: getRecordUnitLabel(record),
      count: (current?.count ?? 0) + 1,
    });
  }

  return [...summary.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'),
  );
}
