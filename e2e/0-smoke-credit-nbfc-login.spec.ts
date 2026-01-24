import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Smoke - Credit & NBFC Login', () => {
  test('Credit team can login without JSON parse error', async ({ page }) => {
    await loginAs(page, 'credit');
    await expect(page.getByText(/Unexpected end of JSON input/i)).not.toBeVisible();
  });

  test('NBFC can login without JSON parse error', async ({ page }) => {
    await loginAs(page, 'nbfc');
    await expect(page.getByText(/Unexpected end of JSON input/i)).not.toBeVisible();
  });
});
