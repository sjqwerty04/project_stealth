/**
 * iOS parity: what a person sees in the TestFlight app must match https://selects-film.vercel.app.
 *
 * Runs in WebKit as an iPhone 15 against a deployed site (production unless SELECTS_BASE_URL is set),
 * signed in as the shared QA account. It never signs up a new account.
 *
 * Run it (Linux or macOS):
 *   npm ci && npx playwright install webkit
 *   export SELECTS_TEST_EMAIL=selects.qa@example.com SELECTS_TEST_PASSWORD=...   # or SELECTS_TEST_CREDS_FILE
 *   npx playwright test --project=ios-webkit
 *   SELECTS_BASE_URL=https://<preview>.vercel.app npx playwright test --project=ios-webkit
 *
 * Inside the iOS simulator's web view, run e2e/ios-sim/parity-check.js (see e2e/README.md).
 */
import { test, expect, devices, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { FALLBACK_FILMS } from '../src/lib/fallbackCatalog';
import { signIn } from './helpers';

const STORE_CREDS = '/cursor/stores/bc-aa24adcb-569e-4a03-a7be-baf7bf9b3aa1/internal/test-account-creds.md';
const CHAT_ERRORS = /couldn't reach the projector booth|Something went wrong reaching the chat/i;

function testAccount() {
  const { SELECTS_TEST_EMAIL: email, SELECTS_TEST_PASSWORD: password } = process.env;
  if (email && password) return { email, password };
  const file = process.env.SELECTS_TEST_CREDS_FILE ?? STORE_CREDS;
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    const read = (key: string) => text.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1].trim();
    const fromFile = { email: read('SELECTS_TEST_EMAIL'), password: read('SELECTS_TEST_PASSWORD') };
    if (fromFile.email && fromFile.password) return fromFile as { email: string; password: string };
  }
  throw new Error('Set SELECTS_TEST_EMAIL and SELECTS_TEST_PASSWORD to the shared QA account. Do not sign up a new one.');
}

/** Same-origin /api calls that failed, errored, or came back as the HTML app shell instead of JSON. */
function watchApi(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const failures: string[] = [];
  const isApi = (raw: string) => {
    const url = new URL(raw);
    return url.origin === origin && url.pathname.startsWith('/api/') ? url.pathname : null;
  };
  page.on('response', (res) => {
    const path = isApi(res.url());
    if (!path) return;
    const type = res.headers()['content-type'] ?? '';
    if (res.status() >= 400) failures.push(`${res.status()} ${res.request().method()} ${path}`);
    else if (type.includes('text/html')) failures.push(`${res.status()} ${res.request().method()} ${path} returned HTML, not the API`);
  });
  page.on('requestfailed', (req) => {
    const path = isApi(req.url());
    const error = req.failure()?.errorText ?? '';
    // Requests the page drops when it navigates away are not failures.
    if (!path || /cancel|abort/i.test(error)) return;
    failures.push(`${req.method()} ${path} ${error}`);
  });
  return failures;
}

async function snap(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

async function signInToHome(page: Page) {
  const { email, password } = testAccount();
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 30_000 });
}

/** Tap the Select that is on screen. The carousel autoplays, so tap its middle like a person would. */
async function openVisibleSelect(page: Page) {
  const carousel = page.getByTestId('selects-carousel');
  await expect(carousel).toBeVisible({ timeout: 60_000 });
  const box = await carousel.boundingBox();
  if (!box) throw new Error('Selects carousel has no box');
  await page.mouse.click(box.x + box.width / 2, box.y + 110);
  await page.waitForURL(/\/movie\/\d+/, { timeout: 20_000 });
  const title = page.getByRole('heading').first();
  await expect(title).toBeVisible({ timeout: 30_000 });
  return (await title.innerText()).trim();
}

function heat1995(page: Page) {
  return page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: 'Heat', exact: true }) })
    .filter({ hasText: '1995' })
    .first();
}

