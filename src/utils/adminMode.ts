/**
 * 管理者モード (隠しゲート) の判定
 *
 * 目的:
 *   通常学習者には学年・分野・単元・問題タイプ・難易度の選択 UI を見せない。
 *   開発者・管理者・テスト時だけ、その選択機能を使えるようにする。
 *
 * セキュリティ上の位置づけ:
 *   クライアント側の簡易ゲートであり、サーバー側の認証・アクセス制御ではない。
 *   既定コードのハッシュはビルド成果物に含まれ、短いコードは推測可能。
 *   VITE_ADMIN_PASSWORD_HASH を設定すると既存の追加コードも利用できる。
 *
 * 環境変数:
 *   VITE_ADMIN_PASSWORD_HASH : sha256(ソルト + ':' + パスワード) の小文字hex
 *   VITE_ADMIN_SALT          : 任意のソルト (未設定なら空文字)
 *
 * ハッシュの生成方法:
 *   npm run admin:hash -- "任意のパスワード"
 */

import { sha256Hex } from './sha256';

const DEFAULT_ADMIN_SALT = 'math-admin-mode-v1';
const DEFAULT_ADMIN_PASSWORD_HASH =
  'd5a8fa9d99505cce71f1f95a2f73cdb7150ed2aa3cfd1a3991f0ef0876eb3317';

function defaultCredentials(): { hash: string; salt: string } {
  const configuredHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH?.trim();
  if (configuredHash) {
    return {
      hash: configuredHash,
      salt: import.meta.env.VITE_ADMIN_SALT ?? '',
    };
  }
  return { hash: DEFAULT_ADMIN_PASSWORD_HASH, salt: DEFAULT_ADMIN_SALT };
}

/** 平文ハッシュを timed 比較するための遅延抵消つき比較 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 入力されたパスワードが設定済みハッシュと一致するか判定する。
 * 環境変数が未設定の場合は既定の簡易ゲートコードを使う。
 */
export function verifyAdminPassword(
  input: string,
  hash?: string,
  salt?: string,
): boolean {
  if (
    safeEqual(
      sha256Hex(`${DEFAULT_ADMIN_SALT}:${input}`),
      DEFAULT_ADMIN_PASSWORD_HASH,
    )
  ) {
    return true;
  }

  const defaults = defaultCredentials();
  const expectedHash = hash ?? defaults.hash;
  const effectiveSalt =
    salt ??
    (hash === undefined ? defaults.salt : import.meta.env.VITE_ADMIN_SALT ?? '');
  if (!expectedHash.trim()) return false;
  if (input === '') return false;
  return safeEqual(
    sha256Hex(`${effectiveSalt.trim()}:${input}`),
    expectedHash.trim().toLowerCase(),
  );
}
