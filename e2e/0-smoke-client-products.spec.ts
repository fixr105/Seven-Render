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

    // Wait for products to load (check for either loading state or loaded state)
    await page.waitForFunction(
      () => {
        const select = document.querySelector('label:has-text("Loan Product")')?.parentElement?.querySelector('select');
        if (!select) return false;
        const options = Array.from(select.querySelectorAll('option'));
        // Check if we're past the loading state (not "Loading products...")
        const hasLoaded = options.some(opt => opt.textContent !== 'Loading products...');
        // Check if we have actual product options (more than just placeholder)
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

    // Wait for the empty state to be determined (either error message or disabled select)
    // Check for error message or helper text indicating no products
    const noProductsMessage = page.getByText(/No loan products are currently available|No loan products are configured for your account/i);
    
    // Wait for either the message to appear OR the select to be disabled with no options
    await Promise.race([
      noProductsMessage.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
      page.waitForFunction(
        () => {
          const select = document.querySelector('label:has-text("Loan Product")')?.parentElement?.querySelector('select') as HTMLSelectElement;
          if (!select) return false;
          const options = Array.from(select.querySelectorAll('option'));
          // Check if select is disabled and only has placeholder/no product options
          const hasOnlyPlaceholder = options.length <= 1 || 
            options.every(opt => 
              !opt.textContent || 
              opt.textContent.match(/^(Select|Choose|--|Loading|No products|No products available)/i) ||
              opt.value === ''
            );
          return select.disabled && hasOnlyPlaceholder;
        },
        { timeout: 10000 }
      ).catch(() => null)
    ]);

    // Verify either the error message is visible OR the select is disabled
    const messageVisible = await noProductsMessage.isVisible().catch(() => false);
    const selectDisabled = await loanProductSelect.isDisabled().catch(() => false);
    
    expect(messageVisible || selectDisabled).toBeTruthy();
  });
});
