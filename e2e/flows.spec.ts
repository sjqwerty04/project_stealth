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
  seedShowingTheater,
  keepSeededTheater,
  mockFilmAxes,
  mockTmdb,
  clearFilmAxesFixtures,
  createFilmAxesDoc,
  createSharedFilmAxesDoc,
  currentUid,
  deleteFilmAxesDocAs,
  readSharedFilmAxesDoc,
  emulatorSignIn,
  emulatorSignUp,
  readFilmAxesDoc,
  rewriteFilmAxesDoc,
  FILM_AXES_FIXTURE,
  FILM_PAGE_THEATER,
  FIRST_VISIT_FILM_ID,
  RULES_FIXTURE_FILM_ID,
  type FilmAxesRestAxis,
  THEATER_FIXTURE,
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
  const rows = page.locator('[data-testid^="library-row-"]');
  await expect(rows).toHaveCount(5);
  await expect(page.getByTestId('library-label')).toHaveText([
    'Watched',
    'The Wallet',
    'Saved',
    'Theaters',
    'Shared lists',
  ]);
  await expect(page.getByTestId('library-row-watched').getByTestId('library-meta')).toHaveText(/^\d+ FILMS?$/);
  await expect(page.getByTestId('library-row-theaters').getByTestId('library-meta')).toHaveText(
    /^\d+ FACETS? YOU KEPT$/,
  );
  await page.getByTestId('library-row-wallet').click();
  await expect(page).toHaveURL(/\/liked/);
  await page.getByTestId('tab-library').click();
  await page.getByTestId('library-row-saved').click();
  await expect(page).toHaveURL(/\/saved/);
  await page.getByTestId('tab-library').click();
  await page.getByTestId('library-row-shared-lists').click();
  await expect(page).toHaveURL(/\/shared/);
  await page.getByTestId('tab-library').click();
  await page.getByTestId('library-row-theaters').click();
  await expect(page).toHaveURL(/\/theaters/);
  await gate(page, 'F10', testInfo.project.name);
  await dumpConsole(page, 'F10', testInfo.project.name, logs);
});

test('F11 You', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  await page.goto('/me');
  await expect(page.getByTestId('you-screen')).toBeVisible();
  await expect(page.getByTestId('you-stats')).toBeVisible();
  await expect(page.getByTestId('you-stat-label')).toHaveText(['WATCHED', 'WALLET', 'THEATERS', 'THIS YEAR']);
  const original = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 720 });
  const theatersLabel = page.getByTestId('you-stat-label').nth(2);
  await expect(theatersLabel).toHaveText('THEATERS');
  expect((await theatersLabel.boundingBox())?.height ?? 99).toBeLessThan(16);
  if (original) await page.setViewportSize(original);
  await page
    .getByTestId('you-stats')
    .screenshot({ path: path.join('artifacts', 'verify', `F11-${testInfo.project.name}`, 'stats.png') });
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
  await mockFilmAxes(page);
  await page.goto('/movie/155');
  await expect(page.getByTestId('action-watchlist')).toBeVisible();
  await page.getByTestId('action-watchlist').click();
  await page.getByTestId('action-like').click().catch(() => {});

  const rows = page.getByTestId('film-axes').getByTestId('axis-row');
  await expect(rows).toHaveCount(8);
  await expect(rows.getByTestId('axis-value')).toHaveText(FILM_AXES_FIXTURE.map((axis) => axis.value));
  await expect(page.getByTestId('film-axes').getByTestId('axis-meter').first()).toHaveAttribute('aria-label', '4 of 5');
  const cta = page.getByTestId('orbit-cta');
  const ctaBox = await cta.boundingBox();
  const contentWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(Math.round(ctaBox?.width ?? 0)).toBe(contentWidth - 32);
  await expect(page.getByTestId('film-theater-reasons')).toHaveCount(0);

  await seedShowingTheater(page);
  const card = page.getByTestId('theater-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { name: THEATER_FIXTURE.title })).toBeVisible();
  await expect(card.getByTestId('facet-line')).toHaveText('COMPETENCE PORN × and NOBODY WINS');
  await expect(card.getByTestId('swatch-strip').locator('span')).toHaveCount(4);
  await expect(card.getByTestId('theater-lineup').locator('li')).toHaveCount(8);
  await expect(card.getByTestId('theater-lineup')).toContainText(THEATER_FIXTURE.lineup[0][3]);
  await expect(card.getByRole('button', { name: /close theater/i })).toBeVisible();
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
};

