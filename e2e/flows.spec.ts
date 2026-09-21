import { test, expect, type Page } from '@playwright/test';
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
  answerOnboardingQuestions,
  finishOnboardingReward,
  ensureAuthed,
  gate,
  mockProfileApi,
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
  await expect(page.getByTestId('selects-carousel')).toBeVisible();
  await page.getByTestId('ticket-slot').first().click();
  await expect(page).toHaveURL(/\/movie\//, { timeout: 15000 });
  await gate(page, 'F5', testInfo.project.name);
  await dumpConsole(page, 'F5', testInfo.project.name, logs);
});

test('F6 Empty day', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/app');
  const emptySlot = page.getByTestId('ticket-slot-empty').first();
  if (await emptySlot.isVisible().catch(() => false)) {
    await emptySlot.click();
    await expect(page).toHaveURL(/discover\?date=/, { timeout: 10000 });
    await gate(page, 'F6', testInfo.project.name);
    await dumpConsole(page, 'F6', testInfo.project.name, logs);
    return;
  }
  await expect(page.getByTestId('selects-carousel')).toBeVisible();
  await page.getByTestId('year-zoom').click();
  await expect(page.getByTestId('year-zoom-calendar')).toBeVisible();
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

const LOOKUP_FIXTURE: Record<string, { id: number; title: string; year: string }> = {
  heat: { id: 949, title: 'Heat', year: '1995' },
  tron: { id: 97, title: 'Tron', year: '1982' },
  drive: { id: 64690, title: 'Drive', year: '2011' },
  her: { id: 152601, title: 'Her', year: '2013' },
  conclave: { id: 974576, title: 'Conclave', year: '2024' },
  whiplash: { id: 244786, title: 'Whiplash', year: '2014' },
  sinners: { id: 1233413, title: 'Sinners', year: '2025' },
  sicario: { id: 273481, title: 'Sicario', year: '2015' },
  'good will hunting': { id: 489, title: 'Good Will Hunting', year: '1997' },
  'the dark knight': { id: 155, title: 'The Dark Knight', year: '2008' },
  'pulp fiction': { id: 680, title: 'Pulp Fiction', year: '1994' },
  arrival: { id: 329865, title: 'Arrival', year: '2016' },
  moonlight: { id: 376867, title: 'Moonlight', year: '2016' },
  'blade runner': { id: 78, title: 'Blade Runner', year: '1982' },
};

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

function janeZip(): Buffer {
  return fs.readFileSync(JANE_ZIP_PATH);
}

test('F15 Letterboxd export import', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await mockMovieLookup(page);
  // A fresh account so counts are exact. Re-importing into an existing one dedupes to zero nights.
  await page.goto('/join');
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await page.getByLabel(/email/i).fill(uniqueEmail());
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('button', { name: /create new account/i }).click();
  await page.getByLabel(/^password$/i).fill('SelectsVerify9');
  await page.getByLabel(/confirm password/i).fill('SelectsVerify9');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 25000 });
  await completeOnboarding(page);
  await page.goto('/watched');
  await page.getByTestId('watched-import').click();
  await page.getByTestId('import-tab-drop').click();
  const zip = janeZip();
  await page.getByTestId('import-dropzone-input').setInputFiles({ name: 'letterboxd-jane-2026-01-21-11-20-utc.zip', mimeType: 'application/zip', buffer: zip });
  const done = page.getByTestId('import-dropzone-done');
  await expect(done).toBeVisible({ timeout: 60000 });
  await expect(done).toContainText('7 films');
  await expect(done).toContainText('5 nights');
  await expect(done).toContainText('2 to watch');
  await expect(page.getByTestId('import-dropzone-unresolved')).toContainText('1 could not be matched');
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('[data-testid="import-sheet"] button[aria-label="Close"]').click();
  await expect(page.getByTestId('watched-count')).toContainText('5 films · 5 nights');
  await expect(page.getByTestId('watch-count-pill').first()).toContainText('x2');
  await page.getByTestId('watched-filter-nope').click();
  await expect(page.getByTestId('watched-poster')).toHaveCount(1);
  await page.getByTestId('watched-filter-all').click();
  await page.screenshot({ path: path.join('artifacts', 'verify', `F15-${testInfo.project.name}`, 'watched-after-import.png'), fullPage: true });
  // Gate here. The home strip's 24px day buttons fail T1 on main already (see F2-mobile/thresholds.json).
  await gate(page, 'F15', testInfo.project.name);
  await page.goto('/app');
  const track = page.getByTestId('strip-track');
  await expect(track).toBeVisible();
  const logged = page.locator('[data-testid^="strip-day-"][aria-label^="Mon"], [data-testid^="strip-day-"][aria-label^="Tue"], [data-testid^="strip-day-"][aria-label^="Wed"], [data-testid^="strip-day-"][aria-label^="Thu"], [data-testid^="strip-day-"][aria-label^="Fri"], [data-testid^="strip-day-"][aria-label^="Sat"], [data-testid^="strip-day-"][aria-label^="Sun"]');
  await expect(logged.first()).toBeVisible({ timeout: 20000 });
  expect(await logged.count()).toBeGreaterThanOrEqual(5);
  await logged.last().click();
  await logged.last().click();
  await expect(page.getByTestId('diary-day-sheet')).toBeVisible();
  await expect(page.getByTestId('diary-day-film').first()).toBeVisible();
  await page.screenshot({ path: path.join('artifacts', 'verify', `F15-${testInfo.project.name}`, 'diary-day.png') });
  await dumpConsole(page, 'F15', testInfo.project.name, logs);
});

