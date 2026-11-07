import { expect, test } from '@playwright/test';
import { ensureAuthed } from './helpers';

const films = {
  155: { id: 155, title: 'The Dark Knight', year: '2008' },
  27205: { id: 27205, title: 'Inception', year: '2010' },
  152601: { id: 152601, title: 'Her', year: '2013' },
  157336: { id: 157336, title: 'Interstellar', year: '2014' },
  949: { id: 949, title: 'Heat', year: '1995' },
  550: { id: 550, title: 'Fight Club', year: '1999' },
} as const;

type Film = (typeof films)[keyof typeof films];

function excludedIds(prompt: string) {
  return new Set([...prompt.matchAll(/"id":"(\d+)"/g)].map((match) => match[1]));
}

function referenceTitle(prompt: string) {
  return prompt.match(/Title: "([^"]+)"/)?.[1] ?? '';
}

function avoidExcluded(prompt: string, film: Film): Film {
  return excludedIds(prompt).has(String(film.id)) ? films[550] : film;
}

function visualPick(prompt: string): Film {
  const title = referenceTitle(prompt);
  const excluded = excludedIds(prompt);
  if (title === 'The Dark Knight') return excluded.has('155') ? films[27205] : films[550];
  if (title === 'Her') return films[157336];
  if (title === 'Interstellar') return films[949];
  return films[550];
}

function emotionalPick(prompt: string): Film {
  return referenceTitle(prompt) === 'Inception' ? films[152601] : films[550];
}

function recommendation(prompt: string): Film {
  if (prompt.includes('visually similar')) return avoidExcluded(prompt, visualPick(prompt));
  if (prompt.includes('same emotional experience')) return avoidExcluded(prompt, emotionalPick(prompt));
  return avoidExcluded(prompt, films[550]);
}

