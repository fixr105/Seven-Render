/**
 * Mobile viewport smoke tests — layout overflow and core navigation.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe('Mobile smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'client');
  });

  test('dashboard has no horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const maybeLater = page.getByRole('button', { name: /maybe later/i });
    if (await maybeLater.isVisible({ timeout: 3000 }).catch(() => false)) {
      await maybeLater.click();
    }
    await assertNoHorizontalOverflow(page);
  });

  test('applications has no horizontal overflow', async ({ page }) => {
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');
    const maybeLater = page.getByRole('button', { name: /maybe later/i });
    if (await maybeLater.isVisible({ timeout: 3000 }).catch(() => false)) {
      await maybeLater.click();
    }
    await assertNoHorizontalOverflow(page);
  });

  test('hamburger menu opens sidebar on mobile', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const maybeLater = page.getByRole('button', { name: /maybe later/i });
    if (await maybeLater.isVisible({ timeout: 3000 }).catch(() => false)) {
      await maybeLater.click();
    }

    const menuButton = page.getByRole('button', { name: /toggle menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    await expect(page.getByTestId('sidebar-nav')).toBeVisible();
    await expect(page.getByRole('button', { name: /close menu/i })).toBeVisible();
  });
});
