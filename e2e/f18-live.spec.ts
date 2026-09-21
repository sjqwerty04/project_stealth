import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { uniqueEmail, saveEvidence, attachPageLog, dumpConsole } from './helpers';

const LIVE = process.env.F18_LIVE === '1';
const JANE_ZIP_PATH = path.join(process.cwd(), 'e2e', 'fixtures', 'letterboxd-jane-2026-01-21-11-20-utc.zip');
const JANE_TITLES = new Set([
  'heat',
  'tron',
  'drive',
  'her',
  'conclave',
  'unmatchable film',
  'whiplash',
  'sinners',
  'sicario',
]);
const JANE_WATCHED = ['Heat', 'Tron', 'Drive', 'Her', 'Conclave'] as const;
const SEARCH_FALLBACKS = ['Inception', 'Parasite', 'Fight Club'] as const;

test.use({ baseURL: 'https://selects-film.vercel.app' });
test.describe.configure({ timeout: 240_000 });

test.afterEach(async ({}, testInfo) => {
  await saveEvidence(testInfo, 'F18-live');
});

async function pickDisjoint(page: Page, count: number): Promise<string[]> {
  const picked: string[] = [];
  await page.getByTestId('film-pick').first().waitFor({ timeout: 30000 });
  for (let i = 0; i < 16 && picked.length < count; i++) {
    const titles = await page.getByTestId('film-pick').evaluateAll((els) =>
      els.map((el) => (el.getAttribute('aria-label') || '').trim()),
    );
    const next = titles.find((title) => title && !JANE_TITLES.has(title.toLowerCase()) && !picked.includes(title));
    if (!next) break;
    await page.locator(`[data-testid="film-pick"][aria-label="${next}"]`).click();
    await expect(page.getByTestId('pick-hero-item').filter({ hasText: next })).toBeVisible();
    picked.push(next);
  }
  for (const fallback of SEARCH_FALLBACKS) {
    if (picked.length >= count) break;
    if (picked.includes(fallback)) continue;
    await page.getByTestId('pick-search').fill(fallback);
    const hit = page.locator(`[data-testid="film-pick"][aria-label="${fallback}"]`);
    await expect(hit).toBeVisible({ timeout: 20000 });
    await hit.click();
    await expect(page.getByTestId('pick-hero-item').filter({ hasText: fallback })).toBeVisible();
    picked.push(fallback);
  }
  expect(picked, `wall only yielded ${picked.join(', ') || 'nothing'}`).toHaveLength(count);
  return picked;
}