test('Orbit watched rating replaces the card', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Same screen; desktop covers the flow');
  test.setTimeout(180_000);

  const prompts: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('orbit_onboarding_seen', 'true');
  });

  await page.route('**/api/llm', async (route) => {
    const body = route.request().postDataJSON() as { prompt: string };
    prompts.push(body.prompt);
    if (body.prompt.includes('FOUR connected films')) {
      const up = visualPick(body.prompt);
      const left = emotionalPick(body.prompt);
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          text: JSON.stringify({
            up: { title: up.title, year: up.year, hex: '#24344d', score: 88, reason: `Visual from ${referenceTitle(body.prompt)}` },
            right: { title: films[550].title, year: films[550].year, hex: '#24344d', score: 80, reason: 'Balanced match' },
            down: { title: films[949].title, year: films[949].year, hex: '#24344d', score: 80, reason: 'Story match' },
            left: { title: left.title, year: left.year, hex: '#24344d', score: 86, reason: `Feeling from ${referenceTitle(body.prompt)}` },
          }),
        }),
      });
      return;
    }
    const pick = recommendation(body.prompt);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        text: JSON.stringify({
          title: pick.title,
          year: pick.year,
          hex: '#24344d',
          score: 88,
          reason: `Next from ${referenceTitle(body.prompt)}`,
        }),
      }),
    });
  });

  await page.route('**/api/letterboxd-rating**', async (route) => {
    const tmdbId = new URL(route.request().url()).searchParams.get('tmdbId');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        tmdbId === '155'
          ? {
              imdb: { value: 9, count: 2000 },
              letterboxd: { value: 4.5, count: 800 },
              tomatoes: { value: 94, count: 300 },
              audience: { value: 94, count: 300 },
              metacritic: { value: 84, count: 40 },
            }
          : {},
      ),
    });
  });

  await page.route('https://api.themoviedb.org/3/**', async (route) => {
    const url = new URL(route.request().url());
    const movieMatch = url.pathname.match(/\/movie\/(\d+)$/);
    if (movieMatch) {
      const id = Number(movieMatch[1]);
      const film = films[id as keyof typeof films] ?? { id, title: 'Unknown', year: '2000' };
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: film.id,
          title: film.title,
          release_date: `${film.year}-01-01`,
          poster_path: null,
          backdrop_path: null,
          genres: [{ id: 18, name: 'Drama' }],
          credits: { crew: [{ job: 'Director', name: 'Test Director' }] },
        }),
      });
      return;
    }
    const title = url.searchParams.get('query');
    const film = Object.values(films).find((candidate) => candidate.title === title);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ results: film ? [{ id: film.id, title: film.title }] : [] }),
    });
  });

  await ensureAuthed(page);
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('llm_cache_')) localStorage.removeItem(key);
    }
    localStorage.setItem('orbit_onboarding_seen', 'true');
  });
  await page.goto('/orbit/155');
  await expect(page.getByRole('heading', { name: 'The Dark Knight' })).toBeVisible();
  const dismissHandle = page.getByRole('button', { name: 'Dismiss' });
  if (await dismissHandle.isVisible().catch(() => false)) await dismissHandle.click();
  await expect(page.getByTestId('orbit-watched')).toBeVisible();
  await expect(page.getByText('Log Today')).toHaveCount(0);
  await expect(page.getByText('Not Interested')).toHaveCount(0);
  const score = page.getByTestId('select-score');
  await expect(score).toBeVisible();
  await expect(score.locator('.bg-select')).toHaveCount(5);

  await page.getByTestId('orbit-watched').click();
  await expect(page.getByTestId('verdict-liked')).toHaveText(/Liked/);
  await expect(page.getByTestId('verdict-okay')).toHaveText(/Meh/);
  await expect(page.getByTestId('verdict-nope')).toHaveText(/Nope/);
  await page.screenshot({ path: '/opt/cursor/artifacts/orbit-watched-picker.png', fullPage: false });

  await page.getByTestId('verdict-okay').click();
  await expect(page.getByRole('heading', { name: 'Inception' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'The Dark Knight' })).toHaveCount(0);
  await expect(page.getByTestId('select-score')).toHaveCount(0);
  expect(prompts.some((prompt) => prompt.includes('The Dark Knight') && prompt.includes('"id":"155"'))).toBe(true);

  const readFilm = (movieId: number) =>
    page.evaluate(async (id) => {
      const firebase = await import('/src/lib/firebase.ts');
      const ledger = await import('/src/lib/library/ledger.ts');
      const uid = firebase.auth.currentUser?.uid;
      if (!uid) return null;
      const film = await ledger.getFilm(uid, id);
      return { verdict: film?.verdict ?? null, watched: film?.watched ?? false };
    }, movieId);

  const darkKnight = await readFilm(155);
  expect(darkKnight).toEqual({ verdict: 'okay', watched: true });

  await page.screenshot({ path: '/opt/cursor/artifacts/orbit-watched-next.png', fullPage: false });

  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(20, viewport.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: 'Her' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Inception' })).toHaveCount(0);

  await page.getByTestId('orbit-watched').click();
  await page.getByTestId('verdict-liked').click();
  await expect(page.getByRole('heading', { name: 'Interstellar' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Her' })).toHaveCount(0);
  expect(prompts.some((prompt) => prompt.includes('Title: "Her"') && prompt.includes('"id":"152601"'))).toBe(true);

  await page.getByTestId('orbit-watched').click();
  await page.getByTestId('verdict-nope').click();
  await expect(page.getByRole('heading', { name: 'Heat' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Interstellar' })).toHaveCount(0);
  expect(prompts.some((prompt) => prompt.includes('Title: "Interstellar"') && prompt.includes('"id":"157336"'))).toBe(true);
  await page.screenshot({ path: '/opt/cursor/artifacts/orbit-watched-after-nope.png', fullPage: false });

  expect(await readFilm(152601)).toEqual({ verdict: 'liked', watched: true });
  expect(await readFilm(157336)).toEqual({ verdict: 'nope', watched: true });

  const taste = await page.evaluate(async () => {
    const firebase = await import('/src/lib/firebase.ts');
    const user = firebase.auth.currentUser;
    if (!user) return [];
    const token = await user.getIdToken();
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/mvplockedin/databases/(default)/documents/users/${user.uid}/taste_events?pageSize=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) return [];
    const body = (await response.json()) as {
      documents?: { fields?: { event?: { mapValue?: { fields?: Record<string, { stringValue?: string; integerValue?: string }> } } } }[];
    };
    return (body.documents ?? []).map((document) => {
      const fields = document.fields?.event?.mapValue?.fields ?? {};
      return {
        type: fields.type?.stringValue ?? '',
        source: fields.source?.stringValue ?? '',
        verdict: fields.verdict?.stringValue ?? '',
        movieId: Number(fields.movieId?.integerValue ?? 0),
      };
    });
  });
  expect(taste).toEqual(
    expect.arrayContaining([
      { type: 'verdict', source: 'orbit', verdict: 'okay', movieId: 155 },
      { type: 'verdict', source: 'orbit', verdict: 'liked', movieId: 152601 },
      { type: 'verdict', source: 'orbit', verdict: 'nope', movieId: 157336 },
    ]),
  );
});
