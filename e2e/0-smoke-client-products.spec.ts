import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Smoke - Client Loan Products', () => {
  test('Client can see and select loan products when available', async ({ page }) => {
    await loginAs(page, 'client');

    await page.goto('/applications/new');
    await expect(page.getByText('Application Details')).toBeVisible({ timeout: 15000 });

    // Use data-testid from NewApplication for stable selector; fallback to label-based for compatibility
    const loanProductSelect = page.getByTestId('loan-product-select').or(
      page.locator('label').filter({ hasText: /Loan Product/i }).locator('..').locator('select')
    ).first();

    await expect(loanProductSelect).toBeVisible({ timeout: 15000 });

    // Wait for products to load (options no longer show "Loading products...")
    await page.waitForFunction(
      () => {
        const select = document.querySelector('[data-testid="loan-product-select"]') as HTMLSelectElement | null
          ?? Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('Loan Product'))?.parentElement?.querySelector('select') as HTMLSelectElement | null;
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
      { timeout: 15000 }
    );

    await expect(loanProductSelect).toBeEnabled();

    const options = loanProductSelect.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    const productOptions = options.filter({ hasNotText: /^(Select|Choose|--|Loading|No products)/i });
    const productCount = await productOptions.count();
    expect(productCount).toBeGreaterThan(0);
  });

  test('Client sees appropriate message when no loan products are configured', async ({ page }) => {
    await loginAs(page, 'client');

    await page.goto('/applications/new');
    await expect(page.getByText('Application Details')).toBeVisible({ timeout: 15000 });

    const loanProductSelect = page.getByTestId('loan-product-select').or(
      page.locator('label').filter({ hasText: /Loan Product/i }).locator('..').locator('select')
    ).first();

    await expect(loanProductSelect).toBeVisible({ timeout: 15000 });

    const noProductsMessage = page.getByText(/No loan products are currently available|No loan products are configured for your account/i);

    await Promise.race([
      noProductsMessage.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
      page.waitForFunction(
        () => {
          const select = document.querySelector('[data-testid="loan-product-select"]') as HTMLSelectElement | null
            ?? Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('Loan Product'))?.parentElement?.querySelector('select') as HTMLSelectElement | null;
          if (!select) return false;
          const options = Array.from(select.querySelectorAll('option'));
          const hasOnlyPlaceholder =
            options.length <= 1 ||
            options.every(
              opt =>
                !opt.textContent ||
                opt.textContent.match(/^(Select|Choose|--|Loading|No products|No products available)/i) ||
                opt.value === ''
            );
          return select.disabled && hasOnlyPlaceholder;
        },
        { timeout: 15000 }
      ).catch(() => null)
    ]);

    const messageVisible = await noProductsMessage.isVisible().catch(() => false);
    const selectDisabled = await loanProductSelect.isDisabled().catch(() => false);
    expect(messageVisible || selectDisabled).toBeTruthy();
  });
});
