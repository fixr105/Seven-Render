import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Smoke - Auth + KAM Clients', () => {
  test('KAM can login and open Clients page', async ({ page }) => {
    await loginAs(page, 'kam');

    await page.goto('/clients');
    await expect(page.getByText('Client Management')).toBeVisible();
    await expect(page.getByText(/All Clients/i)).toBeVisible();
  });
});
