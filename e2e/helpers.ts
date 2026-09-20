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
  lineup: [
    [5511, 'Le Samouraï', '1967', 'A contract killer follows his routine flawlessly and it still closes on him.'],
    [9526, 'To Live and Die in L.A.', '1985', 'A Secret Service agent so good at the chase he becomes the crime.'],
    [1538, 'Collateral', '2004', 'One long night where the professional and the amateur both lose the map.'],
    [31672, 'The Friends of Eddie Coyle', '1973', 'Every hood in Boston knows his trade and none of it saves Eddie.'],
    [24559, 'Sorcerer', '1977', 'Four experts drive nitroglycerin through a jungle that does not care.'],
    [379, "Miller's Crossing", '1990', 'Tom plays every angle in the room and still ends up alone.'],
    [273481, 'Sicario', '2015', 'Kate does everything right and learns the job was never hers.'],
    [10858, 'Thief', '1981', 'Frank builds the whole life on paper and burns every page of it.'],
  ] as [number, string, string, string][],
};

export const FILM_PAGE_THEATER = {
  fingerprint: 'e2e-film-page-theater',
  title: 'Because of the night',
  facets: ['COMPETENCE PORN', 'NOBODY WINS'] as [string, string],
  insight: 'You keep walking back into the same rained-on block after midnight.',
  swatches: ['#1D5B8A', '#8A3A1D', '#3A6E85', '#1D1D20'],
  lineup: [
    [5511, 'Le Samouraï', '1967', 'THE PROFESSIONAL AS MONK. BOTH MEN ARE ALONE BY CHOICE.'],
    [9526, 'To Live and Die in L.A.', '1985', 'SYNTH PULSE, SODIUM LIGHT, AND A CITY THAT DOES THE TALKING.'],
    [1538, 'Collateral', '2004', 'MANN AGAIN. SAME CITY LOGIC, TWENTY-THREE YEARS LATER.'],
    [31672, 'The Friends of Eddie Coyle', '1973', 'EVERY HOOD IN BOSTON KNOWS HIS TRADE AND NONE OF IT SAVES EDDIE.'],
    [24559, 'Sorcerer', '1977', 'FOUR EXPERTS DRIVE NITROGLYCERIN THROUGH A JUNGLE THAT DOES NOT CARE.'],
    [379, "Miller's Crossing", '1990', 'TOM PLAYS EVERY ANGLE AND STILL ENDS UP ALONE.'],
    [273481, 'Sicario', '2015', 'KATE DOES EVERYTHING RIGHT AND LEARNS THE JOB WAS NEVER HERS.'],
    [10858, 'Thief', '1981', 'FRANK BUILDS THE WHOLE LIFE ON PAPER AND BURNS EVERY PAGE OF IT.'],
  ] as [number, string, string, string][],
};

export const FILM_AXES_FIXTURE = [
  { name: 'LOOK', value: 'sodium-and-cyan night', score: 4 },
  { name: 'CAMERA', value: 'locked-off', score: 2 },
  { name: 'TEMPO', value: 'procedural', score: 5 },
  { name: 'WEATHER', value: 'competence porn', score: 4 },
  { name: 'SOUND', value: 'synth pulse', score: 2 },
  { name: 'WORLD', value: 'rain-slick city night', score: 3 },
  { name: 'SHAPE', value: 'two-hander', score: 1 },
  { name: 'FORMAT', value: '1.85 spherical', score: 3 },
];

export type AxesCalls = { count: number };

export async function mockFilmAxes(page: Page): Promise<AxesCalls> {
  const calls: AxesCalls = { count: 0 };
  await page.route('**/api/llm', async (route) => {
    const body = route.request().postData() || '{}';
    const isAxes = (JSON.parse(body) as { prompt?: string }).prompt?.startsWith('<film>') === true;
    if (isAxes) calls.count += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: isAxes ? JSON.stringify({ axes: FILM_AXES_FIXTURE }) : '' }),
    });
  });
  return calls;
}

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

export const FIRST_VISIT_FILM_ID: Record<string, number> = { mobile: 9_000_101, desktop: 9_000_102 };

const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const FIREBASE_PROJECT_ID = 'mvplockedin';
const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

function assertEmulatorTarget(baseURL: string | undefined) {
  if (!LOOPBACK.test(FIRESTORE_EMULATOR_HOST)) {
    throw new Error(`Refusing to delete film_axes: FIRESTORE_EMULATOR_HOST ${FIRESTORE_EMULATOR_HOST} is not loopback.`);
  }
  const host = baseURL ? new URL(baseURL).host : '';
  if (process.env.VITE_FIREBASE_EMULATOR !== '1' && !LOOPBACK.test(host)) {
    throw new Error(`Refusing to delete film_axes: set VITE_FIREBASE_EMULATOR=1 or run against localhost, not ${host || 'an unset baseURL'}.`);
  }
}

