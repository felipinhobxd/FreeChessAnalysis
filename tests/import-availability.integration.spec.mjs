import { test, expect } from '@playwright/test';

test('a non-JSON rate-limit response leaves the import form usable', async ({ page }) => {
  await page.route('**/api/import-pgn?*', route => route.fulfill({
    status: 429,
    contentType: 'text/html',
    body: '<p>Too many requests</p>',
  }));
  await page.goto('/analysis');
  await page.locator('#language-select').selectOption('en');
  await page.locator('#language-enter').click();
  await page.locator('[data-source="link"]').click();
  await page.locator('#game-input').fill('https://www.chess.com/game/live/123');
  await page.locator('#submit').click();
  await expect(page.locator('#import-error')).toHaveText('The service rate-limited requests. Try again shortly.');
  await expect(page.locator('#submit')).toBeEnabled();
  await expect(page.locator('#ply-count')).toHaveText('0 moves');
});
