import { test, expect } from '@playwright/test';

test.describe('selects carousel wrap', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('swipe right from the first select shows the third', async ({ page }) => {
    await page.goto('/dev/selects-carousel');
    const carousel = page.getByTestId('selects-carousel');
    const track = page.getByTestId('selects-carousel-track');
    await expect(track).toHaveAttribute('data-slide', '1');
    await expect(page.getByTestId('ticket-slot').nth(1)).toHaveAttribute('aria-label', 'Select 1');

    const box = await carousel.boundingBox();
    if (!box) throw new Error('carousel missing');
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width * 0.25, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, y, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => track.getAttribute('data-slide'), { timeout: 4000 }).toBe('3');
    await expect(page.getByLabel('Select 3').first()).toBeVisible();

    await page.mouse.move(box.x + box.width * 0.85, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, y, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => track.getAttribute('data-slide'), { timeout: 4000 }).toBe('1');
    await expect(page.getByLabel('Select 1').nth(1)).toBeVisible();
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
});
