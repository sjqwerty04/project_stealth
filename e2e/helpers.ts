import type { Page, TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { runThresholds } from './thresholds';

export const CREDS_PATH = path.join(process.cwd(), 'e2e', '.auth', 'creds.json');

export function uniqueEmail() {
  return `selects.verify.${Date.now()}.${Math.floor(Math.random() * 1e4)}@example.com`;
}

export async function saveEvidence(testInfo: TestInfo, flowId: string) {
  const viewport = testInfo.project.name;
  const dir = path.join(process.cwd(), 'artifacts', 'verify', `${flowId}-${viewport}`);
  fs.mkdirSync(dir, { recursive: true });
  let still = 0;
  for (const a of testInfo.attachments) {
    if (!a.path) continue;
    if (a.contentType?.includes('video') || a.name === 'video') {
      fs.copyFileSync(a.path, path.join(dir, 'flow.webm'));
    }
    if (a.contentType?.includes('image') || a.name === 'screenshot') {
      still += 1;
      const ext = path.extname(a.path) || '.png';
      fs.copyFileSync(a.path, path.join(dir, `still-${still}${ext}`));
    }
  }
}

export async function dumpConsole(page: Page, flowId: string, viewport: string, logs: string[]) {
  const dir = path.join(process.cwd(), 'artifacts', 'verify', `${flowId}-${viewport}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'console.log'), logs.join('\n'));
}

export async function attachPageLog(page: Page) {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`pageerror: ${err.message}`));
  return logs;
}

export async function clearSession(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /^continue$/i }).click();
  const choose = page.getByTestId('login-choose');
  if (await choose.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    await page.getByRole('button', { name: /already have an account/i }).click();
  }
  await page.getByTestId('login-signin').waitFor({ timeout: 8000 });
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/\/app|\/onboarding/, { timeout: 20000 });
}

export async function completeOnboarding(page: Page) {
  await page.getByRole('button', { name: /begin/i }).click();
  const film = page.getByTestId('film-pick').first();
  await film.waitFor({ timeout: 20000 });
  await film.click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByTestId('onboarding-2').waitFor();
  const next = page.getByRole('button', { name: /^next$/i });
  await next.waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  if (await next.isEnabled()) {
    await next.click();
  } else {
    await next.waitFor({ timeout: 12000 });
    await next.click({ timeout: 12000 }).catch(async () => {
      await page.waitForTimeout(2000);
      await next.click();
    });
  }
  await page.getByTestId('onboarding-3').waitFor();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByTestId('onboarding-4').waitFor();
  await page.getByRole('button', { name: /flawless screenplay/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByTestId('onboarding-5').waitFor();
  await page.getByTestId('onboarding-skip-lb').click();
  await page.getByTestId('onboarding-6').waitFor();
  await page.getByTestId('onboarding-skip').click();
  await page.waitForURL(/\/app/, { timeout: 20000 });
}

export const THEATER_FIXTURE = {
  fingerprint: 'e2e-theater-fixture',
  title: 'Men who are good at their jobs and lose anyway',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'] as [string, string],
  insight: 'You keep landing on people whose craft is the exact thing that ruins them.',
  swatches: ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'],
  trail: [
    { id: 949, title: 'Heat', year: '1995', posterPath: '/heat.jpg', backdropPath: null, genres: ['Crime'], director: 'Michael Mann', mediaType: 'movie' as const },
    { id: 10858, title: 'Thief', year: '1981', posterPath: '/thief.jpg', backdropPath: null, genres: ['Crime'], director: 'Michael Mann', mediaType: 'movie' as const },
    { id: 1538, title: 'Collateral', year: '2004', posterPath: '/collateral.jpg', backdropPath: null, genres: ['Crime'], director: 'Michael Mann', mediaType: 'movie' as const },
  ],
  lineup: [
    [5511, 'Le Samouraï', '1967', 'A contract killer follows his routine flawlessly and it still closes on him.'],
    [9526, 'To Live and Die in L.A.', '1985', 'A Secret Service agent so good at the chase he becomes the crime.'],
    [31672, 'The Friends of Eddie Coyle', '1973', 'Every hood in Boston knows his trade and none of it saves Eddie.'],
    [24559, 'Sorcerer', '1977', 'Four experts drive nitroglycerin through a jungle that does not care.'],
    [379, "Miller's Crossing", '1990', 'Tom plays every angle in the room and still ends up alone.'],
    [273481, 'Sicario', '2015', 'Kate does everything right and learns the job was never hers.'],
  ] as [number, string, string, string][],
};

export const FILM_PAGE_THEATER = {
  fingerprint: 'e2e-film-page-theater',
  title: 'Because of the night',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'] as [string, string],
  insight: 'You keep walking back into the same rained-on block after midnight.',
  swatches: ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'],
  trail: THEATER_FIXTURE.trail,
  lineup: [
    [5511, 'Le Samouraï', '1967', 'THE PROFESSIONAL AS MONK. BOTH MEN ARE ALONE BY CHOICE.'],
    [9526, 'To Live and Die in L.A.', '1985', 'SYNTH PULSE, SODIUM LIGHT, AND A CITY THAT DOES THE TALKING.'],
    [31672, 'The Friends of Eddie Coyle', '1973', 'EVERY HOOD IN BOSTON KNOWS HIS TRADE AND NONE OF IT SAVES EDDIE.'],
    [24559, 'Sorcerer', '1977', 'FOUR EXPERTS DRIVE NITROGLYCERIN THROUGH A JUNGLE THAT DOES NOT CARE.'],
    [379, "Miller's Crossing", '1990', 'TOM PLAYS EVERY ANGLE AND STILL ENDS UP ALONE.'],
    [273481, 'Sicario', '2015', 'KATE DOES EVERYTHING RIGHT AND LEARNS THE JOB WAS NEVER HERS.'],
  ] as [number, string, string, string][],
};

export type TmdbFilm = { id: number; title: string; year: string; director: string; genres: string[] };

export async function mockTmdb(page: Page, films: TmdbFilm[]) {
  await page.route('https://api.themoviedb.org/**', async (route) => {
    const url = new URL(route.request().url());
    const [, , , id, section] = url.pathname.split('/');
    const film = films.find((entry) => String(entry.id) === id);
    if (!film) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    const payload =
      section === 'credits'
        ? { cast: [], crew: [{ job: 'Director', name: film.director }] }
        : section
          ? { results: [], logos: [], imdb_id: null }
          : {
              id: film.id,
              title: film.title,
              release_date: `${film.year}-01-01`,
              runtime: 124,
              genres: film.genres.map((name, index) => ({ id: index, name })),
              overview: `${film.title} fixture overview.`,
              poster_path: null,
              backdrop_path: null,
              vote_average: 0,
              vote_count: 0,
            };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const FIREBASE_PROJECT_ID = 'mvplockedin';
const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

function assertEmulatorTarget(baseURL: string | undefined) {
  if (!LOOPBACK.test(FIRESTORE_EMULATOR_HOST)) {
    throw new Error(`Refusing emulator REST: FIRESTORE_EMULATOR_HOST ${FIRESTORE_EMULATOR_HOST} is not loopback.`);
  }
  const host = baseURL ? new URL(baseURL).host : '';
  if (process.env.VITE_FIREBASE_EMULATOR !== '1' && !LOOPBACK.test(host)) {
    throw new Error(`Refusing emulator REST: set VITE_FIREBASE_EMULATOR=1 or run against localhost, not ${host || 'an unset baseURL'}.`);
  }
}

function assertTheaterEmulatorTarget(baseURL: string | undefined) {
  if (!LOOPBACK.test(FIRESTORE_EMULATOR_HOST)) {
    throw new Error(`Refusing to touch users/{uid}/theaters: FIRESTORE_EMULATOR_HOST ${FIRESTORE_EMULATOR_HOST} is not loopback.`);
  }
  const host = baseURL ? new URL(baseURL).host : '';
  if (process.env.VITE_FIREBASE_EMULATOR !== '1' && !LOOPBACK.test(host)) {
    throw new Error(`Refusing to touch users/{uid}/theaters: set VITE_FIREBASE_EMULATOR=1 or run against localhost, not ${host || 'an unset baseURL'}.`);
  }
}

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

function firestoreDocumentsUrl() {
  return `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

export type EmulatorAccount = { uid: string; idToken: string };

async function identityToolkit(baseURL: string | undefined, method: string, body: object): Promise<EmulatorAccount> {
  assertEmulatorTarget(baseURL);
  const url = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=fake-api-key`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Auth emulator refused ${method}: ${response.status} ${await response.text()}`);
  const account = await response.json();
  return { uid: account.localId as string, idToken: account.idToken as string };
}

export async function emulatorSignIn(baseURL: string | undefined) {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) as { email: string; password: string };
  return identityToolkit(baseURL, 'signInWithPassword', { email: creds.email, password: creds.password });
}

export async function emulatorSignUp(baseURL: string | undefined) {
  return identityToolkit(baseURL, 'signUp', { email: uniqueEmail(), password: `pw-${Date.now()}` });
}

function actorHeaders(actor: EmulatorAccount | null): Record<string, string> {
  return actor ? { Authorization: `Bearer ${actor.idToken}` } : {};
}

const POSTER_FIXTURES: Record<string, string> = {
  '/sodium.svg': '#c88c28',
  '/cyan.svg': '#2878a0',
  '/slate.svg': '#3d3d42',
};

/** TMDB serves posters with `access-control-allow-origin: *`, so the fixtures answer the same way a real poster does. */
export async function routePosterFixtures(page: Page) {
  await page.route('https://image.tmdb.org/t/p/w92/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/t/p/w92', '');
    const color = POSTER_FIXTURES[path];
    if (!color) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="92" height="138"><rect width="92" height="138" fill="${color}"/></svg>`,
    });
  });
}

export type SampledPosters = { colors: string[]; swatches: string[]; requested: string[] };

export async function samplePostersInBrowser(page: Page, posterPaths: string[]): Promise<SampledPosters> {
  return page.evaluate(async (paths) => {
    const poster = await import('/src/lib/theater/posterColor.ts');
    const infer = await import('/src/lib/theater/infer.ts');
    const requested: string[] = [];
    const sampler = poster.imagePosterSampler();
    const colors = await poster.posterColorsFrom((url: string) => {
      requested.push(url);
      return sampler(url);
    })(paths.map((posterPath) => ({ posterPath })));
    return { colors, swatches: infer.swatchesFrom(colors), requested };
  }, posterPaths);
}

export const RULES_FIXTURE_THEATER_ID: Record<string, string> = {
  mobile: 'e2e-theater-rules-mobile',
  desktop: 'e2e-theater-rules-desktop',
};

function theatersRestUrl(ownerUid: string) {
  return `${firestoreDocumentsUrl()}/users/${encodeURIComponent(ownerUid)}/theaters`;
}

export type TheaterRestDoc = {
  schema?: number;
  title?: string;
  facets?: string[];
  insight?: string;
  keptAt?: number;
};

export function theaterRestFields(doc: TheaterRestDoc) {
  const fields: Record<string, unknown> = {};
  if (doc.schema !== undefined) fields.schema = { integerValue: String(doc.schema) };
  if (doc.title !== undefined) fields.title = { stringValue: doc.title };
  if (doc.insight !== undefined) fields.insight = { stringValue: doc.insight };
  if (doc.keptAt !== undefined) fields.keptAt = { integerValue: String(doc.keptAt) };
  if (doc.facets !== undefined) {
    fields.facets = { arrayValue: { values: doc.facets.map((facet) => ({ stringValue: facet })) } };
  }
  return fields;
}

export async function createTheaterDocAs(
  actor: EmulatorAccount | null,
  ownerUid: string,
  theaterId: string,
  doc: TheaterRestDoc,
) {
  const response = await fetch(`${theatersRestUrl(ownerUid)}?documentId=${encodeURIComponent(theaterId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...actorHeaders(actor) },
    body: JSON.stringify({ fields: theaterRestFields(doc) }),
  });
  return response.status;
}