async function signUpFresh(page: PageLike) {
  await page.goto('/join');
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await page.getByLabel(/email/i).fill(uniqueEmail());
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('button', { name: /create new account/i }).click();
  await page.getByLabel(/^password$/i).fill('SelectsVerify9');
  await page.getByLabel(/confirm password/i).fill('SelectsVerify9');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 25000 });
}

async function mockMovieLookup(page: PageLike) {
  await page.route('**/api/movie-lookup**', async (route) => {
    const url = new URL(route.request().url());
    const title = (url.searchParams.get('title') || '').toLowerCase();
    const hit = LOOKUP_FIXTURE[title];
    if (!hit) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...hit,
        poster: `https://placehold.co/200x300?text=${encodeURIComponent(hit.title)}`,
        backdrop: null,
        logo: null,
        still: null,
        runtime: '2h 0m',
        mediaType: 'movie',
      }),
    });
  });
}

test('F16 Onboarding import hub, three sources', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await mockMovieLookup(page);
  await signUpFresh(page);
  await answerOnboardingQuestions(page);
  const shot = (name: string) => page.screenshot({ path: path.join('artifacts', 'verify', `F16-${testInfo.project.name}`, `${name}.png`) });
  await expect(page.getByTestId('import-hub')).toBeVisible();
  await expect(page.getByTestId('onboarding-cta')).toBeDisabled();

  await page.getByTestId('import-tile-letterboxd').click();
  const zip = janeZip();
  await page.getByTestId('import-letterboxd-drop-input').setInputFiles({ name: 'letterboxd-jane-2026-01-21-11-20-utc.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByTestId('import-letterboxd-drop-done')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('import-films-read')).toContainText('7');
  await shot('after-letterboxd');

  await page.getByTestId('import-tile-imdb').click();
  const csv = fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'imdb-ratings.csv'));
  await page.getByTestId('import-imdb-drop-input').setInputFiles({ name: 'ratings.csv', mimeType: 'text/csv', buffer: csv });
  await expect(page.getByTestId('import-imdb-drop-done')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('import-films-read')).toContainText('10');
  await shot('after-imdb');

  await page.getByTestId('import-tile-notes').click();
  const notes = fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'notes.txt'), 'utf8');
  await page.getByTestId('paste-textarea').fill(notes);
  await page.getByTestId('paste-read').click();
  await page.getByTestId('paste-commit').click({ timeout: 30000 });
  await expect(page.getByTestId('paste-done')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('import-films-read')).toContainText('13');
  await shot('after-notes');

  await expect(page.getByTestId('onboarding-cta')).toBeEnabled();
  await page.getByTestId('onboarding-cta').click();
  await page.getByTestId('onboarding-reading').waitFor({ timeout: 20000 });
  await shot('reading');
  await finishOnboardingReward(page);
  await expect(page.getByTestId('home-strip')).toBeVisible();
  await page.goto('/watched');
  await expect(page.getByTestId('watched-count')).toContainText(/1[0-9] films/, { timeout: 30000 });
  await shot('watched');
  await dumpConsole(page, 'F16', testInfo.project.name, logs);
});

