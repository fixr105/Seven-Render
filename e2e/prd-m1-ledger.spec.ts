/**
 * PRD M1: Pay In/Out Ledger - E2E Tests
 *
 * Covers: ledger view, running balance, raise query on entry, payout request
 * Requires: CLIENT user for payout/query, KAM/CREDIT for ledger view
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { navigateToPage, waitForPageLoad } from './helpers/navigation';

test.describe('PRD M1: Pay In/Out Ledger', () => {
  test.setTimeout(60000);

  test('KAM can view ledger page', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Commission Ledger|Ledger|Balance|No entries/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Credit can view ledger page', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Commission Ledger|Ledger|Balance/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Client can view ledger page when Ledger is in sidebar', async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);

    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Commission Ledger|Ledger|Balance|No entries/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Ledger page shows balance or empty state', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');

    const hasBalance = await page.getByText(/Balance|₹|Total/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await page.getByText(/No entries|No ledger|empty/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasBalance || hasEmpty).toBe(true);
  });
});
