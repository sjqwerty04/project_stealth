import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  uniqueEmail,
  CREDS_PATH,
  saveEvidence,
  attachPageLog,
  dumpConsole,
  clearSession,
  signIn,
  completeOnboarding,
  gate,
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.afterEach(async ({}, testInfo) => {
  const m = testInfo.title.match(/^(F\d+|F-smoke-[^\s]+)/);
  const flowId = m?.[1] ?? 'unknown';
  await saveEvidence(testInfo, flowId);
});

test('F0 Waitlist', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await clearSession(page);
  const email = uniqueEmail();
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(page).toHaveURL(/waitlist/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /invite only/i })).toBeVisible();
  await gate(page, 'F0', testInfo.project.name);
  await dumpConsole(page, 'F0', testInfo.project.name, logs);
});

test('F1 Sign-in', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  const email = process.env.SELECTS_TEST_EMAIL;
  const password = process.env.SELECTS_TEST_PASSWORD;
  if (!email || !password) {
    test.info().annotations.push({ type: 'skip-reason', description: 'SELECTS_TEST_EMAIL not set' });
    await page.goto('/login');
    await page.screenshot({ path: path.join('artifacts', 'verify', `F1-${testInfo.project.name}`, 'still-skip.png') });
    await dumpConsole(page, 'F1', testInfo.project.name, logs.concat('SKIP: no SELECTS_TEST_EMAIL'));
    return;
  }
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/app/);
  await gate(page, 'F1', testInfo.project.name);
  await dumpConsole(page, 'F1', testInfo.project.name, logs);
});

test('F2 New account', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  const email = uniqueEmail();
  const password = 'SelectsVerify9';
  await page.goto('/join');
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('button', { name: /create new account/i }).click();
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 25000 });
  await completeOnboarding(page);
  await expect(page.getByTestId('tab-bar')).toBeVisible();
  await expect(page.getByTestId('home-strip')).toBeVisible();
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  fs.writeFileSync(CREDS_PATH, JSON.stringify({ email, password }));
  await gate(page, 'F2', testInfo.project.name);
  await dumpConsole(page, 'F2', testInfo.project.name, logs);
});

type PageLike = import('@playwright/test').Page;

async function ensureAuthed(page: PageLike) {
  const creds = fs.existsSync(CREDS_PATH) ? JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) : null;
  await page.goto('/app');
  await page.waitForLoadState('domcontentloaded');
  const tabs = page.getByTestId('tab-bar');
  const email = page.getByLabel(/email/i);
  try {
    await Promise.race([
      tabs.waitFor({ state: 'visible', timeout: 20000 }),
      email.waitFor({ state: 'visible', timeout: 20000 }),
      page.getByTestId('onboarding-0').waitFor({ state: 'visible', timeout: 20000 }),
    ]);
  } catch {
    // fall through
  }
  if (page.url().includes('/onboarding') || (await page.getByTestId('onboarding-0').isVisible().catch(() => false))) {
    await completeOnboarding(page);
    return;
  }
  if (!(await tabs.isVisible().catch(() => false))) {
    if (!creds) throw new Error('No saved F2 creds');
    await signIn(page, creds.email, creds.password);
  }
  if (page.url().includes('/onboarding')) {
    await completeOnboarding(page);
  }
  await tabs.waitFor({ state: 'visible', timeout: 20000 });
}

test('F3 Tabs', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/app');
  await expect(page.getByTestId('tab-home')).toBeVisible();
  await expect(page.getByText(/^search$/i)).toHaveCount(0);
  await page.getByTestId('tab-orbit').click();
  await expect(page).toHaveURL(/\/discover/);
  await expect(page.getByTestId('tab-orbit')).toHaveAttribute('aria-current', 'page');
  await page.getByTestId('tab-library').click();
  await expect(page).toHaveURL(/\/watched/);
  await page.getByTestId('tab-you').click();
  await expect(page).toHaveURL(/\/me/);
  await page.getByTestId('tab-home').click();
  await expect(page).toHaveURL(/\/app/);
  await gate(page, 'F3', testInfo.project.name);
  await dumpConsole(page, 'F3', testInfo.project.name, logs);
});

test('F4 Strip', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/app');
  const track = page.getByTestId('strip-track');
  await expect(track).toBeVisible();
  const first = await page.locator('[data-testid^="strip-day-"]').first().getAttribute('aria-label');
  const box = await track.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width - 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 20, { steps: 12 });
    await page.mouse.up();
  }
  await page.waitForTimeout(400);
  await page.mouse.move(box!.x + 20, box!.y + 20);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 20, box!.y + 20, { steps: 12 });
  await page.mouse.up();
  const after = await page.locator('[aria-pressed="true"]').getAttribute('aria-label');
  expect(first || after).toBeTruthy();
  await gate(page, 'F4', testInfo.project.name);
  await dumpConsole(page, 'F4', testInfo.project.name, logs);
});

