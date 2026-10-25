/** 朝のハイスピード計算ゲートの時刻・日付判定 (Asia/Tokyo) */

import { getStudyDateKey } from './dailyCount';

export const SPEED_GATE_TIME_ZONE = 'Asia/Tokyo';
export const SPEED_GATE_START_HOUR = 6;

export interface TokyoDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const tokyoFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SPEED_GATE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function getTokyoDateParts(date: Date = new Date()): TokyoDateParts {
  const parts = tokyoFormatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** 日本時間の日付キー (YYYY-MM-DD) */
export function getSpeedGateDateKey(date: Date = new Date()): string {
  return getStudyDateKey(date);
}

/** 当日6:00:00以降かどうか */
export function isSpeedGateRequiredAt(date: Date = new Date()): boolean {
  const parts = getTokyoDateParts(date);
  const secondsOfDay = parts.hour * 3600 + parts.minute * 60 + parts.second;
  return secondsOfDay >= SPEED_GATE_START_HOUR * 3600;
}

/** 6:00前は false */
export function isBeforeSpeedGateStart(date: Date = new Date()): boolean {
  return !isSpeedGateRequiredAt(date);
}
