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

export async function seedShowingTheater(page: Page) {
  const theater = {
    title: THEATER_FIXTURE.title,
    facets: THEATER_FIXTURE.facets,
    insight: THEATER_FIXTURE.insight,
    swatches: THEATER_FIXTURE.swatches,
    sourceFilmIds: [10858],
    lineup: THEATER_FIXTURE.lineup.map(([id, title, year, reason]) => ({
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
    { theater, fingerprint: THEATER_FIXTURE.fingerprint, uid },
  );
  await page.reload();
}

export async function gate(page: Page, flowId: string, viewport: string) {
  const report = await runThresholds(page, flowId, viewport);
  if (!report.pass) {
    const msg = report.failures.map((f) => `${f.id}: ${f.detail}`).join('; ');
    throw new Error(`Threshold fail ${flowId} ${viewport}: ${msg}`);
  }
  return report;
}
