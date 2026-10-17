import { describe, expect, it } from 'vitest';
import { isAdminPasswordValid } from './verificationCode';

describe('admin password', () => {
  it('compares the exact code as a string, preserving the leading zero', () => {
    expect(isAdminPasswordValid('0326')).toBe(true);
    expect(isAdminPasswordValid('326')).toBe(false);
    expect(isAdminPasswordValid('0327')).toBe(false);
  });
});
