export const DAILY_REPORT_TIME_ZONE = 'Asia/Tokyo';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DAILY_REPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 指定時刻の Asia/Tokyo 日付を YYYY-MM-DD で返す */
export function getDateKeyInTokyo(date: Date): string {
  const parts = dateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Asia/Tokyo の日付を取得できませんでした');
  }

  return `${year}-${month}-${day}`;
}

/** 指定時刻の Asia/Tokyo における前日キーを返す */
export function getPreviousDateKeyInTokyo(date: Date): string {
  const current = getDateKeyInTokyo(date);
  const [year, month, day] = current.split('-').map(Number);
  const previous = new Date(0);
  previous.setUTCFullYear(year, month - 1, day);
  previous.setUTCHours(0, 0, 0, 0);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

/** LINE へ送る前日学習記録 */
export function formatDailyStudyMessage(count: number): string {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('問題数は0以上の整数である必要があります');
  }

  return `📚 昨日の学習記録\n算数：${count}問`;
}