export async function readTheaterDocAs(actor: EmulatorAccount | null, ownerUid: string, theaterId: string) {
  const response = await fetch(`${theatersRestUrl(ownerUid)}/${encodeURIComponent(theaterId)}`, {
    headers: actorHeaders(actor),
  });
  return response.status;
}

export async function rewriteTheaterDocAs(
  actor: EmulatorAccount | null,
  ownerUid: string,
  theaterId: string,
  doc: TheaterRestDoc,
) {
  const response = await fetch(`${theatersRestUrl(ownerUid)}/${encodeURIComponent(theaterId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...actorHeaders(actor) },
    body: JSON.stringify({ fields: theaterRestFields(doc) }),
  });
  return response.status;
}

export async function deleteTheaterDocAs(actor: EmulatorAccount | null, ownerUid: string, theaterId: string) {
  const response = await fetch(`${theatersRestUrl(ownerUid)}/${encodeURIComponent(theaterId)}`, {
    method: 'DELETE',
    headers: actorHeaders(actor),
  });
  return response.status;
}

export async function clearTheaterFixtures(baseURL: string | undefined, ownerUid: string, theaterIds: string[]) {
  assertTheaterEmulatorTarget(baseURL);
  for (const theaterId of theaterIds) {
    const url = `${theatersRestUrl(ownerUid)}/${encodeURIComponent(theaterId)}`;
    const response = await fetch(url, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
    if (!response.ok) {
      throw new Error(`Emulator refused to clear ${theaterId}: ${response.status} ${await response.text()}`);
    }
  }
}

/** The signed-in uid, read where the Firebase SDK keeps it. IndexedDB is the default, localStorage the fallback. */
export async function currentUid(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const localKey = Object.keys(localStorage).find((key) => key.startsWith('firebase:authUser:'));
    if (localKey) return (JSON.parse(localStorage.getItem(localKey) as string) as { uid: string }).uid;

    const store = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('firebaseLocalStorageDb');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const uid = await new Promise<string | null>((resolve, reject) => {
      const rows = store.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll();
      rows.onsuccess = () => {
        const entries = rows.result as { fbase_key?: string; value?: { uid?: string } }[];
        const row = entries.find((entry) => entry.fbase_key?.startsWith('firebase:authUser:'));
        resolve(row?.value?.uid ?? null);
      };
      rows.onerror = () => reject(rows.error);
    });
    if (!uid) throw new Error('no signed-in Firebase user');
    return uid;
  });
}

export async function seedShowingTheater(page: Page, fixture: typeof THEATER_FIXTURE = THEATER_FIXTURE) {
  const theater = {
    title: fixture.title,
    facets: fixture.facets,
    insight: fixture.insight,
    swatches: fixture.swatches,
    sourceFilmIds: fixture.trail.map((film) => film.id),
    trail: fixture.trail,
    lineup: fixture.lineup.map(([id, title, year, reason]) => ({
      id,
      title,
      year,
      posterPath: null,
      backdropPath: null,
      genres: ['Crime'],
      director: 'Michael Mann',
      mediaType: 'movie',
      reason,
    })),
  };
  const uid = await currentUid(page);
  await page.evaluate(
    ({ theater, fingerprint, uid, signals }) => {
      sessionStorage.setItem(
        `theater-session:v2:${uid}`,
        JSON.stringify({ status: 'showing', theater, signals, fingerprint, lastActiveAt: Date.now() }),
      );
    },
    {
      theater,
      fingerprint: fixture.fingerprint,
      uid,
      signals: fixture.trail.map((film, at) => ({ kind: 'detail_view', film, at })),
    },
  );
  await page.reload();
}

export async function keepSeededTheater(page: Page, fixture: typeof THEATER_FIXTURE) {
  await seedShowingTheater(page, fixture);
  await page.getByTestId('theater-keep').click();
  await page.getByTestId('theater-keep').filter({ hasText: 'Saved' }).waitFor({ timeout: 20000 });
}

export async function revealAboveTabBar(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
    const tab = document.querySelector('[data-testid="tab-bar"]');
    if (!tab) return;
    const overlap = el.getBoundingClientRect().bottom - tab.getBoundingClientRect().top;
    if (overlap > 0) window.scrollBy(0, overlap + 8);
  });
}

export async function gate(page: Page, flowId: string, viewport: string) {
  const report = await runThresholds(page, flowId, viewport);
  if (!report.pass) {
    const msg = report.failures.map((f) => `${f.id}: ${f.detail}`).join('; ');
    throw new Error(`Threshold fail ${flowId} ${viewport}: ${msg}`);
  }
  return report;
}
