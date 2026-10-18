import { test, expect, type Page } from '@playwright/test';
import { attachPageLog, dumpConsole, ensureAuthed, saveEvidence } from './helpers';

async function visibleSelectTitle(page: Page) {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-testid="selects-carousel-track"] [data-testid="ticket-slot"]'),
    );
    const visible = cards.find((node) => {
      const r = node.getBoundingClientRect();
      return r.width > 80 && r.left >= -8 && r.left < window.innerWidth * 0.45;
    });
    return visible?.getAttribute('data-title') ?? '';
  });
}

function slotsNamed(page: Page, title: string) {
  return page.locator(`[data-testid="ticket-slot"][data-title="${title}"]`);
}

test.describe('selects taste ingest', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Watched? ingest is a phone layout');
  });

  test.afterEach(async ({}, testInfo) => {
    await saveEvidence(testInfo, 'selects-taste-ingest');
  });

  test('Watched? liked on slot 0 leaves that title after replacement and reload', async ({
    page,
  }, testInfo) => {
    const logs = await attachPageLog(page);
    await ensureAuthed(page);
    await page.goto('/app');
    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90_000 });

    const title = await visibleSelectTitle(page);
    expect(title.length).toBeGreaterThan(0);
    const card = page.locator(`[data-testid="ticket-slot"][data-title="${title}"]`).filter({ visible: true }).first();
    await card.getByRole('button', { name: /watched\?/i }).click();
    await page.getByRole('radio', { name: 'Liked' }).first().click();
    await expect(slotsNamed(page, title)).toHaveCount(0, { timeout: 90_000 });

    await page.reload();
    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90_000 });
    await expect(slotsNamed(page, title)).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/verify/selects-taste-ingest-${testInfo.project.name}/liked-gone.png`,
      fullPage: true,
    });
    await dumpConsole(page, 'selects-taste-ingest', testInfo.project.name, logs);
  });
});