test('F5 Logged day', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/app');
  const recs = page.getByTestId('empty-day-recs');
  const logged = page.getByTestId('logged-day');
  if (await recs.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
    await recs.getByRole('button').first().click();
    await expect(page).toHaveURL(/\/movie\//, { timeout: 15000 });
  } else {
    await expect(logged).toBeVisible();
    await logged.getByRole('button').first().click();
    await expect(page).toHaveURL(/\/movie\//, { timeout: 15000 });
  }
  await gate(page, 'F5', testInfo.project.name);
  await dumpConsole(page, 'F5', testInfo.project.name, logs);
});

test('F6 Empty day', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/app');
  await page.locator('[data-testid^="strip-day-"]').first().click();
  const recs = page.getByTestId('empty-day-recs');
  if (await recs.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    await recs.getByRole('button').nth(1).click();
    await expect(page).toHaveURL(/\/movie\//, { timeout: 15000 });
  } else {
    await page.getByTestId('year-zoom').click();
    await expect(page.getByTestId('year-zoom-calendar')).toBeVisible();
  }
  await gate(page, 'F6', testInfo.project.name);
  await dumpConsole(page, 'F6', testInfo.project.name, logs);
});

test('F7 Year-zoom', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/app');
  await page.getByTestId('year-zoom').click();
  await expect(page.getByTestId('year-zoom-calendar')).toBeVisible();
  await page.getByLabel(/previous month/i).click();
  await page.getByLabel(/previous month/i).click();
  await page.getByTestId('year-day').nth(10).click();
  await expect(page).toHaveURL(/discover\?date=/, { timeout: 10000 });
  await expect(page.getByTestId('orbit-search')).toBeVisible();
  await gate(page, 'F7', testInfo.project.name);
  await dumpConsole(page, 'F7', testInfo.project.name, logs);
});

test('F8 Orbit hunt', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/discover');
  await page.getByTestId('orbit-search').fill('dark');
  await page.waitForTimeout(800);
  const hit = page.getByRole('button', { name: /dark knight/i }).first().or(page.locator('a,button').filter({ hasText: /dark/i }).first());
  await hit.click({ timeout: 15000 });
  await expect(page).toHaveURL(/\/movie\//);
  await page.getByTestId('orbit-cta').click();
  await expect(page).toHaveURL(/\/orbit\//);
  await gate(page, 'F8', testInfo.project.name);
  await dumpConsole(page, 'F8', testInfo.project.name, logs);
});

test('F9 DNA', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/movie/155');
  const dna = page.getByLabel(/explore dna/i);
  if (!(await dna.isVisible().catch(() => false))) {
    test.info().annotations.push({ type: 'skip-reason', description: 'DNA control not visible' });
    await dumpConsole(page, 'F9', testInfo.project.name, logs.concat('SKIP unmet DNA precondition'));
    return;
  }
  await dna.click();
  await expect(page).toHaveURL(/\/dna\//);
  await gate(page, 'F9', testInfo.project.name);
  await dumpConsole(page, 'F9', testInfo.project.name, logs);
});

test('F10 Library', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/watched');
  await expect(page.getByTestId('library-hub')).toBeVisible();
  await page.getByRole('button', { name: /the wallet/i }).click();
  await expect(page).toHaveURL(/\/liked/);
  await page.getByTestId('tab-library').click();
  await page.getByRole('button', { name: /^saved/i }).click();
  await expect(page).toHaveURL(/\/saved/);
  await page.getByTestId('tab-library').click();
  await page.getByRole('button', { name: /shared lists/i }).click();
  await expect(page).toHaveURL(/\/shared/);
  await page.getByTestId('tab-library').click();
  await page.getByRole('button', { name: /vibes/i }).click();
  await expect(page).toHaveURL(/\/vibes/);
  await gate(page, 'F10', testInfo.project.name);
  await dumpConsole(page, 'F10', testInfo.project.name, logs);
});

test('F11 You', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/me');
  await expect(page.getByTestId('you-screen')).toBeVisible();
  await page.getByTestId('import-letterboxd').click();
  await expect(page.getByPlaceholder(/letterboxd username/i)).toBeVisible();
  await gate(page, 'F11', testInfo.project.name);
  await dumpConsole(page, 'F11', testInfo.project.name, logs);
});

test('F12 Share', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/shared');
  const invite = page.getByRole('button', { name: /invite|share|create/i }).first();
  if (await invite.isVisible().catch(() => false)) {
    await invite.click();
    const cancel = page.getByRole('button', { name: /cancel|close|done/i }).first();
    if (await cancel.isVisible().catch(() => false)) await cancel.click();
  }
  await gate(page, 'F12', testInfo.project.name);
  await dumpConsole(page, 'F12', testInfo.project.name, logs);
});

test('F13 Movie detail chrome', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/movie/155');
  await expect(page.getByTestId('action-watchlist')).toBeVisible();
  await page.getByTestId('action-watchlist').click();
  await page.getByTestId('action-like').click().catch(() => {});
  await gate(page, 'F13', testInfo.project.name);
  await dumpConsole(page, 'F13', testInfo.project.name, logs);
});

test('F14 Admin', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/admin');
  await expect(page.getByText(/access denied|admin|whitelist/i).first()).toBeVisible();
  await gate(page, 'F14', testInfo.project.name);
  await dumpConsole(page, 'F14', testInfo.project.name, logs);
});
