import { defineConfig, devices } from '@playwright/test';

/** The iOS projects check a deployed site (production by default), never the local dev server. */
const IOS_BASE_URL = process.env.SELECTS_BASE_URL ?? 'https://selects-film.vercel.app';
const iosOnly = process.argv.some((arg) => arg.includes('ios-webkit'));
const iPhone = { ...devices['iPhone 15'], baseURL: IOS_BASE_URL };
const IOS_SPECS = /ios-parity\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: iosOnly
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'mobile',
      testIgnore: IOS_SPECS,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'phone-se',
      testMatch: /home-(shell-layout|strip-why)\.spec\.ts/,
      use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'desktop',
      testIgnore: IOS_SPECS,
      use: { viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'ios-webkit',
      testMatch: IOS_SPECS,
      use: iPhone,
    },
    {
      // Existing smokes and flows in WebKit on an iPhone, against the deployed site.
      // Flows that sign up a new account never run here.
      name: 'ios-webkit-smokes',
      testMatch: /(smokes|flows)\.spec\.ts/,
      grepInvert: /F2 New account|F15 Letterboxd export import|F16 Onboarding|F17 Onboarding/,
      use: iPhone,
    },
  ],
});
