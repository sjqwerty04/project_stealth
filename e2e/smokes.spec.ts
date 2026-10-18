import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { CREDS_PATH, signIn, saveEvidence, attachPageLog, dumpConsole, completeOnboarding } from './helpers';

test.afterEach(async ({}, testInfo) => {
  const m = testInfo.title.match(/^(F-smoke-[^\s]+)/);
  await saveEvidence(testInfo, m?.[1] ?? 'smoke');
});

async function authed(page: import('@playwright/test').Page) {
  const creds = fs.existsSync(CREDS_PATH) ? JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) : null;
  await page.goto('/app');
  const tabs = page.getByTestId('tab-bar');
  const email = page.getByLabel(/email/i);
  await Promise.race([
    tabs.waitFor({ state: 'visible', timeout: 20000 }),
    email.waitFor({ state: 'visible', timeout: 20000 }),
  ]).catch(() => {});
  if (!(await tabs.isVisible().catch(() => false))) {
    if (!creds) throw new Error('No F2 creds');
    await signIn(page, creds.email, creds.password);
  }
  if (page.url().includes('/onboarding')) await completeOnboarding(page);
  await tabs.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
}

test('F-smoke-cleanup', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await authed(page);
  await page.goto('/cleanup');
  await page.waitForTimeout(500);
  await dumpConsole(page, 'F-smoke-cleanup', testInfo.project.name, logs);
});

test('F-smoke-invite', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await page.goto('/invite/not-a-real-code');
  await expect(page.locator('body')).toBeVisible();
  await dumpConsole(page, 'F-smoke-invite', testInfo.project.name, logs);
});

test('F-smoke-watchlist', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await authed(page);
  await page.goto('/watchlist');
  await expect(page.getByRole('heading', { name: /library|lists|saved/i }).first()).toBeVisible();
  await dumpConsole(page, 'F-smoke-watchlist', testInfo.project.name, logs);
});

test('F-smoke-splash', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await page.goto('/');
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/(login|app|waitlist|onboarding)/);
  await dumpConsole(page, 'F-smoke-splash', testInfo.project.name, logs);
});

test('F-smoke-call', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await page.goto('/call');
  await expect(page).toHaveTitle('Call Selects');
  await expect(page).toHaveURL(/\/call\/?$/);
  await expect(page.getByRole('img', { name: 'Selects' })).toBeVisible();
  await expect(page.getByText('(231) 525-7644')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Call Selects' })).toHaveCount(0);
  await expect(page.getByText('Call Selects')).toHaveCount(1);
  const button = page.getByRole('link', { name: 'Call Selects' });
  await expect(button).toHaveAttribute('href', 'tel:+12315257644');
  await page.goto('/call/');
  await expect(page).toHaveTitle('Call Selects');
  await expect(page.getByRole('link', { name: 'Call Selects' })).toHaveAttribute('href', 'tel:+12315257644');
  await dumpConsole(page, 'F-smoke-call', testInfo.project.name, logs);
});
