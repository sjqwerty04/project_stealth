import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { CREDS_PATH, signIn } from './helpers';

const THEATER_TITLE = 'Men who are good at their jobs and lose anyway';
const THEATER_FACETS = ['COMPETENCE PORN', 'NOBODY WINS'] as const;
const THEATER_INSIGHT = 'You keep opening films where the plan is perfect and the ending is not.';
const LLM_DELAY_MS = 600;
const TMDB_DELAY_MS = 100;

const HEAT = {
  id: 949,
  title: 'Heat',
  year: '1995',
  director: 'Michael Mann',
  genres: ['Crime', 'Drama'],
} as const;

const PICKS = [
  {
    id: 5511,
    title: 'Le Samouraï',
    year: '1967',
    reason: 'A contract killer follows his routine flawlessly and it still closes on him.',
  },
  {
    id: 9526,
    title: 'To Live and Die in L.A.',
    year: '1985',
    reason: 'A Secret Service agent so good at the chase he becomes the crime.',
  },
  {
    id: 1538,
    title: 'Collateral',
    year: '2004',
    reason: 'One long night where the professional and the amateur both lose the map.',
  },
  {
    id: 31672,
    title: 'The Friends of Eddie Coyle',
    year: '1973',
    reason: 'Every hood in Boston knows his trade and none of it saves Eddie.',
  },
  {
    id: 24559,
    title: 'Sorcerer',
    year: '1977',
    reason: 'Four experts drive nitroglycerin through a jungle that does not care.',
  },
  {
    id: 379,
    title: "Miller's Crossing",
    year: '1990',
    reason: 'Tom plays every angle in the room and still ends up alone.',
  },
  {
    id: 273481,
    title: 'Sicario',
    year: '2015',
    reason: 'Kate does everything right and learns the job was never hers.',
  },
  {
    id: 64690,
    title: 'Drive',
    year: '2011',
    reason: 'The driver is perfect behind the wheel and helpless everywhere else.',
  },
] as const;

const DRAFT = {
  title: THEATER_TITLE,
  facets: THEATER_FACETS,
  insight: THEATER_INSIGHT,
  picks: PICKS.map(({ title, year, reason }) => ({ title, year, reason })),
};

