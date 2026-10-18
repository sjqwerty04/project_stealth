import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { signIn } from './helpers';

// Measures Ask AI latency on real APIs. ASK_AI_FILMS is a comma list of TMDB ids; use films
// nobody has opened recently for cold numbers. Results land in artifacts/ask-ai-timing.json.
const EMAIL = process.env.SELECTS_TEST_EMAIL || '';
const PASSWORD = process.env.SELECTS_TEST_PASSWORD || '';
const FILMS = (process.env.ASK_AI_FILMS || '840705').split(',').map((s) => Number(s.trim()));
const LABEL = process.env.ASK_AI_TIMING_LABEL || 'run';

test.skip(!EMAIL || !PASSWORD, 'needs the shared test account (SELECTS_TEST_EMAIL / SELECTS_TEST_PASSWORD)');

async function until(check: () => Promise<boolean>, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check().catch(() => false)) return Date.now();
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

test('ask ai timings', async ({ page }) => {
  test.setTimeout(600_000);
  await signIn(page, EMAIL, PASSWORD);
  const rows: Record<string, unknown>[] = [];

  for (const id of FILMS) {
    const t0 = Date.now();
    await page.goto(`/movie/${id}?type=movie`);
    const chips = page.getByTestId('ask-ai-chip');
    const firstChip = await until(async () => (await chips.count()) > 0, 60_000);
    const initial = await chips.allInnerTexts().catch(() => [] as string[]);
    // Watch for 25s: cold FAQs used to land around 17s and reshuffle the chips.
    let last = initial.join('|');
    let stableAt = firstChip;
    const settleStart = Date.now();
    while (Date.now() - settleStart < 25_000) {
      await page.waitForTimeout(250);
      const now = (await chips.allInnerTexts()).join('|');
      if (now !== last) {
        last = now;
        stableAt = Date.now();
      }
    }
    const reordered = last !== initial.join('|');

    const t1 = Date.now();
    await page.getByTestId('ask-ai-entry').getByTestId('ask-ai-chip').first().click();
    const reply = page.getByTestId('ask-ai-reply').first();
    const firstToken = await until(async () => ((await reply.innerText()) || '').trim().length > 0, 120_000);
    const done = await until(async () => (await page.getByTestId('ask-ai-thinking').count()) === 0 && (await page.getByTestId('ask-ai-streaming').count()) === 0, 120_000);
    const answer = await reply.innerText().catch(() => '');

    rows.push({
      label: LABEL,
      film: id,
      firstChipMs: firstChip ? firstChip - t0 : null,
      chipsStableMs: stableAt ? stableAt - t0 : null,
      reordered,
      firstAnswerTokenMs: firstToken ? firstToken - t1 : null,
      answerDoneMs: done ? done - t1 : null,
      answerWords: answer.split(/\s+/).filter(Boolean).length,
      emDashes: (answer.match(/\u2014/g) || []).length,
    });
    await page.keyboard.press('Escape');
  }

  const out = path.join(process.cwd(), 'artifacts', 'ask-ai-timing.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
  fs.writeFileSync(out, JSON.stringify([...prev, ...rows], null, 2));
  console.log(JSON.stringify(rows, null, 2));
});