async function fixtureZip(): Promise<Buffer> {
  const { default: JSZip } = await import('jszip');
  const root = path.join(process.cwd(), 'src', 'lib', 'import', 'letterboxd', '__fixtures__');
  const zip = new JSZip();
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else zip.file(path.relative(root, full).replace(/\\/g, '/'), fs.readFileSync(full));
    }
  };
  walk(root);
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('F15 Letterboxd export import', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
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
  const zip = await fixtureZip();
  await page.getByTestId('import-dropzone-input').setInputFiles({ name: 'letterboxd-jane-2026-01-21-11-21-utc.zip', mimeType: 'application/zip', buffer: zip });
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

test('F16 Theater archive', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);

  await page.goto('/discover');
  await seedShowingTheater(page);
  const live = page.getByTestId('theater-card');
  await expect(live.getByRole('heading', { name: THEATER_FIXTURE.title })).toBeVisible();
  await expect(live.getByTestId('facet-line')).toHaveText('COMPETENCE PORN × and NOBODY WINS');
  await expect(live.getByTestId('swatch-strip').locator('span')).toHaveCount(4);
  await page.getByTestId('theater-keep').click();
  await expect(page.getByTestId('theater-keep')).toHaveText('Kept', { timeout: 20000 });

  await page.getByTestId('tab-library').click();
  await page.getByTestId('library-row-theaters').click();
  await expect(page).toHaveURL(/\/theaters/);
  await expect(page.getByRole('heading', { name: 'THEATERS', level: 1 })).toBeVisible();
  await expect(page.getByText('FACETS YOU KEPT WALKING BACK INTO')).toBeVisible();
  const footer = page.getByTestId('theater-archive-footer');
  await expect(footer).toHaveText('A THEATER IS WHAT A TRAIL BECOMES WHEN YOU KEEP IT');
  const linesThroughKeep = await footer.evaluate((el) => {
    const text = el.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, text.data.indexOf('KEEP') + 'KEEP'.length);
    return range.getClientRects().length;
  });
  expect(linesThroughKeep).toBe(1);

  const cards = page.getByTestId('theater-archive-card');
  await expect(cards.first()).toBeVisible({ timeout: 20000 });
  const kept = cards.filter({ has: page.getByText(THEATER_FIXTURE.title) }).first();
  await expect(kept).toHaveAttribute('aria-label', new RegExp(`^${THEATER_FIXTURE.title}\\. COMPETENCE PORN and NOBODY WINS\\. 8 films, \\d+ unseen\\.$`));
  await expect(kept.getByTestId('theater-card-counts')).toHaveText(/^8 FILMS · \d+ UNSEEN$/);
  await expect(kept.getByTestId('swatch-strip').locator('span')).toHaveCount(4);
  const box = await kept.boundingBox();
  expect(Math.round(box?.height ?? 0)).toBe(190);

  await kept.click();
  const sheet = page.getByTestId('theater-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('li')).toHaveCount(8);
  await expect(sheet).toContainText(THEATER_FIXTURE.lineup[0][3]);
  await sheet.getByRole('button', { name: /close theater/i }).click();
  await expect(sheet).toHaveCount(0);

  const archiveCount = await cards.count();
  await page.screenshot({ path: path.join('artifacts', 'verify', `F16-${testInfo.project.name}`, 'archive.png'), fullPage: true });

  await page.getByTestId('tab-you').click();
  await expect(page).toHaveURL(/\/me/);
  await expect(page.getByTestId('you-stat-label')).toHaveText(['WATCHED', 'WALLET', 'THEATERS', 'THIS YEAR']);
  await expect(page.getByTestId('you-stat-value').nth(2)).toHaveText(String(archiveCount), { timeout: 20000 });

  await gate(page, 'F16', testInfo.project.name);
  await dumpConsole(page, 'F16', testInfo.project.name, logs);
});

