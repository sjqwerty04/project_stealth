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

/** The Grok author is mocked so the reward is deterministic and the run never depends on xAI. */
export const PROFILE_FIXTURE = {
  archetype: 'NOCTURNALIST',
  read: 'You watch at night, and you go back to the same six people.',
  insights: [
    { title: 'THE COUNT', headline: '7', body: 'films read. Fourteen hours, give or take a trailer.', tone: 'warm' },
    { title: 'THE ANCHOR', headline: 'Heat.', body: 'The one you would rent the theatre for.', tone: 'warm' },
    { title: 'THE DECADE', headline: '2010s.', body: 'Where most of your logs land.', tone: 'warm' },
    { title: 'THE COMPANY', headline: 'Denis Villeneuve.', body: 'The name that keeps turning up.', tone: 'warm' },
    { title: 'THE HOUR', headline: 'You watch late.', body: '61% of your logs start after 10pm.', tone: 'warm' },
    { title: 'THE GENRE', headline: 'Crime.', body: 'The shelf you reach for first.', tone: 'warm' },
    { title: 'THE LENS', headline: 'Story.', body: 'How you judge, which is not the same as what you like.', tone: 'warm' },
    { title: 'THE COLOUR', headline: '#3A6E85', body: 'The average of the posters you have lived with.', tone: 'warm' },
    { title: 'THE RESISTANCE', headline: 'Dune never landed.', body: 'Everyone else queued twice. You stayed home.', tone: 'sharp' },
    { title: 'ONE IN FIVE', headline: 'You have never rewatched anything you gave five stars.', body: 'Make of that what you like.', tone: 'sharp' },
  ],
};

export async function mockProfileApi(page: Page) {
  await page.route('**/api/selects-profile', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile: PROFILE_FIXTURE, source: 'mock' }) }),
  );
}

/** Splash through the three questions, stopping on the import hub. */
export async function answerOnboardingQuestions(page: Page) {
  await mockProfileApi(page);
  await page.getByRole('button', { name: /begin/i }).click();
  await page.getByTestId('onboarding-1').waitFor();
  const film = page.getByTestId('film-pick').first();
  await film.waitFor({ timeout: 20000 });
  await film.click();
  await page.getByTestId('pick-hero').waitFor();
  await page.getByRole('button', { name: /next · 1 picked/i }).click();
  await page.getByTestId('onboarding-3').waitFor();
  await page.getByRole('button', { name: /next · or skip/i }).click();
  await page.getByTestId('onboarding-4').waitFor();
  await page.getByRole('button', { name: /flawless screenplay/i }).click();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByTestId('onboarding-5').waitFor({ timeout: 20000 });
}

/** Reading through Insights and into the app. */
export async function finishOnboardingReward(page: Page) {
  await page.getByTestId('onboarding-reading').waitFor({ timeout: 20000 });
  await page.getByTestId('onboarding-6').waitFor({ timeout: 30000 });
  await page.getByTestId('profile-read').waitFor();
  await page.getByRole('button', { name: /^insights$/i }).click();
  await page.getByTestId('onboarding-7').waitFor();
  await page.getByTestId('insight-card').first().waitFor();
  await page.getByRole('button', { name: /open the assembly/i }).click();
  await page.waitForURL(/\/app/, { timeout: 20000 });
}

export async function completeOnboarding(page: Page) {
  await answerOnboardingQuestions(page);
  await page.getByTestId('onboarding-skip-lb').click();
  await finishOnboardingReward(page);
}

export async function signupFreshAccount(page: Page, password = 'SelectsVerify9') {
  const email = uniqueEmail();
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
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  fs.writeFileSync(CREDS_PATH, JSON.stringify({ email, password }));
  return { email, password };
}

export async function ensureAuthed(page: Page) {
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
    if (!creds) {
      await signupFreshAccount(page);
      return;
    }
    await signIn(page, creds.email, creds.password);
  }
  if (page.url().includes('/onboarding')) {
    await completeOnboarding(page);
  }
  await tabs.waitFor({ state: 'visible', timeout: 20000 });
}

export async function gate(page: Page, flowId: string, viewport: string) {
  const report = await runThresholds(page, flowId, viewport);
  if (!report.pass) {
    const msg = report.failures.map((f) => `${f.id}: ${f.detail}`).join('; ');
    throw new Error(`Threshold fail ${flowId} ${viewport}: ${msg}`);
  }
  return report;
}
