/**
 * E2E Test Helpers - Navigation
 * Provides utilities for navigating between pages
 */

import { Page } from '@playwright/test';

/**
 * Navigate to a specific page by clicking sidebar item
 */
export async function navigateToPage(page: Page, pageName: string) {
  // Common page names: 'dashboard', 'applications', 'ledger', 'clients', 'new-application', 'form-configuration', 'reports', 'settings'
  const sidebarItem = page.locator(`[data-testid="sidebar-${pageName}"], a:has-text("${pageName}"), button:has-text("${pageName}")`).first();

  if (await sidebarItem.isVisible({ timeout: 2000 })) {
    await sidebarItem.click();
    await page.waitForLoadState('networkidle');
  } else {
    // Fallback: navigate directly via URL
    const pageMap: Record<string, string> = {
      'dashboard': '/dashboard',
      'applications': '/applications',
      'ledger': '/ledger',
      'clients': '/clients',
      'new-application': '/applications/new',
      'form-configuration': '/form-configuration',
      'reports': '/reports',
      'settings': '/settings',
    };

    const url = pageMap[pageName.toLowerCase()] || `/${pageName}`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Click on a specific application in the list (by file number or ID)
 */
export async function clickApplication(page: Page, fileNumber: string) {
  const applicationLink = page.locator(`a:has-text("${fileNumber}"), [data-testid="application-${fileNumber}"]`).first();
  await applicationLink.click();
  await page.waitForLoadState('networkidle');
}

/**
 * Open application by applicant name (clicks row or View button in Applications list)
 */
export async function openApplicationByApplicant(page: Page, applicantName: string): Promise<string | null> {
  await page.goto('/applications');
  await page.waitForLoadState('networkidle');
  const row = page.locator('tr').filter({ hasText: applicantName }).first();
  if (!(await row.isVisible({ timeout: 5000 }).catch(() => false))) {
    return null;
  }
  await row.click();
  await page.waitForLoadState('networkidle');
  const match = page.url().match(/\/applications\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('body', { state: 'visible' });
}

