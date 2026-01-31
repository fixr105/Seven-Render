import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Login Flow', () => {
  test('user can login and reach dashboard', async ({ page }) => {
    await loginAs(page, 'client');

    // Verify we landed on dashboard or applications
    await expect(page).toHaveURL(/\/(dashboard|applications)/);
    // Verify app shell (nav) is visible
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 15000 });
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load', timeout: 60000 });

    const emailInput = page.getByTestId('login-username').or(page.getByPlaceholder(/enter your/i)).first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });

    const passwordInput = page.getByTestId('login-password').or(page.getByPlaceholder(/password/i)).first();

    await emailInput.fill('invalid@example.com');
    await passwordInput.fill('wrongpassword');

    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
    await submitButton.click();

    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5000 });
  });
});
