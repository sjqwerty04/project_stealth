import { test, expect, type Page } from '@playwright/test';
import { signIn, saveEvidence, attachPageLog, dumpConsole } from './helpers';

// Signs in with the shared test account (SELECTS_TEST_EMAIL / SELECTS_TEST_PASSWORD); never signs up.
// /api goes to production, or to a preview via SELECTS_API_TARGET, so starters and replies are real.
const EMAIL = process.env.SELECTS_TEST_EMAIL || '';
const PASSWORD = process.env.SELECTS_TEST_PASSWORD || '';
const BLINK_TWICE = 840705;

const pause = (page: Page, ms = 1200) => page.waitForTimeout(ms);

test.describe('Ask AI starters', () => {
  test.skip(!EMAIL || !PASSWORD, 'needs the shared test account (SELECTS_TEST_EMAIL / SELECTS_TEST_PASSWORD)');

  test('one slim row of tailored starters, a short streamed answer, tappable films and people', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const logs = await attachPageLog(page);
    await signIn(page, EMAIL, PASSWORD);

    await page.goto(`/movie/${BLINK_TWICE}?type=movie`);
    const entry = page.getByTestId('ask-ai-entry');
    await entry.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(entry.getByTestId('ask-ai-beta')).toBeVisible();
    const chips = entry.getByTestId('ask-ai-chip');
    await expect(chips.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ask-ai-floating')).toHaveCount(0);
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(5);
    const box = await entry.boundingBox();
    expect(box!.height).toBeLessThan(90);

    const firstOrder = await chips.allInnerTexts();
    expect(firstOrder.join(' ')).not.toMatch(/\u2014/);
    await pause(page, 2500);
    expect(await chips.allInnerTexts()).toEqual(firstOrder);

    // A starter that names two films shows both posters.
    const twoFilm = chips.filter({ has: page.getByTestId('mention-film').nth(1) }).first();
    await expect(twoFilm).toBeVisible();
    await twoFilm.scrollIntoViewIfNeeded();
    await pause(page, 1200);
    await page.screenshot({ path: testInfo.outputPath('entry.png') });

    const asked = (await twoFilm.innerText()).trim();
    await twoFilm.click();
    const chat = page.getByTestId('ask-ai-chat');
    await expect(chat.getByTestId('ask-ai-user-msg')).toHaveText(asked);
    const reply = chat.getByTestId('ask-ai-reply').first();
    await expect(reply).not.toBeEmpty({ timeout: 60_000 });
    await expect(chat.getByTestId('ask-ai-streaming')).toHaveCount(0, { timeout: 60_000 });
    const answer = await reply.innerText();
    expect(answer).not.toMatch(/\u2014/);
    expect(answer.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(75);
    const filmMention = chat.getByTestId('mention-film').first();
    await expect(filmMention).toBeVisible({ timeout: 15_000 });
    await pause(page, 2500);

    expect(await chat.getByTestId('ask-ai-chip').count()).toBeLessThanOrEqual(5);
    await expect(chat.getByTestId('ask-ai-expand')).toHaveCount(0);
    await pause(page, 1500);
    await page.screenshot({ path: testInfo.outputPath('chat-reply.png') });

    const filmId = await filmMention.getAttribute('data-entity-id');
    await filmMention.click();
    await page.waitForURL(new RegExp(`/movie/${filmId}`));
    await expect(page.getByTestId('ask-ai-entry').getByTestId('ask-ai-chip').first()).toBeVisible({ timeout: 30_000 });
    await pause(page, 2000);

    // People named in an answer open their page in DNA.
    await page.goto(`/movie/${BLINK_TWICE}?type=movie`);
    await page.getByTestId('ask-ai-cta').click();
    await chat.getByLabel(/ask about blink twice/i).fill('Who directed it, and who plays Slater King?');
    await chat.getByRole('button', { name: /^send$/i }).click();
    const person = chat.getByTestId('mention-person').first();
    await expect(person).toBeVisible({ timeout: 60_000 });
    await pause(page, 2000);
    const personName = (await person.innerText()).trim();
    await person.click();
    await page.waitForURL(/\/dna\//);
    await expect(page.getByRole('heading', { name: personName })).toBeVisible({ timeout: 30_000 });
    await pause(page, 2000);
    await page.screenshot({ path: testInfo.outputPath('person.png') });

    await dumpConsole(page, 'ask-ai-starters', testInfo.project.name, logs);
    await saveEvidence(testInfo, 'ask-ai-starters');
  });
});
