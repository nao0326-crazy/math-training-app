/**
 * e2e-adaptive-timelimit.mjs — 適応型制限時間の実機受入テスト
 *
 * Playwright + 実 Chrome で実際にクリック・入力する。アプリ側のコードは変更しない。
 *
 * 検証項目:
 *  1. 管理者出題範囲 (problemType 固定 + 難易度固定) が反映される
 *  2. 適応履歴 (同一グループの正答8件) があると、タイマー表示が適応値 (20秒) になる
 *  3. 回答後に保存される timeLimitSec が、画面表示の制限時間と一致する
 *  4. 時間切れでレコードが二重に作られない (その問題でちょうど1件)
 *  5. 時間切れレコードの timeLimitSec も画面表示と一致する
 *  6. 学習履歴画面の統計 (問題数・正答率) が既存仕様のまま
 *  7. リロード後もアプリが正常表示される
 *  8. console error / uncaught exception が無い
 *
 * 実行: node scripts/e2e-adaptive-timelimit.mjs [baseURL]
 *   例: node scripts/e2e-adaptive-timelimit.mjs http://localhost:5405
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:5405';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
/** クイズに出題させる問題タイプ (scope と履歴 seed を一致させる) */
const PROBLEM_TYPE = 'integer_addition';
const LEVEL = 1;
/** seed する正答時間 (秒)。適応値 = ceil(5×0.9)=5 → 下限 20 秒で 20 */
const SEED_TIME_SEC = 5;
const EXPECTED_LIMIT_SEC = 20;
/** seed する正答記録の件数 (minSamples=8 を満たす) */
const SEED_COUNT = 8;

