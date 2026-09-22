import { test, expect } from '@playwright/test';

test.describe('selects carousel wrap', () => {

  test.skip('swipe right from the first select shows the third', async ({ page }) => {
    await page.goto('/dev/selects-carousel');
    const track = page.getByTestId('selects-carousel-track');
    await expect(track).toHaveAttribute('data-slide', '1');
    await expect(page.getByTestId('ticket-slot').nth(1)).toHaveAttribute('data-title', 'Logan');

    const hero = page.getByTestId('select-open-movie').nth(1);
    const box = await hero.boundingBox();
    if (!box) throw new Error('hero missing');
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width * 0.25, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, y, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => track.getAttribute('data-slide'), { timeout: 4000 }).toBe('3');
    await expect(page.getByLabel('Heat').first()).toBeVisible();

    await page.mouse.move(box.x + box.width * 0.85, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, y, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => track.getAttribute('data-slide'), { timeout: 4000 }).toBe('1');
    await expect(page.getByLabel('Logan').nth(1)).toBeVisible();
  });

  test('autoplay advances 1 then 2 then 3 then 1', async ({ page }) => {
    await page.goto('/dev/selects-carousel');
    const track = page.getByTestId('selects-carousel-track');
    const seen: string[] = [];
    await expect.poll(async () => {
      const v = (await track.getAttribute('data-slide')) ?? '';
      if (v && seen[seen.length - 1] !== v) seen.push(v);
      return seen.join(',');
    }, { timeout: 28000 }).toMatch(/1,2,3,(4,)?1/);
    expect(seen.join(',')).not.toMatch(/3,2/);
  });

  test('slide shows hero, related posters, and full why copy', async ({ page }) => {
    await page.goto('/dev/selects-carousel');
    const card = page.getByTestId('ticket-slot').nth(1);
    await expect(card).toHaveAttribute('data-title', 'Logan');
    await expect(card.getByTestId('why-watch-label')).toHaveText(/why should i watch this/i);
    await expect(card.getByTestId('why-match-line')).toContainText('Cape Fear');
    await expect(card.getByTestId('why-match-line')).toContainText('scarred, adult finish');
    const related = card.getByTestId('related-posters').locator('img');
    await expect(related).toHaveCount(2);
    await expect(related.nth(0)).toHaveAttribute('alt', 'X-Men: The Last Stand');
    await expect(related.nth(1)).toHaveAttribute('alt', 'X2: X-Men United');
  });

  test('tap the visible select opens that movie', async ({ page }) => {
    await page.goto('/dev/selects-carousel');
    const hero = page.getByTestId('select-open-movie').nth(1);
    await expect(hero).toHaveAttribute('aria-label', 'Logan');
    const box = await hero.boundingBox();
    if (!box) throw new Error('hero missing');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.getByTestId('opened-select')).toHaveAttribute('data-id', '263115');
  });

  test('tap a related poster opens that diary film', async ({ page }) => {
    await page.goto('/dev/selects-carousel');
    const card = page.getByTestId('ticket-slot').nth(1);
    await card.getByTestId('related-poster').first().click();
    await expect(page.getByTestId('opened-select')).toHaveAttribute('data-id', '36648');
  });

  test('Watched replaces one stable slot with a slot-local loader', async ({ page }) => {
    await page.goto('/dev/selects-carousel');
    const track = page.getByTestId('selects-carousel-track');

    await expect(page.getByTestId('watched-0').first()).toHaveText(/watched\?/i);
    await page.getByTestId('watched-0').first().click();
    await expect(page.getByRole('radio', { name: 'Liked' }).first()).toBeVisible();
    await expect(page.getByRole('radio', { name: "It's okay" }).first()).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Nope' }).first()).toBeVisible();

    await page.getByRole('radio', { name: 'Liked' }).first().click();
    await expect(page.getByLabel(/Saving feedback|Finding another select/).first()).toBeVisible();
    await expect(page.getByTestId('watched-1').first()).toBeEnabled();
    await expect(page.locator('[data-testid="ticket-slot"][data-title="The Departed"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="ticket-slot"][data-title="Heat"]')).toHaveCount(2);

    await expect(page.getByLabel('Manhunter').first()).toBeVisible();
    await expect(page.locator('[data-testid="ticket-slot"][data-title="The Departed"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="ticket-slot"][data-title="Heat"]')).toHaveCount(2);
    await expect(track).toHaveAttribute('data-slide', '1');
  });
});
