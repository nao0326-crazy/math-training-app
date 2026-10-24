import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TYPE_LIST = JSON.parse(readFileSync(path.join(ROOT, 'e2e-type-list.json'), 'utf8'));

const lines = [];
const failures = [];
const samples = [];
function check(name, ok, detail = '') {
  const l = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`;
  lines.push(l);
  if (!ok) failures.push(`${name} :: ${detail}`);
  console.log(l);
}

let server = null;
server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => lines.push('SERVER ' + String(d).slice(0, 300)));
let up = false;
for (let i = 0; i < 120 && !up; i++) {
  await sleep(500);
  up = await fetch(BASE).then((r) => r.ok).catch(() => false);
}
if (!up) {
  console.log('FAIL dev server did not start');
  if (server) server.kill();
  process.exit(1);
}
console.log(`SERVER UP ${BASE}`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function seedScope(context, types, range) {
  const p = await context.newPage();
  await p.goto(BASE, { waitUntil: 'load' });
  await p.evaluate(async ({ types, range }) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('grade6-math-app', 3);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('answers')) {
          const a = d.createObjectStore('answers', { keyPath: 'id', autoIncrement: true });
          a.createIndex('by-date', 'answeredAt');
          a.createIndex('by-category', 'category');
          a.createIndex('by-type', 'problemType');
        }
        if (!d.objectStoreNames.contains('questions')) {
          const q = d.createObjectStore('questions', { keyPath: 'id', autoIncrement: true });
          q.createIndex('by-date', 'askedAt');
        }
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('dailySync')) d.createObjectStore('dailySync', { keyPath: 'submissionId' });
        if (!d.objectStoreNames.contains('scratchNotes')) d.createObjectStore('scratchNotes', { keyPath: 'attemptId' });
      };
    });
    await new Promise((res, rej) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({
        key: 'admin-practice-scope-v1',
        problemTypes: types,
        difficultyRange: range,
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { types, range });
  await p.close();
}

async function waitForQuestion(page) {
  await page.locator('.question-text').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => window.__E2E_CURRENT_PROBLEM__ != null, null, { timeout: 20000 });
  await page.waitForTimeout(200);
}

async function getGlobal(page) {
  return await page.evaluate(() => ({
    problem: window.__E2E_CURRENT_PROBLEM__,
    inputType: window.__E2E_CURRENT_INPUT_TYPE__,
    expected: window.__E2E_EXPECTED_ANSWER__,
  }));
}

async function submitCorrectUI(page, inputType, problem, expected) {
  if (inputType === 'choice') {
    const btn = page.locator('button.choice-btn', { hasText: expected }).first();
    if (await btn.count()) await btn.click();
  } else if (inputType === 'yesno') {
    const btn = page.locator('button.yesno-btn', { hasText: expected }).first();
    if (await btn.count()) await btn.click();
  } else if (inputType === 'fraction') {
    const p = problem.answer;
    const input = page.locator('input.answer-display').first();
    await input.click();
    await page.keyboard.type(String(p.numerator));
    await page.keyboard.press('Tab');
    await page.keyboard.type(String(p.denominator));
  } else if (inputType === 'mixed') {
    const p = problem.answer;
    const input = page.locator('input.answer-display').first();
    await input.click();
    await page.keyboard.type(String(p.whole));
    await page.keyboard.press('Tab');
    await page.keyboard.type(String(p.numerator));
    await page.keyboard.press('Tab');
    await page.keyboard.type(String(p.denominator));
  } else if (inputType === 'fraction-list') {
    const values = problem.answer.values;
    const input = page.locator('input.answer-display').first();
    await input.click();
    for (let i = 0; i < values.length; i++) {
      await page.keyboard.type(String(values[i].numerator));
      await page.keyboard.press('Tab');
      await page.keyboard.type(String(values[i].denominator));
      if (i < values.length - 1) await page.keyboard.press('Tab');
    }
  } else if (inputType === 'ratio') {
    const parts = String(expected).split(/[：:]/);
    const input = page.locator('input.answer-display').first();
    await input.click();
    await page.keyboard.type(parts[0] ?? '');
    await page.keyboard.press('Tab');
    await page.keyboard.type(parts[1] ?? '');
  } else {
    const input = page.locator('input.answer-display').first();
    await input.click();
    await page.keyboard.type(String(expected));
  }
  await page.locator('button.submit-btn').first().click();
}
async function runCase(type, level) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => lines.push(`PAGEERROR ${type} lv${level}: ${String(e).slice(0, 200)}`));
  const bad = [];
  const pageErrors = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => {
    const msg = String(e?.message ?? e).slice(0, 200);
    pageErrors.push(msg);
    lines.push(`PAGEERROR ${type} lv${level}: ${msg}`);
  });

  try {
    await seedScope(context, [type], { min: level, max: level });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.getByRole('button', { name: '問題を解く' }).click();
    await waitForQuestion(page);

    const q1 = await getGlobal(page);
    const problem1 = q1.problem;
    const inputType1 = q1.inputType;
    const expected1 = q1.expected;
    check(`${type} lv${level} Q1 question text`, !!problem1?.question?.trim(), String(problem1?.question ?? '').slice(0, 40));
    check(`${type} lv${level} Q1 input type`, !!inputType1, String(inputType1 ?? 'null'));
    check(`${type} lv${level} Q1 expected answer`, expected1 != null && String(expected1).trim() !== '', String(expected1 ?? 'null'));
    if (problem1?.figure) {
      const fc = await page.locator('.figure-svg, .problem-figure').count();
      check(`${type} lv${level} Q1 figure rendered`, fc > 0, `count=${fc}`);
    }
    if (problem1?.image) {
      const ic = await page.locator('img.problem-image-img').count();
      let nw = 0;
      if (ic > 0) nw = await page.locator('img.problem-image-img').first().evaluate((el) => el.naturalWidth).catch(() => 0);
      check(`${type} lv${level} Q1 image rendered`, ic > 0 && nw > 0, `count=${ic} naturalWidth=${nw}`);
    }
    if (Array.isArray(problem1?.choices) && problem1.choices.length > 0) {
      const cc = await page.locator('button.choice-btn').count();
      check(`${type} lv${level} Q1 choices rendered`, cc === problem1.choices.length, `rendered=${cc} expected=${problem1.choices.length}`);
    }

    await page.evaluate((val) => { const fn = window.__E2E_SUBMIT__; if (typeof fn === 'function') fn(val); }, expected1);
    await page.locator('.feedback').first().waitFor({ state: 'visible', timeout: 15000 });
    const correctText = await page.locator('.feedback').first().innerText();
    check(`${type} lv${level} Q1 correct feedback`, correctText.includes('せいかい'), correctText.slice(0, 40).replace(/\n/g, ' '));
    const toggle = page.getByRole('button', { name: '答えと解き方をみる' });
    if (await toggle.count()) {
      await toggle.click();
      await page.locator('.solution-display').first().waitFor({ state: 'visible', timeout: 10000 });
    }
    const solVisible = (await page.locator('.solution-display').count()) > 0;
    check(`${type} lv${level} Q1 solution display`, solVisible, `steps=${await page.locator('.solution-step').count()}`);
    const solText = await page.locator('.solution-display').first().innerText().catch(() => '');
    check(`${type} lv${level} Q1 solution answer value`, solText.includes(String(expected1)), `expected=${expected1}`);

    const nextBtn = page.locator('.next-button').first();
    await nextBtn.click();
    await waitForQuestion(page);

    const inputs = page.locator('input.answer-display');
    const icount = await inputs.count();
    let leftover = false;
    for (let i = 0; i < icount; i++) {
      const v = await inputs.nth(i).inputValue().catch(() => '');
      if (v !== '') leftover = true;
    }
    check(`${type} lv${level} Q2 no leftover input`, !leftover, leftover ? 'leftover value present' : 'empty');

    const q2 = await getGlobal(page);
    const problem2 = q2.problem;
    const inputType2 = q2.inputType;
    const expected2 = q2.expected;
    check(`${type} lv${level} Q2 question text`, !!problem2?.question?.trim(), String(problem2?.question ?? '').slice(0, 40));
    check(`${type} lv${level} Q2 input type`, !!inputType2, String(inputType2 ?? 'null'));
    check(`${type} lv${level} Q2 expected answer`, expected2 != null && String(expected2).trim() !== '', String(expected2 ?? 'null'));

    let wrongAnswer = 'WRONG_ANSWER_999';
    if (inputType2 === 'choice' && Array.isArray(problem2?.choices)) {
      const wrongChoice = problem2.choices.find(
        (c) => String(c).replace(/\s+/g, '') !== String(expected2).replace(/\s+/g, ''),
      );
      if (wrongChoice != null) wrongAnswer = String(wrongChoice);
    } else if (inputType2 === 'yesno') {
      if (String(expected2).includes('はい')) wrongAnswer = 'いいえ';
      else if (String(expected2).includes('いいえ')) wrongAnswer = 'はい';
    }

    await page.evaluate((val) => {
      const fn = window.__E2E_SUBMIT__;
      if (typeof fn === 'function') fn(val);
    }, wrongAnswer);
    await page.locator('.feedback').first().waitFor({ state: 'visible', timeout: 15000 });
    const wrongText = await page.locator('.feedback').first().innerText();
    check(`${type} lv${level} Q2 incorrect feedback`, wrongText.includes('ざんねん') && !wrongText.includes('時間切れ'), wrongText.slice(0, 40).replace(/\n/g, ' '));
    const feedbackAnswer = await page.locator('.feedback-answer').first().innerText().catch(() => '');
    check(`${type} lv${level} Q2 correct answer shown`, feedbackAnswer.includes(String(expected2)), `shown=${feedbackAnswer.slice(0, 40)} expected=${expected2}`);
    const sol2Visible = (await page.locator('.solution-display').count()) > 0;
    check(`${type} lv${level} Q2 solution display`, sol2Visible, `steps=${await page.locator('.solution-step').count()}`);

    const finishBtn = page.locator('.next-button').first();
    if (await finishBtn.count()) {
      await finishBtn.click();
      await page.locator('.result-page').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }
    const finishBtn2 = page.locator('.next-button').first();
    if (await finishBtn2.count()) { await finishBtn2.click(); await page.locator('.result-page').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}); }
    const resultVisible = (await page.locator('.result-page').count()) > 0;
    lines.push(`INFO ${type} lv${level} result page: ${resultVisible ? 'reached' : 'not reached (questionCount>2)'}`);

    if (pageErrors.length) check(`${type} lv${level} no page errors`, false, [...new Set(pageErrors)].slice(0, 3).join(' | '));
    else check(`${type} lv${level} no page errors`, true, 'none');
    if (bad.length) check(`${type} lv${level} no 404`, false, [...new Set(bad)].slice(0, 3).join(' | '));
    else check(`${type} lv${level} no 404`, true, 'none');

    samples.push({ type, level, inputType1, expected1, q1: problem1?.question?.slice(0, 60), q2: problem2?.question?.slice(0, 60) });
  } catch (e) {
    const msg = String(e?.message ?? e).slice(0, 300);
    failures.push(`${type} lv${level} EXCEPTION :: ${msg}`);
    lines.push(`FAIL ${type} lv${level} EXCEPTION :: ${msg}`);
    console.log(`FAIL ${type} lv${level} EXCEPTION :: ${msg}`);
  } finally {
    await page.close();
    await context.close();
  }
}
const FULL=process.env.E2E_FULL==='1'; const ONLY_TYPE=FULL?null:process.env.E2E_ONLY_TYPE; const ONLY_LEVEL=FULL?null:(process.env.E2E_ONLY_LEVEL?Number(process.env.E2E_ONLY_LEVEL):null);
for (const t of TYPE_LIST) {

  if (ONLY_TYPE && t.type !== ONLY_TYPE) continue;


  for (const level of t.levels) {

    if (ONLY_LEVEL !== null && level !== ONLY_LEVEL) continue;
    await runCase(t.type, level);
  }
}

await browser.close();
if (server) server.kill();

const passCount = lines.filter((l) => l.startsWith('PASS')).length;
const failCount = failures.length;
writeFileSync(path.join(ROOT, 'e2e-all-types-result.json'), JSON.stringify({ passCount, failCount, failures, samples, lines }, null, 2), 'utf8');
console.log(`\nSUMMARY pass=${passCount} fail=${failCount} cases=${TYPE_LIST.reduce((n,t)=>n+t.levels.length,0)}`);
process.exit(failCount ? 1 : 0);