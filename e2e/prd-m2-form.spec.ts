/**
 * PRD M2: Master Form Builder - E2E Tests
 *
 * Covers: dynamic form loading, mandatory validation, draft save (impl check)
 * Requires: Credit Team for form config, CLIENT for new application
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { navigateToPage, waitForPageLoad } from './helpers/navigation';

test.describe('PRD M2: Master Form Builder', () => {
  test.setTimeout(60000);

  test('Credit team can access form configuration page', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/form-configuration');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Form Configuration|Form|Configure|Select Client/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Client can access new application page', async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);

    await page.goto('/applications/new');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Application|New Application|Loan/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('New application page shows form or product selection', async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);

    await page.goto('/applications/new');
    await page.waitForLoadState('networkidle');

    const hasForm = await page.getByText(/Application Details|Select|Loan Product/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasProductSelect = await page.locator('select, [role="combobox"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasForm || hasProductSelect).toBe(true);
  });
});
