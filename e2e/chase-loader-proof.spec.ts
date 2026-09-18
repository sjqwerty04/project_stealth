import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { CREDS_PATH, signIn } from './helpers';

test('Visual proof of SelectsChaseLoader and Orbit clean wait state', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('orbit_onboarding_seen', 'true');
  });

  const loginDir = path.join(process.cwd(), 'artifacts', 'verify', 'proof');
  fs.mkdirSync(loginDir, { recursive: true });

  // 1. Visit Login screen to show SelectsChaseLoader button state
  await page.goto('/login');
  await page.waitForSelector('[data-testid="mark-lockup"]');
  await page.screenshot({ path: path.join(loginDir, 'login-brand.png') });

  // Sign in so protected routes work
  if (fs.existsSync(CREDS_PATH)) {
    const credentials = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) as {
      email: string;
      password: string;
    };
    await signIn(page, credentials.email, credentials.password);
  }

  // 2. Mock TMDB entry for Orbit
  await page.route('https://api.themoviedb.org/3/**', async (route) => {
    const url = new URL(route.request().url());
    const movieMatch = url.pathname.match(/\/movie\/(\d+)$/);
    if (movieMatch) {
      const id = Number(movieMatch[1]);
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          title: id === 155 ? 'The Dark Knight' : 'Her',
          release_date: id === 155 ? '2008-07-18' : '2013-12-18',
          poster_path: null,
          backdrop_path: null,
          genres: [{ id: 18, name: 'Drama' }, { id: 28, name: 'Action' }],
          credits: { crew: [{ job: 'Director', name: 'Director' }] },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ results: [{ id: 152601, title: 'Her' }] }),
    });
  });

  // Keep LLM pending to capture the active wait state
  let resolveLlm: ((val: any) => void) | null = null;
  await page.route('**/api/llm', async (route) => {
    await new Promise((res) => {
      resolveLlm = res;
    });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        text: JSON.stringify({
          up: { title: 'Inception', year: '2010', hex: '#24344d', score: 88, reason: 'Visual match' },
          right: { title: 'Heat', year: '1995', hex: '#24344d', score: 86, reason: 'Crime thriller' },
          down: { title: 'Memento', year: '2000', hex: '#24344d', score: 90, reason: 'Puzzle' },
          left: { title: 'Her', year: '2013', hex: '#24344d', score: 87, reason: 'Lonely ache' },
        }),
      }),
    });
  });

  await page.goto('/orbit/155');
  await expect(page.getByRole('heading', { name: 'The Dark Knight' })).toBeVisible();

  // Swipe left to trigger recommendation wait state
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(20, viewport.height / 2, { steps: 8 });
  await page.mouse.up();

  // Wait for the center atmospheric loader to appear
  await expect(page.locator('text=Finding emotional match...')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-testid="selects-chase-loader"]').first()).toBeVisible();

  // Capture screenshot of the active wait state:
  // Shows SelectsChaseLoader running, no 0.5 opacity ghosted movie card
  await page.screenshot({ path: path.join(loginDir, 'orbit-waiting-state.png') });

  // Now resolve LLM
  if (resolveLlm) {
    (resolveLlm as any)({});
  }

  // Card navigates to new movie
  await expect(page.getByRole('heading', { name: 'Her' })).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(loginDir, 'orbit-settled.png') });
});
