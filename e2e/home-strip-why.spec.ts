import { test, expect } from '@playwright/test';
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

async function logFutureNight(page: import('@playwright/test').Page, day: string) {
  await page.getByTestId('action-log').click();
  const date = page.locator('input[type="date"]');
  await date.waitFor({ timeout: 15000 });
  await date.fill(day);
  await page.getByRole('button', { name: /^Add to Calendar$/i }).click();
  await page.waitForURL(new RegExp(`/app\\?date=${day}`), { timeout: 20000 });
}

test.describe('home strip why vs trailer', () => {
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
    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 30000 });

    const dayA = localDay(3);
    const dayB = localDay(5);
    await page.getByTestId('ticket-slot').first().click();
    await expect(page).toHaveURL(/\/movie\//, { timeout: 15000 });
    await logFutureNight(page, dayA);
    await expect(page.getByTestId('day-stage')).toBeVisible();
    const firstKey = await page.getByTestId('day-stage').getAttribute('data-stage-key');
    expect(firstKey).toContain(dayA);

    const whyClear = await page.evaluate(() => {
      const dock = document.querySelector('[data-testid="strip-dock"]');
      if (!dock) return { ok: false, detail: 'no dock' };
      const dr = dock.getBoundingClientRect();
      const whys = Array.from(document.querySelectorAll('[data-testid="why-match-line"]'));
      const visible = whys.filter((node) => {
        const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
      });
      if (!visible.length) return { ok: false, detail: 'no visible why' };
      for (const node of visible) {
        const r = node.getBoundingClientRect();
        const overlap = Math.min(r.bottom, dr.bottom) - Math.max(r.top, dr.top);
        if (overlap > 1) {
          return { ok: false, detail: `overlap ${overlap}` };
        }
      }
      return { ok: true, detail: '' };
    });
    expect(whyClear.ok, whyClear.detail).toBe(true);

    await page.getByTestId('selects-dismiss').click();
    await expect(page.getByTestId('day-stage')).toHaveCount(0);

    await page.getByTestId('tab-home').click();
    await page.goto('/app');
    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('ticket-slot').nth(1).click();
    await expect(page).toHaveURL(/\/movie\//, { timeout: 15000 });
    await logFutureNight(page, dayB);
    await expect(page.getByTestId('day-stage')).toBeVisible();
    const secondKey = await page.getByTestId('day-stage').getAttribute('data-stage-key');
    expect(secondKey).toContain(dayB);
    expect(secondKey).not.toBe(firstKey);
    await dumpConsole(page, 'home-strip-why', testInfo.project.name, logs);
  });
});
