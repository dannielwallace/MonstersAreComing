import { test, expect } from '@playwright/test';

test('game renders and runs', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'e2e-screenshot-1.png' });

  // Press B to enter build mode
  await page.keyboard.press('b');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e-screenshot-build.png' });

  // Wait for wave to start
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'e2e-screenshot-wave.png' });
});
