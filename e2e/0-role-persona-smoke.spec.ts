/**
 * E2E Role-Persona Smoke Tests
 *
 * Logs in as each user role (client, KAM, credit_team, NBFC), verifies:
 * - Role-specific sidebar (visible and hidden items)
 * - Allowed and forbidden page access
 * - One key action per role
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('Role-persona smoke', () => {
  test.setTimeout(120000);

  test('Client: sidebar, page access, and New Application key action', async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);

    // Sidebar: navigate via sidebar to avoid full reload (keeps auth); wait for Applications page so sidebar reflects Applications layout
    const nav = page.getByTestId('sidebar-nav');
    await nav.getByRole('button', { name: 'Applications' }).click();
    await page.waitForURL(/\/applications/, { timeout: 10000 });
    await page.getByText(/Loan Applications|Applications|All Applications|Loading/i).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(nav.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await expect(nav.getByRole('button', { name: 'Applications' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Ledger' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Reports' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Clients' })).toHaveCount(0);

    // Allowed pages
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/unauthorized/);
    await expect(page.getByText(/Loan Applications|Applications|All Applications|Loading/i).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/applications/new');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page.getByText('Application Details')).toBeVisible();

    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page.getByText(/Commission Ledger|Ledger/i).first()).toBeVisible();

    // Forbidden: /clients, /form-configuration -> /unauthorized
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    await page.goto('/form-configuration');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    // Key action: New Application shows Application Details
    await page.goto('/applications/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Application Details')).toBeVisible();
  });

  test('KAM: sidebar, page access, and Clients key action', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    const nav = page.getByTestId('sidebar-nav');
    await nav.getByRole('button', { name: 'Applications' }).click();
    await page.waitForURL(/\/applications/, { timeout: 10000 });
    await page.getByText(/Loan Applications|Applications|All Applications|Loading/i).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(nav.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await expect(nav.getByRole('button', { name: 'Applications' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Clients' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Reports' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Ledger' })).toHaveCount(0);

    // Allowed pages
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page.getByText(/Client Management|All Clients/i).first()).toBeVisible();

    await page.goto('/form-configuration');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page.getByText(/Configure Client Forms|Select Client/i).first()).toBeVisible();

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);

    // Forbidden: /applications/new, /ledger -> /unauthorized
    await page.goto('/applications/new');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    // Key action: Clients shows Client Management or All Clients
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Client Management|All Clients/i).first()).toBeVisible();
  });

  test('Credit team: sidebar, page access, and Reports key action', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    const nav = page.getByTestId('sidebar-nav');
    await nav.getByRole('button', { name: 'Applications' }).click();
    await page.waitForURL(/\/applications/, { timeout: 10000 });
    await page.getByText(/Loan Applications|Applications|All Applications|Loading/i).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(nav.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await expect(nav.getByRole('button', { name: 'Applications' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Clients' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Ledger' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Reports' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Settings' })).toBeVisible();

    // Allowed pages (visit /ledger first while token is valid; it can trigger 403 on payout-requests for credit and clear token)
    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page.getByText(/Commission Ledger|Ledger|Ledger Entries|No ledger entries/i).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page.getByText(/Daily Summary Reports|Reports|Generate/i).first()).toBeVisible();

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);

    // Forbidden: /applications/new, /form-configuration -> /unauthorized
    await page.goto('/applications/new');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    await page.goto('/form-configuration');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    // Key action: Reports shows Daily Summary Reports or Generate (not only Access Restricted)
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Daily Summary Reports|Generate|Recent Reports/i).first()).toBeVisible();
  });

  test('NBFC: sidebar, page access, and Applications key action', async ({ page }) => {
    await loginAs(page, 'nbfc');
    await waitForPageLoad(page);

    const nav = page.getByTestId('sidebar-nav');
    await nav.getByRole('button', { name: 'Applications' }).click();
    await page.waitForURL(/\/applications/, { timeout: 10000 });
    await page.getByText(/Loan Applications|Applications|No applications|All Applications|Loading/i).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(nav.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await expect(nav.getByRole('button', { name: 'Applications' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Reports' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Clients' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Ledger' })).toHaveCount(0);

    // Allowed: /applications, /reports (Access Restricted in content), /dashboard
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page.getByText(/Loan Applications|Applications|No applications|All Applications/i).first()).toBeVisible();

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page.getByText('Access Restricted')).toBeVisible();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/unauthorized/);

    // Forbidden: /clients, /ledger, /form-configuration, /applications/new -> /unauthorized
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    await page.goto('/form-configuration');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    await page.goto('/applications/new');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    // Key action: Applications list or "No applications" (no crash)
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/Loan Applications|Applications|No applications|All Applications|Loading/i).first()
    ).toBeVisible();
  });
});
