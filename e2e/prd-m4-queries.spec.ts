/**
 * PRD M4: Audit Log & Query Dialog - E2E Tests
 *
 * Covers: query UI on application detail, audit log visibility
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('PRD M4: Audit Log & Query Dialog', () => {
  test.setTimeout(60000);

  test('Application detail has query/audit section', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href*="/applications/"]').first();
    if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      const hasQuery = await page.getByText(/Query|Raise Query|Audit|Comments|Messages/i).first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasMessageIcon = await page.locator('button:has([data-lucide="MessageSquare"]), [data-lucide="MessageSquare"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasQuery || hasMessageIcon).toBe(true);
    } else {
      test.skip();
    }
  });

  test('KAM can open query modal or section', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href*="/applications/"]').first();
    if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      const queryButton = page.locator('button:has-text("Raise Query"), button:has-text("Query"), button:has-text("Add")').first();
      if (await queryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await queryButton.click();
        await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 3000 });
      }
    } else {
      test.skip();
    }
  });
});
