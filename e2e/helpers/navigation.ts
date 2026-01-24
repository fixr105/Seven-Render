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
 * Click on a specific application in the list
 */
export async function clickApplication(page: Page, fileNumber: string) {
  const applicationLink = page.locator(`a:has-text("${fileNumber}"), [data-testid="application-${fileNumber}"]`).first();
  await applicationLink.click();
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('body', { state: 'visible' });
}

