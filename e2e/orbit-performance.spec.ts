import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { CREDS_PATH, signIn } from './helpers';

const recommendations = {
  emotional: { id: 152601, title: 'Her', year: '2013', reason: 'Same lonely ache as The Dark Knight' },
  visual: { id: 27205, title: 'Inception', year: '2010', reason: 'Shadowed spectacle like The Dark Knight' },
  balanced: { id: 49026, title: 'The Dark Knight Rises', year: '2012', reason: 'Epic crime stakes like The Dark Knight' },
  storytelling: { id: 157336, title: 'Interstellar', year: '2014', reason: 'Layered urgency from The Dark Knight' },
} as const;

type Direction = keyof typeof recommendations;

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((percentileValue / 100) * sorted.length) - 1];
}

function directionFromPrompt(prompt: string): Direction {
  if (prompt.includes('same emotional experience')) return 'emotional';
  if (prompt.includes('visually similar')) return 'visual';
  if (prompt.includes('well-balanced match')) return 'balanced';
  return 'storytelling';
}

test('Orbit publishes a completed direction without duplicate generation', async ({ page }, testInfo) => {
  const calls: Record<Direction, number> = {
    emotional: 0,
    visual: 0,
    balanced: 0,
    storytelling: 0,
  };

  await page.addInitScript(() => {
    localStorage.setItem('orbit_onboarding_seen', 'true');
  });

  await page.route('**/api/llm', async (route) => {
    const body = route.request().postDataJSON() as { prompt: string };
    if (body.prompt.includes('FOUR connected films')) {
      if (body.prompt.includes('Title: "The Dark Knight"')) {
        calls.emotional += 1;
        calls.visual += 1;
        calls.balanced += 1;
        calls.storytelling += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          text: JSON.stringify({
            up: { title: recommendations.visual.title, year: recommendations.visual.year, hex: '#24344d', score: 88, reason: recommendations.visual.reason },
            right: { title: recommendations.balanced.title, year: recommendations.balanced.year, hex: '#24344d', score: 86, reason: recommendations.balanced.reason },
            down: { title: recommendations.storytelling.title, year: recommendations.storytelling.year, hex: '#24344d', score: 90, reason: recommendations.storytelling.reason },
            left: { title: recommendations.emotional.title, year: recommendations.emotional.year, hex: '#24344d', score: 87, reason: recommendations.emotional.reason },
          }),
        }),
      });
      return;
    }

    const direction = directionFromPrompt(body.prompt);
    if (body.prompt.includes('Title: "The Dark Knight"')) {
      calls[direction] += 1;
    }
    const pick = recommendations[direction];
    await new Promise((resolve) => setTimeout(resolve, direction === 'emotional' ? 300 : 1800));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        text: JSON.stringify({
          title: pick.title,
          year: pick.year,
          hex: '#24344d',
          score: 88,
          reason: pick.reason,
        }),
      }),
    });
  });

  await page.route('https://api.themoviedb.org/3/**', async (route) => {
    const url = new URL(route.request().url());
    const movieMatch = url.pathname.match(/\/movie\/(\d+)$/);
    if (movieMatch) {
      const id = Number(movieMatch[1]);
      const pick = id === 155
        ? { id: 155, title: 'The Dark Knight', year: '2008' }
        : Object.values(recommendations).find((candidate) => candidate.id === id);
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          title: pick?.title ?? 'Unknown',
          release_date: `${pick?.year ?? '2000'}-01-01`,
          poster_path: null,
          backdrop_path: null,
          genres: [{ id: 18, name: 'Drama' }],
          credits: { crew: [{ job: 'Director', name: 'Test Director' }] },
        }),
      });
      return;
    }

    const title = url.searchParams.get('query');
    const pick = Object.values(recommendations).find((candidate) => candidate.title === title);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ results: pick ? [{ id: pick.id, title: pick.title }] : [] }),
    });
  });

  if (!fs.existsSync(CREDS_PATH)) {
    throw new Error('No saved E2E credentials. Run F2 New account first.');
  }
  const credentials = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) as {
    email: string;
    password: string;
  };
  await signIn(page, credentials.email, credentials.password);
  const gestureSamples: number[] = [];
  const settledSamples: number[] = [];
  for (let iteration = 0; iteration < 5; iteration += 1) {
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('llm_cache_')) localStorage.removeItem(key);
      }
    });
    await page.goto('/orbit/155');
    await expect(page.getByRole('heading', { name: 'The Dark Knight' })).toBeVisible();

    await page.waitForTimeout(600);
    const startedAt = performance.now();
    const viewport = page.viewportSize()!;
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, viewport.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole('heading', { name: 'Her' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'The Dark Knight' })).toHaveCount(0);
    await expect(page.getByText('Same lonely ache as The Dark Knight')).toBeVisible();
    settledSamples.push(Math.round(performance.now() - startedAt));
    const gestureTiming = await page.evaluate(() =>
      window.__ORBIT_TIMINGS__
        ?.filter((entry) => entry.phase === 'gesture-to-card')
        .at(-1)
    );
    expect(gestureTiming).toBeDefined();
    expect(gestureTiming!.cacheState).toBe('ready');
    gestureSamples.push(Math.round(gestureTiming!.durationMs));
  }

  const telemetry = await page.evaluate(() => window.__ORBIT_TIMINGS__ ?? []);
  const result = {
    gestureSamples,
    gestureP50Ms: percentile(gestureSamples, 50),
    gestureP95Ms: percentile(gestureSamples, 95),
    automationSettledSamples: settledSamples,
    calls,
    telemetry,
  };
  const outputDir = path.join(process.cwd(), 'artifacts', 'verify', `orbit-performance-${testInfo.project.name}`);
  fs.mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, 'result.png') });
  fs.writeFileSync(path.join(outputDir, 'timings.json'), JSON.stringify(result, null, 2));

  for (const count of Object.values(calls)) {
    expect(count).toBe(gestureSamples.length);
  }
  expect(result.gestureP95Ms).toBeLessThan(500);
});
