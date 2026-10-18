import { chromium } from '@playwright/test';
import fs from 'node:fs';

const credsFile = '/cursor/stores/bc-aa24adcb-569e-4a03-a7be-baf7bf9b3aa1/internal/test-account-creds.md';
const text = fs.readFileSync(credsFile, 'utf8');
const email = text.match(/SELECTS_TEST_EMAIL=(\S+)/)?.[1];
const password = text.match(/SELECTS_TEST_PASSWORD=(\S+)/)?.[1];
if (!email || !password) throw new Error('test account creds missing');

const videoDir = '/tmp/onboarding-phone-demo';
fs.mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
});
const page = await context.newPage();
page.on('pageerror', (err) => console.log('pageerror', err.message));

await page.goto('http://127.0.0.1:5173/login');
await page.getByLabel(/email/i).fill(email);
await page.getByRole('button', { name: /^continue$/i }).click();
const choose = page.getByTestId('login-choose');
if (await choose.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
  await page.getByRole('button', { name: /already have an account/i }).click();
}
await page.getByLabel(/^password$/i).fill(password);
await page.getByRole('button', { name: /^continue$/i }).click();
await page.waitForURL(/\/app|\/onboarding/, { timeout: 25000 });

await page.goto('http://127.0.0.1:5173/onboarding');
await page.getByTestId('onboarding-0').waitFor();
await page.getByRole('button', { name: /begin/i }).click();
await page.getByTestId('onboarding-phone').waitFor();
await page.getByTestId('onboarding-phone-input').fill('555');
await page.getByRole('button', { name: /check this number/i }).click();
await page.getByTestId('onboarding-phone-error').waitFor();
await page.waitForTimeout(900);
await page.getByTestId('onboarding-phone-input').fill('+1 202 555 0100');
await page.getByRole('button', { name: /check this number/i }).click();
await page.getByTestId('onboarding-phone-likes').waitFor({ timeout: 20000 });
await page.getByText('Heat').waitFor();
await page.getByText(/telephoto/i).waitFor();
await page.getByTestId('onboarding-phone-picks').getByText('Sicario').waitFor();
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /^continue$/i }).click();
await page.getByTestId('onboarding-1').waitFor();
await page.getByText('Heat').first().waitFor();

await page.goto('http://127.0.0.1:5173/saved');
await page.getByRole('img', { name: 'Sicario' }).waitFor({ timeout: 20000 });
await page.getByRole('img', { name: 'Michael Clayton' }).waitFor();
await page.getByRole('img', { name: 'Sicario' }).click();
await page.locator('h3', { hasText: 'Sicario' }).waitFor();
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/onboarding-phone-saved.png' });

const video = page.video();
await context.close();
await browser.close();
const src = await video?.path();
if (!src) throw new Error('no video');
fs.copyFileSync(src, '/tmp/onboarding-phone-demo.webm');
console.log('demo ok', src);