const failures = [];
function check(name, ok, detail = '') {
  const l = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`;
  console.log(l);
  if (!ok) failures.push(`${name} :: ${detail}`);
}

/** 現在のタイマー表示値 (残り秒) を読む */
async function shownTimerSec(page) {
  const raw = await page
    .locator('[data-testid="quiz-timer"] .quiz-timer-value')
    .first()
    .innerText({ timeout: 5000 })
    .catch(() => '');
  return Number(raw);
}

/** React fiber から描画済み問題データを読み取る (e2e-adaptive-learning.mjs と同流儀) */
async function analyzeProblem(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.answer-section') || document.querySelector('.quiz-page');
    if (!root) return null;
    const nodes = [root, ...root.querySelectorAll('*')];
    let problem = null;
    for (const el of nodes) {
      const fk = Object.keys(el).find(
        (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
      );
      if (!fk) continue;
      let fiber = el[fk];
      let depth = 0;
      while (fiber && depth < 80) {
        const props = fiber.memoizedProps;
        if (props && props.problem && props.problem.answer) {
          problem = props.problem;
          break;
        }
        fiber = fiber.return;
        depth++;
      }
      if (problem) break;
    }
    if (!problem) return null;
    return { type: problem.type, answer: problem.answer };
  });
}

/** キーパッドで1文字入力 */
async function typeDigit(page, ch) {
  const btn = page
    .locator('button.keypad-button.number-btn', { hasText: new RegExp('^' + ch + '$') })
    .first();
  if ((await btn.count()) === 0) return false;
  await btn.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(80);
  return true;
}

/**
 * 確実に不正解になる値を入力する。
 * (1問目を不正解にすると有効正答は seed の8件のまま維持され、
 *  2問目以降も適応値が続くことが保証される)
 */
async function inputWrongAnswer(page, problem) {
  const { answer } = problem;
  if (answer.kind === 'integer' || answer.kind === 'decimal') {
    const v = Number(answer.value);
    const wrong = Number.isFinite(v) ? (v >= 0 ? Math.floor(v) + 1 : 1) : 1;
    await page.locator('input.answer-display').first().click().catch(() => {});
    await page.waitForTimeout(120);
    for (const ch of String(wrong)) {
      await typeDigit(page, ch);
    }
    return true;
  }
  const field = page.locator('input.answer-display').first();
  if ((await field.count()) > 0) await field.click().catch(() => {});
  await typeDigit(page, '1');
  return (await page.locator('input.answer-display').count()) > 0;
}

/** answers ストアの全レコードを読み取る */
async function allAnswerRecords(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('grade6-math-app', 2);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const rows = await new Promise((res, rej) => {
      const tx = db.transaction('answers', 'readonly');
      const q = tx.objectStore('answers').getAll();
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    db.close();
    return rows;
  });
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 250)));

await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

// ---------- scope と適応履歴を seed ----------
await page.evaluate(
  async ({ type, level, seedTime, seedCount }) => {
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
    // 出題範囲: 対象 problemType 固定 + 難易度固定 (集計グループを1つに絞る)
    await new Promise((res, rej) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({
        key: 'admin-practice-scope-v1',
        problemTypes: [type],
        difficultyRange: { min: level, max: level },
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    // 適応履歴: 同一グループの有効な正答記録 (時系列順)
    const base = Date.now() - seedCount * 60000;
    for (let i = 0; i < seedCount; i++) {
      await new Promise((res, rej) => {
        const tx = db.transaction('answers', 'readwrite');
        tx.objectStore('answers').put({
          problemId: `seed_${i}`,
          problemType: type,
          category: 'integer',
          isCorrect: true,
          answerTimeSec: seedTime,
          answeredAt: new Date(base + i * 60000).toISOString(),
          difficultyLevel: level,
          question: `seed ${i}`,
          userAnswer: '1',
          correctAnswer: '1',
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
    db.close();
  },
  { type: PROBLEM_TYPE, level: LEVEL, seedTime: SEED_TIME_SEC, seedCount: SEED_COUNT },
);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// ---------- 1. scope の反映 ----------
const homeText = await page.locator('body').innerText();
check('1 出題範囲が反映される', homeText.includes('出題範囲：1種類'), homeText.match(/出題範囲：[^\n]*/)?.[0] ?? '');
check(
  '2 出題難易度が固定される',
  homeText.includes(`Lv${LEVEL}〜Lv${LEVEL}`),
  homeText.match(/出題難易度：[^\n]*/)?.[0] ?? '',
);

// ---------- 2. クイズ開始 → 適応値の表示 ----------
await page.locator('.start-button').first().click();
await page.waitForSelector('.question-card', { timeout: 15000 });
await page.waitForTimeout(300);
const shown1 = await shownTimerSec(page);
check(
  '3 1問目の表示制限時間が適応値 (20秒)',
  shown1 === EXPECTED_LIMIT_SEC,
  `shown=${shown1} expected=${EXPECTED_LIMIT_SEC}`,
);

const problem1 = await analyzeProblem(page);
check(
  '4 出題グループが seed と一致',
  problem1?.type === PROBLEM_TYPE,
  `type=${problem1?.type} expected=${PROBLEM_TYPE}`,
);

// ---------- 3. 回答 → 保存 timeLimitSec が表示と一致 ----------
const inputOk = problem1 ? await inputWrongAnswer(page, problem1) : false;
check('5 回答入力を構成できる', inputOk, `kind=${problem1?.answer?.kind}`);
await page.waitForTimeout(200);
await page.locator('button.submit-btn').first().click();
await page.waitForSelector('.feedback', { timeout: 8000 });
await page.waitForTimeout(600);

const recordsAfterQ1 = await allAnswerRecords(page);
const userRecords1 = recordsAfterQ1.filter((r) => !String(r.problemId).startsWith('seed_'));
check('6 回答が保存される', userRecords1.length === 1, `count=${userRecords1.length}`);
check(
  '7 保存 timeLimitSec が画面表示と一致 (1問目)',
  userRecords1[0]?.timeLimitSec === shown1,
  `timeLimitSec=${userRecords1[0]?.timeLimitSec} shown=${shown1}`,
);
check(
  '8 保存 answerTimeSec が有限の正数',
  typeof userRecords1[0]?.answerTimeSec === 'number' &&
    Number.isFinite(userRecords1[0]?.answerTimeSec) &&
    userRecords1[0]?.answerTimeSec >= 0,
  `answerTimeSec=${userRecords1[0]?.answerTimeSec}`,
);

// ---------- 4. 2問目 → 時間切れ → 二重確定なし ----------
await page.locator('.next-button').first().click();
await page.waitForSelector('.question-card', { timeout: 10000 });
await page.waitForTimeout(300);
const shown2 = await shownTimerSec(page);
check(
  '9 2問目の表示制限時間も適応値 (20秒)',
  shown2 === EXPECTED_LIMIT_SEC,
  `shown=${shown2}`,
);

// 時間切れ (20秒) を待つ。timeout は制限時間 + 余裕。
const sawTimedOut = await page
  .waitForSelector('.feedback.timed-out', { timeout: 35000 })
  .then(() => true)
  .catch(() => false);
check('10 時間切れ表示が出る', sawTimedOut, '⏰ 時間切れ！');
const timedOutText = sawTimedOut
  ? await page.locator('.feedback-title').first().innerText().catch(() => '')
  : '';
check('11 時間切れの文言', timedOutText.includes('時間切れ'), timedOutText);

const recordsAfterTimeout = await allAnswerRecords(page);
const timedOutRecords = recordsAfterTimeout.filter((r) => r.isTimedOut === true);
check(
  '12 時間切れの二重確定なし (ちょうど1件)',
  timedOutRecords.length === 1,
  `count=${timedOutRecords.length}`,
);
check(
  '13 時間切れの timeLimitSec も画面表示と一致',
  timedOutRecords[0]?.timeLimitSec === shown2,
  `timeLimitSec=${timedOutRecords[0]?.timeLimitSec} shown=${shown2}`,
);
check(
  '14 時間切れは不正解として記録される (isCorrect=false)',
  timedOutRecords[0]?.isCorrect === false,
  `isCorrect=${timedOutRecords[0]?.isCorrect}`,
);

// ---------- 5. 履歴統計 (既存仕様の維持) ----------
// seed 8 + 1問目1 + 時間切れ1 = 10件。正答は seed 8件 → 正答率 80%。
await page.locator('.nav-button', { hasText: '学習履歴' }).first().click();
await page.waitForSelector('.stats-overview', { timeout: 10000 });
await page.waitForTimeout(500);
const totalText = await page
  .locator('.stat-card', { hasText: '問題数' })
  .first()
  .innerText()
  .catch(() => '');
const accuracyText = await page
  .locator('.stat-card', { hasText: '正答率' })
  .first()
  .innerText()
  .catch(() => '');
check('15 学習履歴の問題数 (時間切れ込みの総回答数)', totalText.includes('10問'), totalText.replace(/\n/g, ' '));
check('16 学習履歴の正答率 (正答8 / 総数10)', accuracyText.includes('80'), accuracyText.replace(/\n/g, ' '));

// ---------- 6. リロード後も壊れない ----------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const afterReload = await page.locator('body').innerText();
check('17 リロード後もアプリが表示される', afterReload.includes('小6数学トレーニング'), afterReload.slice(0, 60).replace(/\n/g, ' '));
check('18 リロード後に読み込みエラーが出ない', !afterReload.includes('データの読み込みに失敗'));

// ---------- 7. エラー監視 ----------
check('19 console error が無い', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('20 uncaught exception が無い', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await browser.close();

console.log(`--- ${failures.length === 0 ? 'ALL PASS' : `${failures.length} FAIL`} / 20 checks ---`);
if (failures.length > 0) {
  for (const f of failures) console.log(`FAILED: ${f}`);
  process.exit(1);
}