test('F18-live First-user on production', async ({ page }, testInfo) => {
  test.skip(!LIVE, 'set F18_LIVE=1 to hit production');
  test.skip(testInfo.project.name === 'desktop', 'First-user strip and Selects are a phone layout');
  const logs = await attachPageLog(page);
  const selectBodies: unknown[] = [];
  await page.route('**/api/your-selects', async (route) => {
    if (route.request().method() === 'POST') {
      const raw = route.request().postData();
      selectBodies.push(raw ? JSON.parse(raw) : {});
    }
    await route.continue();
  });
  const shot = (name: string) =>
    page.screenshot({ path: path.join('artifacts', 'verify', `F18-live-${testInfo.project.name}`, `${name}.png`) });

  const email = uniqueEmail();
  await page.goto('/join');
  await page.waitForURL(/\/login/, { timeout: 20000 });
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('button', { name: /create new account/i }).click();
  await page.getByLabel(/^password$/i).fill('SelectsVerify9');
  await page.getByLabel(/confirm password/i).fill('SelectsVerify9');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 30000 });

  await page.getByRole('button', { name: /begin/i }).click();
  await page.getByTestId('onboarding-1').waitFor();
  const positive = await pickDisjoint(page, 2);
  await page.getByRole('button', { name: /next · 2 picked/i }).click();

  await page.getByTestId('onboarding-3').waitFor();
  const [negative] = await pickDisjoint(page, 1);
  await page.getByRole('button', { name: /next · 1 struck/i }).click();

  await page.getByTestId('onboarding-4').waitFor();
  await page.getByRole('button', { name: /flawless screenplay/i }).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByTestId('onboarding-5').waitFor({ timeout: 20000 });
  await page.getByTestId('import-tile-letterboxd').click();
  await page.getByTestId('import-letterboxd-drop-input').setInputFiles({
    name: 'letterboxd-jane-2026-01-21-11-20-utc.zip',
    mimeType: 'application/zip',
    buffer: fs.readFileSync(JANE_ZIP_PATH),
  });
  await expect(page.getByTestId('import-letterboxd-drop-done')).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId('import-films-read')).toContainText('7');
  await shot('after-zip');

  await page.getByTestId('onboarding-cta').click();
  await page.getByTestId('onboarding-reading').waitFor({ timeout: 30000 });
  await page.getByTestId('onboarding-6').waitFor({ timeout: 90000 });
  await page.getByTestId('profile-read').waitFor();
  await shot('negative');
  await page.getByRole('button', { name: /^insights$/i }).click();
  await page.getByTestId('onboarding-7').waitFor();
  await expect(page.getByTestId('insight-card').first()).toBeVisible();
  await shot('insights');
  await page.getByRole('button', { name: /open the assembly/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30000 });

  await expect(page.getByTestId('home-strip')).toBeVisible();
  await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId('ticket-slot').first()).toBeVisible();
  await shot('home-selects');

  await expect
    .poll(
      () => {
        const blob = JSON.stringify(selectBodies);
        const picksIn = positive.every((title) => blob.toLowerCase().includes(title.toLowerCase()));
        const janeIn = blob.includes('Heat') && (blob.includes('Tron') || blob.includes('dislikes: Tron'));
        return picksIn && janeIn && blob.toLowerCase().includes(negative.toLowerCase());
      },
      { timeout: 60000 },
    )
    .toBe(true);

  const logged = page.locator(
    '[data-testid^="strip-day-"][aria-label^="Mon"], [data-testid^="strip-day-"][aria-label^="Tue"], [data-testid^="strip-day-"][aria-label^="Wed"], [data-testid^="strip-day-"][aria-label^="Thu"], [data-testid^="strip-day-"][aria-label^="Fri"], [data-testid^="strip-day-"][aria-label^="Sat"], [data-testid^="strip-day-"][aria-label^="Sun"]',
  );
  await expect(logged.first()).toBeVisible({ timeout: 30000 });
  expect(await logged.count()).toBeGreaterThanOrEqual(5);
  const fills = await page.evaluate(() => {
    const barOf = (el: Element) => {
      const bar = el.querySelector('span.block');
      return bar ? getComputedStyle(bar).backgroundColor : '';
    };
    const days = [...document.querySelectorAll('[data-testid^="strip-day-"]')];
    const loggedDays = days.filter((el) => !el.getAttribute('aria-label')?.startsWith('Log a film'));
    const emptyDays = days.filter((el) => el.getAttribute('aria-label')?.startsWith('Log a film'));
    return { logged: barOf(loggedDays[0] ?? days[0]), empty: barOf(emptyDays[0] ?? days[0]) };
  });
  expect(fills.logged).not.toBe(fills.empty);
  await logged.last().scrollIntoViewIfNeeded();
  await logged.last().click();
  await logged.last().click();
  await expect(page.getByTestId('diary-day-sheet')).toBeVisible();
  await expect(page.getByTestId('diary-day-sheet')).toContainText(/Heat|Her|Tron|Conclave/);
  await shot('diary-day');

  await page.goto('/watched');
  await expect(page.getByTestId('watched-count')).toContainText('5 films · 5 nights', { timeout: 30000 });
  for (const title of JANE_WATCHED) {
    await expect(page.getByRole('button', { name: title, exact: true }).first()).toBeVisible();
  }
  await expect(page.getByTestId('watch-count-pill').first()).toContainText('x2');
  await page.getByTestId('watched-filter-nope').click();
  await expect(page.getByTestId('watched-poster')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Tron', exact: true })).toBeVisible();
  await shot('watched');
  await dumpConsole(page, 'F18-live', testInfo.project.name, logs.concat(`picks=${positive.join('|')};neg=${negative}`));
});
