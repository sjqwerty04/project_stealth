import { test, expect, type Page } from '@playwright/test';
import { attachPageLog, dumpConsole, ensureAuthed, saveEvidence } from './helpers';

type StoredPick = { movieId: number; title: string };

async function storedPicks(page: Page): Promise<StoredPick[]> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('selects:lastPicks:'));
    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const entry = JSON.parse(raw) as { picks?: StoredPick[] };
    return (entry.picks ?? []).map((p) => ({ movieId: p.movieId, title: p.title }));
  });
}

test.describe('selects verdict', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'one viewport is enough for behaviour');
  });

  test.afterEach(async ({}, testInfo) => {
    await saveEvidence(testInfo, 'selects-verdict-slot');
  });

  test('a Watched verdict replaces one slot and asks for one pick, not a new trio', async ({
    page,
  }, testInfo) => {
    const logs = await attachPageLog(page);
    await ensureAuthed(page);
    await page.goto('/app');
    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1000);

    const before = await storedPicks(page);
    expect(before.length, 'no picks cached before the verdict').toBeGreaterThanOrEqual(2);

    const requested: number[] = [];
    page.on('request', (r) => {
      if (!r.url().includes('/api/your-selects')) return;
      try {
        requested.push(JSON.parse(r.postData() ?? '{}').count ?? 0);
      } catch {
        requested.push(0);
      }
    });

    const rated = before[0];
    const survivors = before.slice(1);
    await page.getByTestId('watched-0').first().click();
    await page.getByRole('radio', { name: 'Liked' }).first().click();

    await page
      .locator(`[data-testid="ticket-slot"][data-title="${rated.title}"]`)
      .first()
      .waitFor({ state: 'detached', timeout: 90_000 });
    await page.waitForTimeout(6000);

    const after = await storedPicks(page);

    expect(
      requested.filter((count) => count === 3),
      'the verdict kicked off a full three-pick regeneration',
    ).toEqual([]);
    expect(requested, 'the verdict should ask for exactly one replacement pick').toEqual([1]);

    expect(after.some((p) => p.movieId === rated.movieId), 'the rated film came back').toBe(false);
    for (const keep of survivors) {
      expect(
        after.some((p) => p.movieId === keep.movieId),
        `${keep.title} was replaced even though it was not rated`,
      ).toBe(true);
    }

    await page.reload();
    await expect(page.getByTestId('selects-carousel')).toBeVisible({ timeout: 90_000 });
    await expect(
      page.locator(`[data-testid="ticket-slot"][data-title="${rated.title}"]`),
    ).toHaveCount(0);

    await page.screenshot({
      path: `artifacts/verify/selects-verdict-slot-${testInfo.project.name}/one-slot-swapped.png`,
    });
    await dumpConsole(page, 'selects-verdict-slot', testInfo.project.name, logs);
  });
});
