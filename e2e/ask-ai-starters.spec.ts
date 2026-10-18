import { test, expect, type Page } from '@playwright/test';
import { signIn, saveEvidence, attachPageLog, dumpConsole } from './helpers';

// Signs in with the shared test account (SELECTS_TEST_EMAIL / SELECTS_TEST_PASSWORD); never signs up.
// /api proxies to production, so starters and replies are real.
const EMAIL = process.env.SELECTS_TEST_EMAIL || '';
const PASSWORD = process.env.SELECTS_TEST_PASSWORD || '';
const BLINK_TWICE = 840705;
const DUNE_PART_TWO = 693134;

const pause = (page: Page, ms = 1200) => page.waitForTimeout(ms);

test.describe('Ask AI starters', () => {
  test.skip(!EMAIL || !PASSWORD, 'needs the shared test account (SELECTS_TEST_EMAIL / SELECTS_TEST_PASSWORD)');

  test('every film gets tailored starters, an expanded sheet, and a chat that answers', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const logs = await attachPageLog(page);
    await signIn(page, EMAIL, PASSWORD);

    await page.goto(`/movie/${BLINK_TWICE}?type=movie`);
    const floating = page.getByTestId('ask-ai-floating');
    await expect(floating).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ask-ai-cta').getByTestId('ask-ai-beta')).toBeVisible();
    expect(await floating.getByTestId('ask-ai-chip').count()).toBeGreaterThanOrEqual(3);
    await pause(page, 2000);
    await page.screenshot({ path: testInfo.outputPath('floating-row.png') });

    const entry = page.getByTestId('ask-ai-entry');
    await entry.scrollIntoViewIfNeeded();
    await expect(entry.getByTestId('ask-ai-beta')).toBeVisible();
    const entryChips = entry.getByTestId('ask-ai-chip');
    await expect(entryChips).toHaveCount(3);
    await expect(entryChips.filter({ hasText: 'Blink Twice' }).first()).toBeVisible();
    await pause(page, 1800);
    await page.screenshot({ path: testInfo.outputPath('entry.png') });
    await entry.getByTestId('ask-ai-entry-chips').evaluate((el) => el.scrollBy({ left: 400, behavior: 'smooth' }));
    await pause(page, 1500);

    await entry.getByTestId('ask-ai-expand').click();
    const sheet = page.getByTestId('ask-ai-starter-sheet');
    await expect(sheet).toBeVisible();
    expect(await sheet.getByTestId('ask-ai-sheet-item').count()).toBeGreaterThanOrEqual(6);
    await expect(sheet).toContainText('How does Blink Twice compare to Get Out?');
    await expect(sheet).toContainText('What is the meaning behind Blink Twice?');
    await pause(page, 2000);
    await page.screenshot({ path: testInfo.outputPath('starter-sheet.png') });

    await sheet.getByTestId('ask-ai-sheet-item').filter({ hasText: 'compare to Get Out' }).click();
    const chat = page.getByTestId('ask-ai-chat');
    await expect(chat.getByTestId('ask-ai-user-msg')).toHaveText('How does Blink Twice compare to Get Out?');
    await expect(chat.getByTestId('ask-ai-reply').first()).not.toBeEmpty({ timeout: 90_000 });
    await expect(chat.getByTestId('ask-ai-chip').filter({ hasText: 'compare to Get Out' })).toHaveCount(0);
    await pause(page, 3000);
    await page.screenshot({ path: testInfo.outputPath('chat-reply.png') });

    // Reddit-grounded "most asked" questions merge in ahead of the templates once they land.
    await chat.getByTestId('ask-ai-expand').click();
    await expect(sheet.getByText('Most asked').first()).toBeVisible({ timeout: 90_000 });
    await pause(page, 2500);
    await sheet.getByRole('button', { name: /close starters/i }).click();
    await chat.getByRole('button', { name: /^close$/i }).click();
    await pause(page, 800);

    // A second film gets its own starters, including its franchise connection.
    await page.goto(`/movie/${DUNE_PART_TWO}?type=movie`);
    const duneEntry = page.getByTestId('ask-ai-entry');
    await duneEntry.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(duneEntry.getByTestId('ask-ai-chip').first()).toBeVisible({ timeout: 30_000 });
    await duneEntry.getByTestId('ask-ai-expand').click();
    await expect(sheet.getByTestId('ask-ai-sheet-item').filter({ hasText: 'related to Dune' }).first()).toBeVisible();
    await pause(page, 2500);
    await page.screenshot({ path: testInfo.outputPath('dune-starters.png') });

    await dumpConsole(page, 'ask-ai-starters', testInfo.project.name, logs);
    await saveEvidence(testInfo, 'ask-ai-starters');
  });
});