type RequestCounts = {
  llmTotal: number;
  theaterInfer: number;
  theaterInferForHeatFingerprint: number;
  unexpectedTheaterInfer: number;
  aiSearch: number;
  filmAxes: number;
  otherLlm: number;
  huntSearch: number;
  heatDetail: number;
  lineupSearch: number;
  lineupDetail: number;
  otherTmdb: number;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assertEmulatorTarget(baseURL: string | undefined) {
  if (!baseURL) throw new Error('Theater performance verification requires a baseURL.');
  const hostname = new URL(baseURL).hostname;
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (process.env.VITE_FIREBASE_EMULATOR !== '1' && !loopback) {
    throw new Error(
      `Refusing to run Theater performance verification against ${hostname}. Set VITE_FIREBASE_EMULATOR=1 or use localhost.`,
    );
  }
}

function moviePayload(film: (typeof PICKS)[number] | typeof HEAT) {
  return {
    id: film.id,
    title: film.title,
    release_date: `${film.year}-01-01`,
    runtime: 120,
    genres: ('genres' in film ? film.genres : ['Crime', 'Drama']).map((name, id) => ({ id, name })),
    overview: `${film.title} fixture overview.`,
    tagline: '',
    poster_path: null,
    backdrop_path: null,
    vote_average: 8,
    vote_count: 1000,
    credits: {
      crew: [{ job: 'Director', name: 'director' in film ? film.director : 'Fixture Director' }],
      cast: [],
    },
  };
}

function snapshot(counts: RequestCounts) {
  return { ...counts };
}

async function installTimingObserver(page: Page) {
  await page.evaluate((title) => {
    const root = document.documentElement;
    const mark = (name: string, present: boolean) => {
      if (present && !root.dataset[name]) root.dataset[name] = String(performance.now());
    };
    const observe = () => {
      const buttonText = Array.from(document.querySelectorAll('button'), (button) => button.textContent ?? '');
      const headingText = Array.from(document.querySelectorAll('h1'), (heading) => heading.textContent ?? '');
      const theaterText = Array.from(
        document.querySelectorAll('[data-testid="theater-card"] h3'),
        (heading) => heading.textContent ?? '',
      );
      mark('huntResultAt', buttonText.some((text) => text.includes('Heat') && text.includes('1995')));
      mark('detailHeadingAt', headingText.some((text) => text.trim() === 'Heat'));
      mark('inferringShellAt', document.querySelector('[data-testid="theater-inferring"]') !== null);
      mark('theaterReadyAt', theaterText.some((text) => text.trim() === title));
    };
    new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
    observe();
  }, THEATER_TITLE);
}

async function mockRuntime(page: Page, counts: RequestCounts, onHuntCommit: () => Promise<void>) {
  await page.route('**/api/llm', async (route) => {
    const body = route.request().postDataJSON() as { prompt?: string };
    const prompt = body.prompt ?? '';
    counts.llmTotal += 1;

    if (prompt.startsWith('<evidence>') && prompt.includes('program exactly 8 films')) {
      counts.theaterInfer += 1;
      const heatFingerprint =
        prompt.includes('Searches this person committed to:\n- "heat"\n') &&
        prompt.includes('Films this person opened:\n- Heat (1995) | dir. Michael Mann | Crime, Drama\n');
      if (heatFingerprint) counts.theaterInferForHeatFingerprint += 1;
      else counts.unexpectedTheaterInfer += 1;
      await wait(LLM_DELAY_MS);
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify(DRAFT) }),
      });
      return;
    }

    if (prompt.includes('The user is searching for movies with this query')) counts.aiSearch += 1;
    else if (prompt.startsWith('<film>')) counts.filmAxes += 1;
    else counts.otherLlm += 1;

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ text: '' }),
    });
  });

  await page.route('https://api.themoviedb.org/3/**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('query');
    const exactMovie = url.pathname.match(/^\/3\/movie\/(\d+)$/);

    if ((url.pathname === '/3/search/movie' || url.pathname === '/3/search/tv') && query === 'heat') {
      counts.huntSearch += 1;
      await onHuntCommit();
      await wait(TMDB_DELAY_MS);
      const results =
        url.pathname === '/3/search/movie' && url.searchParams.get('page') === '1'
          ? [{ ...moviePayload(HEAT), genre_ids: [80, 18], popularity: 100 }]
          : [];
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ results }),
      });
      return;
    }

    const lineupPick = PICKS.find((pick) => pick.title === query);
    if (url.pathname === '/3/search/movie' && lineupPick) {
      counts.lineupSearch += 1;
      await wait(TMDB_DELAY_MS);
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ results: [moviePayload(lineupPick)] }),
      });
      return;
    }

    if (exactMovie) {
      const id = Number(exactMovie[1]);
      if (id === HEAT.id) {
        counts.heatDetail += 1;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(moviePayload(HEAT)),
        });
        return;
      }
      const pick = PICKS.find((candidate) => candidate.id === id);
      if (pick) {
        counts.lineupDetail += 1;
        await wait(TMDB_DELAY_MS);
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(moviePayload(pick)),
        });
        return;
      }
    }

    if (url.pathname.startsWith(`/3/movie/${HEAT.id}/`)) {
      counts.heatDetail += 1;
      const section = url.pathname.slice(`/3/movie/${HEAT.id}/`.length);
      const payload =
        section === 'credits'
          ? moviePayload(HEAT).credits
          : section === 'watch/providers'
            ? { results: {} }
            : section === 'external_ids'
              ? { imdb_id: null }
              : { results: [], logos: [] };
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
      return;
    }

    counts.otherTmdb += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ results: [] }),
    });
  });
}

