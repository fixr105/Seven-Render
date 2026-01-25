/**
 * Role Selection Helper
 * Since authentication is bypassed, we use role selection buttons
 */

import { Page } from '@playwright/test';

export const ROLE_BUTTONS = {
  client: 'Test Client',
  kam: 'Test KAM',
  credit_team: 'Test Credit',
  nbfc: 'Test NBFC',
};

// Alternative selectors in case button text changes
export const ROLE_SELECTORS = {
  client: ['Test Client', 'Client (DSA Partner)', 'Sagar@gmail.com'],
  kam: ['Test KAM', 'Key Account Manager', 'Sagar@gmail.com'],
  credit_team: ['Test Credit', 'Credit Team', 'Sagar@gmail.com'],
  nbfc: ['Test NBFC', 'NBFC Partner', 'Sagar@gmail.com'],
};

/**
 * Select role on login page (bypasses authentication)
 */
export async function selectRole(page: Page, role: keyof typeof ROLE_BUTTONS) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // Wait for role buttons to be visible
  await page.waitForSelector('button:has-text("Test Client"), button:has-text("Test KAM"), button:has-text("Test Credit")', { timeout: 10000 });
  
  // Try multiple selectors to find the role button
  const selectors = ROLE_SELECTORS[role];
  let roleButton = null;
  
  for (const selector of selectors) {
    roleButton = page.locator(`button:has-text("${selector}")`).first();
    if (await roleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      break;
    }
  }
  
  if (!roleButton || !(await roleButton.isVisible({ timeout: 2000 }).catch(() => false))) {
    throw new Error(`Role button for ${role} not found`);
  }
  
  await roleButton.click();
  
  // Wait for navigation to dashboard
  await page.waitForURL(/\/(dashboard|applications)/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

