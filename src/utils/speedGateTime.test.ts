import { describe, expect, it } from 'vitest';
import { getSpeedGateDateKey, isSpeedGateRequiredAt } from './speedGateTime';

describe('speedGateTime', () => {
  it('05:59:59 JST では必須にならない', () => {
    expect(isSpeedGateRequiredAt(new Date('2026-10-25T05:59:59+09:00'))).toBe(false);
  });

  it('06:00:00 JST では必須になる', () => {
    expect(isSpeedGateRequiredAt(new Date('2026-10-25T06:00:00+09:00'))).toBe(true);
  });

  it('日付キーは日本時間で統一される', () => {
    expect(getSpeedGateDateKey(new Date('2026-10-25T05:59:59+09:00'))).toBe('2026-10-25');
    expect(getSpeedGateDateKey(new Date('2026-10-24T22:00:00+09:00'))).toBe('2026-10-24');
  });

  it('前日完了でも翌日6時以降は新しい日として必須になる', () => {
    const prevDay = new Date('2026-10-24T06:00:00+09:00');
    const nextDay = new Date('2026-10-25T06:00:00+09:00');
    expect(getSpeedGateDateKey(prevDay)).not.toBe(getSpeedGateDateKey(nextDay));
    expect(isSpeedGateRequiredAt(nextDay)).toBe(true);
  });
});
