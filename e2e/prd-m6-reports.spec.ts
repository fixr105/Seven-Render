/**
 * PRD M6: Daily Summary Reports - E2E Tests
 *
 * Covers: Reports page access, daily summary list/view
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('PRD M6: Daily Summary Reports', () => {
  test.setTimeout(60000);

  test('Credit can access Reports page', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Reports|Daily Summary|Summary/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Reports page shows content or empty state', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    const hasContent = await page.getByText(/Report|Summary|Generate|No reports/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('KAM can access Reports page', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Reports|Daily|Summary/i).first()).toBeVisible({ timeout: 10000 });
  });
});
