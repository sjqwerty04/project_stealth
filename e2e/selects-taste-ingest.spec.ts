import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  attachPageLog,
  completeOnboarding,
  CREDS_PATH,
  dumpConsole,
  saveEvidence,
  signIn,
  uniqueEmail,
} from './helpers';

async function signupFreshAccount(page: Page, password = 'SelectsVerify9') {
  const email = uniqueEmail();
  await page.goto('/join');
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('button', { name: /create new account/i }).click();
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 25_000 });
  await completeOnboarding(page);
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  fs.writeFileSync(CREDS_PATH, JSON.stringify({ email, password }));
}

async function ensureAuthed(page: Page) {
  const creds = fs.existsSync(CREDS_PATH) ? JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) : null;
  await page.goto('/app');
  await page.waitForLoadState('domcontentloaded');
  const tabs = page.getByTestId('tab-bar');
  const email = page.getByLabel(/email/i);
  try {
    await Promise.race([
      tabs.waitFor({ state: 'visible', timeout: 20_000 }),
      email.waitFor({ state: 'visible', timeout: 20_000 }),
      page.getByTestId('onboarding-0').waitFor({ state: 'visible', timeout: 20_000 }),
    ]);
  } catch {
    // fall through
  }
  if (page.url().includes('/onboarding') || (await page.getByTestId('onboarding-0').isVisible().catch(() => false))) {
    await completeOnboarding(page);
    return;
  }
  if (!(await tabs.isVisible().catch(() => false))) {
    if (!creds) {
      await signupFreshAccount(page);
      return;
    }
    await signIn(page, creds.email, creds.password);
  }
  if (page.url().includes('/onboarding')) {
    await completeOnboarding(page);
  }
  await tabs.waitFor({ state: 'visible', timeout: 20_000 });
}

async function visibleSelectTitle(page: Page) {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-testid="selects-carousel-track"] [data-testid="ticket-slot"]'),
    );
    const visible = cards.find((node) => {
      const r = node.getBoundingClientRect();
      return r.width > 80 && r.left >= -8 && r.left < window.innerWidth * 0.45;
    });
    return visible?.getAttribute('data-title') ?? '';
  });
}

function slotsNamed(page: Page, title: string) {
  return page.locator(`[data-testid="ticket-slot"][data-title="${title}"]`);
}

test.describe('selects taste ingest', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Watched? ingest is a phone layout');
  });

  test.afterEach(async ({}, testInfo) => {
    await saveEvidence(testInfo, 'selects-taste-ingest');
  });

  test('Watched? liked on slot 0 leaves that title after replacement and reload', async ({
    page,
  }, testInfo) => {
    const logs = await attachPageLog(page);
    await ensureAuthed(page);
    await page.goto('/app');
    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90_000 });

    const title = await visibleSelectTitle(page);
    expect(title.length).toBeGreaterThan(0);
    const card = page.locator(`[data-testid="ticket-slot"][data-title="${title}"]`).filter({ visible: true }).first();
    await card.getByRole('button', { name: /watched\?/i }).click();
    await page.getByRole('radio', { name: 'Liked' }).first().click();
    await expect(slotsNamed(page, title)).toHaveCount(0, { timeout: 90_000 });

    await page.reload();
    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90_000 });
    await expect(slotsNamed(page, title)).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/verify/selects-taste-ingest-${testInfo.project.name}/liked-gone.png`,
      fullPage: true,
    });
    await dumpConsole(page, 'selects-taste-ingest', testInfo.project.name, logs);
  });
});
