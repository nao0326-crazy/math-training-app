import { describe, expect, it } from 'vitest';
import {
  formatDailyStudyMessage,
  getDateKeyInTokyo,
  getPreviousDateKeyInTokyo,
} from '../../supabase/functions/_shared/dailyReport';

describe('getDateKeyInTokyo', () => {
  it('JSTの午前0時を日付境界にする', () => {
    expect(getDateKeyInTokyo(new Date('2026-09-23T14:59:59.999Z'))).toBe('2026-09-23');
    expect(getDateKeyInTokyo(new Date('2026-09-23T15:00:00.000Z'))).toBe('2026-09-24');
  });
});

describe('getPreviousDateKeyInTokyo', () => {
  it('9月24日8時JSTには9月23日を返す', () => {
    // 2026-09-24 08:00 JST
    expect(getPreviousDateKeyInTokyo(new Date('2026-09-23T23:00:00.000Z'))).toBe(
      '2026-09-23',
    );
  });

  it('9月25日8時JSTには9月24日を返す', () => {
    // 2026-09-25 08:00 JST
    expect(getPreviousDateKeyInTokyo(new Date('2026-09-24T23:00:00.000Z'))).toBe(
      '2026-09-24',
    );
  });
});

describe('formatDailyStudyMessage', () => {
  it('前日問題数を指定書式で通知する', () => {
    expect(formatDailyStudyMessage(47)).toBe('📚 昨日の学習記録\n算数：47問');
    expect(formatDailyStudyMessage(0)).toBe('📚 昨日の学習記録\n算数：0問');
  });

  it('不正な集計値を受け付けない', () => {
    expect(() => formatDailyStudyMessage(-1)).toThrow();
    expect(() => formatDailyStudyMessage(1.5)).toThrow();
  });
});
