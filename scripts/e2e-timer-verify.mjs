/**
 * e2e-timer-verify.mjs — 問題ごとの時間制限タイマーの実ブラウザ検証（一時スクリプト）
 *
 * 目的: 制限時間タイマーが 実Chrome + preview サーバ で
 *       - カウントダウン表示・減少
 *       - 時間内の解答受理（正解/誤答）
 *       - 時間切れで入力が無効になり正答と解説が表示され「次へ」で進める
 *       - モバイル幅での収まり
 *       を正しく行い、console error / 未捕捉例外が無いことを確認する。
 *
 * 時間は Playwright の clock API (page.clock) で進めるため、実際の長時間待ちはしない。
 *
 * 実行:
 *   node scripts/e2e-timer-verify.mjs [baseURL]
 *   (既定 baseURL: http://localhost:5322 = `npm run preview -- --port 5322`)
 *
 * 管理者パスワード: 既定ゲートコード '0326'。
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5322';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ADMIN_PW = '0326';
const SHOT_DIR = 'e2e-timer-shots';

mkdirSync(SHOT_DIR, { recursive: true });

const out = { results: [], consoleErrors: [], pageErrors: [], screenshots: [] };
function rec(name, status, detail = '') {
  out.results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ' :: ' + detail : ''}`);
}

/** アプリ側 quizTimer.ts と同じポリシーで制限秒を算出 (表示と整合することを検証) */
function expectedLimit({ difficultyLevel: level, category, hasImage, hasFigure }) {
  const baseByLevel = { 1: 30, 2: 45, 3: 60, 4: 90, 5: 120 };
  const word = new Set(['ratio', 'speed', 'geometry', 'data', 'combinatorics', 'realWorld']);
  let t = baseByLevel[level] ?? 60;
  if (word.has(category)) t += 20;
  if (hasFigure) t += 20;
  if (hasImage) t += 30;
  return Math.min(300, Math.max(30, t));
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  serviceWorkers: 'block',
});
const page = await context.newPage();

page.on('console', (m) => {
  if (m.type() !== 'error') return;
  out.consoleErrors.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 300)));

async function shot(name) {
  const path = `${SHOT_DIR}/${name}`;
  await page.screenshot({ path, fullPage: false });
  out.screenshots.push(path);
}

