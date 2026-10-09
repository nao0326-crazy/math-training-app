/** e2e-debug.mjs — 指定インデックスの問題で送信しても feedback が出ない原因を調査 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5173';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET = Number(process.argv[3] || 2); // 1始まり

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const log = [];
page.on('pageerror', (e) => log.push('PAGEERROR ' + String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') log.push(`CONSOLE[${m.type()}] ` + m.text().slice(0, 300));
});
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.locator('.area-button').first().click();
await page.waitForTimeout(1200);

{
  const q = await page.locator('.question-text').innerText().catch(() => '(none)');
  log.push('Q1 ' + q);
  const before = await page.evaluate(() => ({
    inputs: document.querySelectorAll('input.answer-display').length,
    numBtns: document.querySelectorAll('button.keypad-button.number-btn').length,
    yesno: document.querySelectorAll('button.keypad-button.yesno-btn').length,
    btnTexts: [...document.querySelectorAll('button')].map((b) => `${b.className} :: ${b.innerText.trim()}`).slice(0, 30),
  }));
  log.push('BEFORE_CLICK ' + JSON.stringify(before));
  await page.locator('input.answer-display').first().click().catch((e) => log.push('FIELDCLICKFAIL ' + String(e).slice(0, 150)));
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    numBtns: document.querySelectorAll('button.keypad-button.number-btn').length,
    yesno: document.querySelectorAll('button.keypad-button.yesno-btn').length,
    active: [...document.querySelectorAll('input.answer-display')].map((el) => el.className),
    bodyHead: document.body.innerText.slice(0, 400),
  }));
  log.push('AFTER_CLICK ' + JSON.stringify(after));
}
console.log(log.join('\n'));
await browser.close();
