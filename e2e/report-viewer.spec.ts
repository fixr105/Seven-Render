/**
 * E2E Tests: Report Viewer (NBFC AI Tools)
 *
 * Verifies the Report Viewer loads and displays correctly on the AI Tools page.
 * Covers: Report Viewer visibility, RAAD reports section, no raw DB error message.
 *
 * Requires: E2E_NBFC_USERNAME must be an account with NBFC role in the backend.
 * If the logged-in user lacks NBFC role, tests are skipped (Unauthorized page).
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

async function ensureNBFCToolsPage(page: import('@playwright/test').Page) {
  await loginAs(page, 'nbfc');
  await page.waitForLoadState('networkidle');

  await page.goto('/nbfc/tools');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const unauthorized = page.getByText('Unauthorized');
  if (await unauthorized.isVisible({ timeout: 2000 }).catch(() => false)) {
    test.skip(true, 'Logged-in user does not have NBFC role; need E2E_NBFC_USERNAME with nbfc role');
  }
}

test.describe('Report Viewer', () => {
  test.setTimeout(60000);

  test('Report Viewer loads when NBFC opens AI Tools page', async ({ page }) => {
    await ensureNBFCToolsPage(page);

    const reportViewer = page.getByTestId('report-viewer');
    await expect(reportViewer).toBeVisible({ timeout: 10000 });

    await expect(reportViewer.getByRole('heading', { name: 'Report Viewer' })).toBeVisible();
  });

  test('Report Viewer shows RAAD reports section when RAAD is selected', async ({ page }) => {
    await ensureNBFCToolsPage(page);

    const reportViewer = page.getByTestId('report-viewer');
    await expect(reportViewer).toBeVisible({ timeout: 10000 });

    // RAAD is selected by default; we should see one of:
    // - "RAAD Reports" header + loading/empty/list
    // - "Loading reports..."
    // - "No RAAD reports yet. Run a tool to see results here."
    // - Or report tiles
    const hasRaadSection =
      (await reportViewer.getByText('RAAD Reports').isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await reportViewer.getByText('Loading reports...').isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await reportViewer.getByText('No RAAD reports yet').isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await reportViewer.getByText('Run a tool to see results here').isVisible({ timeout: 5000 }).catch(() => false));

    expect(hasRaadSection).toBe(true);
  });

  test('Report Viewer does not show raw Database is not configured error', async ({ page }) => {
    await ensureNBFCToolsPage(page);

    const reportViewer = page.getByTestId('report-viewer');
    await expect(reportViewer).toBeVisible({ timeout: 10000 });

    // Wait for Report Viewer to settle (list may load)
    await page.waitForTimeout(2000);

    // We should NOT see the raw backend error (formatRaadError should transform it)
    const rawError = page.getByText('Database is not configured. Set DATABASE_URL in your environment.', { exact: false });
    await expect(rawError).not.toBeVisible();
  });

  test('Report Viewer refresh button is clickable when RAAD reports section is visible', async ({ page }) => {
    await ensureNBFCToolsPage(page);

    const reportViewer = page.getByTestId('report-viewer');
    await expect(reportViewer).toBeVisible({ timeout: 10000 });

    const refreshButton = reportViewer.locator('button[title="Refresh list"]');
    if (await refreshButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await refreshButton.click();
      await page.waitForTimeout(500);
      const stillVisible = await reportViewer.isVisible();
      expect(stillVisible).toBe(true);
    }
  });
});
