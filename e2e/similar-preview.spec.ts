import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

const preview = process.env.PREVIEW_URL || '';
const share = process.env.PREVIEW_SHARE || '';

test.skip(!preview, 'PREVIEW_URL not set');
test.use({ baseURL: preview || 'http://127.0.0.1:5173' });

test('preview similar films lineage then scholar refresh', async ({ page }) => {
  test.setTimeout(180_000);
  if (share) {
    await page.goto(share);
    await page.waitForLoadState('domcontentloaded');
  }
  await page.goto('/join');
  await signIn(page, 'selects.preview.0210.speed@example.com', 'SelectsVerify9');
  await page.goto('/movie/155');
  await expect(page.getByTestId('action-watchlist')).toBeVisible({ timeout: 30000 });
  const start = Date.now();
  await expect(page.getByTestId('similar-grid')).toBeVisible({ timeout: 3000 });
  const gridMs = Date.now() - start;
  await expect(page.getByTestId('similar-source-lineage').first()).toBeVisible({ timeout: 3000 });
  await page.getByTestId('similar-grid').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('similar-refreshed')).toBeVisible({ timeout: 70000 });
  await expect(page.getByTestId('similar-source-for-you').first()).toBeVisible();
  console.log(`similar-grid visible ${gridMs}ms after watchlist`);
});