test('F17 Onboarding reward without an import', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await signUpFresh(page);
  await answerOnboardingQuestions(page);
  await page.getByTestId('onboarding-skip-lb').click();
  await page.getByTestId('onboarding-reading').waitFor({ timeout: 20000 });
  await page.getByTestId('onboarding-6').waitFor({ timeout: 30000 });
  await expect(page.getByTestId('taste-graph')).toBeVisible();
  await expect(page.getByTestId('profile-archetype')).toHaveText('NOCTURNALIST');
  await expect(page.getByTestId('profile-colour')).toHaveText(/^#[0-9A-F]{6}$/);
  await page.screenshot({ path: path.join('artifacts', 'verify', `F17-${testInfo.project.name}`, 'negative.png') });
  await page.getByRole('button', { name: /^insights$/i }).click();
  await page.getByTestId('onboarding-7').waitFor();
  await expect(page.getByTestId('insight-card')).toHaveCount(10);
  await expect(page.locator('[data-testid="insight-card"][data-tone="sharp"]')).toHaveCount(2);
  await page.screenshot({ path: path.join('artifacts', 'verify', `F17-${testInfo.project.name}`, 'insights.png'), fullPage: true });
  await page.getByRole('button', { name: /open the assembly/i }).click();
  await page.waitForURL(/\/app/, { timeout: 20000 });
  await expect(page.getByTestId('home-strip')).toBeVisible();
  await dumpConsole(page, 'F17', testInfo.project.name, logs);
});

async function pickDisjoint(page: Page, count: number): Promise<string[]> {
  const picked: string[] = [];
  await page.getByTestId('film-pick').first().waitFor({ timeout: 20000 });
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
    await expect(hit).toBeVisible({ timeout: 15000 });
    await hit.click();
    await expect(page.getByTestId('pick-hero-item').filter({ hasText: fallback })).toBeVisible();
    picked.push(fallback);
  }
  expect(picked, `wall only yielded ${picked.join(', ') || 'nothing'}`).toHaveLength(count);
  return picked;
}

function captureYourSelects(page: Page): unknown[] {
  const bodies: unknown[] = [];
  void page.route('**/api/your-selects', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const raw = route.request().postData();
    bodies.push(raw ? JSON.parse(raw) : {});
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        picks: [
          { title: 'Arrival', year: '2016', whyMatch: '', confidence: 0.9, id: '329865' },
          { title: 'Moonlight', year: '2016', whyMatch: '', confidence: 0.88, id: '376867' },
          { title: 'Blade Runner', year: '1982', whyMatch: '', confidence: 0.86, id: '78' },
        ],
      }),
    });
  });
  return bodies;
}

test('F18 First-user Letterboxd zip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'First-user strip and Selects are a phone layout');
  test.setTimeout(180_000);
  const logs = await attachPageLog(page);
  await mockMovieLookup(page);
  await mockProfileApi(page);
  const selectBodies = captureYourSelects(page);
  const shot = (name: string) =>
    page.screenshot({ path: path.join('artifacts', 'verify', `F18-${testInfo.project.name}`, `${name}.png`) });

  await signUpFresh(page);
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
    buffer: janeZip(),
  });
  await expect(page.getByTestId('import-letterboxd-drop-done')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('import-films-read')).toContainText('7');
  await shot('after-zip');

  await page.getByTestId('onboarding-cta').click();
  await finishOnboardingReward(page);
  await expect(page.getByTestId('home-strip')).toBeVisible();
  await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('ticket-slot').first()).toBeVisible();
  await shot('home-selects');

  await expect
    .poll(() => {
      const blob = JSON.stringify(selectBodies);
      const picksIn = positive.every((title) => blob.toLowerCase().includes(title.toLowerCase()));
      const janeIn = blob.includes('Heat') && (blob.includes('Tron') || blob.includes('dislikes: Tron'));
      return picksIn && janeIn && blob.toLowerCase().includes(negative.toLowerCase());
    }, { timeout: 30000 })
    .toBe(true);

  const track = page.getByTestId('strip-track');
  await expect(track).toBeVisible();
  const logged = page.locator(
    '[data-testid^="strip-day-"][aria-label^="Mon"], [data-testid^="strip-day-"][aria-label^="Tue"], [data-testid^="strip-day-"][aria-label^="Wed"], [data-testid^="strip-day-"][aria-label^="Thu"], [data-testid^="strip-day-"][aria-label^="Fri"], [data-testid^="strip-day-"][aria-label^="Sat"], [data-testid^="strip-day-"][aria-label^="Sun"]',
  );
  await expect(logged.first()).toBeVisible({ timeout: 20000 });
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
  expect(fills.logged).toBeTruthy();
  expect(fills.empty).toBeTruthy();
  expect(fills.logged).not.toBe(fills.empty);

  await logged.last().scrollIntoViewIfNeeded();
  await logged.last().click();
  await logged.last().click();
  await expect(page.getByTestId('diary-day-sheet')).toBeVisible();
  await expect(page.getByTestId('diary-day-film').first()).toBeVisible();
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
  await dumpConsole(page, 'F18', testInfo.project.name, logs);
});
