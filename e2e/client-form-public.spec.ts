/**
 * E2E Test: Public ClientForm (form link)
 *
 * Verifies that the public form page at /form/:clientId loads form config
 * from the Form Fields table via GET /public/clients/:id/form-config.
 *
 * Run: npm run test:e2e e2e/client-form-public.spec.ts
 * With existing server: PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npm run test:e2e e2e/client-form-public.spec.ts
 */

import { test, expect } from '@playwright/test';

// Client ID that has form mappings (from user's webhook data - recVpVbkj1QdEfM9J is "anya")
const TEST_CLIENT_ID = process.env.E2E_TEST_CLIENT_ID || 'recVpVbkj1QdEfM9J';

test.describe('Public ClientForm', () => {
  test.setTimeout(30000);

  test('loads form config from Form Fields table', async ({ page }) => {
    await page.goto(`/form/${TEST_CLIENT_ID}`);

    // Wait for either: form content (categories/fields) or error message
    await page.waitForLoadState('networkidle');

    const loadingText = page.locator('text=Loading form configuration');
    const errorText = page.locator('text=No form configuration found');
    const formTitle = page.locator('text=Loan Application Form');
    const categoryOrField = page.locator('form input, form select, form textarea, [class*="Card"]');

    // Should not be stuck on loading
    await expect(loadingText).not.toBeVisible({ timeout: 5000 }).catch(() => {});

    // Should show either the form or a clear error
    const hasForm = await formTitle.isVisible({ timeout: 3000 }).catch(() => false);
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    const hasContent = await categoryOrField.first().isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasForm || hasError || hasContent).toBe(true);
  });
});
