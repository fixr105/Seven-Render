import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Smoke - Client Loan Products', () => {
  test('Client can see and select loan products when available', async ({ page }) => {
    await loginAs(page, 'client');

    await page.goto('/applications/new');
    await expect(page.getByText('Application Details')).toBeVisible();

    // Wait for the loan product select to be visible
    const loanProductSelect = page
      .locator('label:has-text("Loan Product")')
      .locator('..')
      .locator('select');

    await expect(loanProductSelect).toBeVisible({ timeout: 10000 });

    // Wait for products to load (browser-valid DOM: :has-text is Playwright-only)
    await page.waitForFunction(
      () => {
        const label = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('Loan Product'));
        const select = label?.parentElement?.querySelector('select');
        if (!select) return false;
        const options = Array.from(select.querySelectorAll('option'));
        const hasLoaded = options.some(opt => opt.textContent !== 'Loading products...');
        const hasProducts = options.some(opt =>
          opt.textContent &&
          !opt.textContent.match(/^(Select|Choose|--|Loading|No products)/i) &&
          opt.value !== ''
        );
        return hasLoaded && hasProducts;
      },
      { timeout: 10000 }
    );

    // Verify the select is enabled and has product options
    await expect(loanProductSelect).toBeEnabled();
    
    const options = loanProductSelect.locator('option');
    const optionCount = await options.count();
    
    // Should have at least 2 options: placeholder + at least one product
    expect(optionCount).toBeGreaterThan(1);
    
    // Verify at least one actual product option exists (not placeholder)
    const productOptions = options.filter({ hasNotText: /^(Select|Choose|--|Loading|No products)/i });
    const productCount = await productOptions.count();
    expect(productCount).toBeGreaterThan(0);
  });

  test('Client sees appropriate message when no loan products are configured', async ({ page }) => {
    await loginAs(page, 'client');

    await page.goto('/applications/new');
    await expect(page.getByText('Application Details')).toBeVisible();

    // Wait for the loan product select to be visible
    const loanProductSelect = page
      .locator('label:has-text("Loan Product")')
      .locator('..')
      .locator('select');

    await expect(loanProductSelect).toBeVisible({ timeout: 10000 });

    // Wait for products to load (or empty state)
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
      () => {
        const label = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('Loan Product'));
        const select = label?.parentElement?.querySelector('select');
        if (!select) return false;
        const options = Array.from(select.querySelectorAll('option'));
        const hasLoaded = options.some(opt => opt.textContent !== 'Loading products...');
        return hasLoaded;
      },
      { timeout: 10000 }
    );

    // If client has products configured, skip this test (it only applies when no products)
    const options = loanProductSelect.locator('option');
    const productOptions = options.filter({ hasNotText: /^(Select|Choose|--|Loading|No products)/i });
    const productCount = await productOptions.count();
    if (productCount > 0) {
      test.skip(true, 'Client has products configured; this test only asserts no-products state');
      return;
    }

    // Verify either the error message is visible OR the select is disabled
    const noProductsMessage = page.getByText(/No loan products are currently available|No loan products are configured for your account/i);
    const messageVisible = await noProductsMessage.isVisible().catch(() => false);
    const selectDisabled = await loanProductSelect.isDisabled().catch(() => false);

    expect(messageVisible || selectDisabled).toBeTruthy();
  });
});
