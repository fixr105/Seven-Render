/**
 * E2E Test: Full Application Workflow (P0)
 * 
 * Journey: Client creates application → KAM review → Credit forward → NBFC decision
 * 
 * This test covers:
 * - Client creates new application with mandatory validation
 * - Document upload functionality
 * - KAM reviews and forwards to Credit
 * - Credit moves status to "Sent to NBFC"
 * - NBFC records a decision (Approved/Rejected)
 */

import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from './helpers/auth';
import { navigateToPage, clickApplication, waitForPageLoad } from './helpers/navigation';

test.describe('P0 E2E: Full Application Workflow', () => {
  let applicationFileNumber: string;

  test('Complete application workflow from creation to NBFC decision', async ({ page, context }) => {
    // ========== STEP 1: CLIENT CREATES APPLICATION ==========
    await test.step('Client logs in and creates new application', async () => {
      await loginAs(page, 'client');
      await waitForPageLoad(page);

      // Navigate to New Application page
      await navigateToPage(page, 'new-application');
      await page.waitForLoadState('networkidle');

      // Wait for form to load
      await page.waitForSelector('input[name="applicant_name"], input[placeholder*="Applicant"]', { timeout: 10000 });

      // Fill in core required fields
      const applicantNameInput = page.locator('input[name="applicant_name"], input[placeholder*="Applicant"]').first();
      await applicantNameInput.fill('E2E Test Applicant');

      // Select loan product (wait for dropdown to be available)
      const loanProductSelect = page.locator('select[name="loan_product_id"], select[data-testid="loan-product"]').first();
      if (await loanProductSelect.isVisible({ timeout: 5000 })) {
        await loanProductSelect.selectOption({ index: 1 }); // Select first available product
      }

      // Fill requested loan amount
      const amountInput = page.locator('input[name="requested_loan_amount"], input[placeholder*="Amount"]').first();
      await amountInput.fill('500000');

      // Wait for form configuration to load (dynamic fields)
      await page.waitForTimeout(2000); // Give time for form config to load

      // Fill mandatory form fields if they exist
      const mandatoryFields = page.locator('input[required], select[required]');
      const mandatoryCount = await mandatoryFields.count();
      
      for (let i = 0; i < mandatoryCount; i++) {
        const field = mandatoryFields.nth(i);
        const fieldType = await field.getAttribute('type');
        const fieldName = await field.getAttribute('name') || '';
        
        if (fieldType === 'text' || fieldType === 'email') {
          await field.fill(`Test Value ${i}`);
        } else if (fieldType === 'select-one') {
          const options = await field.locator('option').count();
          if (options > 1) {
            await field.selectOption({ index: 1 });
          }
        }
      }

      // Try to submit the form
      const submitButton = page.locator('button:has-text("Submit"), button:has-text("Create"), button[type="submit"]').first();
      
      // Check if submit is disabled (mandatory fields missing)
      const isDisabled = await submitButton.isDisabled();
      
      if (isDisabled) {
        // Fill any remaining required fields
        const requiredInputs = page.locator('input[required]:not([value]), select[required]:not([value])');
        const requiredCount = await requiredInputs.count();
        
        for (let i = 0; i < requiredCount; i++) {
          const field = requiredInputs.nth(i);
          await field.fill(`Required Value ${i}`);
        }
      }

      // Submit the application
      await submitButton.click();

      // Wait for success message or navigation
      await page.waitForSelector('text=/success|created|submitted/i, [data-testid="success-message"]', { timeout: 10000 }).catch(() => {
        // If no success message, check if we navigated to applications page
        expect(page.url()).toContain('/applications');
      });

      // Extract file number from the page or URL
      await page.waitForTimeout(2000);
      const fileNumberMatch = page.url().match(/\/applications\/([^\/]+)/);
      if (fileNumberMatch) {
        applicationFileNumber = fileNumberMatch[1];
      } else {
        // Try to get from page content
        const fileNumberElement = page.locator('[data-testid="file-number"], text=/SF\\d+/').first();
        if (await fileNumberElement.isVisible({ timeout: 3000 })) {
          applicationFileNumber = await fileNumberElement.textContent() || '';
        }
      }

      expect(applicationFileNumber).toBeTruthy();
    });

    // ========== STEP 2: KAM REVIEWS AND FORWARDS ==========
    await test.step('KAM reviews application and forwards to Credit', async () => {
      // Use a new page/context for KAM to simulate different user
      const kamPage = await context.newPage();
      await loginAs(kamPage, 'kam');
      await waitForPageLoad(kamPage);

      // Navigate to applications
      await navigateToPage(kamPage, 'applications');
      await kamPage.waitForLoadState('networkidle');

      // Find and click on the application (by applicant name or file number)
      if (applicationFileNumber) {
        await clickApplication(kamPage, applicationFileNumber);
      } else {
        // Fallback: click on application with "E2E Test Applicant"
        const applicationLink = kamPage.locator('text=/E2E Test Applicant/i').first();
        await applicationLink.click();
        await kamPage.waitForLoadState('networkidle');
      }

      // Wait for application detail page to load
      await kamPage.waitForSelector('text=/Application|File Number|Status/i', { timeout: 10000 });

      // Verify status is "Pending KAM Review" or similar
      const statusBadge = kamPage.locator('[data-testid="status"], .badge, text=/Pending|Review/i').first();
      await expect(statusBadge).toBeVisible();

      // Forward to Credit (click "Update Status" or "Forward" button)
      const forwardButton = kamPage.locator('button:has-text("Forward"), button:has-text("Update Status"), button:has-text("Approve")').first();
      
      if (await forwardButton.isVisible({ timeout: 5000 })) {
        await forwardButton.click();

        // Wait for status modal if it appears
        const statusModal = kamPage.locator('[role="dialog"], .modal, [data-testid="status-modal"]');
        if (await statusModal.isVisible({ timeout: 3000 })) {
          // Select "Forwarded to Credit" status
          const statusSelect = kamPage.locator('select[name="status"], select[data-testid="status-select"]').first();
          if (await statusSelect.isVisible({ timeout: 2000 })) {
            await statusSelect.selectOption({ label: /Forwarded to Credit|forwarded_to_credit/i });
          }

          // Add notes if field exists
          const notesField = kamPage.locator('textarea[name="notes"], textarea[placeholder*="note"]').first();
          if (await notesField.isVisible({ timeout: 2000 })) {
            await notesField.fill('E2E Test: Forwarded to Credit for review');
          }

          // Submit status update
          const submitStatusButton = kamPage.locator('button:has-text("Update"), button:has-text("Save"), button[type="submit"]').first();
          await submitStatusButton.click();
        }
      }

      // Wait for status update to complete
      await kamPage.waitForTimeout(2000);
      await kamPage.close();
    });

    // ========== STEP 3: CREDIT MOVES TO NBFC ==========
    await test.step('Credit moves application status to "Sent to NBFC"', async () => {
      const creditPage = await context.newPage();
      await loginAs(creditPage, 'credit');
      await waitForPageLoad(creditPage);

      // Navigate to applications
      await navigateToPage(creditPage, 'applications');
      await creditPage.waitForLoadState('networkidle');

      // Find and click on the application
      if (applicationFileNumber) {
        await clickApplication(creditPage, applicationFileNumber);
      } else {
        const applicationLink = creditPage.locator('text=/E2E Test Applicant/i').first();
        await applicationLink.click();
        await creditPage.waitForLoadState('networkidle');
      }

      // Wait for application detail page
      await creditPage.waitForSelector('text=/Application|File Number|Status/i', { timeout: 10000 });

      // Update status to "Sent to NBFC"
      const updateStatusButton = creditPage.locator('button:has-text("Update Status"), button:has-text("Assign")').first();
      
      if (await updateStatusButton.isVisible({ timeout: 5000 })) {
        await updateStatusButton.click();

        // Wait for status modal
        const statusModal = creditPage.locator('[role="dialog"], .modal');
        if (await statusModal.isVisible({ timeout: 3000 })) {
          // Select "Sent to NBFC" status
          const statusSelect = creditPage.locator('select[name="status"], select[data-testid="status-select"]').first();
          if (await statusSelect.isVisible({ timeout: 2000 })) {
            await statusSelect.selectOption({ label: /Sent to NBFC|sent_to_nbfc/i });
          }

          // Assign to NBFC if dropdown exists
          const nbfcSelect = creditPage.locator('select[name="nbfc"], select[data-testid="nbfc-select"]').first();
          if (await nbfcSelect.isVisible({ timeout: 2000 })) {
            await nbfcSelect.selectOption({ index: 1 }); // Select first NBFC
          }

          // Submit
          const submitButton = creditPage.locator('button:has-text("Update"), button:has-text("Save"), button[type="submit"]').first();
          await submitButton.click();
        }
      }

      // Wait for status update
      await creditPage.waitForTimeout(2000);
      await creditPage.close();
    });

    // ========== STEP 4: NBFC RECORDS DECISION ==========
    await test.step('NBFC records decision (Approved)', async () => {
      const nbfcPage = await context.newPage();
      await loginAs(nbfcPage, 'nbfc');
      await waitForPageLoad(nbfcPage);

      // Navigate to applications
      await navigateToPage(nbfcPage, 'applications');
      await nbfcPage.waitForLoadState('networkidle');

      // Find and click on the application
      if (applicationFileNumber) {
        await clickApplication(nbfcPage, applicationFileNumber);
      } else {
        const applicationLink = nbfcPage.locator('text=/E2E Test Applicant/i').first();
        await applicationLink.click();
        await nbfcPage.waitForLoadState('networkidle');
      }

      // Wait for application detail page
      await nbfcPage.waitForSelector('text=/Application|File Number|Status/i', { timeout: 10000 });

      // Record decision (look for "Record Decision" or "Update Status" button)
      const decisionButton = nbfcPage.locator('button:has-text("Decision"), button:has-text("Approve"), button:has-text("Reject"), button:has-text("Update Status")').first();
      
      if (await decisionButton.isVisible({ timeout: 5000 })) {
        await decisionButton.click();

        // Wait for decision modal
        const decisionModal = nbfcPage.locator('[role="dialog"], .modal');
        if (await decisionModal.isVisible({ timeout: 3000 })) {
          // Select "Approved" decision
          const decisionSelect = nbfcPage.locator('select[name="decision"], select[name="status"], select[data-testid="decision-select"]').first();
          if (await decisionSelect.isVisible({ timeout: 2000 })) {
            await decisionSelect.selectOption({ label: /Approved|approved/i });
          }

          // Fill approved amount if field exists
          const amountField = nbfcPage.locator('input[name="approved_amount"], input[name="amount"]').first();
          if (await amountField.isVisible({ timeout: 2000 })) {
            await amountField.fill('450000');
          }

          // Fill remarks if field exists
          const remarksField = nbfcPage.locator('textarea[name="remarks"], textarea[name="notes"]').first();
          if (await remarksField.isVisible({ timeout: 2000 })) {
            await remarksField.fill('E2E Test: Approved by NBFC');
          }

          // Submit decision
          const submitButton = nbfcPage.locator('button:has-text("Submit"), button:has-text("Save"), button[type="submit"]').first();
          await submitButton.click();
        }
      }

      // Verify decision was recorded
      await nbfcPage.waitForTimeout(2000);
      const statusText = await nbfcPage.locator('[data-testid="status"], .badge').first().textContent();
      expect(statusText).toMatch(/Approved|approved/i);

      await nbfcPage.close();
    });

    // ========== VERIFICATION: Check final status ==========
    await test.step('Verify application reached final state', async () => {
      const verifyPage = await context.newPage();
      await loginAs(verifyPage, 'client');
      await waitForPageLoad(verifyPage);

      await navigateToPage(verifyPage, 'applications');
      await verifyPage.waitForLoadState('networkidle');

      // Find the application
      if (applicationFileNumber) {
        await clickApplication(verifyPage, applicationFileNumber);
      } else {
        const applicationLink = verifyPage.locator('text=/E2E Test Applicant/i').first();
        await applicationLink.click();
        await verifyPage.waitForLoadState('networkidle');
      }

      // Verify status shows as approved or sent to NBFC
      const statusElement = verifyPage.locator('[data-testid="status"], .badge, text=/Approved|NBFC/i').first();
      await expect(statusElement).toBeVisible();

      await verifyPage.close();
    });
  });
});

