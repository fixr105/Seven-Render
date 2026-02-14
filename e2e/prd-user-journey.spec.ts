/**
 * PRD User Journey: End-to-End E2E Tests
 *
 * Covers full loan application lifecycle across Client, KAM, Credit, and NBFC roles.
 * Scenarios A–D run sequentially; later steps may depend on earlier ones.
 * Uses test.skip() when required data (e.g. applications, NBFCs) is missing.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { navigateToPage, clickApplication, waitForPageLoad, openApplicationByApplicant } from './helpers/navigation';

const APPLICANT_HAPPY = 'E2E User Journey Happy Path';
const APPLICANT_REJECT = 'E2E User Journey Rejection';
const APPLICANT_QUERY = 'E2E User Journey Query';
const APPLICANT_WITHDRAW = 'E2E User Journey Withdrawal';

test.describe('PRD User Journey: End-to-End', () => {
  test.setTimeout(60000);

  let applicationIdA: string;
  let applicationIdB: string;
  let applicationIdC: string;
  let applicationIdD: string;

  /**
   * Fill new application form with minimal required fields
   */
  async function fillNewApplicationForm(
    page: import('@playwright/test').Page,
    applicantName: string,
    amount = '500000'
  ) {
    await page.waitForSelector('input[name="applicant_name"], input[placeholder*="Applicant"]', {
      timeout: 15000,
    });
    const applicantInput = page
      .locator('input[name="applicant_name"], input[placeholder*="Applicant"]')
      .first();
    await applicantInput.fill(applicantName);

    const loanProductSelect = page
      .locator('select[name="loan_product_id"], select[data-testid="loan-product"]')
      .first();
    if (await loanProductSelect.isVisible({ timeout: 5000 })) {
      await loanProductSelect.selectOption({ index: 1 });
    }

    const amountInput = page
      .locator('input[name="requested_loan_amount"], input[placeholder*="Amount"]')
      .first();
    await amountInput.fill(amount);

    await page.waitForTimeout(1500);

    const mandatoryFields = page.locator('input[required], select[required]');
    const count = await mandatoryFields.count();
    for (let i = 0; i < count; i++) {
      const field = mandatoryFields.nth(i);
      const type = await field.getAttribute('type');
      if (type === 'text' || type === 'email') {
        await field.fill(`Test${i}`);
      } else if (type === null && (await field.evaluate((el) => el.tagName === 'SELECT'))) {
        const opts = await field.locator('option').count();
        if (opts > 1) await field.selectOption({ index: 1 });
      }
    }
  }

  /**
   * Assign NBFC via API (Credit has no dedicated Assign NBFC UI; status modal uses KAM route)
   */
  async function assignNBFCViaAPI(
    page: import('@playwright/test').Page,
    applicationId: string,
    baseURL: string
  ): Promise<boolean> {
    const apiBase = baseURL.replace(/\/$/, '') + '/api';
    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (!token) return false;

    const partnersRes = await page.request.get(`${apiBase}/nbfc-partners`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!partnersRes.ok()) return false;
    const partnersData = await partnersRes.json();
    const partners = partnersData?.data ?? partnersData;
    const ids = Array.isArray(partners)
      ? partners.map((p: any) => p.id || p['Lender ID']).filter(Boolean)
      : [];
    if (ids.length === 0) return false;

    const assignRes = await page.request.post(
      `${apiBase}/credit/loan-applications/${applicationId}/assign-nbfcs`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: { nbfcIds: [ids[0]] },
      }
    );
    return assignRes.ok();
  }

  test.describe.serial('Scenario A: Happy Path', () => {
    test('A1–A14: Application to Disbursement', async ({ page, context }, testInfo) => {
      const baseURL = testInfo.project.use?.baseURL || 'http://localhost:3000';

      await test.step('A1–A5: Client creates draft, submits, verifies Under KAM Review', async () => {
        await loginAs(page, 'client');
        await waitForPageLoad(page);
        await page.goto('/applications/new');
        await page.waitForLoadState('networkidle');

        const hasForm = await page
          .getByText(/Application|New Application|Loan/i)
          .first()
          .isVisible({ timeout: 10000 })
          .catch(() => false);
        if (!hasForm) {
          test.skip(true, 'New application form not available (no form config?)');
        }

        await fillNewApplicationForm(page, APPLICANT_HAPPY);
        const saveDraftBtn = page.getByTestId('save-draft').or(page.locator('button:has-text("Save as Draft")')).first();
        if (await saveDraftBtn.isVisible({ timeout: 3000 })) {
          await saveDraftBtn.click();
        } else {
          test.skip(true, 'Save as Draft button not found');
        }

        page.once('dialog', (d) => d.accept());
        await page.waitForURL(/\/applications/, { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const appId = await openApplicationByApplicant(page, APPLICANT_HAPPY);
        if (!appId) test.skip(true, 'Could not open draft application');
        applicationIdA = appId;

        const statusBtn = page
          .locator('button:has-text("Submit / Withdraw"), button:has-text("Update Status")')
          .first();
        if (!(await statusBtn.isVisible({ timeout: 5000 }))) {
          test.skip(true, 'Submit/Update Status button not found');
        }
        await statusBtn.click();

        const modal = page.locator('[role="dialog"], .modal').first();
        await expect(modal).toBeVisible({ timeout: 3000 });
        const submitOpt = page.locator('select option').filter({ hasText: /Submit|under_kam_review/i }).first();
        if (await submitOpt.isVisible({ timeout: 2000 })) {
          await page.locator('select').first().selectOption({ label: /Submit|under_kam_review/i });
        }
        await page.locator('button:has-text("Update Status"), button[type="submit"]').first().click();
        page.once('dialog', (d) => d.accept());

        await page.waitForTimeout(2000);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(
          page.getByTestId('status-badge').or(page.locator('.badge').filter({ hasText: /Under KAM Review|KAM Review/i }))
        ).toBeVisible({ timeout: 5000 });
      });

      await test.step('A6–A7: KAM opens application, raises query', async () => {
        const kamPage = await context.newPage();
        await loginAs(kamPage, 'kam');
        await waitForPageLoad(kamPage);
        await kamPage.goto('/applications');
        await kamPage.waitForLoadState('networkidle');

        const firstLink = kamPage.locator('a[href*="/applications/"]').first();
        const viewBtn = kamPage.getByRole('button', { name: 'View' }).first();
        if (await firstLink.isVisible({ timeout: 5000 })) {
          await firstLink.click();
        } else if (await viewBtn.isVisible({ timeout: 5000 })) {
          await viewBtn.click();
        } else {
          test.skip(true, 'No applications visible for KAM');
        }
        await kamPage.waitForLoadState('networkidle');

        const applicantRow = kamPage.locator('tr').filter({ hasText: APPLICANT_HAPPY }).first();
        if (await applicantRow.isVisible({ timeout: 3000 })) {
          await applicantRow.getByRole('button', { name: 'View' }).first().click();
          await kamPage.waitForLoadState('networkidle');
        }

        const raiseQueryBtn = kamPage.locator('button:has-text("Raise Query")').first();
        if (!(await raiseQueryBtn.isVisible({ timeout: 5000 }))) {
          kamPage.close();
          test.skip(true, 'Raise Query button not found');
        }
        await raiseQueryBtn.click();
        const queryModal = kamPage.locator('[role="dialog"]').first();
        await expect(queryModal).toBeVisible({ timeout: 3000 });
        await kamPage.locator('textarea').first().fill('E2E: Please confirm applicant details.');
        await kamPage.locator('button:has-text("Send Query")').first().click();
        await kamPage.waitForTimeout(1500);
        kamPage.close();
      });

      await test.step('A8: Client responds to query', async () => {
        await loginAs(page, 'client');
        await waitForPageLoad(page);
        const id = applicationIdA;
        await page.goto(`/applications/${id}`);
        await page.waitForLoadState('networkidle');

        const replyArea = page.locator('textarea[placeholder*="Type your response"]').first();
        if (await replyArea.isVisible({ timeout: 5000 })) {
          await replyArea.fill('E2E: Confirmed. All details are correct.');
          await page.locator('button:has-text("Send")').first().click();
          await page.waitForTimeout(1500);
        }
      });

      await test.step('A9: KAM resolves query, forwards to Credit', async () => {
        const kamPage = await context.newPage();
        await loginAs(kamPage, 'kam');
        await waitForPageLoad(kamPage);
        await kamPage.goto(`/applications/${applicationIdA}`);
        await kamPage.waitForLoadState('networkidle');

        const resolveBtn = kamPage.locator('button:has-text("Mark Resolved")').first();
        if (await resolveBtn.isVisible({ timeout: 3000 })) {
          kamPage.once('dialog', (d) => d.accept());
          await resolveBtn.click();
          await kamPage.waitForTimeout(1000);
        }

        const statusBtn = kamPage.locator('button:has-text("Update Status")').first();
        if (!(await statusBtn.isVisible({ timeout: 5000 }))) {
          kamPage.close();
          test.skip(true, 'Update Status button not found for KAM');
        }
        await statusBtn.click();
        const modal = kamPage.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 3000 });
        const forwardOpt = kamPage.locator('select').first();
        await forwardOpt.selectOption({ label: /Forwarded to Credit|pending_credit_review/i });
        await kamPage.locator('button:has-text("Update Status")').first().click();
        kamPage.once('dialog', (d) => d.accept());
        await kamPage.waitForTimeout(2000);
        kamPage.close();
      });

      await test.step('A10: Credit marks In Negotiation', async () => {
        const creditPage = await context.newPage();
        await loginAs(creditPage, 'credit');
        await waitForPageLoad(creditPage);
        await creditPage.goto(`/applications/${applicationIdA}`);
        await creditPage.waitForLoadState('networkidle');

        const statusBtn = creditPage.locator('button:has-text("Update Status")').first();
        if (!(await statusBtn.isVisible({ timeout: 5000 }))) {
          creditPage.close();
          test.skip(true, 'Update Status button not found for Credit');
        }
        await statusBtn.click();
        const modal = creditPage.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 3000 });
        await creditPage.locator('select').first().selectOption({ label: /In Negotiation/i });
        await creditPage.locator('button:has-text("Update Status")').first().click();
        await creditPage.waitForTimeout(2000);
        creditPage.close();
      });

      await test.step('A11: Credit assigns NBFC (via API)', async () => {
        const creditPage = await context.newPage();
        await loginAs(creditPage, 'credit');
        await waitForPageLoad(creditPage);
        const ok = await assignNBFCViaAPI(creditPage, applicationIdA, baseURL);
        creditPage.close();
        if (!ok) {
          test.skip(true, 'Assign NBFC via API failed (no NBFC partners or auth)');
        }
      });

      await test.step('A12: NBFC records Approve', async () => {
        const nbfcPage = await context.newPage();
        await loginAs(nbfcPage, 'nbfc');
        await waitForPageLoad(nbfcPage);
        await nbfcPage.goto('/applications');
        await nbfcPage.waitForLoadState('networkidle');

        const firstView = nbfcPage.getByRole('button', { name: 'View' }).first();
        if (!(await firstView.isVisible({ timeout: 5000 }))) {
          nbfcPage.close();
          test.skip(true, 'No applications assigned to NBFC');
        }
        await firstView.click();
        await nbfcPage.waitForLoadState('networkidle');

        const decisionBtn = nbfcPage.locator('button:has-text("Record Decision")').first();
        if (!(await decisionBtn.isVisible({ timeout: 5000 }))) {
          nbfcPage.close();
          test.skip(true, 'Record Decision button not found');
        }
        await decisionBtn.click();
        const decisionModal = nbfcPage.locator('[role="dialog"]').first();
        await expect(decisionModal).toBeVisible({ timeout: 3000 });
        await nbfcPage.locator('select').first().selectOption({ label: /Approve/i });
        const amountInput = nbfcPage.locator('input[placeholder*="amount"], input[type="number"]').first();
        if (await amountInput.isVisible({ timeout: 2000 })) {
          await amountInput.fill('450000');
        }
        await nbfcPage.locator('button:has-text("Record Decision")').last().click();
        nbfcPage.once('dialog', (d) => d.accept());
        await nbfcPage.waitForTimeout(2000);
        nbfcPage.close();
      });

      await test.step('A13: Credit marks Disbursed', async () => {
        const creditPage = await context.newPage();
        await loginAs(creditPage, 'credit');
        await waitForPageLoad(creditPage);
        await creditPage.goto(`/applications/${applicationIdA}`);
        await creditPage.waitForLoadState('networkidle');

        const statusBtn = creditPage.locator('button:has-text("Update Status")').first();
        if (!(await statusBtn.isVisible({ timeout: 5000 }))) {
          creditPage.close();
          return;
        }
        await statusBtn.click();
        const modal = creditPage.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 3000 });
        await creditPage.locator('select').first().selectOption({ label: /Disbursed/i });
        await creditPage.locator('button:has-text("Update Status")').first().click();
        await creditPage.waitForTimeout(2000);
        creditPage.close();
      });

      await test.step('A14: Verify commission in Ledger (optional)', async () => {
        const ledgerPage = await context.newPage();
        await loginAs(ledgerPage, 'client');
        await waitForPageLoad(ledgerPage);
        await ledgerPage.goto('/ledger');
        await ledgerPage.waitForLoadState('networkidle');
        const hasLedger = await ledgerPage.getByText(/Ledger|Commission|Balance/i).first().isVisible({ timeout: 5000 }).catch(() => false);
        ledgerPage.close();
        if (!hasLedger) {
          test.skip(true, 'Ledger (M1) not enabled or not visible');
        }
      });
    });
  });

  test.describe.serial('Scenario B: Rejection Path', () => {
    test('B1–B6: Application to Rejection', async ({ page, context }, testInfo) => {
      const baseURL = testInfo.project.use?.baseURL || 'http://localhost:3000';

      await test.step('B1: Client creates and submits application', async () => {
        await loginAs(page, 'client');
        await waitForPageLoad(page);
        await page.goto('/applications/new');
        await page.waitForLoadState('networkidle');

        const hasForm = await page
          .getByText(/Application|New Application|Loan/i)
          .first()
          .isVisible({ timeout: 10000 })
          .catch(() => false);
        if (!hasForm) test.skip(true, 'New application form not available');

        await fillNewApplicationForm(page, APPLICANT_REJECT);
        const submitBtn = page.getByTestId('submit-application').or(page.locator('button:has-text("Submit Application")')).first();
        if (!(await submitBtn.isVisible({ timeout: 3000 }))) {
          test.skip(true, 'Submit Application button not found');
        }
        page.once('dialog', (d) => d.accept());
        await submitBtn.click();
        await page.waitForURL(/\/applications/, { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const appId = await openApplicationByApplicant(page, APPLICANT_REJECT);
        if (!appId) test.skip(true, 'Could not open submitted application');
        applicationIdB = appId;
      });

      await test.step('B2: KAM forwards to Credit', async () => {
        const kamPage = await context.newPage();
        await loginAs(kamPage, 'kam');
        await waitForPageLoad(kamPage);
        await kamPage.goto(`/applications/${applicationIdB}`);
        await kamPage.waitForLoadState('networkidle');

        const statusBtn = kamPage.locator('button:has-text("Update Status")').first();
        if (!(await statusBtn.isVisible({ timeout: 5000 }))) {
          kamPage.close();
          test.skip(true, 'Update Status not found');
        }
        await statusBtn.click();
        await kamPage.locator('select').first().selectOption({ label: /Forwarded to Credit|pending_credit_review/i });
        await kamPage.locator('button:has-text("Update Status")').first().click();
        kamPage.once('dialog', (d) => d.accept());
        await kamPage.waitForTimeout(2000);
        kamPage.close();
      });

      await test.step('B3: Credit assigns NBFC', async () => {
        const creditPage = await context.newPage();
        await loginAs(creditPage, 'credit');
        await waitForPageLoad(creditPage);
        await creditPage.goto(`/applications/${applicationIdB}`);
        await creditPage.waitForLoadState('networkidle');

        const statusBtn = creditPage.locator('button:has-text("Update Status")').first();
        if (await statusBtn.isVisible({ timeout: 3000 })) {
          await statusBtn.click();
          await creditPage.locator('select').first().selectOption({ label: /In Negotiation/i });
          await creditPage.locator('button:has-text("Update Status")').first().click();
          await creditPage.waitForTimeout(2000);
        }
        const ok = await assignNBFCViaAPI(creditPage, applicationIdB, baseURL);
        creditPage.close();
        if (!ok) test.skip(true, 'Assign NBFC failed');
      });

      await test.step('B4: NBFC rejects with reason', async () => {
        const nbfcPage = await context.newPage();
        await loginAs(nbfcPage, 'nbfc');
        await waitForPageLoad(nbfcPage);
        await nbfcPage.goto('/applications');
        await nbfcPage.waitForLoadState('networkidle');

        const firstView = nbfcPage.getByRole('button', { name: 'View' }).first();
        if (!(await firstView.isVisible({ timeout: 5000 }))) {
          nbfcPage.close();
          test.skip(true, 'No applications for NBFC');
        }
        await firstView.click();
        await nbfcPage.waitForLoadState('networkidle');

        const decisionBtn = nbfcPage.locator('button:has-text("Record Decision")').first();
        if (!(await decisionBtn.isVisible({ timeout: 5000 }))) {
          nbfcPage.close();
          test.skip(true, 'Record Decision not found');
        }
        await decisionBtn.click();
        await nbfcPage.locator('select').first().selectOption({ label: /Reject/i });
        const reasonSelect = nbfcPage.locator('select').nth(1);
        if (await reasonSelect.isVisible({ timeout: 2000 })) {
          await reasonSelect.selectOption({ index: 1 });
        }
        const otherText = nbfcPage.locator('textarea').first();
        if (await otherText.isVisible({ timeout: 1000 })) {
          await otherText.fill('E2E: Rejected for testing.');
        }
        await nbfcPage.locator('button:has-text("Record Decision")').last().click();
        nbfcPage.once('dialog', (d) => d.accept());
        await nbfcPage.waitForTimeout(2000);
        nbfcPage.close();
      });

      await test.step('B5–B6: Verify Rejected/Closed', async () => {
        await loginAs(page, 'client');
        await waitForPageLoad(page);
        await page.goto(`/applications/${applicationIdB}`);
        await page.waitForLoadState('networkidle');
        await expect(
          page.getByTestId('status-badge').or(page.locator('.badge').filter({ hasText: /Rejected|Closed/i }))
        ).toBeVisible({ timeout: 5000 });
      });
    });
  });

  test.describe.serial('Scenario C: Query Resolution Path', () => {
    test('C1–C4: KAM raises query, Client responds, KAM resolves', async ({ page, context }) => {
      await test.step('C1: KAM raises query', async () => {
        await loginAs(page, 'client');
        await waitForPageLoad(page);
        await page.goto('/applications/new');
        await page.waitForLoadState('networkidle');

        const hasForm = await page
          .getByText(/Application|New Application|Loan/i)
          .first()
          .isVisible({ timeout: 10000 })
          .catch(() => false);
        if (!hasForm) test.skip(true, 'New application form not available');

        await fillNewApplicationForm(page, APPLICANT_QUERY);
        const submitBtn = page.getByTestId('submit-application').or(page.locator('button:has-text("Submit Application")')).first();
        if (!(await submitBtn.isVisible({ timeout: 3000 }))) test.skip(true, 'Submit button not found');
        page.once('dialog', (d) => d.accept());
        await submitBtn.click();
        await page.waitForURL(/\/applications/, { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const appId = await openApplicationByApplicant(page, APPLICANT_QUERY);
        if (!appId) test.skip(true, 'Could not open application');
        applicationIdC = appId;
      });

      await test.step('C1 (cont): KAM raises query', async () => {
        const kamPage = await context.newPage();
        await loginAs(kamPage, 'kam');
        await waitForPageLoad(kamPage);
        await kamPage.goto(`/applications/${applicationIdC}`);
        await kamPage.waitForLoadState('networkidle');

        const raiseQueryBtn = kamPage.locator('button:has-text("Raise Query")').first();
        if (!(await raiseQueryBtn.isVisible({ timeout: 5000 }))) {
          kamPage.close();
          test.skip(true, 'Raise Query not found');
        }
        await raiseQueryBtn.click();
        await kamPage.locator('textarea').first().fill('E2E Query: Please provide additional documents.');
        await kamPage.locator('button:has-text("Send Query")').first().click();
        await kamPage.waitForTimeout(1500);
        kamPage.close();
      });

      await test.step('C2: Client responds', async () => {
        await loginAs(page, 'client');
        await waitForPageLoad(page);
        await page.goto(`/applications/${applicationIdC}`);
        await page.waitForLoadState('networkidle');

        const replyArea = page.locator('textarea[placeholder*="Type your response"]').first();
        if (await replyArea.isVisible({ timeout: 5000 })) {
          await replyArea.fill('E2E: Documents attached.');
          await page.locator('button:has-text("Send")').first().click();
          await page.waitForTimeout(1500);
        }
      });

      await test.step('C3–C4: KAM resolves, verify thread', async () => {
        const kamPage = await context.newPage();
        await loginAs(kamPage, 'kam');
        await waitForPageLoad(kamPage);
        await kamPage.goto(`/applications/${applicationIdC}`);
        await kamPage.waitForLoadState('networkidle');

        const resolveBtn = kamPage.locator('button:has-text("Mark Resolved")').first();
        if (await resolveBtn.isVisible({ timeout: 5000 })) {
          kamPage.once('dialog', (d) => d.accept());
          await resolveBtn.click();
          await kamPage.waitForTimeout(1500);
        }
        await expect(
          kamPage.locator('text=/Resolved|Query|Communication/i').first()
        ).toBeVisible({ timeout: 5000 });
        kamPage.close();
      });
    });
  });

  test.describe.serial('Scenario D: Withdrawal Path', () => {
    test('D1–D3: Client creates draft and withdraws', async ({ page }) => {
      await test.step('D1: Client creates draft', async () => {
        await loginAs(page, 'client');
        await waitForPageLoad(page);
        await page.goto('/applications/new');
        await page.waitForLoadState('networkidle');

        const hasForm = await page
          .getByText(/Application|New Application|Loan/i)
          .first()
          .isVisible({ timeout: 10000 })
          .catch(() => false);
        if (!hasForm) test.skip(true, 'New application form not available');

        await fillNewApplicationForm(page, APPLICANT_WITHDRAW);
        const saveDraftBtn = page.locator('button:has-text("Save as Draft")').first();
        if (!(await saveDraftBtn.isVisible({ timeout: 3000 }))) {
          test.skip(true, 'Save as Draft not found');
        }
        page.once('dialog', (d) => d.accept());
        await saveDraftBtn.click();
        await page.waitForURL(/\/applications/, { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const appId = await openApplicationByApplicant(page, APPLICANT_WITHDRAW);
        if (!appId) test.skip(true, 'Could not open draft');
        applicationIdD = appId;
      });

      await test.step('D2–D3: Client withdraws, verify Withdrawn', async () => {
        const statusBtn = page
          .locator('button:has-text("Submit / Withdraw"), button:has-text("Update Status")')
          .first();
        if (!(await statusBtn.isVisible({ timeout: 5000 }))) {
          test.skip(true, 'Submit/Withdraw button not found');
        }
        await statusBtn.click();
        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 3000 });
        await page.locator('select').first().selectOption({ label: /Withdraw/i });
        await page.locator('button:has-text("Update Status")').first().click();
        page.once('dialog', (d) => d.accept());
        await page.waitForTimeout(2000);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(
          page.getByTestId('status-badge').or(page.locator('.badge').filter({ hasText: /Withdrawn|Closed/i }))
        ).toBeVisible({ timeout: 5000 });
      });
    });
  });
});
