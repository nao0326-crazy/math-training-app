/**
 * 管理者モード (パスワード式ゲート) のテスト
 *
 * 確認したいこと:
 * - 平文パスワードはコードに埋め込まず、ハッシュで照合する
 * - ハッシュ未設定ならゲートは開かない (安全側の既定)
 * - 解除状態は sessionStorage にあり、閉じると消える
 */

import { describe, expect, it } from 'vitest';
import {
  isAdminGateConfigured,
  verifyAdminPassword,
  isAdminUnlocked,
  setAdminUnlocked,
  clearAdminUnlocked,
  safeEqual,
  ADMIN_SESSION_KEY,
} from './adminMode';
import { sha256Hex } from './sha256';

/** テスト用のハッシュを作る (本番の admin:hash スクリプトと同じ形) */
function hashOf(password: string, salt = ''): string {
  return sha256Hex(`${salt}:${password}`);
}

describe('verifyAdminPassword', () => {
  it('正しいパスワードは解除される', () => {
    const hash = hashOf('swordfish');
    expect(verifyAdminPassword('swordfish', hash, '')).toBe(true);
  });

  it('誤ったパスワードは解除されない', () => {
    const hash = hashOf('swordfish');
    expect(verifyAdminPassword('swordfsh', hash, '')).toBe(false);
    expect(verifyAdminPassword('', hash, '')).toBe(false);
    expect(verifyAdminPassword('SWORDFISH', hash, '')).toBe(false);
  });

  it('ソルトありのハッシュでも照合できる', () => {
    const salt = 'pepper';
    const hash = hashOf('swordfish', salt);
    expect(verifyAdminPassword('swordfish', hash, salt)).toBe(true);
    // ソルト無しで生成されたハッシュは一致しない
    expect(verifyAdminPassword('swordfish', hash, '')).toBe(false);
  });

  it('ハッシュ未設定なら必ず false (ゲートは無効)', () => {
    expect(verifyAdminPassword('swordfish', undefined, '')).toBe(false);
    expect(verifyAdminPassword('swordfish', '', '')).toBe(false);
    expect(verifyAdminPassword('swordfish', '   ', '')).toBe(false);
  });

  it('ハッシュは大文字小文字を区別しない (入力側で正規化されるため)', () => {
    const hash = hashOf('swordfish').toUpperCase();
    expect(verifyAdminPassword('swordfish', hash, '')).toBe(true);
  });
});

describe('isAdminGateConfigured', () => {
  it('ハッシュがあれば true、なければ false', () => {
    expect(isAdminGateConfigured(hashOf('x'))).toBe(true);
    expect(isAdminGateConfigured('')).toBe(false);
    expect(isAdminGateConfigured(undefined)).toBe(false);
  });
});

describe('safeEqual', () => {
  it('同じ文字列は true、異なる場合は false', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});

describe('解除状態の保存', () => {
  // テスト環境は node (jsdom 未導入) のため sessionStorage が無いことがある。
  // 無い場合でも例外を出さず「未解除」を返すことを保証する。
  const hasStorage = typeof sessionStorage !== 'undefined';

  it('未解除の状態を保存・読み取り・破棄できる', () => {
    clearAdminUnlocked();
    expect(isAdminUnlocked()).toBe(false);

    setAdminUnlocked();
    expect(isAdminUnlocked()).toBe(hasStorage);

    clearAdminUnlocked();
    expect(isAdminUnlocked()).toBe(false);
  });

  it('解除状態はセッション内だけ保持される (タブを閉じると消える)', () => {
    if (!hasStorage) return;
    // localStorage ではなく sessionStorage を使う =
    // タブを閉じると解除状態は消える
    setAdminUnlocked();
    expect(sessionStorage.getItem(ADMIN_SESSION_KEY)).toBe('1');
    expect(localStorage.getItem(ADMIN_SESSION_KEY)).toBeNull();
    clearAdminUnlocked();
    expect(sessionStorage.getItem(ADMIN_SESSION_KEY)).toBeNull();
  });
});
