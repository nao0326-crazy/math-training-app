/**
 * e2e-inspect.mjs — 問題画面の DOM を調査する（デバッグ専用）
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5322';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const N = Number(process.argv[3] || 3);
const log = [];
page.on('pageerror', (e) => log.push('PAGEERROR ' + String(e).slice(0, 120)));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.locator('.area-button').first().click();
await page.waitForTimeout(1200);

for (let i = 0; i < N; i++) {
  const q = await page.locator('.question-text').innerText().catch(() => '(no q)');
  const before = await page.locator('input.answer-display').first().inputValue().catch(() => '?');
  const digit = String((i + 7) % 10);
  const numBtn = page
    .locator('button.keypad-button.number-btn', { hasText: new RegExp(`^${digit}$`) })
    .first();
  const btnCount = await numBtn.count();
  await numBtn.click().catch((e) => log.push('CLICKFAIL ' + digit + ' ' + String(e).slice(0, 80)));
  await page.waitForTimeout(400);
  const after = await page.locator('input.answer-display').first().inputValue().catch(() => '?');

  const submit = page.locator('button.submit-btn');
  const dis = await submit.first().isDisabled();
  await submit.first().click({ force: true }).catch((e) => log.push('SUBMITFAIL ' + String(e).slice(0, 80)));
  await page.waitForTimeout(1200);

  const body = await page.locator('body').innerText();
  const nextLabel = await page.locator('button.next-button').innerText().catch(() => '(none)');
  const hasResult = (await page.locator('.result-page').count()) > 0;

  log.push(JSON.stringify({
    i,
    q: q.slice(0, 60),
    inputBefore: before,
    inputAfter: after,
    btnCount,
    submitDisabled: dis,
    head: body.slice(0, 240).replace(/\n/g, ' | '),
    nextLabel: nextLabel.trim(),
    hasResult,
  }));

  if (hasResult) break;
  const next = page.locator('button.next-button');
  if ((await next.count()) > 0) {
    await next.first().click();
    await page.waitForTimeout(1200);
  }
}
console.log(log.join('\n'));
await browser.close();