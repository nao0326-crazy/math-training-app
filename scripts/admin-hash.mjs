#!/usr/bin/env node
/**
 * 管理者モードのパスワードハッシュ生成
 *
 * 平文パスワードはソースコードに置かない。生成されたハッシュだけを
 * .env に VITE_ADMIN_PASSWORD_HASH として設定する。
 *
 * 使い方:
 *   npm run admin:hash -- "任意のパスワード"
 *   VITE_ADMIN_SALT=mysalt npm run admin:hash -- "任意のパスワード"
 *
 * 出力する .env 用の行をそのまま .env へ貼り付ける。
 */

import { createHash } from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('使い方: npm run admin:hash -- "パスワード"');
  process.exit(1);
}

const salt = process.env.VITE_ADMIN_SALT ?? '';
const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex');

console.log('--- .env に追加する内容 ---');
if (salt) console.log(`VITE_ADMIN_SALT=${salt}`);
console.log(`VITE_ADMIN_PASSWORD_HASH=${hash}`);
console.log('---');
console.log('※ このハッシュは浏览器ーに公開されます。認証用ではなく表示制御用のゲートです。');
