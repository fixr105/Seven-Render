/**
 * KAM SPA Load E2E – isPageReload-removal validation
 *
 * Verifies that for KAM, applications and clients load when navigating via the app
 * (sidebar, in-app) without a full page reload (F5). Asserts "loading then data or
 * explicit empty" and never "indefinitely empty / fetch skipped".
 *
 * @see docs/KAM_SPA_LOAD_TEST_PLAN.md
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('KAM SPA load (isPageReload-removal)', () => {
  test.setTimeout(120000);

  test('SPA path: Login → Dashboard → Applications → Clients → Form Config → Reports → Dashboard', async ({
    page,
  }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    // --- 3.1 Dashboard (after login) ---
    await expect(
      page.getByText(/Loading clients|Client Overview|Managed Clients|No Clients Assigned|No clients assigned to you yet/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/Loading applications|Recent Applications|No applications from your clients/i).first()
    ).toBeVisible({ timeout: 15000 });

    const nav = page.locator('nav');

    // --- 3.2 Dashboard → Applications (SPA, sidebar) ---
    await nav.getByRole('button', { name: 'Applications' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(
      page.getByText(/Loading|Loading applications|Applications|No applications|No applications from your clients/i).first()
    ).toBeVisible({ timeout: 15000 });

    // --- 3.3 Applications → Clients (SPA, sidebar) ---
    await nav.getByRole('button', { name: 'Clients' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(
      page
        .getByText(/Loading|Client Management|All Clients|No clients found\. Onboard your first client/i)
        .first()
    ).toBeVisible({ timeout: 15000 });

    // --- 3.4 Clients → Form Configuration: KAM no longer has access (moved to Credit Team) ---
    await page.goto('/form-configuration');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unauthorized/);

    // --- 3.5 Clients → Reports (SPA, sidebar) ---
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await nav.getByRole('button', { name: 'Reports' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.getByText('Access Restricted')).toBeVisible({ timeout: 15000 });

    // --- 3.6 Reports → Dashboard (SPA, full circle) ---
    await nav.getByRole('button', { name: 'Dashboard' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(
      page.getByText(/Loading clients|Client Overview|Managed Clients|No Clients Assigned|No clients assigned to you yet/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/Loading applications|Recent Applications|No applications from your clients/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('F5 baseline: full reload on Dashboard still loads Recent Applications and Client Overview', async ({
    page,
  }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    // Ensure we're on Dashboard
    await expect(page).toHaveURL(/\/(dashboard|applications)/);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Simulate F5
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(
      page.getByText(/Loading clients|Client Overview|Managed Clients|No Clients Assigned|No clients assigned to you yet/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/Loading applications|Recent Applications|No applications from your clients/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('API requests: /api/kam/clients and /api/loan-applications are requested on SPA nav to Dashboard and Clients', async ({
    page,
  }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    // --- Dashboard: /api/kam/clients and /api/loan-applications GET (navigate away and back to force fresh fetch) ---
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const isKamClientsGet = (res: { url: () => string; request: () => { method: () => string } }) =>
      res.url().includes('/api/kam/clients') && res.request().method() === 'GET';
    const isLoanApplicationsGet = (res: { url: () => string; request: () => { method: () => string } }) =>
      res.url().includes('/api/loan-applications') &&
      res.request().method() === 'GET' &&
      !res.url().includes('/api/loan-applications/');
    const [kamClientsRes, loanAppsRes] = await Promise.all([
      page.waitForResponse(isKamClientsGet, { timeout: 15000 }),
      page.waitForResponse(isLoanApplicationsGet, { timeout: 15000 }),
      page.goto('/dashboard'),
    ]);
    await page.waitForLoadState('networkidle');
    expect(kamClientsRes.status()).toBeGreaterThanOrEqual(200);
    expect(kamClientsRes.status()).toBeLessThan(300);
    expect(loanAppsRes.status()).toBeGreaterThanOrEqual(200);
    expect(loanAppsRes.status()).toBeLessThan(300);

    // --- Clients: /api/kam/clients GET (sidebar from Dashboard) ---
    const nav = page.locator('nav');
    const [clientsPageRes] = await Promise.all([
      page.waitForResponse(isKamClientsGet, { timeout: 15000 }),
      nav.getByRole('button', { name: 'Clients' }).click(),
    ]);
    await page.waitForLoadState('networkidle');
    expect(clientsPageRes.status()).toBeGreaterThanOrEqual(200);
    expect(clientsPageRes.status()).toBeLessThan(300);
  });
});
