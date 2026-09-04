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

export async function gate(page: Page, flowId: string, viewport: string) {
  const report = await runThresholds(page, flowId, viewport);
  if (!report.pass) {
    const msg = report.failures.map((f) => `${f.id}: ${f.detail}`).join('; ');
    throw new Error(`Threshold fail ${flowId} ${viewport}: ${msg}`);
  }
  return report;
}
