/**
 * e2e-acceptance.mjs — 実機ブラウザ受入テスト (Playwright + 実Chrome)
 *
 * 目的: 「今日から普通に使えるか」を確認する。
 * コード変更は一切行わない (読み取り専用でアプリ，观察のみ)。
 *
 * 実行: node scripts/e2e-acceptance.mjs [baseURL]
 */

import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5322';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

function record(name, status, detail = '') {
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ' :: ' + detail : ''}`);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
page.on('requestfailed', (r) =>
  failedRequests.push(`${r.method()} ${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`),
);

// ---------- 1. ホーム画面 ----------
try {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  record('ホーム表示', bodyText.length > 10 ? 'PASS' : 'FAIL', `title=${title}`);
  // 通常モードの開始導線は分野ボタン (area) だけ
  const areaBtns = page.locator('.area-button');
  const areaCount = await areaBtns.count();
  record('分野選択ボタンの存在', areaCount > 0 ? 'PASS' : 'FAIL', `count=${areaCount}`);
  record('旧スタートボタンが無い', bodyText.includes('学習をはじめる') ? 'FAIL' : 'PASS');

  // 通常画面に selection UI (分野・学年・難易度) が無いか確認
  const forbidden = ['学年を選択', '分野を選択', '難易度を選択', '問題タイプ'];
  const leaked = forbidden.filter((w) => bodyText.includes(w));
  record(
    '通常画面にgenerator選択UIが無い',
    leaked.length === 0 ? 'PASS' : 'FAIL',
    leaked.length ? '検出: ' + leaked.join(',') : '',
  );

  // 管理者入口の有無
  const adminLink = page.getByRole('button', { name: /管理者/ }).first();
  const adminCount = await adminLink.count();
  record('管理者入口の存在', adminCount > 0 ? 'PASS' : 'FAIL', `count=${adminCount}`);

  globalThis.__homeButtons = await page.getByRole('button').allInnerTexts();
  globalThis.__homeText = bodyText;
} catch (e) {
  record('ホーム表示', 'FAIL', String(e).slice(0, 200));
}

console.log('--- HOME BUTTONS ---');
console.log(JSON.stringify(globalThis.__homeButtons));
console.log('--- HOME TEXT (first 600) ---');
console.log(String(globalThis.__homeText).slice(0, 600));

writeFileSync('e2e-step1.json', JSON.stringify({ results, consoleErrors, pageErrors, failedRequests }, null, 2));

// ---------- 管理者のパスワード入力-screen（正解パスなし） ----------
try {
  const adminBtn = page.getByRole('button', { name: /管理者/ }).first();
  await adminBtn.click();
  await page.waitForTimeout(600);
  const dialogText = await page.locator('body').innerText();
  const hasPasswordField = (await page.locator('input[type="password"]').count()) > 0;
  record('管理者パスワード入力画面が開く', hasPasswordField ? 'PASS' : 'FAIL',
    hasPasswordField ? '' : dialogText.slice(0, 200));
  await page.screenshot({ path: 'e2e-admin-dialog.png' });
} catch (e) {
  record('管理者パスワード入力画面が開く', 'FAIL', String(e).slice(0, 200));
}

writeFileSync('e2e-step2.json', JSON.stringify({ results, consoleErrors, pageErrors, failedRequests }, null, 2));

await browser.close();
console.log('DONE');
console.log(JSON.stringify({
  results,
  consoleErrors: consoleErrors.slice(0, 20),
  pageErrors: pageErrors.slice(0, 20),
  failedRequests: failedRequests.slice(0, 20),
}, null, 2));