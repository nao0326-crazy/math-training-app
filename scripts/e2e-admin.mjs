/**
 * e2e-admin.mjs — 管理者モードの実機受入テスト
 *
 * パスワードは環境変数 ADMIN_TEST_PW で受け取る（ログには出さない）。
 * 実行: $env:ADMIN_TEST_PW='...'; node scripts/e2e-admin.mjs [baseURL]
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5322';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PW = process.env.ADMIN_TEST_PW;
if (!PW) { console.error('ADMIN_TEST_PW が未設定'); process.exit(1); }

const results = [];
function rec(name, status, detail = '') {
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ' :: ' + detail : ''}`);
}

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

// 1. 管理者入口
const entry = page.getByRole('button', { name: /^管理者モード$/ }).first();
rec('1 管理者入口が存在', (await entry.count()) > 0 ? 'PASS' : 'FAIL');

// 2. パスワード入力画面
await entry.click();
await page.waitForTimeout(500);
const pwField = page.locator('input[type="password"]');
rec('2 パスワード入力画面が開く', (await pwField.count()) > 0 ? 'PASS' : 'FAIL');

// 3. 間違ったパスワードでは解除されない
await pwField.fill('wrong-password-12345');
await page.getByRole('button', { name: '解除する' }).click();
await page.waitForTimeout(400);
const errText = await page.locator('.admin-gate-error').innerText().catch(() => '');
const panelVisible = (await page.locator('#admin-category').count()) > 0;
rec('3 間違ったパスワードでは解除されない',
  (!panelVisible && errText.includes('違います')) ? 'PASS' : 'FAIL',
  `panel=${panelVisible} err="${errText}"`);

// 4. 正しいパスワードで解除される
await pwField.fill(PW);
await page.getByRole('button', { name: '解除する' }).click();
await page.waitForTimeout(600);
const unlocked = (await page.locator('#admin-category').count()) > 0;
rec('4 正しいパスワードで解除される', unlocked ? 'PASS' : 'FAIL');

// 5. 管理者用フィルタが表示される (grade/category/difficulty/type)
const ids = ['admin-category', 'admin-grade', 'admin-difficulty', 'admin-type'];
const present = [];
for (const id of ids) present.push(`${id}:${(await page.locator('#' + id).count()) > 0}`);
rec('5 フィルタ (分野/学年/難易度/タイプ) が表示される',
  present.every((p) => p.endsWith('true')) ? 'PASS' : 'FAIL', present.join(' '));

// 6-2. リロード後も解除状態が保持される (sessionStorage)
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const panelAfterReload = (await page.locator('#admin-category').count()) > 0;
rec('6b リロード後も解除状態が保持', panelAfterReload ? 'PASS' : 'FAIL',
  `panel=${panelAfterReload}`);

// 6-3. 各フィルタ条件で個別に問題生成を試す (どれが失敗するか切り分け)
const cases = [
  { id: 'admin-grade', label: '学年のみ' },
  { id: 'admin-category', label: '分野のみ' },
  { id: 'admin-difficulty', label: '難易度のみ' },
  { id: 'admin-type', label: 'タイプのみ' },
];
const caseResults = [];
for (const c of cases) {
  // ホームへ戻る
  const back = page.getByRole('button', { name: 'ホームに戻る' }).first();
  if ((await back.count()) > 0) { await back.click(); await page.waitForTimeout(500); }
  // すべて未選択に戻す
  for (const id of ['admin-category', 'admin-grade', 'admin-difficulty', 'admin-type']) {
    await page.selectOption('#' + id, '').catch(() => {});
  }
  const sel = page.locator('#' + c.id);
  const opts = await sel.locator('option').evaluateAll((o) => o.map((x) => x.value).filter((v) => v !== ''));
  if (opts.length === 0) { caseResults.push(`${c.label}:選択肢なし`); continue; }
  await sel.selectOption(opts[0]);
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'この条件で学習をはじめる' }).click();
  const ok = await page.locator('.question-text').first()
    .waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  const errText = await page.locator('.error-message').innerText().catch(() => '');
  caseResults.push(`${c.label}(=${opts[0]}): ${ok ? 'OK' : 'FAIL ' + errText}`);
  if (ok) {
    const back2 = page.getByRole('button', { name: /^ホーム$/ }).first();
    if ((await back2.count()) > 0) { await back2.click(); await page.waitForTimeout(400); }
    const back3 = page.getByRole('button', { name: 'ホームに戻る' }).first();
    if ((await back3.count()) > 0) { await back3.click(); await page.waitForTimeout(500); }
  }
}
rec('6 フィルタ条件ごとの問題生成', caseResults.every((r) => r.includes('OK') || r.includes('選択肢なし')) ? 'PASS' : 'FAIL',
  caseResults.join(' / '));

// 6-2. ブラウザ内で grade=1 の生成を直接試す (失敗理由の回収)
const genProbe = await page.evaluate(async () => {
  const reg = await import('/src/engine/selector/generatorRegistry.ts');
  const qp = await import('/src/engine/selector/questionPool.ts');
  const out = [];
  const pool = qp.filterQuestionPool({ grade: 1 }, qp.buildQuestionPool());
  out.push('pool=' + pool.map((e) => e.type).join(','));
  for (const e of pool) {
    let ok = 0; const errs = [];
    for (let i = 0; i < 30; i++) {
      try { reg.generateProblem({ type: e.type, difficulty: e.supportedLevels[0] }); ok++; }
      catch (err) { if (errs.length < 2) errs.push(String(err && err.message || err).slice(0, 150)); }
    }
    out.push(`${e.type}: ok=${ok}/30 errs=${errs.join(' || ')}`);
  }
  return out;
});
rec('6b grade=1 ブラウザ内生成の切り分け', 'INFO', genProbe.join(' / '));

// 6-3. FilteredSelector.selectNextQuestion を直接呼ぶ (再現確認)
const selProbe = await page.evaluate(async () => {
  const { FilteredSelector } = await import('/src/engine/selector/filteredSelector.ts');
  const out = [];
  for (const f of [{ grade: 1 }, { grade: 6 }, { category: 'integer' }, { difficulty: 1 }]) {
    const s = new FilteredSelector(f);
    let ok = 0; const errs = [];
    for (let i = 0; i < 20; i++) {
      try { s.selectNextQuestion([], [], { mode: { kind: 'filtered', filter: f }, difficulty: 1 }); ok++; }
      catch (err) { if (errs.length < 3) errs.push(String(err && err.message || err).slice(0, 200)); }
    }
    out.push(JSON.stringify(f) + ` ok=${ok}/20` + (errs.length ? ' errs=' + errs.join(' || ') : ''));
  }
  return out;
});
rec('6c FilteredSelector 直接呼び出し', 'INFO', selProbe.join(' / '));

// 6-4. QuizPage と同じ経路 (createQuizSelector) を再現
const uiProbe = await page.evaluate(async () => {
  const qs = await import('/src/pages/quizSelection.ts');
  const out = [];
  const cases = [
    { studyMode: { kind: 'filtered', filter: { grade: 1 } }, category: null, difficulty: 2, filter: { grade: 1 } },
    { studyMode: { kind: 'filtered', filter: { grade: 6 } }, category: null, difficulty: 2, filter: { grade: 6 } },
  ];
  for (const sel of cases) {
    let ok = 0; const errs = [];
    for (let i = 0; i < 20; i++) {
      try {
        const s = qs.createQuizSelector(sel);
        s.selectNextQuestion([], [], { mode: sel.studyMode, difficulty: qs.toDifficultyLevel(sel.difficulty) });
        ok++;
      } catch (err) { if (errs.length < 3) errs.push(String(err && err.message || err).slice(0, 250)); }
    }
    out.push(JSON.stringify(sel.studyMode.filter) + ` ok=${ok}/20` + (errs.length ? ' errs=' + errs.join(' || ') : ''));
  }
  return out;
});
rec('6d createQuizSelector 経路の再現', 'INFO', uiProbe.join(' / '));


// 7. 通常画面に通常の選択UIが無い（学習画面側）
const bodyNow = await page.locator('body').innerText();
const normalLeak = ['学年を選択', '分野を選択', '難易度を選択'].filter((w) => bodyNow.includes(w));
rec('7 学習画面に選択UIが無い', normalLeak.length === 0 ? 'PASS' : 'FAIL',
  normalLeak.join(','));

// 8. ホームへ戻り、管理者モードを閉じて通常モードへ戻れる
const homeBtn = page.getByRole('button', { name: /^ホーム$/ }).first();
if ((await homeBtn.count()) > 0) { await homeBtn.click(); await page.waitForTimeout(800); }
const closeBtn = page.getByRole('button', { name: '管理者モードを閉じる' }).first();
if ((await closeBtn.count()) > 0) {
  await closeBtn.click();
  await page.waitForTimeout(500);
}
const backToEntry = (await page.getByRole('button', { name: /^管理者モード$/ }).count()) > 0;
const panelGone = (await page.locator('#admin-category').count()) === 0;
rec('8 通常モードへ戻れる', (backToEntry && panelGone) ? 'PASS' : 'FAIL',
  `entry=${backToEntry} panelGone=${panelGone}`);

// 9. クローズ後は再度ロックされる (パスワード画面が戻る)
await page.getByRole('button', { name: /^管理者モード$/ }).first().click().catch(() => {});
await page.waitForTimeout(400);
const lockedAgain = (await page.locator('input[type="password"]').count()) > 0 &&
  (await page.locator('#admin-category').count()) === 0;
rec('9 閉じた後は再ロックされる', lockedAgain ? 'PASS' : 'FAIL', `locked=${lockedAgain}`);

rec('10 console error なし', consoleErrors.length === 0 ? 'PASS' : 'FAIL', consoleErrors.join(' | '));
rec('11 uncaught exception なし', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.join(' | '));

writeFileSync('e2e-admin.json', JSON.stringify({ results, consoleErrors, pageErrors }, null, 2));
console.log('DONE');
await browser.close();