test('Theater meets generation and restore budgets without duplicate inference', async ({ page, baseURL }, testInfo) => {
  assertEmulatorTarget(baseURL);
  if (!fs.existsSync(CREDS_PATH)) {
    throw new Error('No saved E2E credentials. Run F2 New account against the Firebase emulators first.');
  }

  const counts: RequestCounts = {
    llmTotal: 0,
    theaterInfer: 0,
    theaterInferForHeatFingerprint: 0,
    unexpectedTheaterInfer: 0,
    aiSearch: 0,
    filmAxes: 0,
    otherLlm: 0,
    huntSearch: 0,
    heatDetail: 0,
    lineupSearch: 0,
    lineupDetail: 0,
    otherTmdb: 0,
  };
  await mockRuntime(page, counts, async () => {
    await page.evaluate(() => {
      document.documentElement.dataset.huntCommittedAt ??= String(performance.now());
    });
  });

  const credentials = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) as {
    email: string;
    password: string;
  };
  await signIn(page, credentials.email, credentials.password);
  await page.goto('/discover');
  await installTimingObserver(page);

  const inputStartedAt = await page.evaluate(() => performance.now());
  await page.getByTestId('orbit-search').fill('heat');
  const heatResult = page.getByRole('button', { name: /Heat 1995/i }).first();
  await expect(heatResult).toBeVisible();

  await heatResult.click();
  await expect(page).toHaveURL(/\/movie\/949\?type=movie/);
  await expect(page.getByRole('heading', { name: 'Heat', level: 1 })).toBeVisible();

  const card = page.getByTestId('theater-card');
  await expect(card.getByTestId('theater-inferring')).toBeVisible();
  await expect(card.getByRole('heading', { name: THEATER_TITLE })).toBeVisible();
  const initialTiming = await page.evaluate(() => {
    const { huntCommittedAt, huntResultAt, detailHeadingAt, inferringShellAt, theaterReadyAt } =
      document.documentElement.dataset;
    return {
      huntCommittedAt: Number(huntCommittedAt),
      huntResultAt: Number(huntResultAt),
      detailHeadingAt: Number(detailHeadingAt),
      inferringShellAt: Number(inferringShellAt),
      theaterReadyAt: Number(theaterReadyAt),
    };
  });

  await expect(card.getByTestId('facet-line')).toHaveText('COMPETENCE PORN × and NOBODY WINS');
  const rows = card.getByTestId('theater-lineup').locator('li');
  await expect(rows).toHaveCount(8);
  const rowTexts = await rows.allTextContents();
  for (const [index, pick] of PICKS.entries()) {
    expect(rowTexts[index]).toContain(pick.title);
    expect(rowTexts[index]).toContain(pick.year);
    expect(rowTexts[index]).toContain(pick.reason);
  }

  const countsBeforeReload = snapshot(counts);
  await page.addInitScript((title) => {
    document.addEventListener('DOMContentLoaded', () => {
      const mark = () => {
        const ready = Array.from(
          document.querySelectorAll('[data-testid="theater-card"] h3'),
          (heading) => heading.textContent ?? '',
        ).some((text) => text.trim() === title);
        if (ready && !document.documentElement.dataset.restoredTheaterAt) {
          document.documentElement.dataset.restoredTheaterAt = String(performance.now());
        }
      };
      new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
      mark();
    });
  }, THEATER_TITLE);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const restoredCard = page.getByTestId('theater-card');
  await expect(restoredCard.getByRole('heading', { name: THEATER_TITLE })).toBeVisible();
  const restoredAt = await page.evaluate(() =>
    Number(document.documentElement.dataset.restoredTheaterAt),
  );
  await expect(restoredCard.getByTestId('facet-line')).toHaveText('COMPETENCE PORN × and NOBODY WINS');
  const restoredRows = restoredCard.getByTestId('theater-lineup').locator('li');
  await expect(restoredRows).toHaveCount(8);
  const restoredRowTexts = await restoredRows.allTextContents();
  await page.waitForTimeout(2800);
  const countsAfterReload = snapshot(counts);

  const huntCommitToFirstResultMs = Math.round(initialTiming.huntResultAt - initialTiming.huntCommittedAt);
  const huntInputToFirstResultMs = Math.round(initialTiming.huntResultAt - inputStartedAt);
  const inferringShellToReadyMs = Math.round(initialTiming.theaterReadyAt - initialTiming.inferringShellAt);
  const detailHeadingToReadyMs = Math.round(initialTiming.theaterReadyAt - initialTiming.detailHeadingAt);
  const reloadNavigationToRestoredTitleMs = Math.round(restoredAt);
  const controlledNetworkFloorMs = LLM_DELAY_MS + TMDB_DELAY_MS * 2;
  const serializedHydrationFloorMs = LLM_DELAY_MS + PICKS.length * TMDB_DELAY_MS * 2;
  const clientOverheadMs = Math.max(0, inferringShellToReadyMs - controlledNetworkFloorMs);
  const outputDir = path.join(
    process.cwd(),
    'artifacts',
    'verify',
    `theater-performance-${testInfo.project.name}`,
  );
  const result = {
    project: testInfo.project.name,
    budgetsMs: {
      huntCommitToFirstResult: 1500,
      inferringShellToReady: 1500,
      reloadNavigationToRestoredTitle: 500,
      clientOverheadAfterControlledNetwork: 500,
    },
    controlledNetwork: {
      llmDelayMs: LLM_DELAY_MS,
      lineupSearchDelayMs: TMDB_DELAY_MS,
      lineupDetailDelayMs: TMDB_DELAY_MS,
      lineupPicks: PICKS.length,
      routeShape: 'one LLM request, then eight parallel pick hydrations with search and detail in series',
      controlledFloorMs: controlledNetworkFloorMs,
      serializedHydrationFloorMs,
    },
    timingsMs: {
      huntCommitToFirstResult: huntCommitToFirstResultMs,
      huntInputToFirstResult: huntInputToFirstResultMs,
      inferringShellToReady: inferringShellToReadyMs,
      detailHeadingToReady: detailHeadingToReadyMs,
      inferenceDebounceReportedMs: 2500,
      reloadNavigationToRestoredTitle: reloadNavigationToRestoredTitleMs,
      clientOverheadAfterControlledNetwork: clientOverheadMs,
    },
    requests: {
      beforeReload: countsBeforeReload,
      afterReload: countsAfterReload,
      theaterInferDeltaOnReload: countsAfterReload.theaterInfer - countsBeforeReload.theaterInfer,
    },
    restoredUi: {
      title: await restoredCard.getByRole('heading', { name: THEATER_TITLE }).textContent(),
      facets: (await restoredCard.getByTestId('facet-line').textContent())?.replace(/\s+/g, ' ').trim(),
      lineupRows: restoredRowTexts.length,
      reasonedRows: restoredRowTexts.filter((text, index) => text.includes(PICKS[index].reason)).length,
    },
  };

  fs.mkdirSync(outputDir, { recursive: true });
  await restoredCard.screenshot({ path: path.join(outputDir, 'result.png') });
  fs.writeFileSync(path.join(outputDir, 'timings.json'), JSON.stringify(result, null, 2));

  expect(countsBeforeReload.theaterInfer).toBe(1);
  expect(countsBeforeReload.theaterInferForHeatFingerprint).toBe(1);
  expect(countsBeforeReload.unexpectedTheaterInfer).toBe(0);
  expect(countsAfterReload.theaterInfer).toBe(1);
  expect(countsAfterReload.theaterInfer - countsBeforeReload.theaterInfer).toBe(0);
  expect(countsAfterReload.aiSearch).toBe(0);
  expect(countsBeforeReload.lineupSearch).toBe(8);
  expect(countsBeforeReload.lineupDetail).toBe(8);
  expect(result.restoredUi).toEqual({
    title: THEATER_TITLE,
    facets: 'COMPETENCE PORN × and NOBODY WINS',
    lineupRows: 8,
    reasonedRows: 8,
  });
  expect(huntCommitToFirstResultMs).toBeLessThanOrEqual(1500);
  expect(inferringShellToReadyMs).toBeLessThanOrEqual(1500);
  expect(reloadNavigationToRestoredTitleMs).toBeLessThanOrEqual(500);
  expect(clientOverheadMs).toBeLessThanOrEqual(500);
});
