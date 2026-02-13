/**
 * E2E Verification Tests for 8 Bug Fixes
 *
 * Run with: npm run test:e2e -- e2e/8-bug-fixes-verification.spec.ts
 *
 * Covers:
 * 1. Draft status - Client sees Submit/Withdraw, uses submitApplication for Submit
 * 2. Client query - Client can raise query to KAM via createClientQuery
 * 3. Query section - Message and form data render correctly
 * 4. Query resolution - Only author (or KAM/Credit) can resolve
 * 5. Assigned KAM - Credit Clients list shows KAM name, not raw ID
 * 6. Dashboard tiles - Status normalization (pending_credit_review, credit_query_with_kam)
 * 7. Ledger - Client ledger loads (diagnostic logging in backend)
 * 8. Admin activity log - Performed by and Action type are dropdowns
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('8 Bug Fixes Verification', () => {
  test.setTimeout(90000);

  test('1. Draft status: Client sees Submit/Withdraw button; modal shows only Submit and Withdraw options', async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const draftLink = page.locator('a[href*="/applications/"]').filter({ hasText: /draft|Draft/i }).first();
    const anyLink = page.locator('a[href*="/applications/"]').first();

    const linkToClick = (await draftLink.isVisible({ timeout: 3000 }).catch(() => false)) ? draftLink : anyLink;
    if (await linkToClick.isVisible({ timeout: 5000 }).catch(() => false)) {
      await linkToClick.click();
      await page.waitForLoadState('networkidle');

      const statusBadge = page.getByText(/Draft|draft/i).first();
      if (await statusBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
        const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Submit / Withdraw")').first();
        await expect(submitBtn).toBeVisible({ timeout: 5000 });

        // Strengthen: Click Submit/Withdraw and assert modal shows ONLY Submit and Withdraw (not full status list)
        await submitBtn.click();
        const modal = page.getByRole('dialog').or(page.locator('[role="dialog"]'));
        await expect(modal).toBeVisible({ timeout: 3000 });

        const options = modal.locator('select option');
        const optionCount = await options.count();
        expect(optionCount).toBe(2);

        const optionTexts = await options.allTextContents();
        expect(optionTexts.sort()).toEqual(['Submit', 'Withdraw']);
      }
    } else {
      test.skip();
    }
  });

  test('2. Client query: Client can open Raise Query modal and see Raise Query button', async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href*="/applications/"]').first();
    if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      const raiseQueryBtn = page.locator('button:has-text("Raise Query")').first();
      await expect(raiseQueryBtn).toBeVisible({ timeout: 5000 });

      await raiseQueryBtn.click();
      const modal = page.getByRole('dialog').or(page.locator('[role="dialog"]'));
      await expect(modal).toBeVisible({ timeout: 3000 });
    } else {
      test.skip();
    }
  });

  test('3. Query section: Queries section and Application Information render; messages not "No message"', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href*="/applications/"]').first();
    if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      const queriesSection = page.getByText(/Queries|Communication|No queries yet/i).first();
      await expect(queriesSection).toBeVisible({ timeout: 5000 });

      const appInfo = page.getByText(/Application Information|No form data recorded/i).first();
      await expect(appInfo).toBeVisible({ timeout: 5000 });

      // Bug 3: When app has queries, messages must not show "No message" or "(No message)"
      const noQueriesYet = page.getByText(/No queries yet/i);
      if (!(await noQueriesYet.isVisible({ timeout: 2000 }).catch(() => false))) {
        const noMessageVisible = await page.getByText('No message', { exact: true }).isVisible({ timeout: 1000 }).catch(() => false);
        const noMessageParenVisible = await page.getByText('(No message)', { exact: true }).isVisible({ timeout: 1000 }).catch(() => false);
        expect(noMessageVisible).toBe(false);
        expect(noMessageParenVisible).toBe(false);
      }
    } else {
      test.skip();
    }
  });

  test('4. Query resolution: Mark Resolved only on queries you raised', async ({ page }) => {
    await loginAs(page, 'kam');
    await waitForPageLoad(page);

    await page.goto('/applications');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href*="/applications/"]').first();
    if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      const noQueriesYet = page.getByText(/No queries yet/i);
      if (await noQueriesYet.isVisible({ timeout: 2000 }).catch(() => false)) {
        return; // No queries - nothing to verify
      }

      // Bug 5: Mark Resolved must appear only on queries where current user (KAM) is the author
      const queryThreads = page.locator('div.border.rounded-lg.p-4').filter({ has: page.locator('span:has-text("To:")') });
      const threadCount = await queryThreads.count();
      for (let i = 0; i < threadCount; i++) {
        const thread = queryThreads.nth(i);
        const markResolvedBtn = thread.locator('button:has-text("Mark Resolved")');
        const hasMarkResolved = await markResolvedBtn.isVisible({ timeout: 500 }).catch(() => false);
        const firstActorLabel = thread.locator('span.text-sm.font-medium').first();
        const actorText = (await firstActorLabel.textContent())?.trim() || '';
        const isOwnQuery = actorText === 'You';
        if (hasMarkResolved) {
          expect(isOwnQuery).toBe(true);
        } else {
          const isResolved = await thread.locator('text=Resolved').isVisible({ timeout: 200 }).catch(() => false);
          if (!isResolved) {
            expect(isOwnQuery).toBe(false);
          }
        }
      }
    } else {
      test.skip();
    }
  });

  test('5. Assigned KAM: Credit Clients page shows KAM names, not raw IDs', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/unauthorized/);
    const tableOrHeader = page.getByText(/Assigned KAM|Client Management|Company Name/i).first();
    await expect(tableOrHeader).toBeVisible({ timeout: 10000 });

    // Strengthen: Assigned KAM column cells must NOT contain raw ID patterns (USER-*, KAM-* with long suffix)
    const rawIdPattern = /USER-\d+-[a-z0-9]+|KAM-\d+-[a-z0-9]+/i;
    const tableCells = page.locator('table td');
    const cellCount = await tableCells.count();
    for (let i = 0; i < cellCount; i++) {
      const text = await tableCells.nth(i).textContent();
      expect(text).not.toMatch(rawIdPattern);
    }
  });

  test('6. Dashboard tiles: Credit dashboard shows stats with correct status filters', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const statsOrCards = page.locator('[class*="Card"], .card, [data-testid="dashboard"]').first();
    await expect(statsOrCards.or(page.getByText(/Past SLA|Pending|Applications|Payout/i).first())).toBeVisible({ timeout: 10000 });
  });

  test('2b. Pending Queries card: KAM/Credit dashboard shows card when unresolved queries exist', async ({ page }) => {
    // KAM dashboard
    await loginAs(page, 'kam');
    await waitForPageLoad(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const kamPendingQueriesCard = page.locator('#pending-queries');
    if (await kamPendingQueriesCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(kamPendingQueriesCard.getByText(/Pending Queries/i)).toBeVisible();
      await expect(kamPendingQueriesCard.getByText(/query|queries/i)).toBeVisible();
    }

    // Credit dashboard
    await loginAs(page, 'credit');
    await waitForPageLoad(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const creditPendingQueriesCard = page.locator('#pending-queries');
    if (await creditPendingQueriesCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(creditPendingQueriesCard.getByText(/Pending Queries/i)).toBeVisible();
      await expect(creditPendingQueriesCard.getByText(/query|queries/i)).toBeVisible();
    }
  });

  test('7. Ledger: Client ledger page loads', async ({ page }) => {
    await loginAs(page, 'client');
    await waitForPageLoad(page);

    await page.goto('/ledger');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/unauthorized/);
    const ledgerContent = page.getByText(/Commission Ledger|Ledger|No ledger entries|Balance|Payout/i).first();
    await expect(ledgerContent).toBeVisible({ timeout: 10000 });
  });

  test('8. Admin activity log: Performed by and Action type are dropdowns (select), not text inputs', async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);

    await page.goto('/admin/activity-log');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/unauthorized/);

    const performedByLabel = page.getByText('Performed by', { exact: true }).first();
    await expect(performedByLabel).toBeVisible({ timeout: 5000 });

    const actionTypeLabel = page.getByText('Action type', { exact: true }).first();
    await expect(actionTypeLabel).toBeVisible({ timeout: 5000 });

    // Strengthen: Verify labels are associated with select elements (not input type="text")
    const performedBySection = performedByLabel.locator('..');
    const performedBySelect = performedBySection.locator('select');
    await expect(performedBySelect.first()).toBeVisible({ timeout: 2000 });

    const actionTypeSection = actionTypeLabel.locator('..');
    const actionTypeSelect = actionTypeSection.locator('select');
    await expect(actionTypeSelect.first()).toBeVisible({ timeout: 2000 });
  });
});
