import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for production audit at lms.sevenfincorp.com
 * No local webServer; baseURL points to production.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e/audit-report' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://lms.sevenfincorp.com',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  timeout: 180000,
});
