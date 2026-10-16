/**
 * e2e-eggs-verify.mjs — 実写連動教材 realworld_eggs の実ブラウザ描画検証（一時スクリプト）
 *
 * 目的: 卵問題 (realworld_eggs) が 実Chrome + preview サーバ で正しく描画・採点・
 *       解説表示され、通常モードで学習履歴へ保存されることを確認する。
 *
 * 特徴:
 * - 本番コードは一切変更しない（読み取り専用でアプリを操作する）。
 * - 表示検証は 管理者モード (filtered: type=realworld_eggs) を使い、卵問題を確実に表示する。
 * - 履歴保存は 通常モード（管理者モードでは保存されない仕様のため）で確認する。
 * - 画像フォールバックは page.route で画像リクエストを意図的に失敗させて確認する。
 *   (Service Worker のキャッシュ影響を避けるため context で serviceWorkers:'block' を使う)
 *
 * 実行:
 *   node scripts/e2e-eggs-verify.mjs [baseURL]
 *   (既定 baseURL: http://localhost:5322 = `npm run preview -- --port 5322`)
 *
 * 管理者パスワード: 既定ゲートコード '0326' (src/utils/adminMode.test.ts で確認済み)。
 */

import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, statSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5322';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ADMIN_PW = '0326';
const SHOT_DIR = 'e2e-eggs-shots';
const IMG_URL_SUBSTR = 'eggs-brown-white.jpg';
const AREA = 'くらしの中の算数';

mkdirSync(SHOT_DIR, { recursive: true });

