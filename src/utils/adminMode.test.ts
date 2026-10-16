/**
 * 管理者モード (パスワード式ゲート) のテスト
 *
 * 確認したいこと:
 * - 既定の先頭ゼロを含むコードを文字列のまま照合する
 * - 設定された SHA-256 ハッシュによる照合を維持する
 * - 解除状態を永続化しない
 */

import { describe, expect, it } from 'vitest';
import {
  verifyAdminPassword,
  safeEqual,
} from './adminMode';
import { sha256Hex } from './sha256';

/** テスト用のハッシュを作る (本番の admin:hash スクリプトと同じ形) */
function hashOf(password: string, salt = ''): string {
  return sha256Hex(`${salt}:${password}`);
}

describe('verifyAdminPassword', () => {
  it('既定コードは先頭ゼロを含む文字列としてのみ受け付ける', () => {
    expect(verifyAdminPassword('0326')).toBe(true);
    expect(verifyAdminPassword('326')).toBe(false);
    expect(verifyAdminPassword('03260')).toBe(false);
  });

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

  it('環境設定済みの別コードがあっても既定コードを受け付ける', () => {
    expect(verifyAdminPassword('0326', hashOf('other-code', 'pepper'), 'pepper')).toBe(true);
  });

  it('明示的に空のハッシュは受け付けない', () => {
    expect(verifyAdminPassword('swordfish', '', '')).toBe(false);
    expect(verifyAdminPassword('swordfish', '   ', '')).toBe(false);
  });

  it('ハッシュは大文字小文字を区別しない (入力側で正規化されるため)', () => {
    const hash = hashOf('swordfish').toUpperCase();
    expect(verifyAdminPassword('swordfish', hash, '')).toBe(true);
  });
});

describe('safeEqual', () => {
  it('同じ文字列は true、異なる場合は false', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});
