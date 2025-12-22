/**
 * E2E Test Helpers - Authentication
 * Provides utilities for logging in as different user roles
 */

import { Page } from '@playwright/test';

export const TEST_USERS = {
  client: {
    email: 'client@test.com',
    password: 'Test@123456',
    role: 'client',
  },
  kam: {
    email: 'kam@test.com',
    password: 'Test@123456',
    role: 'kam',
  },
  credit: {
    email: 'credit@test.com',
    password: 'Test@123456',
    role: 'credit_team',
  },
  nbfc: {
    email: 'nbfc@test.com',
    password: 'Test@123456',
    role: 'nbfc',
  },
};

/**
 * Login as a specific user role
 */
export async function loginAs(page: Page, user: keyof typeof TEST_USERS) {
  const credentials = TEST_USERS[user];
  
  // Navigate to login page
  await page.goto('/login');
  
  // Wait for login form
  await page.waitForSelector('input[type="email"], input[name="email"]');
  
  // Fill in credentials
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  
  await emailInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  
  // Submit form
  const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
  await submitButton.click();
  
  // Wait for navigation to dashboard or applications page
  await page.waitForURL(/\/(dashboard|applications)/, { timeout: 10000 });
  
  // Verify we're logged in (check for user-specific content)
  await page.waitForLoadState('networkidle');
}

/**
 * Logout from the application
 */
export async function logout(page: Page) {
  // Look for logout button (usually in header or sidebar)
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"]').first();
  
  if (await logoutButton.isVisible({ timeout: 2000 })) {
    await logoutButton.click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
  }
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(page: Page, urlPattern: string | RegExp, timeout = 10000) {
  return page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