/** Titles on the Selects that the carousel shows right now (on screen, poster loaded). */
async function visibleSelects(page: Page) {
  return page.evaluate(() => {
    const out: { title: string; still: boolean }[] = [];
    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-testid="select-open-movie"]')) {
      const r = btn.getBoundingClientRect();
      if (r.right <= 1 || r.left >= window.innerWidth - 1) continue;
      const img = btn.querySelector('img');
      out.push({ title: btn.getAttribute('aria-label') ?? '', still: Boolean(img && img.complete && img.naturalWidth > 0) });
    }
    return out;
  });
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    const w = window as unknown as { __ytStates: number[] };
    w.__ytStates = [];
    window.addEventListener('message', (event) => {
      if (!/youtube/.test(event.origin)) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (typeof data?.info?.playerState === 'number') w.__ytStates.push(data.info.playerState);
      } catch {
        // not a player message
      }
    });
  });
});

test('home shows real Selects, not the offline fallback set', async ({ page, baseURL }, testInfo) => {
  watchApi(page, baseURL!);
  await signInToHome(page);
  await expect(page.getByTestId('select-open-movie').first()).toBeAttached({ timeout: 60_000 });
  await expect(page.getByText('Could not load Your Selects.')).toHaveCount(0);

  const titles = [
    ...new Set(
      await page.getByTestId('select-open-movie').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? '')),
    ),
  ].filter(Boolean);
  const fallback = new Set(FALLBACK_FILMS.map((film) => film.title));
  testInfo.annotations.push({ type: 'selects', description: titles.join(', ') });
  expect(titles.length, 'at least one Select').toBeGreaterThan(0);
  expect(
    titles.filter((title) => !fallback.has(title)),
    `Selects are all from the offline fallback catalog: ${titles.join(', ')}`,
  ).not.toHaveLength(0);

  await expect
    .poll(async () => (await visibleSelects(page)).some((select) => select.still), {
      message: 'the Select on screen shows its still',
      timeout: 30_000,
    })
    .toBe(true);
  await snap(page, testInfo, 'home-selects');
});

test('a trailer plays', async ({ page, baseURL }, testInfo) => {
  watchApi(page, baseURL!);
  await signInToHome(page);
  const title = await openVisibleSelect(page);
  testInfo.annotations.push({ type: 'film', description: title });

  const trailer = page.locator('iframe[src*="youtube.com/embed"]');
  if (!(await trailer.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false))) {
    testInfo.annotations.push({ type: 'note', description: `${title} has no trailer; using The Dark Knight` });
    await page.goto('/movie/155?type=movie');
    await trailer.waitFor({ timeout: 30_000 });
  }

  const status = async () => {
    const frame = page.frames().find((f) => f.url().includes('youtube.com/embed'));
    const shown = await frame?.locator('body').innerText({ timeout: 2_000 }).catch(() => '') ?? '';
    if (/not a bot/i.test(shown)) return 'bot-check';
    const error = shown.match(/Error \d+|Video unavailable|configuration error/i);
    if (error) return `YouTube error: ${error[0]}`;
    const states = await page.evaluate(() => (window as unknown as { __ytStates: number[] }).__ytStates);
    const opacity = await trailer.evaluate((el) => getComputedStyle(el).opacity).catch(() => '0');
    return states.includes(1) && opacity === '1' ? 'playing' : 'waiting';
  };

  let result = 'waiting';
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    result = await status();
    if (result !== 'waiting') break;
    await page.waitForTimeout(1_000);
  }
  await snap(page, testInfo, 'trailer');
  test.skip(
    result === 'bot-check',
    'YouTube showed "Sign in to confirm you\'re not a bot" to this network. That is YouTube blocking the runner, not the app. Run from a home network or the Mac.',
  );
  expect(result, 'the trailer reaches YouTube state playing and fades in over the still').toBe('playing');
});

test('Orbit loads the film with its Select score', async ({ page, baseURL }, testInfo) => {
  watchApi(page, baseURL!);
  await signInToHome(page);
  const title = await openVisibleSelect(page);
  await page.getByRole('button', { name: /enter orbit/i }).click();
  await expect(page).toHaveURL(/\/orbit\/\d+/);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  const score = page.getByTestId('select-score');
  await expect(score).toBeVisible({ timeout: 30_000 });
  await expect(score).toContainText(/Select\s*\d{1,3}/i);
  testInfo.annotations.push({ type: 'orbit', description: `${title}: ${(await score.innerText()).replace(/\s+/g, ' ')}` });
  await snap(page, testInfo, 'orbit');
});