/** 描画済み問題を React fiber から読み取る。 */
async function readProblem() {
  return page.evaluate(() => {
    const root = document.querySelector('.answer-section') || document.querySelector('.quiz-page');
    if (!root) return null;
    const nodes = [root, ...root.querySelectorAll('*')];
    for (const el of nodes) {
      const fk = Object.keys(el).find(
        (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
      );
      if (!fk) continue;
      let fiber = el[fk];
      let depth = 0;
      while (fiber && depth < 100) {
        const props = fiber.memoizedProps;
        if (props && props.problem && props.problem.answer) {
          const p = props.problem;
          return {
            type: p.type,
            category: p.category,
            answerKind: p.answer.kind,
            answerValue: p.answer.value,
            difficultyLevel: p.difficulty?.level ?? null,
            hasImage: !!p.image,
            hasFigure: !!p.figure,
          };
        }
        fiber = fiber.return;
        depth++;
      }
    }
    return null;
  });
}

/** 現在の残り秒表示を読み取る。 */
async function readTimerValue() {
  const txt = await page.locator('.quiz-timer-value').first().innerText().catch(() => null);
  if (txt == null) return null;
  const n = parseInt(txt, 10);
  return Number.isFinite(n) ? n : null;
}

/** 整数を UI キーパッド経由で入力する。 */
async function inputInteger(value) {
  await page.locator('input.answer-display').first().click().catch(() => {});
  await page.waitForTimeout(120);
  for (const ch of String(value)) {
    await page
      .locator('button.keypad-button.number-btn', { hasText: new RegExp('^' + ch + '$') })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(70);
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

/** 管理者モードで integer・難易度1 を指定し、決定的な計算問題を表示する。 */
async function startAdminIntegerQuiz() {
  await ensureAdminUnlocked();
  await page.selectOption('#admin-category', 'integer').catch(() => {});
  await page.selectOption('#admin-difficulty', '1').catch(() => {});
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'この条件で学習をはじめる' }).click();
  await page.locator('.question-text').first().waitFor({ state: 'visible', timeout: 8000 });
}

// ============================================================
// 時計を install (以降 Date.now / setInterval は仮想化。runFor で進める)
// ============================================================
await page.clock.install();
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

// ============================================================
// PHASE 1 — カウントダウン表示と減少
// ============================================================
rec('--- PHASE 1: カウントダウン表示と減少 ---', 'INFO');
await startAdminIntegerQuiz();
await page.waitForTimeout(200);

const q1 = await readProblem();
const timerVisible = (await page.locator('.quiz-timer').count()) > 0;
const v0 = await readTimerValue();
const exp = q1 ? expectedLimit(q1) : null;
rec(
  'P1a カウントダウンが表示され、制限時間ポリシーと一致',
  timerVisible && q1 && v0 === exp ? 'PASS' : 'FAIL',
  `timer=${timerVisible} shown=${v0} expected=${exp} level=${q1?.difficultyLevel} cat=${q1?.category}`,
);

// 時計を 3 秒進める → 残りが減る (経過時間ベース)
await page.clock.runFor(3000);
await page.waitForTimeout(200);
const v1 = await readTimerValue();
rec(
  'P1b 時間が経過すると残り秒が減る',
  v1 != null && v0 != null && v1 === v0 - 3 ? 'PASS' : 'FAIL',
  `before=${v0} after=${v1}`,
);

// ============================================================
// PHASE 2 — 時間内の解答は通常どおり受理される
// ============================================================
rec('--- PHASE 2: 時間内の解答受理 ---', 'INFO');
if (q1 && q1.answerKind === 'integer') {
  await inputInteger(q1.answerValue);
  await page.locator('button.submit-btn').first().click();
  await page.locator('.feedback').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(150);
  const fbClass =
    (await page.locator('.feedback.correct').count()) > 0
      ? 'correct'
      : (await page.locator('.feedback.incorrect').count()) > 0
        ? 'incorrect'
        : 'none';
  const timedOutShown = (await page.locator('.feedback.timed-out').count()) > 0;
  const timerGone = (await page.locator('.quiz-timer').count()) === 0;
  rec(
    'P2a 時間内の正答は正解になり、タイマーは停止 (表示されない)',
    fbClass === 'correct' && !timedOutShown && timerGone ? 'PASS' : 'FAIL',
    `fb=${fbClass} timedOut=${timedOutShown} timerGone=${timerGone} answer=${q1.answerValue}`,
  );
} else {
  rec('P2a 時間内の正答は正解になり、タイマーは停止 (表示されない)', 'FAIL', `answerKind=${q1?.answerKind}`);
}

// ============================================================
// PHASE 3 — 次へ進むと新しい問題でタイマーが再開 (新しい制限時間)
// ============================================================
rec('--- PHASE 3: 次の問題でタイマー再開 ---', 'INFO');
await page.locator('button.next-button').first().click();
await page.locator('.question-text').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
await page.waitForTimeout(200);
const q2 = await readProblem();
const v2 = await readTimerValue();
const exp2 = q2 ? expectedLimit(q2) : null;
rec(
  'P3 次の問題で新しい制限時間 (全秒) から始まる',
  q2 && (await page.locator('.quiz-timer').count()) > 0 && v2 === exp2 ? 'PASS' : 'FAIL',
  `shown=${v2} expected=${exp2} level=${q2?.difficultyLevel}`,
);

// ============================================================
// PHASE 4 — 時間切れ: 入力無効化・正答と解説表示・次へで進行
// ============================================================
rec('--- PHASE 4: 時間切れの処理 ---', 'INFO');
if (q2) {
  const limit2 = exp2 ?? (await readTimerValue()) ?? 30;
  // 制限時間 + 2 秒だけ進めて期限を超える
  await page.clock.runFor((limit2 + 2) * 1000);
  await page.waitForTimeout(300);

  const timedOutShown = (await page.locator('.feedback.timed-out').count()) > 0;
  const titleTxt = await page.locator('.feedback-title').first().innerText().catch(() => '');
  const inputGone = (await page.locator('.answer-section').count()) === 0;
  const timerGone = (await page.locator('.quiz-timer').count()) === 0;
  rec(
    'P4a 時間切れになり入力が無効化される',
    timedOutShown && inputGone && timerGone && titleTxt.includes('時間切れ') ? 'PASS' : 'FAIL',
    `timedOut=${timedOutShown} inputGone=${inputGone} timerGone=${timerGone} title="${titleTxt}"`,
  );

  const fbText = await page.locator('.feedback').first().innerText().catch(() => '');
  const showsAnswer = fbText.includes('正解は');
  rec(
    'P4b 時間切れで正答と解説が表示される',
    showsAnswer && fbText.length > 0 ? 'PASS' : 'FAIL',
    `showsAnswer=${showsAnswer} fbLen=${fbText.length}`,
  );
  await shot('01-timeout-feedback.png');

  // 次へ進める
  const nextBtn = page.locator('button.next-button').first();
  const nextVisible = (await nextBtn.count()) > 0;
  const progressBefore = await page.locator('.quiz-progress').first().innerText().catch(() => '');
  if (nextVisible) await nextBtn.click();
  await page.locator('.question-text').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(200);
  const progressAfter = await page.locator('.quiz-progress').first().innerText().catch(() => '');
  rec(
    'P4c 時間切れ後も「次へ」で次の問題へ進める',
    nextVisible && progressAfter !== progressBefore ? 'PASS' : 'FAIL',
    `next=${nextVisible} "${progressBefore.trim()}" -> "${progressAfter.trim()}"`,
  );
}

// ============================================================
// PHASE 5 — モバイル幅 (375px) でタイマーが崩れない
// ============================================================
rec('--- PHASE 5: モバイル幅の表示 ---', 'INFO');
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(300);
const mTimer = await page.locator('.quiz-timer').first().boundingBox().catch(() => null);
const mWithin = mTimer && mTimer.x >= 0 && mTimer.x + mTimer.width <= 376;
const mNoScroll = await page.evaluate(
  () => document.documentElement.scrollWidth <= window.innerWidth + 1,
);
rec(
  'P5 モバイル幅でタイマーが画面外へはみ出さない',
  mWithin && mNoScroll ? 'PASS' : 'FAIL',
  `timerR=${mTimer && Math.round(mTimer.x + mTimer.width)} hScroll=${!mNoScroll}`,
);
await shot('02-timer-mobile.png');

// ============================================================
// エラー確認
// ============================================================
rec('--- エラー確認 ---', 'INFO');
rec(
  'E1 console error が無い',
  out.consoleErrors.length === 0 ? 'PASS' : 'FAIL',
  `count=${out.consoleErrors.length} ${out.consoleErrors.slice(0, 3).join(' | ')}`,
);
rec(
  'E2 未捕捉例外 (pageerror) が無い',
  out.pageErrors.length === 0 ? 'PASS' : 'FAIL',
  `count=${out.pageErrors.length} ${out.pageErrors.slice(0, 3).join(' | ')}`,
);

await browser.close();

const pass = out.results.filter((r) => r.status === 'PASS').length;
const fail = out.results.filter((r) => r.status === 'FAIL').length;
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify({ PASS: pass, FAIL: fail, screenshots: out.screenshots }));
process.exit(fail === 0 ? 0 : 1);
