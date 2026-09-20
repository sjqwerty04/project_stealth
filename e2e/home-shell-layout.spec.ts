import { test, expect, type Page } from '@playwright/test';
import { attachPageLog, dumpConsole, ensureAuthed, saveEvidence } from './helpers';

type Frame = { top: number; bottom: number; height: number } | null;

type Measurement = {
  innerHeight: number;
  docOverflowPx: number;
  bannerVisible: boolean;
  stripTrack: Frame;
  tabBar: Frame;
  stripBelowTabBarPx: number | null;
  scrollportOverflowPx: number;
  dayStageInScrollport: boolean | null;
};

async function measure(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const frame = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    const stripTrack = frame('[data-testid="strip-track"]');
    const tabBar = frame('[data-testid="tab-bar"]');
    const scrollport = document.querySelector('[data-testid="selects-scroll"]');
    const stage = document.querySelector('[data-testid="day-stage"]');
    return {
      innerHeight: window.innerHeight,
      docOverflowPx: document.documentElement.scrollHeight - window.innerHeight,
      bannerVisible: Boolean(document.querySelector('button[aria-label="Dismiss"]')),
      stripTrack,
      tabBar,
      stripBelowTabBarPx: stripTrack && tabBar ? stripTrack.bottom - tabBar.top : null,
      scrollportOverflowPx: scrollport ? scrollport.scrollHeight - scrollport.clientHeight : 0,
      dayStageInScrollport: stage ? Boolean(stage.closest('[data-testid="selects-scroll"]')) : null,
    };
  });
}

function expectChromePinned(m: Measurement, label: string) {
  expect(m.stripTrack, `${label}: no date strip`).not.toBeNull();
  expect(m.tabBar, `${label}: no tab bar`).not.toBeNull();
  expect(
    m.stripBelowTabBarPx,
    `${label}: date strip runs ${m.stripBelowTabBarPx}px past the top of the tab bar`,
  ).toBeLessThanOrEqual(1);
  expect(m.docOverflowPx, `${label}: the page scrolls by ${m.docOverflowPx}px`).toBeLessThanOrEqual(1);
}

test.describe('home shell layout', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'phone chrome only');
  });

  test.afterEach(async ({}, testInfo) => {
    await saveEvidence(testInfo, 'home-shell-layout');
  });

  test('tab bar and date strip stay pinned while Your Selects scrolls under them', async ({
    page,
  }, testInfo) => {
    const logs = await attachPageLog(page);
    await ensureAuthed(page);
    await page.goto('/app');
    await expect(page.getByTestId('home-strip')).toBeVisible();
    await expect(page.getByTestId('strip-track')).toBeVisible();
    await page.waitForTimeout(500);

    const onLoad = await measure(page);
    expectChromePinned(onLoad, 'on load');

    if (onLoad.bannerVisible) {
      await page.evaluate(() => {
        const banner = document.querySelector('button[aria-label="Dismiss"]')?.closest('div')?.parentElement;
        if (!banner) return;
        const filler = document.createElement('div');
        filler.style.height = '40px';
        banner.appendChild(filler);
      });
      await page.waitForTimeout(200);
      expectChromePinned(await measure(page), 'with a taller banner');
    }

    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(500);

    const beforeScroll = await measure(page);
    if (beforeScroll.scrollportOverflowPx > 0) {
      const scrolled = await page.getByTestId('selects-scroll').evaluate((node) => {
        node.scrollTop = node.scrollHeight;
        return node.scrollTop;
      });
      await page.waitForTimeout(300);
      const afterScroll = await measure(page);
      expect(scrolled, 'the selects column never scrolled').toBeGreaterThan(0);
      expect(afterScroll.stripTrack?.top, 'the date strip moved when the selects scrolled').toBe(
        beforeScroll.stripTrack?.top,
      );
      expect(afterScroll.tabBar?.top, 'the tab bar moved when the selects scrolled').toBe(
        beforeScroll.tabBar?.top,
      );
      expectChromePinned(afterScroll, 'after scrolling selects');
    }

    const withStage = await measure(page);
    if (withStage.dayStageInScrollport !== null) {
      expect(withStage.dayStageInScrollport, 'the day trailer is still pinned in the dock').toBe(true);
    }

    await page.screenshot({
      path: `artifacts/verify/home-shell-layout-${testInfo.project.name}/chrome-pinned.png`,
    });
    await dumpConsole(page, 'home-shell-layout', testInfo.project.name, logs);
  });
});
