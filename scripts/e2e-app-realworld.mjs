/**
 * e2e-app-realworld.mjs — 実アプリの出題経路で画像教材を検証する
 *
 * 管理者出題範囲 (IndexedDB) を画像教材2種に限定し、
 * ホーム画面 →「はじめる」→ クイズ画面 → 解答 → 解説、という
 * ユーザーが実際に通る経路だけで検証する (自作HTMLは使わない)。
 *
 * 検証項目:
 *  1. クイズ画面で <img.problem-image-img> が自然サイズで実描画される
 *  2. 画像リクエストが 404 / 失敗しない
 *  3. alt に解答に必要な情報 (価格・個数) が含まれる
 *  4. 問題文・画像・解説・途中式が同じデータから対応して生成されている
 *  5. 画像が必須の2タイプとも実際に出題される
 *  6. 画像なし問題では画像要素が1つも出ない
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const PORT = 5399;
const BASE = `http://localhost:${PORT}`;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');

const lines = [];
const failures = [];
function check(name, ok, detail = '') {
  const l = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`;
  lines.push(l);
  if (!ok) failures.push(`${name} :: ${detail}`);
  console.log(l);
}

// ---- preview server ----
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => lines.push('SERVER ' + String(d).slice(0, 200)));

let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await sleep(500);
  up = await fetch(BASE).then((r) => r.ok).catch(() => false);
}
if (!up) { console.log('FAIL preview server did not start'); server.kill(); process.exit(1); }

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });

const badResponses = [];
const pageErrors = [];

/** 管理者出題範囲を IndexedDB に直接書き込む (UIの検証コード入力を省くため) */
async function seedScope(types) {
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'load' });
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

/** ホーム画面 → 「はじめる」でクイズを開始 */
async function startQuiz() {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  p.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
  await p.goto(BASE, { waitUntil: 'load' });
  await p.locator('.start-button').first().waitFor({ state: 'visible', timeout: 15000 });
  await p.locator('.start-button').first().click();
  await p.locator('.question-card').first().waitFor({ state: 'visible', timeout: 15000 });
  return p;
}

// ================= 1. 画像教材のみで出題 =================
await seedScope(['realworld_shopping', 'realworld_eggs']);
const page = await startQuiz();

const seen = new Map(); // image src -> details
const maxQ = 24;
for (let i = 0; i < maxQ; i++) {
  const img = page.locator('img.problem-image-img').first();
  const hasImg = (await page.locator('img.problem-image-img').count()) > 0;
  if (!hasImg) {
    check(`Q${i + 1} 画像問題として出題される`, false, 'img要素なし');
    break;
  }
  await img.waitFor({ state: 'visible', timeout: 8000 });
  const d = await img.evaluate((el) => ({
    src: el.getAttribute('src'),
    alt: el.getAttribute('alt') ?? '',
    nw: el.naturalWidth, nh: el.naturalHeight,
    w: el.clientWidth, h: el.clientHeight,
  }));
  const question = (await page.locator('.question-text').first().innerText()).trim();

  // 解答して解説・途中式を開示
  await page.locator('.keypad-button', { hasText: /^0$/ }).first().click();
  await page.locator('.submit-btn').first().click();
  await page.locator('.feedback').first().waitFor({ state: 'visible', timeout: 8000 });
  const explanation = (await page.locator('.feedback-explanation').first().innerText().catch(() => '')).trim();
  const steps = await page.locator('.solution-step').count();
  const stepText = (await page.locator('.solution-display').first().innerText().catch(() => '')).trim();

  if (!seen.has(d.src)) {
    seen.set(d.src, { ...d, question, explanation, steps, stepText });
  }

  // 次の問題へ (最終問は「けっかをみる」→ 結果画面に遷移するためそこで終了)
  const next = page.locator('.next-button').first();
  if ((await next.count()) === 0) break;
  const label = (await next.innerText()).trim();
  await next.click();
  if (label.includes('けっか')) {
    lines.push(`INFO 結果画面へ遷移 (出題${i + 1}問目で終了)`);
    break;
  }
  await page
    .locator('.question-card')
    .first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .catch(() => {});
}

// ---- 判定 ----
const expected = ['/images/supermarket-shelf.svg', '/images/eggs-brown-white.jpg'];
for (const src of expected) {
  const rec = seen.get(src);
  check(`画像教材が実際に出題される (${src})`, !!rec, rec ? `q=${rec.question.slice(0, 30)}` : `未出題。出題された画像=${[...seen.keys()].join(',')}`);
  if (!rec) continue;
  check(`  自然サイズ>0 で実描画 (${src})`, rec.nw > 0 && rec.nh > 0 && rec.w > 0 && rec.h > 0, `natural=${rec.nw}x${rec.nh} box=${rec.w}x${rec.h}`);
  check(`  alt に解答に必要な情報 (${src})`, /円|個|卵|値|価/.test(rec.alt), rec.alt.slice(0, 60));
  check(`  解説が生成される (${src})`, rec.explanation.length > 0, rec.explanation.slice(0, 40));
  check(`  途中式が生成される (${src})`, rec.steps > 0, `steps=${rec.steps}`);
  // 対応検証 (型ごとに画像から読ませる情報が違う)
  //  - スーパー: 値札の価格 (円) を画像から読み、解説・途中式で使う
  //  - 卵:      個数 (茶色1個 + 白1個 = 2個) を画像から読み、解説・途中式で使う
  //    (卵の値段は写真からは読めないため問題文側に書く設計)
  let infoOk = false;
  let infoDetail = '';
  if (src.includes('supermarket')) {
    const prices = [...rec.alt.matchAll(/(\d+)円/g)].map((m) => m[1]);
    const used = prices.filter((v) => rec.stepText.includes(v) || rec.explanation.includes(v));
    infoOk = prices.length > 0 && used.length > 0;
    infoDetail = prices.length
      ? 'alt価格=' + prices.join('/') + ' 使用=' + (used.join('/') || 'なし')
      : 'altに価格なし';
  } else {
    const altCounts = [...rec.alt.matchAll(/(\d+)個/g)].map((m) => m[1]);
    const usedCounts = altCounts.filter((v) => rec.stepText.includes(v) || rec.explanation.includes(v) || rec.question.includes(v));
    infoOk = altCounts.length > 0 && usedCounts.length > 0;
    infoDetail = altCounts.length
      ? 'alt個数=' + altCounts.join('/') + ' 使用=' + (usedCounts.join('/') || 'なし')
      : 'altに個数なし';
  }
  check(`  画像から読む情報が問題文・解説・途中式と対応 (${src})`, infoOk, infoDetail);
}

// ================= 2. 画像なし問題では画像が出ない =================
await seedScope(['integer_addition']);
const page2 = await startQuiz();
const plainImgs = await page2.locator('img.problem-image-img').count();
check('画像なし問題では画像要素を出さない', plainImgs === 0, `count=${plainImgs}`);
await page2.close();

// ================= 3. 監視項目 =================
check('404 / 失敗レスポンスが無い', badResponses.length === 0, [...new Set(badResponses)].slice(0, 6).join(' | '));
check('ページエラーが無い', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await browser.close();
server.kill();

writeFileSync(new URL('./e2e-app-realworld-result.json', import.meta.url), JSON.stringify({ lines, failures }, null, 2));
console.log(`\nSUMMARY pass=${lines.filter((l) => l.startsWith('PASS')).length} fail=${failures.length}`);
process.exit(failures.length ? 1 : 0);