export async function clearFilmAxesFixtures(baseURL: string | undefined, ownerUid: string, filmKeys: string[]) {
  assertEmulatorTarget(baseURL);
  for (const filmKey of filmKeys) {
    const url = `${filmAxesRestUrl(ownerUid)}/${encodeURIComponent(filmKey)}`;
    const response = await fetch(url, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
    if (!response.ok) {
      throw new Error(`Emulator refused to clear ${filmKey}: ${response.status} ${await response.text()}`);
    }
  }
}

export const RULES_FIXTURE_FILM_ID: Record<string, number> = { mobile: 9_000_201, desktop: 9_000_202 };

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

function firestoreDocumentsUrl() {
  return `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

function filmAxesRestUrl(ownerUid: string) {
  return `${firestoreDocumentsUrl()}/users/${encodeURIComponent(ownerUid)}/film_axes`;
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

export type FilmAxesRestDoc = {
  schema?: number;
  mediaType?: string;
  filmId?: number;
  title?: string;
  year?: string;
  axes?: FilmAxesRestAxis[];
  createdAt?: number;
  extra?: string;
};

export type FilmAxesRestAxis = { name: string; value: string; score: number; extra?: string };

export function filmAxesRestFields(doc: FilmAxesRestDoc) {
  const fields: Record<string, unknown> = {};
  if (doc.schema !== undefined) fields.schema = { integerValue: String(doc.schema) };
  if (doc.mediaType !== undefined) fields.mediaType = { stringValue: doc.mediaType };
  if (doc.filmId !== undefined) fields.filmId = { integerValue: String(doc.filmId) };
  if (doc.title !== undefined) fields.title = { stringValue: doc.title };
  if (doc.year !== undefined) fields.year = { stringValue: doc.year };
  if (doc.createdAt !== undefined) fields.createdAt = { integerValue: String(doc.createdAt) };
  if (doc.extra !== undefined) fields.extra = { stringValue: doc.extra };
  if (doc.axes !== undefined) {
    fields.axes = {
      arrayValue: {
        values: doc.axes.map((axis) => ({
          mapValue: {
            fields: {
              name: { stringValue: axis.name },
              value: { stringValue: axis.value },
              score: Number.isInteger(axis.score)
                ? { integerValue: String(axis.score) }
                : { doubleValue: axis.score },
              ...(axis.extra === undefined ? {} : { extra: { stringValue: axis.extra } }),
            },
          },
        })),
      },
    };
  }
  return fields;
}

function actorHeaders(actor: EmulatorAccount | null): Record<string, string> {
  return actor ? { Authorization: `Bearer ${actor.idToken}` } : {};
}

export async function createFilmAxesDoc(
  actor: EmulatorAccount | null,
  ownerUid: string,
  filmKey: string,
  doc: FilmAxesRestDoc,
) {
  const response = await fetch(`${filmAxesRestUrl(ownerUid)}?documentId=${encodeURIComponent(filmKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...actorHeaders(actor) },
    body: JSON.stringify({ fields: filmAxesRestFields(doc) }),
  });
  return response.status;
}

export async function createSharedFilmAxesDoc(actor: EmulatorAccount, filmKey: string, doc: FilmAxesRestDoc) {
  const response = await fetch(`${firestoreDocumentsUrl()}/film_axes?documentId=${encodeURIComponent(filmKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...actorHeaders(actor) },
    body: JSON.stringify({ fields: filmAxesRestFields(doc) }),
  });
  return response.status;
}

export async function readSharedFilmAxesDoc(actor: EmulatorAccount, filmKey: string) {
  const response = await fetch(`${firestoreDocumentsUrl()}/film_axes/${encodeURIComponent(filmKey)}`, {
    headers: actorHeaders(actor),
  });
  return response.status;
}

export async function readFilmAxesDoc(actor: EmulatorAccount | null, ownerUid: string, filmKey: string) {
  const response = await fetch(`${filmAxesRestUrl(ownerUid)}/${encodeURIComponent(filmKey)}`, {
    headers: actorHeaders(actor),
  });
  return response.status;
}

export async function rewriteFilmAxesDoc(
  actor: EmulatorAccount,
  ownerUid: string,
  filmKey: string,
  doc: FilmAxesRestDoc,
) {
  const response = await fetch(`${filmAxesRestUrl(ownerUid)}/${encodeURIComponent(filmKey)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...actorHeaders(actor) },
    body: JSON.stringify({ fields: filmAxesRestFields(doc) }),
  });
  return response.status;
}

export async function deleteFilmAxesDocAs(actor: EmulatorAccount, ownerUid: string, filmKey: string) {
  const response = await fetch(`${filmAxesRestUrl(ownerUid)}/${encodeURIComponent(filmKey)}`, {
    method: 'DELETE',
    headers: actorHeaders(actor),
  });
  return response.status;
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
    sourceFilmIds: [10858],
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
    ({ theater, fingerprint, uid }) => {
      sessionStorage.setItem(
        `theater-session:v1:${uid}`,
        JSON.stringify({ status: 'showing', theater, signals: [], fingerprint, lastActiveAt: Date.now() }),
      );
    },
    { theater, fingerprint: fixture.fingerprint, uid },
  );
  await page.reload();
}

export async function keepSeededTheater(page: Page, fixture: typeof THEATER_FIXTURE) {
  await seedShowingTheater(page, fixture);
  await page.getByTestId('theater-keep').click();
  await page.getByTestId('theater-keep').filter({ hasText: 'Kept' }).waitFor({ timeout: 20000 });
}

export async function gate(page: Page, flowId: string, viewport: string) {
  const report = await runThresholds(page, flowId, viewport);
  if (!report.pass) {
    const msg = report.failures.map((f) => `${f.id}: ${f.detail}`).join('; ');
    throw new Error(`Threshold fail ${flowId} ${viewport}: ${msg}`);
  }
  return report;
}
