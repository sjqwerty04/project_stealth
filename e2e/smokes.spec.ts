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
  if (/login|join|waitlist/.test(page.url())) {
    if (!creds) throw new Error('No F2 creds');
    await signIn(page, creds.email, creds.password);
  }
  if (page.url().includes('/onboarding')) await completeOnboarding(page);
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
  await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  await dumpConsole(page, 'F-smoke-watchlist', testInfo.project.name, logs);
});

test('F-smoke-splash', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await page.goto('/');
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/(login|app|waitlist|onboarding)/);
  await dumpConsole(page, 'F-smoke-splash', testInfo.project.name, logs);
});
