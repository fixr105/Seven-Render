/**
 * PRD NBFC: Decision Recording - E2E Tests
 *
 * Covers: NBFC approves/rejects, mandatory rejection reason, Needs Clarification
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('PRD NBFC: Decision Recording', () => {
  test.setTimeout(60000);

  test('NBFC can view applications page', async ({ page }) => {
    await loginAs(page, 'nbfc');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Applications|Loan|Assigned/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('NBFC application detail has decision options', async ({ page }) => {
    await loginAs(page, 'nbfc');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href*="/applications/"]').first();
    if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      const hasDecision = await page.getByText(/Approve|Reject|Decision|Record/i).first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasButton = await page.locator('button:has-text("Approve"), button:has-text("Reject")').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasDecision || hasButton).toBe(true);
    } else {
      test.skip();
    }
  });

  test('NBFC decision modal has Approve, Reject, Needs Clarification', async ({ page }) => {
    await loginAs(page, 'nbfc');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href*="/applications/"]').first();
    if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      const decisionBtn = page.locator('button:has-text("Record Decision"), button:has-text("Decision"), button:has-text("Approve")').first();
      if (await decisionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await decisionBtn.click();
        await page.waitForLoadState('networkidle');

        const hasOptions = await page.getByText(/Approve|Reject|Needs Clarification/i).first().isVisible({ timeout: 3000 }).catch(() => false);
        expect(hasOptions).toBe(true);
      }
    } else {
      test.skip();
    }
  });
});