test('Ask AI answers a question', async ({ page, baseURL }, testInfo) => {
  watchApi(page, baseURL!);
  await signInToHome(page);
  await openVisibleSelect(page);
  await page.getByRole('button', { name: /^ask ai/i }).click();
  const input = page.getByPlaceholder(/^ask about/i);
  await expect(input).toBeVisible();
  const question = 'In one sentence, who directed this film?';
  await input.fill(question);
  await input.press('Enter');

  const sheet = page.locator('form').filter({ has: input }).locator('xpath=..');
  const reply = async () => {
    const lines = (await sheet.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
    const asked = lines.indexOf(question);
    return asked >= 0 ? lines.slice(asked + 1).join(' ') : '';
  };
  await expect.poll(reply, { message: 'Ask AI shows a reply', timeout: 60_000 }).not.toBe('');
  const answer = await reply();
  testInfo.annotations.push({ type: 'reply', description: answer.slice(0, 200) });
  await snap(page, testInfo, 'ask-ai');
  expect(answer, 'Ask AI answered instead of showing its error copy').not.toMatch(CHAT_ERRORS);
  expect(answer.length).toBeGreaterThan(15);
});

test('Library and Hunt load', async ({ page, baseURL }, testInfo) => {
  watchApi(page, baseURL!);
  await signInToHome(page);

  await page.getByTestId('tab-library').click();
  await expect(page).toHaveURL(/\/watched/);
  await expect(page.getByTestId('library-hub')).toBeVisible();
  await expect(page.getByRole('button', { name: /^watched/i })).toBeVisible();
  await snap(page, testInfo, 'library');

  await page.getByTestId('tab-orbit').click();
  await expect(page).toHaveURL(/\/discover/);
  await page.getByTestId('orbit-search').fill('heat');
  const heat = heat1995(page);
  await expect(heat).toBeVisible({ timeout: 20_000 });
  await snap(page, testInfo, 'hunt');
  await heat.click();
  await expect(page).toHaveURL(/\/movie\/949/);
  await expect(page.getByRole('heading', { name: 'Heat' }).first()).toBeVisible({ timeout: 30_000 });
});

test('no /api call fails across home, a film, Orbit, Ask AI, Library and Hunt', async ({ page, baseURL }, testInfo) => {
  const failures = watchApi(page, baseURL!);
  await signInToHome(page);
  await expect(page.getByTestId('select-open-movie').first()).toBeAttached({ timeout: 60_000 });
  await openVisibleSelect(page);
  await page.waitForTimeout(5_000);
  await page.getByRole('button', { name: /^ask ai/i }).click();
  const input = page.getByPlaceholder(/^ask about/i);
  await input.fill('Is it worth a rewatch?');
  await input.press('Enter');
  await page.waitForResponse((res) => res.url().includes('/api/movie-chat'), { timeout: 60_000 }).catch(() => {});
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: /enter orbit/i }).click();
  await expect(page.getByTestId('select-score')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await page.getByTestId('tab-library').click();
  await expect(page.getByTestId('library-hub')).toBeVisible();
  await page.getByTestId('tab-orbit').click();
  await page.getByTestId('orbit-search').fill('heat');
  await expect(heat1995(page)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2_000);
  testInfo.annotations.push({ type: 'api-failures', description: failures.join('; ') || 'none' });
  expect(failures, 'failed /api responses').toEqual([]);
});

test('sign out and sign back in', async ({ page, browser, baseURL }, testInfo) => {
  await signInToHome(page);
  await page.getByTestId('tab-you').click();
  await expect(page.getByTestId('you-screen')).toBeVisible();
  const signOut = page.getByRole('button', { name: /sign out|log out/i }).or(page.getByRole('link', { name: /sign out|log out/i }));
  const hasControl = await signOut.first().isVisible({ timeout: 5_000 }).catch(() => false);
  await snap(page, testInfo, 'you-screen');
  expect.soft(hasControl, 'the You screen offers a way to sign out').toBe(true);

  // Without a sign-out control, a fresh session stands in for a signed-out person.
  let signedOut = page;
  if (hasControl) {
    await signOut.first().click();
  } else {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 15'];
    const context = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL });
    signedOut = await context.newPage();
  }
  await signedOut.goto('/app');
  await expect(signedOut).toHaveURL(/\/login/, { timeout: 20_000 });
  await signInToHome(signedOut);
  await expect(signedOut.getByTestId('select-open-movie').first()).toBeAttached({ timeout: 60_000 });
  await snap(signedOut, testInfo, 'signed-back-in');
});
