/**
 * E2E Test: Money Multiplier Form Load
 *
 * Verifies that when a client user selects the Money Multiplier product on the
 * New Application page, the product-specific form configuration loads correctly.
 *
 * Run against deployed site:
 *   PLAYWRIGHT_TEST_BASE_URL=https://your-deployed-url.vercel.app \
 *   E2E_CLIENT_USERNAME=user@linked-to-anya.com \
 *   E2E_CLIENT_PASSWORD=xxx \
 *   npm run test:e2e e2e/money-multiplier-form-load.spec.ts
 */

import { test, expect } from '@playwright/test';
import { NewApplicationPage } from './pages/NewApplicationPage';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('Money Multiplier Form Load', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);
  });

  test('Form loads when Money Multiplier product is selected', async ({ page }) => {
    const newAppPage = new NewApplicationPage(page);
    await newAppPage.goto();

    // Select Money Multiplier (by label - works for LP010/LP011 display name)
    await newAppPage.selectProductAndWaitForForm('Money Multiplier');

    // Verify form configuration loaded - at least one category with fields
    await newAppPage.waitForFormCategoriesVisible(15000);
    const hasFormFields = (await page.locator('form input, form select, form textarea').count()) > 3;
    expect(hasFormFields).toBe(true);
  });
});
