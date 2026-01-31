/**
 * E2E Test Helpers - Authentication
 * Provides utilities for logging in as different user roles
 */

import { Page } from '@playwright/test';

// Load test credentials from environment variables with fallback for backward compatibility
const getEnvVar = (key: string, fallback: string): string => {
  const value = process.env[key];
  if (!value && process.env.CI) {
    throw new Error(`Required environment variable ${key} is not set. Please set it in CI secrets or .env file.`);
  }
  return value || fallback;
};

export const TEST_USERS = {
  client: {
    email: getEnvVar('E2E_CLIENT_USERNAME', 'sagar@sevenfincorp.email'),
    password: getEnvVar('E2E_CLIENT_PASSWORD', 'pass@123'),
    role: 'client',
  },
  kam: {
    email: getEnvVar('E2E_KAM_USERNAME', 'sagar@sevenfincorp.email'),
    password: getEnvVar('E2E_KAM_PASSWORD', 'pass@123'),
    role: 'kam',
  },
  credit: {
    email: getEnvVar('E2E_CREDIT_USERNAME', 'sagar@sevenfincorp.email'),
    password: getEnvVar('E2E_CREDIT_PASSWORD', 'pass@123'),
    role: 'credit_team',
  },
  nbfc: {
    email: getEnvVar('E2E_NBFC_USERNAME', 'sagar@sevenfincorp.email'),
    password: getEnvVar('E2E_NBFC_PASSWORD', 'pass@123'),
    role: 'nbfc',
  },
};

/**
 * Login as a specific user role
 */
export async function loginAs(page: Page, user: keyof typeof TEST_USERS) {
  const credentials = TEST_USERS[user];

  // Capture JS errors to help diagnose blank page (e.g. React not mounting)
  page.on('pageerror', (err) => {
    console.error('[E2E pageerror]', err.message);
    if (err.stack) console.error(err.stack);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[E2E console]', msg.text());
  });

  // Navigate to login page and wait for app to be ready
  await page.goto('/login', { waitUntil: 'load', timeout: 60000 });

  // Wait for login form - prefer data-testid, fallback to placeholder
  const emailInput = page.getByTestId('login-username').or(page.getByPlaceholder(/enter your username|username/i)).first();
  await emailInput.waitFor({ state: 'visible', timeout: 45000 });

  const passwordInput = page.getByTestId('login-password').or(page.getByPlaceholder(/enter your passcode|passcode/i)).first();
  
  await emailInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  
  // Submit form
  const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
  await submitButton.click();
  
  // Wait for navigation to dashboard or applications page
  await page.waitForURL(/\/(dashboard|applications)/, { timeout: 15000 });
  // Ensure we're in the app (nav/sidebar exists); if we were redirected to /login, this will timeout
  await page.locator('nav').first().waitFor({ state: 'visible', timeout: 15000 });
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

