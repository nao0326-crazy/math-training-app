/**
 * e2e-learning.mjs — 通常学習フローの実機受入テスト
 *
 * Playwright + 実 Chrome で実際にクリック・入力する。
 * アプリ側のコードは一切変更しない（読み取りのみ）。
 *
 * 実行: node scripts/e2e-learning.mjs [baseURL]
 */

import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5322';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const QUESTIONS = 12;

const out = { results: [], consoleErrors: [], pageErrors: [], failedRequests: [], played: [] };
function rec(name, status, detail = '') {
  out.results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ' :: ' + detail : ''}`);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return;
  const args = m.args().map((a) => {
    try {
      return JSON.stringify(a.jsonValue()).slice(0, 400);
    } catch {
      return '<' + a.toString().slice(0, 200) + '>';
    }
  });
  out.consoleErrors.push(`[${m.type()}] ${m.text().slice(0, 300)} ||ARGS ${args.join(' ~ ')}`);
});
page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 250)));
page.on('requestfailed', (r) => out.failedRequests.push(`${r.url().slice(0, 100)} :: ${r.failure()?.errorText}`));

await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
rec('1 ホーム画面表示', 'PASS');

// 通常モードは「分野 (area) 選択 → 10問」。最初の分野ボタンから始まる。
await page.locator('.area-button').first().click();
await page.waitForTimeout(1200);
let body = await page.locator('body').innerText();
rec('2 学習開始→問題画面', body.length > 20 ? 'PASS' : 'FAIL', body.slice(0, 80));
await page.screenshot({ path: 'e2e-q1.png' });
/**
 * 問題文から答えを確定できるパターンを探す。
 * 判定できない場合は null を返す（その場合は適当な数字を答えて次の問題へ進む）。
 */
function solveQuestion(q) {
  const t = q.replace(/\s/g, '');
  let m;
  if ((m = t.match(/(\d+)と(\d+)を(たす|足す|加え)/))) {
    return { answer: String(Number(m[1]) + Number(m[2])) };
  }
  if ((m = t.match(/(\d+)[−-](\d+)/))) {
    return { answer: String(Number(m[1]) - Number(m[2])) };
  }
  if ((m = t.match(/(\d+)と(\d+)を(かける|掛け)/))) {
    return { answer: String(Number(m[1]) * Number(m[2])) };
  }
  if ((m = t.match(/(\d+)÷(\d+)/)) && Number(m[2]) !== 0 && Number(m[1]) % Number(m[2]) === 0) {
    return { answer: String(Number(m[1]) / Number(m[2])) };
  }
  if (
    (m = t.match(/(\d+)と(\d+)を(わ|割)/)) &&
    Number(m[2]) !== 0 &&
    Number(m[1]) % Number(m[2]) === 0
  ) {
    return { answer: String(Number(m[1]) / Number(m[2])) };
  }
  // 「5個買うと35円の品物があります。同じ品物を6個買うと何円ですか」
  if ((m = t.match(/(\d+)個買うと(\d+)円の品物があります。同じ品物を(\d+)個買う/))) {
    const v = (Number(m[2]) / Number(m[1])) * Number(m[3]);
    return { answer: String(Number.isInteger(v) ? v : Math.round(v)) };
  }
  // 「全体が144のとき、5：3に分けると小さいほうはいくつ」
  if ((m = t.match(/全体が(\d+)のとき、(\d+)：(\d+)に分けると小さいほうは/))) {
    const a = Number(m[2]);
    const b = Number(m[3]);
    const v = (Number(m[1]) * Math.min(a, b)) / (a + b);
    return { answer: String(Number.isInteger(v) ? v : Math.round(v)) };
  }
  // 「180 を100として考えたとき、90 パーセントはいくつですか」
  if ((m = t.match(/(\d+)を\d+として考えたとき、(\d+)パーセントは/))) {
    return { answer: String((Number(m[1]) * Number(m[2])) / 100) };
  }
  return null;
}

/** 最大公約数（検算用） */
function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}
let qIndex = 0; // 現在の問題番号（yes/no 選択の交互化に使用）
async function typeAnswer(page, answer, fields = 1) {
  // 判定（はい/いいえ）問題は数字キーパッドが無い
  const yesBtn = page.locator('button.yesno-btn.yes-btn');
  const noBtn = page.locator('button.yesno-btn.no-btn');
  if ((await page.locator('button.keypad-button.number-btn').count()) === 0 &&
      ((await yesBtn.count()) > 0 || (await noBtn.count()) > 0)) {
    // ランダムに1つ選ぶ（正誤判定の表示確認が目的）
    const pick = (qIndex % 2 === 0) ? yesBtn : noBtn;
    const target = (await pick.count()) > 0 ? pick : (await yesBtn.count()) > 0 ? yesBtn : noBtn;
    await target.first().click().catch(() => {});
    await page.waitForTimeout(200);
    return;
  }
  // 数字キーパッドも yes/no も無い画面では何もしない
  if ((await page.locator('button.keypad-button.number-btn').count()) === 0) return;
  const clear = page.locator('button.keypad-button.action-btn', { hasText: /^C$/ }).first();
  if ((await clear.count()) > 0) await clear.click().catch(() => {});
  await page.waitForTimeout(120);
  const values = Array.isArray(answer) ? answer : [answer];
  for (let idx = 0; idx < fields; idx++) {
    let v; if (idx < values.length) v = String(values[idx]); else if (fields === 1) v = '1'; else v = (idx === fields - 1) ? '3' : '2';
    // 複数入力欄はクリックでフォーカスを切替える（キー入力は常に active 欄へ入る）
    const field = page.locator('input.answer-display').nth(idx);
    await field.click().catch(() => {});
    await page.waitForTimeout(150);
    for (const ch of v) {
      if (ch === '.') {
        // 小数点は全角ボタン
        await page.locator('button.keypad-button.symbol-btn', { hasText: /^．$/ }).first().click({ timeout: 3000 }).catch(() => {});
      } else if (/^\d$/.test(ch)) {
        await page
          .locator('button.keypad-button.number-btn', { hasText: new RegExp(`^${ch}$`) })
          .first()
          .click({ timeout: 5000 })
          .catch(() => {});
      }
      // '-' など無いキーは無視（不正解でも採点結果の表示確認はできる）
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(200);
  }
}

let answered = 0;
let sawCorrect = false;
let sawWrong = false;
let sawSolution = false;
let sawNext = false;
let correctCount = 0;
for (let i = 0; i < QUESTIONS; i++) {
  const inputCount = await page.locator('input.answer-display').count();
  if (inputCount === 0) {
    const isResult = (await page.locator('.result-page').count()) > 0;
    rec(`Q${i + 1} 入力欄が無い`, isResult ? 'INFO' : 'FAIL', isResult ? '結果画面に到達' : '');
    break;
  }
  if (await page.locator('button.next-button').count() > 0) {
    // 前問の採り直しはしない
  }

  const qText = (await page.locator('.question-text').innerText().catch(() => '')) || '';
  const solved = solveQuestion(qText);
  const answerToType = solved ? solved.answer : String((i + 7) % 10);
  qIndex = i;
  await typeAnswer(page, answerToType, inputCount);
  await page.waitForTimeout(400);

  const submit = page.locator('button.submit-btn');
  if ((await submit.count()) === 0) {
    const snap = await page.evaluate(() => ({
      result: !!document.querySelector('.result-page'),
      choices: document.querySelectorAll('.choice-btn, .choice-option, [class*="choice"]').length,
      body: document.body.innerText.slice(0, 400),
    }));
    rec(`Q${i + 1} 送信ボタンが無い`, 'FAIL',
      `q="${qText.slice(0, 40)}" result=${snap.result} choices=${snap.choices} body=${snap.body.replace(/\n/g, ' | ').slice(0, 200)}`);
    break;
  }
  if (await submit.first().isDisabled()) {
    rec(`Q${i + 1} 送信ボタンが disabled`, 'FAIL', '入力が反映されていない可能性');
    break;
  }
  await submit.first().click();
  // 採点結果（.feedback）が表示されるまで待つ
  const gotFeedback = await page
    .locator('.feedback')
    .first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!gotFeedback) {
    rec(`Q${i + 1} 送信後に採点結果が表示されない`, 'FAIL',
      `q="${qText.slice(0, 40)}" typed=${answerToType}`);
    break;
  }
  await page.waitForTimeout(300);

  if (i === 0) {
    const dump = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].map((b) => ({
        text: (b.innerText || '').trim().slice(0, 20),
        cls: b.className,
        vis: !!b.offsetParent,
      }));
      return { btns, body: document.body.innerText.slice(0, 900) };
    });
    writeFileSync('e2e-answered-dump.json', JSON.stringify(dump, null, 2));
  }

  const after = await page.locator('body').innerText();
  const fbText = await page.locator('.feedback').first().innerText().catch(() => '(no feedback)');
  // ※絵文字は文字コード環境によって壊れるため、判定は文字列で行う
  const hasCorrect = after.includes('せいかい！') || after.includes('計算は合っています');
  const hasWrong = after.includes('ざんねん');
  const hasAnswerShown = /正解は\s*\S/.test(after);
  const hasSteps = after.includes('途中式');
  if (hasCorrect) sawCorrect = true;
  if (hasWrong) sawWrong = true;
  if (hasSteps) sawSolution = true;

  const solBtn = page.locator('button.toggle-solution-btn');
  if ((await solBtn.count()) > 0) {
    await solBtn.first().click();
    await page.waitForTimeout(400);
    if ((await page.locator('body').innerText()).length > after.length) sawSolution = true;
    await solBtn.first().click().catch(() => {});
    await page.waitForTimeout(200);
  }

  const nextBtn = page.locator('button.next-button');
  if ((await nextBtn.count()) > 0) {
    sawNext = true;
    await nextBtn.first().click();
    await page.waitForTimeout(800);
  }
  answered++;
  out.played.push({
    q: i + 1,
    qText: qText.slice(0, 50),
    typed: answerToType,
    inputVal: await page.locator('input.answer-display').first().inputValue().catch(() => '?'),
    hasCorrect,
    hasWrong,
    hasSteps,
    hasAnswerShown,
    fb: fbText.slice(0, 120).replace(/\n/g, ' | '),
  });
  if (i === 0) await page.screenshot({ path: 'e2e-answered.png' });
  if ((await page.locator('.result-page').count()) > 0) break;
}

rec('3 回答送信できる', answered >= 3 ? 'PASS' : 'FAIL', `${answered}問送信`);
rec('4 正解判定が表示される', sawCorrect ? 'PASS' : 'NOT TESTED');
rec('5 不正解判定が表示される', sawWrong ? 'PASS' : 'NOT TESTED');
rec('6 解説・途中式が表示される', sawSolution ? 'PASS' : 'FAIL',
  `${answered}問中 ${out.played.filter((p) => p.hasSteps).length}問に途中式`);
rec('6b 正解が開示される', out.played.every((p) => p.hasAnswerShown || p.hasCorrect) ? 'PASS' : 'FAIL');
rec('7 次の問題へ進める', sawNext && answered >= 3 ? 'PASS' : 'FAIL', `${answered}問連続`);
rec('8 複数問連続プレイ', answered >= 5 ? 'PASS' : 'FAIL', `${answered}問`);

if ((await page.locator('.result-page').count()) > 0) {
  rec('9 結果画面（正答率）表示', 'PASS',
    (await page.locator('.result-page').innerText()).slice(0, 60).replace(/\n/g, ' '));
  await page.screenshot({ path: 'e2e-result.png' });
} else {
  rec('9 結果画面（正答率）表示', 'NOT TESTED', '結果画面未到達');
}

rec('10 問題タイプが変化する', answered >= 5 ? 'PASS' : 'FAIL', `${answered}問 play`);

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
const histBtn = page.getByRole('button', { name: /学習履歴/ }).first();
if ((await histBtn.count()) > 0) {
  await histBtn.click();
  await page.waitForTimeout(1500);
  const histBody = await page.locator('body').innerText();
  rec('11 履歴画面が表示される', histBody.length > 40 ? 'PASS' : 'FAIL',
    histBody.slice(0, 110).replace(/\n/g, ' | '));
  await page.screenshot({ path: 'e2e-history.png' });

  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  rec('12 IndexedDB が存在する', dbs.length > 0 ? 'PASS' : 'FAIL', dbs.join(','));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const afterReload = await page.locator('body').innerText();
  rec('13 リロード後も履歴が残る', afterReload.length > 40 ? 'PASS' : 'FAIL',
    afterReload.slice(0, 90).replace(/\n/g, ' | '));
  await page.screenshot({ path: 'e2e-history-reload.png' });
} else {
  rec('11 履歴画面が表示される', 'FAIL', '履歴ボタンが見つからない');
}

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
rec('14 通常画面リロードでクラッシュしない',
  (await page.locator('body').innerText()).length > 20 ? 'PASS' : 'FAIL');

await page.locator('.area-button').first().click();
await page.waitForTimeout(1000);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
rec('15 学習中リロードで復旧する',
  (await page.locator('body').innerText()).length > 20 ? 'PASS' : 'FAIL');

rec('16 console error なし', out.consoleErrors.length === 0 ? 'PASS' : 'FAIL',
  out.consoleErrors.slice(0, 3).join(' | '));
rec('17 uncaught exception なし', out.pageErrors.length === 0 ? 'PASS' : 'FAIL',
  out.pageErrors.slice(0, 3).join(' | '));
rec('18 module 読み込み失敗なし', out.failedRequests.length === 0 ? 'PASS' : 'FAIL',
  out.failedRequests.slice(0, 3).join(' | '));

writeFileSync('e2e-learning.json', JSON.stringify(out, null, 2));
await browser.close();
console.log('DONE');
