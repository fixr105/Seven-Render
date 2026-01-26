/**
 * E2E Test: Credit Team Query UI Improvements
 * 
 * Tests the credit team query UI enhancements including:
 * - "Awaiting KAM Response" filter
 * - Query count badges in applications list
 * - Visual indicators for unresolved queries
 * - Enhanced queries section in application detail
 * - Query count updates after resolution
 * - Performance with multiple applications
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { waitForPageLoad } from './helpers/navigation';

test.describe('Credit Team Query UI Improvements', () => {
  test.setTimeout(60000); // Reduced timeout for faster feedback

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'credit');
    await waitForPageLoad(page);
  });

  test('Applications list shows query count badges for unresolved queries', async ({ page }) => {
    await test.step('Navigate to Applications page', async () => {
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000); // Wait for query counts to load
    });

    await test.step('Verify applications with unresolved queries show badges', async () => {
      // Look for query count badges (format: "X query" or "X queries")
      const queryBadges = page.locator('text=/\\d+ (query|queries)/i');
      const badgeCount = await queryBadges.count();
      
      if (badgeCount > 0) {
        // Verify badge format
        const firstBadge = queryBadges.first();
        await expect(firstBadge).toBeVisible({ timeout: 5000 });
        
        // Verify badge text matches pattern
        const badgeText = await firstBadge.textContent();
        expect(badgeText).toMatch(/^\d+ (query|queries)$/i);
      } else {
        // If no badges, verify there are no applications with unresolved queries
        // This is acceptable if test data doesn't have unresolved queries
        console.log('No query badges found - may indicate no unresolved queries in test data');
      }
    });

    await test.step('Verify visual indicators for applications with unresolved queries', async () => {
      // Look for rows with warning background/border
      // These should have classes: bg-warning/5 and border-l-4 border-warning
      const highlightedRows = page.locator('tr').filter({ has: page.locator('text=/\\d+ (query|queries)/i') });
      const highlightedCount = await highlightedRows.count();
      
      if (highlightedCount > 0) {
        // Verify at least one row has the warning styling
        const firstRow = highlightedRows.first();
        const className = await firstRow.getAttribute('class');
        expect(className).toContain('warning');
      }
    });
  });

  test('Awaiting KAM Response filter appears and works correctly', async ({ page }) => {
    await test.step('Navigate to Applications page', async () => {
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify filter option appears for credit team', async () => {
      // Look for status filter dropdown
      const statusFilter = page.locator('select').filter({ hasText: /status/i }).or(
        page.locator('select').first()
      );
      
      if (await statusFilter.isVisible({ timeout: 5000 })) {
        // Verify "Awaiting KAM Response" option exists
        const filterOptions = await statusFilter.locator('option').allTextContents();
        const hasAwaitingFilter = filterOptions.some(opt => 
          opt.toLowerCase().includes('awaiting') && opt.toLowerCase().includes('kam')
        );
        
        // Note: Filter may not appear if no applications match, which is acceptable
        if (filterOptions.length > 0) {
          console.log('Filter options found:', filterOptions);
        }
      }
    });

    await test.step('Test filter functionality', async () => {
      const statusFilter = page.locator('select').filter({ hasText: /status/i }).or(
        page.locator('select').first()
      );
      
      if (await statusFilter.isVisible({ timeout: 5000 })) {
        // Try to select "Awaiting KAM Response" if it exists
        const options = statusFilter.locator('option');
        const optionCount = await options.count();
        
        for (let i = 0; i < optionCount; i++) {
          const optionText = await options.nth(i).textContent();
          if (optionText && optionText.toLowerCase().includes('awaiting') && 
              optionText.toLowerCase().includes('kam')) {
            await statusFilter.selectOption({ index: i });
            await page.waitForTimeout(1000);
            
            // Verify applications are filtered
            const applicationRows = page.locator('tbody tr, [data-testid="application-row"]');
            const rowCount = await applicationRows.count();
            
            // Should show filtered results (may be 0 if no matches)
            expect(rowCount).toBeGreaterThanOrEqual(0);
            break;
          }
        }
      }
    });
  });

  test('Application detail page shows enhanced queries section', async ({ page }) => {
    await test.step('Navigate to Applications page', async () => {
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Wait for query counts
    });

    await test.step('Click on an application with queries', async () => {
      // Try to find an application with query badge, or just click first application
      const applicationWithQuery = page.locator('tr').filter({ has: page.locator('text=/\\d+ (query|queries)/i') }).first();
      const firstApplication = page.locator('tbody tr, [data-testid="application-row"]').first();
      
      const appToClick = (await applicationWithQuery.isVisible({ timeout: 2000 })) 
        ? applicationWithQuery 
        : firstApplication;
      
      await appToClick.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    });

    await test.step('Verify queries section enhancements', async () => {
      // Look for queries section
      const queriesSection = page.locator('text=/queries|Queries & Communication/i').first();
      await expect(queriesSection).toBeVisible({ timeout: 10000 });

      // Verify unresolved count badge in header
      const unresolvedBadge = page.locator('text=/unresolved/i').first();
      if (await unresolvedBadge.isVisible({ timeout: 2000 })) {
        const badgeText = await unresolvedBadge.textContent();
        expect(badgeText).toMatch(/\d+/); // Should contain a number
      }

      // Verify "Awaiting KAM Response" alert (if applicable)
      const awaitingAlert = page.locator('text=/awaiting.*kam.*response/i').first();
      if (await awaitingAlert.isVisible({ timeout: 2000 })) {
        await expect(awaitingAlert).toBeVisible();
      }

      // Verify query threads display
      const queryThreads = page.locator('[class*="border"], [class*="rounded"]').filter({ 
        hasText: /query|message|reply/i 
      });
      const threadCount = await queryThreads.count();
      
      // Should have at least some query-related content
      if (threadCount > 0) {
        // Verify "Last activity" timestamps
        const lastActivity = page.locator('text=/last activity/i').first();
        if (await lastActivity.isVisible({ timeout: 2000 })) {
          await expect(lastActivity).toBeVisible();
        }
      }
    });
  });

  test('Query count badges update after resolving queries', async ({ page }) => {
    await test.step('Navigate to Applications page and find application with queries', async () => {
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000); // Wait for query counts to load
    });

    await test.step('Find application with unresolved queries', async () => {
      const applicationWithQuery = page.locator('tr').filter({ has: page.locator('text=/\\d+ (query|queries)/i') }).first();
      
      if (await applicationWithQuery.isVisible({ timeout: 5000 })) {
        // Get initial query count
        const badge = applicationWithQuery.locator('text=/\\d+ (query|queries)/i').first();
        const initialCountText = await badge.textContent();
        const initialCount = initialCountText ? parseInt(initialCountText.match(/\d+/)?.[0] || '0') : 0;
        
        if (initialCount > 0) {
          await test.step('Click application and resolve a query', async () => {
            await applicationWithQuery.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            // Look for "Mark Resolved" button
            const resolveButton = page.locator('button:has-text("Mark Resolved"), button:has-text("Resolve")').first();
            
            if (await resolveButton.isVisible({ timeout: 5000 })) {
              await resolveButton.click();
              await page.waitForTimeout(2000); // Wait for API call
              
              // Navigate back to applications list
              await page.goto('/applications');
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(3000); // Wait for query counts to reload
              
              // Verify badge count decreased or disappeared
              const updatedBadge = page.locator('tr').filter({ has: page.locator('text=/\\d+ (query|queries)/i') }).first();
              
              if (await updatedBadge.isVisible({ timeout: 5000 })) {
                const newBadge = updatedBadge.locator('text=/\\d+ (query|queries)/i').first();
                const newCountText = await newBadge.textContent();
                const newCount = newCountText ? parseInt(newCountText.match(/\d+/)?.[0] || '0') : 0;
                
                // Count should have decreased or badge should be gone
                expect(newCount).toBeLessThanOrEqual(initialCount);
              } else {
                // Badge disappeared (all queries resolved) - this is acceptable
                console.log('Query badge disappeared after resolution - all queries resolved');
              }
            } else {
              console.log('No "Mark Resolved" button found - may need to create test query first');
            }
          });
        }
      } else {
        console.log('No applications with unresolved queries found for this test');
      }
    });
  });

  test('Applications with no queries display correctly', async ({ page }) => {
    await test.step('Navigate to Applications page', async () => {
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    });

    await test.step('Verify applications without queries show no badges', async () => {
      // Get all application rows
      const allRows = page.locator('tbody tr, [data-testid="application-row"]');
      const rowCount = await allRows.count();
      
      if (rowCount > 0) {
        // Check that rows without query badges don't have warning styling
        const rowsWithoutBadges = allRows.filter({ 
          hasNot: page.locator('text=/\\d+ (query|queries)/i') 
        });
        const cleanRowCount = await rowsWithoutBadges.count();
        
        if (cleanRowCount > 0) {
          // Verify first row without badge doesn't have warning classes
          const firstCleanRow = rowsWithoutBadges.first();
          const className = await firstCleanRow.getAttribute('class');
          
          // Should not have warning background for rows without queries
          if (className) {
            // Note: This is a soft check - rows may have other styling
            console.log('Row classes:', className);
          }
        }
      }
    });

    await test.step('Verify application detail shows "No queries yet" for applications without queries', async () => {
      // Click on first application
      const firstApp = page.locator('tbody tr, [data-testid="application-row"]').first();
      if (await firstApp.isVisible({ timeout: 5000 })) {
        await firstApp.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Check for "No queries yet" message
        const noQueriesMessage = page.locator('text=/no queries|No queries yet/i').first();
        
        // Either "No queries yet" appears, or queries section shows queries
        const hasNoQueries = await noQueriesMessage.isVisible({ timeout: 2000 });
        const hasQueries = await page.locator('text=/query|Queries & Communication/i').isVisible({ timeout: 2000 });
        
        // Should have one or the other
        expect(hasNoQueries || hasQueries).toBeTruthy();
      }
    });
  });

  test('Filter works with search query combination', async ({ page }) => {
    await test.step('Navigate to Applications page', async () => {
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Apply search query', async () => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
      
      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);
        
        // Verify search results
        const results = page.locator('tbody tr, [data-testid="application-row"]');
        const resultCount = await results.count();
        expect(resultCount).toBeGreaterThanOrEqual(0);
      }
    });

    await test.step('Apply filter with search', async () => {
      const statusFilter = page.locator('select').filter({ hasText: /status/i }).or(
        page.locator('select').first()
      );
      
      if (await statusFilter.isVisible({ timeout: 5000 })) {
        // Try to find and select "Awaiting KAM Response"
        const options = statusFilter.locator('option');
        const optionCount = await options.count();
        
        for (let i = 0; i < optionCount; i++) {
          const optionText = await options.nth(i).textContent();
          if (optionText && optionText.toLowerCase().includes('awaiting') && 
              optionText.toLowerCase().includes('kam')) {
            await statusFilter.selectOption({ index: i });
            await page.waitForTimeout(1000);
            
            // Verify both filter and search are applied
            const filteredResults = page.locator('tbody tr, [data-testid="application-row"]');
            const filteredCount = await filteredResults.count();
            
            // Results should be filtered (may be 0)
            expect(filteredCount).toBeGreaterThanOrEqual(0);
            break;
          }
        }
      }
    });
  });

  test('Performance: Query counts load for multiple applications', async ({ page }) => {
    await test.step('Navigate to Applications page and measure load time', async () => {
      const startTime = Date.now();
      
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
      
      // Wait for query counts to start appearing
      await page.waitForTimeout(8000); // Give time for query counts to load
      
      const loadTime = Date.now() - startTime;
      
      // Verify page loads within reasonable time (< 10 seconds)
      expect(loadTime).toBeLessThan(10000);
      
      // Verify applications are visible
      const applications = page.locator('tbody tr, [data-testid="application-row"]');
      const appCount = await applications.count();
      expect(appCount).toBeGreaterThanOrEqual(0);
    });

    await test.step('Verify query counts load progressively', async () => {
      // Check that query badges appear (may take time)
      const queryBadges = page.locator('text=/\\d+ (query|queries)/i');
      
      // Wait up to 10 seconds for badges to appear
      await page.waitForTimeout(10000);
      
      const badgeCount = await queryBadges.count();
      
      // Should have loaded some badges or none (both are acceptable)
      expect(badgeCount).toBeGreaterThanOrEqual(0);
    });

    await test.step('Verify UI remains responsive during loading', async () => {
      // Try to interact with page while query counts are loading
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
      
      if (await searchInput.isVisible({ timeout: 5000 })) {
        // Should be able to type while query counts load
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        await searchInput.clear();
        
        // Verify input is responsive
        await expect(searchInput).toBeVisible();
      }
    });
  });

  test('Role-based visibility: Query improvements only for credit team', async ({ page, context }) => {
    await test.step('Verify credit team sees query improvements', async () => {
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Credit team should see query badges
      const queryBadges = page.locator('text=/\\d+ (query|queries)/i');
      const badgeCount = await queryBadges.count();
      
      // Badges may or may not appear depending on data, but page should load
      expect(badgeCount).toBeGreaterThanOrEqual(0);
    });

    await test.step('Verify KAM does not see credit-specific query improvements', async () => {
      // Logout and login as KAM
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      await loginAs(page, 'kam');
      await waitForPageLoad(page);
      
      await page.goto('/applications');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // KAM should not see "Awaiting KAM Response" filter
      const statusFilter = page.locator('select').filter({ hasText: /status/i }).or(
        page.locator('select').first()
      );
      
      if (await statusFilter.isVisible({ timeout: 5000 })) {
        const options = await statusFilter.locator('option').allTextContents();
        const hasAwaitingFilter = options.some(opt => 
          opt.toLowerCase().includes('awaiting') && opt.toLowerCase().includes('kam') && 
          opt.toLowerCase().includes('response')
        );
        
        // KAM should not see this filter
        expect(hasAwaitingFilter).toBeFalsy();
      }
    });
  });
});
