/**
 * 管理者モード (隠しゲート) の判定
 *
 * 目的:
 *   通常学習者には学年・分野・単元・問題タイプ・難易度の選択 UI を見せない。
 *   開発者・管理者・テスト時だけ、その選択機能を使えるようにする。
 *
 * セキュリティ上の位置づけ:
 *   「突破不能な認証」ではなく「通常ユーザーから選択機能を隠すゲート」。
 *   Vite の VITE_ 値はビルド成果物に公開されるため、ここに秘密情報は置かない。
 *   そのため、平文パスワードではなく **SHA-256 ハッシュ** を環境変数で渡す。
 *   平文パスワードがソースコードやビルド成果物に現れないことが要件。
 *
 * 環境変数:
 *   VITE_ADMIN_PASSWORD_HASH : sha256(ソルト + ':' + パスワード) の小文字hex
 *   VITE_ADMIN_SALT          : 任意のソルト (未設定なら空文字)
 *
 * ハッシュの生成方法:
 *   npm run admin:hash -- "任意のパスワード"
 */

import { sha256Hex } from './sha256';

/** セッション内で解除状態を保持するためのキー */
export const ADMIN_SESSION_KEY = 'math-admin-mode';

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
 * 入力されたパスワードが環境変数のハッシュと一致するか判定する
 *
 * ハッシュが未設定 (ゲートが無効) の場合は必ず false を返す。
 */
export function verifyAdminPassword(
  input: string,
  hash: string | undefined = import.meta.env.VITE_ADMIN_PASSWORD_HASH,
  salt: string | undefined = import.meta.env.VITE_ADMIN_SALT,
): boolean {
  if (!hash) return false;
  if (input === '') return false;
  const normalizedSalt = (salt ?? '').trim();
  return safeEqual(sha256Hex(`${normalizedSalt}:${input}`), hash.trim().toLowerCase());
}

/** ゲートが有効かどうか (ハッシュが設定されているか) */
export function isAdminGateConfigured(
  hash: string | undefined = import.meta.env.VITE_ADMIN_PASSWORD_HASH,
): boolean {
  return typeof hash === 'string' && hash.trim() !== '';
}

/** sessionStorage を読む (テストやSSRでも壊れないように包む) */
function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** 解除済みかどうかを読む (既定は未解除) */
export function isAdminUnlocked(): boolean {
  try {
    return storage()?.getItem(ADMIN_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/** 解除状態を保存する */
export function setAdminUnlocked(unlocked = true): void {
  try {
    if (unlocked) storage()?.setItem(ADMIN_SESSION_KEY, '1');
    else storage()?.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // 保存できなくても判定自体は成立させる (ゲートは表示制御が主目的)
  }
}

/** 解除状態を破棄する (管理者モードを閉じる) */
export function clearAdminUnlocked(): void {
  setAdminUnlocked(false);
}
