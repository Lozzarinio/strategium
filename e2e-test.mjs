import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SSDIR = 'c:\\Users\\laure\\Documents\\GitHub\\strategium\\e2e-screenshots';
try { mkdirSync(SSDIR, { recursive: true }); } catch (_) {}

const results = [];

function log(msg, ok = true) {
  const icon = ok ? 'OK' : 'FAIL';
  console.log(`[${icon}] ${msg}`);
  results.push({ ok, msg });
}

async function ss(page, name) {
  try {
    await page.screenshot({ path: `${SSDIR}\\${name}.png`, fullPage: false, timeout: 4000 });
  } catch (_) {}
}

const FRONT = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(15000);

// ── Step 1: HomePage ──────────────────────────────────────────────────────
try {
  await page.goto(FRONT, { waitUntil: 'networkidle' });
  const h1 = await page.textContent('h1');
  const links = await page.locator('a[href^="/tournament/"]').count();
  log(`HomePage: h1="${h1?.trim()}" | ${links} tournament links`);
  await ss(page, '01-homepage');
} catch (e) {
  log(`HomePage FAIL: ${e.message}`, false);
}

// ── Step 2: Create tournament ─────────────────────────────────────────────
let sessionCode = null;
let createdId = null;
try {
  await page.goto(`${FRONT}/tournament/create`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form');
  await page.locator('input[placeholder*="Bay Area"]').fill('E2E Test Tournament');
  await page.locator('input[placeholder*="Fire and Dice"]').fill('Alpha Team');
  const playerInputs = await page.locator('input[placeholder^="Player "]').all();
  const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'];
  for (let i = 0; i < Math.min(5, playerInputs.length); i++) {
    await playerInputs[i].fill(names[i]);
  }
  await ss(page, '02a-form');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Tournament Created!', { timeout: 15000 });

  // Session code is in the big font-mono element
  const codeEl = page.locator('p.text-5xl.font-mono');
  sessionCode = (await codeEl.textContent())?.trim();

  // Get tournament ID from the "Go to Dashboard" link href
  const dashLink = page.locator('a:has-text("Go to Dashboard")');
  const dashHref = await dashLink.getAttribute('href');
  createdId = dashHref?.split('/').pop();

  log(`Create tournament OK | code=${sessionCode} | id=${createdId}`);
  await ss(page, '02b-success');
} catch (e) {
  log(`Create tournament FAIL: ${e.message}`, false);
  await ss(page, '02-fail');
}

// ── Step 3: Dashboard ─────────────────────────────────────────────────────
try {
  // Navigate directly using the real ID
  await page.goto(`${FRONT}/tournament/${createdId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Session Code');
  const codeOnDash = await page.locator('.font-mono').first().textContent();
  const hasAlice = (await page.locator('text=Alice').count()) > 0;
  log(`Dashboard: code=${codeOnDash?.trim()} | Alice visible=${hasAlice}`);
  await ss(page, '03-dashboard');
} catch (e) {
  log(`Dashboard FAIL: ${e.message}`, false);
  await ss(page, '03-fail');
}

// ── Step 4: Add opponent team ─────────────────────────────────────────────
try {
  await page.locator('button:has-text("Add Opponent Team")').click();
  await page.waitForSelector('text=New Opponent Team');
  await page.locator('input[placeholder*="Thunder Warriors"]').fill('E2E Opponents');
  const pInputs = await page.locator('input[placeholder^="Player "]').all();
  for (let i = 0; i < 5; i++) await pInputs[i].fill(`Enemy${i + 1}`);
  await ss(page, '04a-opp-form');
  await page.locator('button:has-text("Save Team")').click();
  await page.waitForSelector('text=E2E Opponents', { timeout: 10000 });
  log('Add opponent team OK — visible in list');
  await ss(page, '04b-opp-saved');
} catch (e) {
  log(`Add opponent FAIL: ${e.message}`, false);
  await ss(page, '04-fail');
}

// ── Step 5: Assign opponent to Round 1 ───────────────────────────────────
try {
  const sel = page.locator('select').first();
  await sel.waitFor();
  await sel.selectOption({ label: 'E2E Opponents' });
  await page.waitForTimeout(2000);
  const vsCount = await page.locator('text=vs').count();
  log(`Round assigned OK | "vs" occurrences: ${vsCount}`);
  await ss(page, '05-assigned');
} catch (e) {
  log(`Assign round FAIL: ${e.message}`, false);
  await ss(page, '05-fail');
}

// ── Step 6: View round detail ─────────────────────────────────────────────
let roundId = null;
try {
  const viewLink = page.locator('a:has-text("View Round")').first();
  await viewLink.waitFor();
  const roundHref = await viewLink.getAttribute('href');
  roundId = roundHref?.split('/').pop();
  await viewLink.click();
  await page.waitForSelector('text=Prediction Matrix', { timeout: 10000 });
  const hasEnemy1 = (await page.locator('th:has-text("Enemy1")').count()) > 0;
  log(`Round detail: Matrix visible | Enemy1 column=${hasEnemy1} | roundId=${roundId}`);
  await ss(page, '06-round-detail');
} catch (e) {
  log(`Round detail FAIL: ${e.message}`, false);
  await ss(page, '06-fail');
}

// ── Step 7: Fill predictions ──────────────────────────────────────────────
try {
  await page.waitForSelector('td.cursor-pointer', { timeout: 5000 });
  const cells = await page.locator('td.cursor-pointer').all();
  let filled = 0;
  for (const cell of cells) {
    if (filled >= 25) break;
    try {
      await cell.click({ timeout: 2000 });
      const input = page.locator('input[type="number"]').first();
      await input.waitFor({ timeout: 1500 });
      await input.fill(String(10 + (filled % 8)));
      await input.press('Enter');
      await page.waitForTimeout(300);
      filled++;
    } catch (_) {}
  }
  await page.waitForTimeout(4000);
  const successCount = await page.locator('.text-success').count();
  log(`Predictions: filled ${filled}/25 cells | ${successCount} success indicators`);
  await ss(page, '07-predictions');
} catch (e) {
  log(`Predictions FAIL: ${e.message}`, false);
  await ss(page, '07-fail');
}

// ── Step 8: Run Optimizer ─────────────────────────────────────────────────
try {
  const runBtn = page.locator('button:has-text("Run Optimizer")');
  await runBtn.waitFor({ timeout: 8000 });
  const disabled = await runBtn.isDisabled();
  if (disabled) {
    const hint = await page.locator('p').filter({ hasText: /Waiting/ }).first().textContent().catch(() => 'n/a');
    log(`Optimizer button disabled — hint: ${hint}`, false);
  } else {
    await runBtn.click();
    await page.waitForSelector('text=Recommended Defender', { timeout: 30000 });
    const rec = await page.locator('text=Recommended Defender').locator('..').locator('.text-2xl, .text-3xl').first().textContent().catch(() => '?');
    const meta = await page.locator('text=/scenarios/').first().textContent().catch(() => '?');
    log(`Optimizer OK | Defender: ${rec?.trim()} | ${meta?.trim()}`);
    await ss(page, '08-optimizer');
  }
} catch (e) {
  log(`Optimizer FAIL: ${e.message}`, false);
  await ss(page, '08-fail');
}

// ── Step 9: Pairing Wizard ────────────────────────────────────────────────
try {
  const wizLink = page.locator('a:has-text("Start Pairing Wizard")');
  await wizLink.waitFor({ state: 'visible', timeout: 5000 });
  await wizLink.click();
  await page.waitForSelector('h1', { timeout: 10000 });
  const wizTitle = await page.locator('h1').textContent();
  const step1 = (await page.locator('text=Step 1').count()) > 0;
  log(`Wizard: title="${wizTitle?.trim()}" | step1=${step1}`);
  await ss(page, '09-wizard');
} catch (e) {
  log(`Wizard FAIL: ${e.message}`, false);
  await ss(page, '09-fail');
}

// ── Step 10: Session join ─────────────────────────────────────────────────
if (sessionCode) {
  try {
    await page.goto(`${FRONT}/session/join`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[placeholder="A7X2K9"]').waitFor();
    await page.fill('input[placeholder="A7X2K9"]', sessionCode);
    await page.locator('button:has-text("Join Session")').click();
    await page.waitForSelector('text=Who are you?', { timeout: 10000 });
    const hasAlice = (await page.locator('text=Alice').count()) > 0;
    log(`Session join: roster shows Alice=${hasAlice}`);
    await ss(page, '10-join');
  } catch (e) {
    log(`Session join FAIL: ${e.message}`, false);
    await ss(page, '10-fail');
  }
} else {
  log('Session join SKIP — no session code captured', false);
}

await browser.close();

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${'─'.repeat(60)}`);
console.log(`SUMMARY: ${passed}/${results.length} passed  ${failed === 0 ? 'PASS' : 'FAIL'}`);
results.forEach(r => console.log(`  [${r.ok ? 'OK' : 'FAIL'}] ${r.msg}`));
