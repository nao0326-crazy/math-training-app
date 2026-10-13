/**
 * verify-maintenance.mjs — AGENTS.md の required checks を実ブラウザで確認する
 *
 * 1. VITE_MAINTENANCE_MODE=true  のビルド → MaintenancePage のみ
 * 2. VITE_MAINTENANCE_MODE=false のビルド → 通常アプリ
 * 3. false 状態で quiz / history / calendar が動く
 */
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const VITE = 'node_modules/vite/bin/vite.js';

const failures = [];
function check(name, ok, detail = '') {
  const l = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`;
  console.log(l);
  if (!ok) failures.push(`${name} :: ${detail}`);
}

function build(mode) {
  console.log(`--- vite build (VITE_MAINTENANCE_MODE=${mode}) ---`);
  execFileSync(process.execPath, [VITE, 'build'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VITE_MAINTENANCE_MODE: mode },
  });
}

async function preview(port) {
  const srv = spawn(process.execPath, [VITE, 'preview', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://localhost:${port}`;
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(500);
    up = await fetch(base).then((r) => r.ok).catch(() => false);
  }
  if (!up) throw new Error(`preview did not start on ${port}`);
  return { srv, base };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });

/** 管理者出題範囲を IndexedDB に書き込む (E2E と同じ手順) */
async function seedScope(base, types) {
  const p = await ctx.newPage();
  await p.goto(base, { waitUntil: 'load' });
  await p.evaluate(async (t) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('grade6-math-app', 2);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      if (req.onupgradeneeded) {
        const d = req.result;
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('answers')) d.createObjectStore('answers', { keyPath: 'id', autoIncrement: true });
        if (!d.objectStoreNames.contains('questions')) d.createObjectStore('questions', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('dailySync')) d.createObjectStore('dailySync', { keyPath: 'submissionId' });
      }
    });
    await new Promise((res, rej) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key: 'admin-practice-scope-v1', problemTypes: t, difficultyRange: { min: 1, max: 5 } });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, types);
  await p.close();
}

// ================= 1. maintenance=true =================
build('true');
const p1 = await preview(5401);
{
  const page = await ctx.newPage();
  await page.goto(p1.base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const m = await page.locator('.maintenance-page').count();
  const h = await page.locator('.home-page').count();
  const anyQuiz = await page.locator('.question-card, .history-page').count();
  const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 80);
  check('true: MaintenancePage のみ表示', m === 1, `.maintenance-page=${m} text=${text}`);
  check('true: 通常アプリが無い', h === 0 && anyQuiz === 0, `.home-page=${h} quiz/history=${anyQuiz}`);
  await page.close();
}
p1.srv.kill();

// ================= 2/3. maintenance=false =================
build('false');
const p2 = await preview(5402);
{
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(p2.base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const m = await page.locator('.maintenance-page').count();
  const h = await page.locator('.home-page').count();
  check('false: 通常アプリが表示される', h === 1 && m === 0, `.home-page=${h} .maintenance-page=${m}`);

  // quiz (ホーム → .start-button)
  await seedScope(p2.base, ['integer_addition']);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.start-button').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.start-button').first().click();
  let quizOk = true;
  try {
    await page.locator('.question-card').first().waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    quizOk = false;
  }
  const quiz = await page.locator('.question-card').count();
  const kp = await page.locator('.keypad-button').count();
  const startErr = (await page.locator('.error-message').allInnerTexts().catch(() => [])).join(' | ');
  check('false: quiz が動く', quizOk && quiz > 0 && kp > 0, `.question-card=${quiz} keypad=${kp}${startErr ? ' err=' + startErr.slice(0, 100) : ''}`);

  // history + calendar (クイズ画面を閉じ、ホームから開き直す)
  const page2 = await ctx.newPage();
  await page2.goto(p2.base, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(800);
  const histBtn = page2.locator('button:has-text("学習履歴を見る")').first();
  await histBtn.click({ timeout: 10000 }).catch((e) => check('履歴ボタンをクリック', false, String(e).slice(0, 80)));
  await page2.waitForTimeout(1500);
  const hist = await page2.locator('.history-page').count();
  const cal = await page2.locator('.calendar-grid').count();
  check('false: history が動く', hist > 0, `.history-page=${hist}`);
  check('false: calendar が動く', cal > 0, `.calendar-grid=${cal}`);
  await page2.close();
  check('false: ページエラーが無い', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}
p2.srv.kill();

await browser.close();
console.log(`\nSUMMARY pass=${failures.length === 0 ? 'ALL' : 'some'} fail=${failures.length}`);
process.exit(failures.length ? 1 : 0);
