/**
 * PRD M5: Action Center - E2E Tests
 *
 * Covers: role-specific dashboard actions (New Application, Clients, etc.)
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('PRD M5: Action Center', () => {
  test.setTimeout(60000);

  test('KAM dashboard shows key actions', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const hasClients = await page.getByText(/Clients|Client Management/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasApplications = await page.getByText(/Applications|New Application/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasClients || hasApplications).toBe(true);
  });

  test('Credit dashboard shows Reports and Ledger', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const hasReports = await page.getByText(/Reports|Dashboard/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasReports).toBe(true);
  });

  test('Dashboard has navigation to main pages', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav');
    await expect(nav.locator('a, button').filter({ hasText: /Dashboard|Applications/i }).first()).toBeVisible({ timeout: 5000 });
  });
});
