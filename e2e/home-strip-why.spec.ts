import { test, expect, type Page } from '@playwright/test';
import { addDays, format, startOfDay } from 'date-fns';
import {
  attachPageLog,
  dumpConsole,
  ensureAuthed,
  saveEvidence,
} from './helpers';

function localDay(offset: number) {
  return format(addDays(startOfDay(new Date()), offset), 'yyyy-MM-dd');
}

async function dismissClaimBanner(page: Page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

async function waitForSelects(page: Page) {
  await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('why-match-line').first()).toBeVisible({ timeout: 20_000 });
}

async function logFutureNight(page: Page, movieId: number, day: string) {
  await page.goto(`/movie/${movieId}?type=movie`);
  await expect(page.getByTestId('action-log')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('action-log').click();
  const date = page.locator('input[type="date"]');
  await date.waitFor({ timeout: 15_000 });
  await date.fill(day);
  await page.getByRole('button', { name: 'Add to Calendar', exact: true }).click();
  await page.waitForURL(new RegExp(`/app\\?date=${day}`), { timeout: 20_000 });
}

async function whyClearOfDock(page: Page) {
  return page.evaluate(() => {
    const tab = document.querySelector('[data-testid="tab-bar"]');
    const scroll = document.querySelector('[data-testid="selects-scroll"]');
    const dock = document.querySelector('[data-testid="strip-dock"]');
    if (!tab) return { ok: false, detail: 'no tab' };
    if (!scroll) return { ok: false, detail: 'no scroll' };
    if (!dock || !scroll.contains(dock)) return { ok: false, detail: 'day reel is not in the scroll' };
    const tr = tab.getBoundingClientRect();
    const whys = Array.from(document.querySelectorAll('[data-testid="why-match-line"]'));
    const visible = whys.filter((node) => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.bottom - r.top > 8;
    });
    if (!visible.length) return { ok: false, detail: 'no visible why' };
    for (const node of visible) {
      const r = node.getBoundingClientRect();
      const overlap = Math.min(r.bottom, tr.bottom) - Math.max(r.top, tr.top);
      if (overlap > 1) return { ok: false, detail: `why under tab ${overlap}` };
    }
    return { ok: true, detail: '' };
  });
}

test.describe('home strip why vs trailer', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'phone layouts only');
  });

  test.afterEach(async ({}, testInfo) => {
    await saveEvidence(testInfo, 'home-strip-why');
  });

  test('why copy stays above the dock, tap-away hides the trailer, and a new date remounts it', async ({
    page,
  }, testInfo) => {
    const logs = await attachPageLog(page);
    await ensureAuthed(page);
    await page.goto('/app');
    await expect(page.getByTestId('home-strip')).toBeVisible();
    await dismissClaimBanner(page);
    await waitForSelects(page);

    const dayA = localDay(3);
    const dayB = localDay(5);
    await logFutureNight(page, 949, dayA);
    await expect(page.getByTestId('day-stage')).toBeVisible();
    const firstKey = await page.getByTestId('day-stage').getAttribute('data-stage-key');
    expect(firstKey).toContain(dayA);
    await waitForSelects(page);
    await page.getByTestId('why-match-line').first().scrollIntoViewIfNeeded();

    const whyClear = await whyClearOfDock(page);
    expect(whyClear.ok, whyClear.detail).toBe(true);
    await page.screenshot({
      path: `artifacts/verify/home-strip-why-${testInfo.project.name}/why-above-dock.png`,
      fullPage: true,
    });

    await page.getByTestId('selects-dismiss').click();
    await expect(page.getByTestId('day-stage')).toHaveCount(0);

    await logFutureNight(page, 1949, dayB);
    await expect(page.getByTestId('day-stage')).toBeVisible();
    const secondKey = await page.getByTestId('day-stage').getAttribute('data-stage-key');
    expect(secondKey).toContain(dayB);
    expect(secondKey).not.toBe(firstKey);
    await dumpConsole(page, 'home-strip-why', testInfo.project.name, logs);
  });
});