const out = { results: [], consoleErrors: [], pageErrors: [], failedRequests: [], screenshots: [] };
function rec(name, status, detail = '') {
  out.results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ' :: ' + detail : ''}`);
}
let intentionalImageBlock = false;

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
// Service Worker のキャッシュを無効化し、画像の読み込み成功/失敗を network で決定的にする。
const context = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  serviceWorkers: 'block',
});
const page = await context.newPage();

page.on('console', (m) => {
  if (m.type() !== 'error') return;
  // 画像フォールバック試験で卵画像を意図的に失敗させた際の
  // "Failed to load resource" は対象リソースが卵画像なので除外する。
  const loc = (typeof m.location === 'function' ? m.location() : {}) || {};
  if ((loc.url || '').includes(IMG_URL_SUBSTR)) return;
  out.consoleErrors.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 300)));
page.on('requestfailed', (r) => {
  const url = r.url();
  if (intentionalImageBlock && url.includes(IMG_URL_SUBSTR)) return; // 試験上の意図的失敗
  out.failedRequests.push(`${r.method()} ${url.slice(0, 120)} :: ${r.failure()?.errorText}`);
});

async function shot(name) {
  const path = `${SHOT_DIR}/${name}`;
  await page.screenshot({ path, fullPage: false });
  out.screenshots.push(path);
  return path;
}

/** 描画済み問題を React fiber から読み取る (preview の production バンドルでも可)。 */
async function readProblem() {
  return page.evaluate(() => {
    const root = document.querySelector('.answer-section') || document.querySelector('.quiz-page');
    if (!root) return null;
    const nodes = [root, ...root.querySelectorAll('*')];
    for (const el of nodes) {
      const fk = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (!fk) continue;
      let fiber = el[fk];
      let depth = 0;
      while (fiber && depth < 100) {
        const props = fiber.memoizedProps;
        if (props && props.problem && props.problem.answer) {
          const p = props.problem;
          const steps = Array.isArray(p.solutionSteps) ? p.solutionSteps : [];
          return {
            type: p.type, category: p.category, question: p.question,
            answerKind: p.answer.kind, answerValue: p.answer.value,
            difficultyLevel: p.difficulty?.level ?? null,
            imageSrc: p.image?.src ?? null, imageAlt: p.image?.altText ?? '', imageCaption: p.image?.caption ?? '',
            variant: p.parameters?.variant ?? null, explanation: p.explanation ?? '',
            solutionText: steps.map((s) => `${s.expression ?? ''} ${s.explanation ?? ''}`).join(' '),
          };
        }
        fiber = fiber.return; depth++;
      }
    }
    return null;
  });
}

/** 整数を UI キーパッド経由で入力する (実写教材はすべて integer 入力)。 */
async function inputInteger(value) {
  await page.locator('input.answer-display').first().click().catch(() => {});
  await page.waitForTimeout(120);
  for (const ch of String(value)) {
    await page.locator('button.keypad-button.number-btn', { hasText: new RegExp('^' + ch + '$') }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(80);
  }
}

/** 管理者モードが解除済みでなければ解除する。 */
async function ensureAdminUnlocked() {
  if ((await page.locator('#admin-type').count()) > 0) return;
  await page.getByRole('button', { name: /^管理者モード$/ }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('input[type="password"]').fill(ADMIN_PW);
  await page.getByRole('button', { name: '解除する' }).click().catch(() => {});
  await page.locator('#admin-type').first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
}

/** 管理者モードで type=realworld_eggs・難易度2 を指定して卵問題を表示する。 */
async function startAdminEggQuiz() {
  await ensureAdminUnlocked();
  await page.selectOption('#admin-type', 'realworld_eggs');
  await page.selectOption('#admin-difficulty', '2').catch(() => {});
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'この条件で学習をはじめる' }).click();
  await page.locator('.question-text').first().waitFor({ state: 'visible', timeout: 8000 });
}

/** IndexedDB の store の件数を数える。 */
async function countStore(storeName) {
  return page.evaluate(async (sn) => new Promise((resolve, reject) => {
    const req = indexedDB.open('grade6-math-app', 2);
    req.onerror = () => reject(new Error('open fail'));
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction(sn, 'readonly');
        const c = tx.objectStore(sn).count();
        c.onsuccess = () => { resolve(c.result); db.close(); };
        c.onerror = () => { reject(new Error('count fail')); db.close(); };
      } catch (e) { db.close(); reject(e); }
    };
  }), storeName);
}

/** 保存済み回答のうち realworld_eggs で正答の件数を数える。 */
async function countSavedEggAnswers() {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const req = indexedDB.open('grade6-math-app', 2);
    req.onerror = () => reject(new Error('open fail'));
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('answers', 'readonly');
        const g = tx.objectStore('answers').getAll();
        g.onsuccess = () => {
          const rows = g.result || [];
          resolve(rows.filter((r) => r.problemType === 'realworld_eggs' && r.isCorrect).length);
          db.close();
        };
        g.onerror = () => { reject(new Error('get fail')); db.close(); };
      } catch (e) { db.close(); reject(e); }
    };
  }));
}

// ============================================================
// PHASE A — 管理者モードで卵問題を確実に表示し、描画・採点・解説・フォールバックを検証
// ============================================================
rec('--- PHASE A: 管理者モードで卵問題を表示 ---', 'INFO');
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
await startAdminEggQuiz();

const q1 = await readProblem();
if (!q1 || q1.type !== 'realworld_eggs') {
  rec('A0 卵問題を表示できた', 'FAIL', `type=${q1?.type}`);
} else {
  rec('A0 卵問題を表示できた', 'PASS', `variant=${q1.variant} lv=${q1.difficultyLevel}`);

  const img = page.locator('.problem-image-img').first();
  const imgCount = await page.locator('.problem-image-img').count();
  const imgState = await img.evaluate((el) => ({ complete: el.complete, naturalWidth: el.naturalWidth, src: el.getAttribute('src') })).catch(() => null);
  rec('A1 卵の実写画像が読み込まれる',
    imgCount === 1 && imgState?.complete && imgState.naturalWidth > 0 ? 'PASS' : 'FAIL',
    `count=${imgCount} complete=${imgState?.complete} naturalWidth=${imgState?.naturalWidth}`);

  const qText = await page.locator('.question-text').first().innerText().catch(() => '');
  const hasInput = (await page.locator('input.answer-display').count()) > 0;
  const hasSubmit = (await page.locator('button.submit-btn').count()) > 0;
  const hasKeypad = (await page.locator('button.keypad-button.number-btn').count()) > 0;
  rec('A2 画像/問題文/入力欄/回答ボタンのレイアウト',
    qText.length > 0 && hasInput && hasSubmit && hasKeypad ? 'PASS' : 'FAIL',
    `qLen=${qText.length} input=${hasInput} submit=${hasSubmit} keypad=${hasKeypad}`);

  const distinguished = qText.includes('問題で設定した数値') && (qText.includes('写真のように') || qText.includes('写真の'));
  const captionText = await page.locator('.image-caption').first().innerText().catch(() => '');
  const altText = await img.getAttribute('alt').catch(() => '');
  rec('A3 問題文の数値と写真情報が区別されている',
    distinguished && captionText.includes('2個') && (altText || '').includes('2個') ? 'PASS' : 'FAIL',
    `setNumMark=${qText.includes('問題で設定した数値')} photoRef=${distinguished} caption2=${captionText.includes('2個')} alt2=${(altText || '').includes('2個')}`);

  const vp = page.viewportSize();
  const bx = {};
  for (const [k, sel] of Object.entries({ img: '.problem-image-img', input: 'input.answer-display', submit: 'button.submit-btn' })) {
    bx[k] = await page.locator(sel).first().boundingBox().catch(() => null);
  }
  const within = (b) => b && b.x >= 0 && b.x + b.width <= vp.width + 1;
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  rec('A4 デスクトップで画像・回答欄が画面外へはみ出さない',
    within(bx.img) && within(bx.input) && within(bx.submit) && noHScroll ? 'PASS' : 'FAIL',
    `vpW=${vp.width} imgR=${bx.img && Math.round(bx.img.x + bx.img.width)} inputR=${bx.input && Math.round(bx.input.x + bx.input.width)} submitR=${bx.submit && Math.round(bx.submit.x + bx.submit.width)} hScroll=${!noHScroll}`);
  await shot('01-egg-question-desktop.png');
}

if (q1 && q1.type === 'realworld_eggs') {
  // --- モバイル幅 (375px) でもはみ出さない ---
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  const mImg = await page.locator('.problem-image-img').first().boundingBox().catch(() => null);
  const mInput = await page.locator('input.answer-display').first().boundingBox().catch(() => null);
  const mSubmit = await page.locator('button.submit-btn').first().boundingBox().catch(() => null);
  const mWithin = (b) => b && b.x >= 0 && b.x + b.width <= 376;
  const mNoScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  rec('A5 モバイル幅(375px)でも画像・回答欄が画面外へはみ出さない',
    mWithin(mImg) && mWithin(mInput) && mWithin(mSubmit) && mNoScroll ? 'PASS' : 'FAIL',
    `imgR=${mImg && Math.round(mImg.x + mImg.width)} inputR=${mInput && Math.round(mInput.x + mInput.width)} submitR=${mSubmit && Math.round(mSubmit.x + mSubmit.width)} hScroll=${!mNoScroll}`);
  await shot('02-egg-mobile-layout.png');
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.waitForTimeout(200);

  // --- 正答を入力 → 正解判定と解説 ---
  const correctValue = q1.answerValue;
  await inputInteger(correctValue);
  await page.locator('button.submit-btn').first().click();
  await page.locator('.feedback').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const isCorrect = (await page.locator('.feedback.correct').count()) > 0;
  rec('A6 正答入力で正解判定が表示される', isCorrect ? 'PASS' : 'FAIL', `answer=${correctValue}`);

  const toggle = page.locator('button.toggle-solution-btn');
  if ((await toggle.count()) > 0) await toggle.first().click().catch(() => {});
  await page.waitForTimeout(300);
  const solText = await page.locator('.feedback').first().innerText().catch(() => '');
  const solHasAnswer = solText.includes(String(correctValue));
  const explHasAnswer = (q1.explanation || '').includes(String(correctValue));
  rec('A7 解説の答えと問題の正答が一致する',
    solHasAnswer && explHasAnswer ? 'PASS' : 'FAIL',
    `solutionShows=${solHasAnswer} explanationHas=${explHasAnswer} answer=${correctValue}`);
  await shot('03-egg-correct.png');
}

if (q1 && q1.type === 'realworld_eggs') {
  // --- 次の問題 (Q2=卵) で誤答を入力 ---
  await page.locator('button.next-button').first().click().catch(() => {});
  await page.locator('.question-text').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const q2 = await readProblem();
  if (q2 && q2.type === 'realworld_eggs') {
    const wrongValue = Number(q2.answerValue) + 100;
    await inputInteger(wrongValue);
    await page.locator('button.submit-btn').first().click();
    await page.locator('.feedback').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const inCorrectShown = (await page.locator('.feedback.incorrect').count()) > 0;
    const correctShown = (await page.locator('.feedback.correct').count()) > 0;
    const fbText = await page.locator('.feedback').first().innerText().catch(() => '');
    const answerLineShown = fbText.includes('正解は') && fbText.includes(String(q2.answerValue));
    const intact = (await page.locator('.question-text').count()) > 0;
    rec('A8 誤答入力で画面が壊れず不正解判定が表示される',
      inCorrectShown && !correctShown && intact ? 'PASS' : 'FAIL',
      `input=${wrongValue} correct=${q2.answerValue} incorrectShown=${inCorrectShown} intact=${intact}`);
    rec('A9 誤答時にも正解開示と解説が正答と一致する',
      answerLineShown && (q2.explanation || '').includes(String(q2.answerValue)) ? 'PASS' : 'FAIL',
      `answerLine=${answerLineShown} explHas=${(q2.explanation || '').includes(String(q2.answerValue))}`);
    await shot('04-egg-wrong.png');
  } else {
    rec('A8 誤答テスト (Q2が卵でない)', 'WARN', `type=${q2?.type}`);
  }

  // --- 画像読み込み失敗時のフォールバック ---
  intentionalImageBlock = true;
  await page.route('**/' + IMG_URL_SUBSTR, (route) => route.abort());
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await startAdminEggQuiz();
  await page.waitForTimeout(700);
  const fallbackShown = (await page.locator('.problem-image-fallback').count()) > 0;
  const fbBody = await page.locator('.problem-image-fallback').first().innerText().catch(() => '');
  rec('A10 画像読み込み失敗時にフォールバックが表示される',
    fallbackShown && fbBody.includes('2個') ? 'PASS' : 'FAIL',
    `fallback=${fallbackShown} hasPhotoInfo=${fbBody.includes('2個')}`);
  await shot('05-egg-fallback.png');
  await page.unroute('**/' + IMG_URL_SUBSTR).catch(() => {});
  intentionalImageBlock = false;

  rec('A11 console error / 未捕捉例外なし',
    out.consoleErrors.length === 0 && out.pageErrors.length === 0 ? 'PASS' : 'FAIL',
    `console=${out.consoleErrors.length} pageerror=${out.pageErrors.length}`);
}

// ============================================================
// PHASE B — 通常モードで卵問題を1問正解し、学習履歴へ保存されるを確認
// ============================================================
rec('--- PHASE B: 通常モードで卵問題の履歴保存を確認 ---', 'INFO');
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await page.getByRole('button', { name: '管理者モードを閉じる' }).first().click().catch(() => {});
await page.waitForTimeout(400);

const answersBefore = await countStore('answers').catch(() => 0);
const questionsBefore = await countStore('questions').catch(() => 0);

let eggSaved = false;
let answeredThisRun = false;
let attempts = 0;
for (let attempt = 0; attempt < 14 && !eggSaved; attempt++) {
  attempts++;
  const areaBtn = page.locator(`.area-button[data-area="${AREA}"]`).first();
  if ((await areaBtn.count()) === 0) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.getByRole('button', { name: '管理者モードを閉じる' }).first().click().catch(() => {});
    await page.waitForTimeout(300);
    continue;
  }
  await areaBtn.click();
  await page.locator('.question-text').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const prob = await readProblem();
  if (prob && prob.type === 'realworld_eggs' && prob.answerKind === 'integer') {
    await inputInteger(prob.answerValue);
    await page.locator('button.submit-btn').first().click();
    await page.locator('.feedback').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    answeredThisRun = true;
    await page.waitForTimeout(900);
    if ((await countSavedEggAnswers().catch(() => 0)) >= 1) {
      eggSaved = true;
      await shot('06-egg-normal-save.png');
      rec('B1 通常モードで卵問題を正答した', 'PASS', `variant=${prob.variant} answer=${prob.answerValue}`);
      break;
    }
  }
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.getByRole('button', { name: '管理者モードを閉じる' }).first().click().catch(() => {});
  await page.waitForTimeout(300);
}

const answersAfter = await countStore('answers').catch(() => 0);
const questionsAfter = await countStore('questions').catch(() => 0);
rec('B2 解答後の履歴保存が正常に行われる (answers/questions が増える)',
  answeredThisRun && answersAfter > answersBefore ? 'PASS' : 'FAIL',
  `answers ${answersBefore}→${answersAfter} questions ${questionsBefore}→${questionsAfter} attempts=${attempts}`);
rec('B3 保存された履歴に realworld_eggs の正答が含まれる',
  eggSaved ? 'PASS' : 'FAIL', `eggCorrectSaved=${await countSavedEggAnswers().catch(() => 0)}`);

// ============================================================
// グローバル判定
// ============================================================
const realFailed = out.failedRequests.filter((f) => !f.includes(IMG_URL_SUBSTR));
rec('C1 モジュール読込失敗・ネットワーク失敗なし (意図的画像ブロックを除く)',
  realFailed.length === 0 ? 'PASS' : 'FAIL',
  realFailed.length ? realFailed.slice(0, 3).join(' | ') : '');
rec('C2 console error / 未捕捉例外なし (全体)',
  out.consoleErrors.length === 0 && out.pageErrors.length === 0 ? 'PASS' : 'FAIL',
  `console=${out.consoleErrors.length} pageerror=${out.pageErrors.length}`);

const existingShots = out.screenshots.filter((p) => existsSync(p) && statSync(p).size > 0);
rec('C3 スクリーンショット保存を確認', existingShots.length > 0 ? 'PASS' : 'FAIL', existingShots.join(', '));

console.log('\n=== SCREENSHOTS ===');
for (const s of existingShots) console.log('  ' + s);
console.log('\n=== SUMMARY ===');
const counts = out.results.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
console.log(JSON.stringify(counts));
if (out.consoleErrors.length) console.log('CONSOLE ERRORS:', JSON.stringify(out.consoleErrors, null, 2));
if (out.pageErrors.length) console.log('PAGE ERRORS:', JSON.stringify(out.pageErrors, null, 2));

await browser.close();