test('F17 Film axes first visit', async ({ page, baseURL }, testInfo) => {
  const filmId = FIRST_VISIT_FILM_ID[testInfo.project.name];
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  const uid = await currentUid(page);
  await clearFilmAxesFixtures(baseURL, uid, [`movie:${filmId}`]);
  await mockTmdb(page, [
    { id: filmId, title: 'Thief', year: '1981', director: 'Michael Mann', genres: ['Crime', 'Thriller'] },
  ]);
  const axes = await mockFilmAxes(page);

  await page.goto('/discover');
  await keepSeededTheater(page, FILM_PAGE_THEATER);

  await page.goto(`/movie/${filmId}?type=movie`);
  const rows = page.getByTestId('film-axes').getByTestId('axis-row');
  await expect(rows).toHaveCount(8);
  await expect(rows.getByTestId('axis-name')).toHaveText(FILM_AXES_FIXTURE.map((axis) => axis.name));
  await expect(rows.getByTestId('axis-value')).toHaveText(FILM_AXES_FIXTURE.map((axis) => axis.value));
  expect(axes.count).toBe(1);

  const meters = rows.getByTestId('axis-meter');
  expect(await meters.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).toEqual(
    FILM_AXES_FIXTURE.map((axis) => `${axis.score} of 5`),
  );
  expect(
    await meters.evaluateAll((els) => els.map((el) => el.querySelectorAll('[data-testid="bar-unit"]').length)),
  ).toEqual([5, 5, 5, 5, 5, 5, 5, 5]);
  const weather = await rows.filter({ hasText: 'competence porn' }).getByTestId('axis-count').textContent();
  expect(Number(weather)).toBeGreaterThanOrEqual(8);
  await expect(page.getByTestId('film-theater-reasons')).toHaveCount(0);

  await page
    .getByTestId('film-axes')
    .screenshot({ path: path.join('artifacts', 'verify', `F17-${testInfo.project.name}`, 'axes.png') });

  const original = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(rows).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
  await page
    .getByTestId('film-axes')
    .screenshot({ path: path.join('artifacts', 'verify', `F17-${testInfo.project.name}`, 'axes-320.png') });
  if (original) await page.setViewportSize(original);

  const owner = await emulatorSignIn(baseURL);
  await expect.poll(() => readFilmAxesDoc(owner, uid, `movie:${filmId}`)).toBe(200);

  await page.getByTestId('orbit-cta').scrollIntoViewIfNeeded();
  await gate(page, 'F17', testInfo.project.name);
  await dumpConsole(page, 'F17', testInfo.project.name, logs);
});

