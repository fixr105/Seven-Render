/**
 * E2E Test: Form Load for anyaaa@gmail.com
 *
 * Verifies that when anyaaa@gmail.com logs in and selects a loan product on the
 * New Application page, the form configuration loads correctly (no "No form configuration loaded").
 *
 * Run: npm run test:e2e:anya-form
 * Or: E2E_CLIENT_USERNAME=anyaaa@gmail.com E2E_CLIENT_PASSWORD=pass@123 npm run test:e2e e2e/anya-form-load.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import { NewApplicationPage } from './pages/NewApplicationPage';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('Anya Form Load', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);
  });

  test('Form loads when loan product is selected and Load form is clicked', async ({ page }) => {
    const newAppPage = new NewApplicationPage(page);
    await newAppPage.goto();

    // Wait for loan product dropdown to populate
    await newAppPage.loanProductSelect.waitFor({ state: 'visible', timeout: 10000 });
    const optionCount = await newAppPage.loanProductSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(1);

    // Select Money Multiplier if present, otherwise first available product
    const hasMoneyMultiplier = await page.locator('select option:has-text("Money Multiplier")').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (hasMoneyMultiplier) {
      await newAppPage.selectProductAndWaitForForm('Money Multiplier');
    } else {
      await newAppPage.loanProductSelect.selectOption({ index: 1 });
      if (await newAppPage.loadFormButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newAppPage.loadFormButton.click();
      }
      await newAppPage.waitForFormCategoriesVisible(15000);
    }

    // Assert: no "No form configuration loaded" message
    const noConfigText = page.locator('text=No form configuration loaded');
    await expect(noConfigText).not.toBeVisible();

    // Assert: at least one form category visible
    await newAppPage.waitForFormCategoriesVisible(15000);
    const hasFormFields = (await page.locator('form input, form select, form textarea').count()) > 3;
    expect(hasFormFields).toBe(true);
  });
});