test('F17 Film axes cache rules', async ({ baseURL }, testInfo) => {
  const owner = await emulatorSignIn(baseURL);
  const intruder = await emulatorSignUp(baseURL);
  const filmId = RULES_FIXTURE_FILM_ID[testInfo.project.name];
  const filmKey = `movie:${filmId}`;
  await clearFilmAxesFixtures(baseURL, owner.uid, [filmKey]);
  await clearFilmAxesFixtures(baseURL, intruder.uid, [filmKey]);
  const axes = FILM_AXES_FIXTURE.map((axis) => ({ name: axis.name, value: axis.value, score: axis.score }));
  const valid = { schema: 1, mediaType: 'movie', filmId, title: 'Thief', year: '1981', axes, createdAt: 1758240000000 };
  const withAxis = (index: number, axis: Partial<FilmAxesRestAxis>) => ({
    ...valid,
    axes: axes.map((row, at) => (at === index ? { ...row, ...axis } : row)),
  });

  expect(await createSharedFilmAxesDoc(owner, filmKey, valid)).toBe(403);
  expect(await readSharedFilmAxesDoc(owner, filmKey)).toBe(403);

  expect(await createFilmAxesDoc(null, owner.uid, filmKey, valid)).toBe(403);
  expect(await readFilmAxesDoc(null, owner.uid, filmKey)).toBe(403);
  expect(await createFilmAxesDoc(intruder, owner.uid, filmKey, valid)).toBe(403);
  expect(await readFilmAxesDoc(intruder, owner.uid, filmKey)).toBe(403);

  expect(await createFilmAxesDoc(owner, owner.uid, `movie:${filmId + 1}`, valid)).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, `tv:${filmId}`, valid)).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, schema: 2 })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, mediaType: 'book' })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, extra: 'counts' })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, title: undefined })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, title: '' })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, title: 'T'.repeat(201) })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, year: '1'.repeat(17) })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, axes: axes.slice(0, 7) })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, axes: [...axes, axes[0]] })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, axes: [...axes].reverse() })).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, withAxis(0, { name: 'MOOD' }))).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, withAxis(3, { value: '' }))).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, withAxis(3, { value: 'v'.repeat(81) }))).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, withAxis(5, { score: 0 }))).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, withAxis(5, { score: 6 }))).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, withAxis(5, { score: 2.5 }))).toBe(403);
  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, withAxis(7, { extra: 'count' }))).toBe(403);

  expect(await createFilmAxesDoc(owner, owner.uid, filmKey, valid)).toBe(200);
  expect(await readFilmAxesDoc(owner, owner.uid, filmKey)).toBe(200);
  expect(await readFilmAxesDoc(intruder, owner.uid, filmKey)).toBe(403);
  expect(await rewriteFilmAxesDoc(owner, owner.uid, filmKey, { ...valid, title: 'Heat' })).toBe(403);
  expect(await deleteFilmAxesDocAs(owner, owner.uid, filmKey)).toBe(403);
  expect(await createFilmAxesDoc(intruder, intruder.uid, filmKey, valid)).toBe(200);

  await clearFilmAxesFixtures(baseURL, owner.uid, [filmKey]);
  await clearFilmAxesFixtures(baseURL, intruder.uid, [filmKey]);
});

test('F17 Film axes cache hit and Theater reasons', async ({ page }, testInfo) => {
  const logs = await attachPageLog(page);
  await ensureAuthed(page);
  const filmId = FIRST_VISIT_FILM_ID[testInfo.project.name];
  await mockTmdb(page, [
    { id: 10858, title: 'Thief', year: '1981', director: 'Michael Mann', genres: ['Crime', 'Thriller'] },
    { id: filmId, title: 'Thief', year: '1981', director: 'Michael Mann', genres: ['Crime', 'Thriller'] },
  ]);
  const axes = await mockFilmAxes(page);

  await page.goto('/discover');
  await keepSeededTheater(page, FILM_PAGE_THEATER);

  await page.goto(`/movie/${filmId}?type=movie`);
  const rows = page.getByTestId('film-axes').getByTestId('axis-row');
  await expect(rows).toHaveCount(8);
  await expect(rows.getByTestId('axis-value')).toHaveText(FILM_AXES_FIXTURE.map((axis) => axis.value));
  expect(axes.count).toBe(0);

  await page.goto('/movie/10858?type=movie');
  await expect(rows).toHaveCount(8);
  const section = page.getByTestId('film-theater-reasons');
  await expect(section.getByTestId('film-theater-kicker')).toHaveText('BECAUSE OF THE NIGHT');
  await expect(section.getByTestId('theater-reason-row')).toHaveCount(7);
  await expect(section.getByTestId('theater-reason').first()).toHaveText(
    'THE PROFESSIONAL AS MONK. BOTH MEN ARE ALONE BY CHOICE.',
  );
  await expect(section).toContainText('Le Samouraï 1967');
  await expect(section).toContainText('SYNTH PULSE, SODIUM LIGHT, AND A CITY THAT DOES THE TALKING.');
  await expect(section).toContainText('MANN AGAIN. SAME CITY LOGIC, TWENTY-THREE YEARS LATER.');
  await expect(section).not.toContainText('Thief 1981');
  await section.screenshot({
    path: path.join('artifacts', 'verify', `F17-${testInfo.project.name}`, 'theater-reasons.png'),
  });

  await page.getByTestId('orbit-cta').scrollIntoViewIfNeeded();
  await gate(page, 'F17', testInfo.project.name);

  await page.getByTestId('orbit-cta').click();
  await expect(page).toHaveURL(/\/orbit\/10858/);
  await dumpConsole(page, 'F17', testInfo.project.name, logs);
});
