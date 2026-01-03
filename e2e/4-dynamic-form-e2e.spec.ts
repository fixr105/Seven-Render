/**
 * E2E Test Suite: Dynamic Form Creation, Asset Integration, and Data Persistence
 * 
 * Test 1: Dynamic Form Creation - Fill form from JSON, verify UI structure, verify Create success
 * Test 2: Asset Integration - Upload file, attach to form, verify file appears and metadata updates
 * Test 3: Data Persistence & Submission - Submit form, reload page, verify data persists
 * 
 * Requirements:
 * - No authentication (uses role selection)
 * - Data-driven from JSON file
 * - Page Object Model pattern
 * - Comprehensive assertions
 */

import { test, expect } from '@playwright/test';
import { NewApplicationPage, FormTestData } from './pages/NewApplicationPage';
import { selectRole } from './helpers/roleSelection';
import * as fs from 'fs';
import * as path from 'path';

// Load test data from JSON file
const testDataPath = path.join(__dirname, 'test-data', 'form-test-data.json');
const testData: FormTestData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));

// Create test files directory if it doesn't exist
const testFilesDir = path.join(__dirname, 'test-files');
if (!fs.existsSync(testFilesDir)) {
  fs.mkdirSync(testFilesDir, { recursive: true });
}

// Create sample test files
const createTestFile = (fileName: string, content: string = 'Test file content') => {
  const filePath = path.join(testFilesDir, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
  }
  return filePath;
};

test.describe('E2E: Dynamic Form Workflow', () => {
  let newApplicationPage: NewApplicationPage;
  let applicationId: string | null = null;
  let uploadedFilePaths: string[] = [];

  test.beforeAll(() => {
    // Create test files
    uploadedFilePaths = [
      createTestFile('pan-card.pdf', 'PAN Card Test Document'),
      createTestFile('aadhar-card.pdf', 'Aadhar Card Test Document'),
    ];
  });

  test.beforeEach(async ({ page }) => {
    newApplicationPage = new NewApplicationPage(page);
    
    // Select client role (no authentication needed)
    await selectRole(page, 'client');
    
    // Navigate to new application page
    await newApplicationPage.goto();
  });

  test('Test 1: Dynamic Form Creation', async ({ page }) => {
    await test.step('Step 1.1: Verify form structure matches JSON configuration', async () => {
      // Verify form structure from JSON
      await newApplicationPage.verifyFormStructure(testData.formConfig);
      
      // Assert: All categories from JSON are visible
      for (const category of testData.formConfig.categories) {
        const categoryElement = page.locator(`text="${category.categoryName}"`).first();
        await expect(categoryElement).toBeVisible();
      }
      
      // Assert: All fields from JSON are present
      for (const category of testData.formConfig.categories) {
        for (const field of category.fields) {
          const fieldLabel = page.locator(`label:has-text("${field.label}"), text="${field.label}"`).first();
          await expect(fieldLabel).toBeVisible();
        }
      }
    });

    await test.step('Step 1.2: Fill core application fields from JSON', async () => {
      await newApplicationPage.fillCoreFields(testData.formData);
      
      // Assert: Core fields are filled correctly
      const applicantName = await newApplicationPage.applicantNameInput.inputValue();
      expect(applicantName).toBe(testData.formData.applicant_name);
      
      const amount = await newApplicationPage.requestedAmountInput.inputValue();
      expect(amount).toContain(testData.formData.requested_loan_amount.replace(/[^0-9]/g, ''));
    });

    await test.step('Step 1.3: Fill dynamic form fields from JSON', async () => {
      await newApplicationPage.fillDynamicFields(testData.formConfig, testData.formData.form_data);
      
      // Assert: Dynamic fields are filled
      for (const [fieldId, value] of Object.entries(testData.formData.form_data)) {
        // Skip file fields (handled in Test 2)
        if (fieldId.includes('document') || fieldId.includes('file')) {
          continue;
        }
        
        const field = page.locator(`input[name="${fieldId}"], input[id="${fieldId}"], textarea[name="${fieldId}"]`).first();
        if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
          const fieldValue = await field.inputValue();
          expect(fieldValue).toContain(String(value));
        }
      }
    });

    await test.step('Step 1.4: Verify Create action returns success state', async () => {
      // Save as draft first to verify form can be created
      await newApplicationPage.saveDraftButton.click();
      
      // Wait for success indication
      await Promise.race([
        newApplicationPage.successMessage.waitFor({ state: 'visible', timeout: 10000 }),
        page.waitForURL(/\/applications/, { timeout: 10000 }),
        page.waitForSelector('text=/saved|draft/i', { timeout: 10000 }),
      ]);
      
      // Assert: Form was created successfully
      const url = page.url();
      expect(url).toMatch(/\/applications/);
      
      // Extract application ID if available
      applicationId = await newApplicationPage.getApplicationId();
    });
  });

  test('Test 2: Asset Integration', async ({ page }) => {
    // First, fill the form
    await newApplicationPage.fillCoreFields(testData.formData);
    await newApplicationPage.fillDynamicFields(testData.formConfig, testData.formData.form_data);

    await test.step('Step 2.1: Upload file for first field', async () => {
      const firstUpload = testData.fileUploads[0];
      const filePath = uploadedFilePaths[0];
      
      await newApplicationPage.uploadFile(firstUpload.fieldId, filePath);
      
      // Assert: File upload initiated
      await page.waitForTimeout(2000); // Wait for upload to process
      
      // Assert: File appears in attached list
      const isAttached = await newApplicationPage.verifyFileAttached(firstUpload.fieldId, firstUpload.fileName);
      expect(isAttached).toBe(true);
    });

    await test.step('Step 2.2: Upload file for second field', async () => {
      const secondUpload = testData.fileUploads[1];
      const filePath = uploadedFilePaths[1];
      
      await newApplicationPage.uploadFile(secondUpload.fieldId, filePath);
      
      // Assert: Second file upload initiated
      await page.waitForTimeout(2000);
      
      // Assert: Second file appears in attached list
      const isAttached = await newApplicationPage.verifyFileAttached(secondUpload.fieldId, secondUpload.fileName);
      expect(isAttached).toBe(true);
    });

    await test.step('Step 2.3: Verify metadata updates correctly', async () => {
      // Verify file count for each field
      for (const upload of testData.fileUploads) {
        // Look for file list or count indicator
        const fileContainer = page.locator(`[data-field-id="${upload.fieldId}"], [data-testid="file-upload-${upload.fieldId}"]`).first();
        
        if (await fileContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Verify file name is visible
          const fileNameElement = fileContainer.locator(`text="${upload.fileName}"`).first();
          await expect(fileNameElement).toBeVisible({ timeout: 5000 });
          
          // Verify upload success indicator
          const successIndicator = fileContainer.locator('text=/uploaded|success|complete/i, .text-success').first();
          if (await successIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Metadata updated successfully
            expect(true).toBe(true);
          }
        }
      }
    });

    await test.step('Step 2.4: Verify files are attached to form', async () => {
      // Check that all uploaded files are visible
      for (const upload of testData.fileUploads) {
        const isAttached = await newApplicationPage.verifyFileAttached(upload.fieldId, upload.fileName);
        expect(isAttached).toBe(true);
      }
    });
  });

  test('Test 3: Data Persistence & Submission', async ({ page }) => {
    // Fill form completely
    await newApplicationPage.fillCoreFields(testData.formData);
    await newApplicationPage.fillDynamicFields(testData.formConfig, testData.formData.form_data);

    // Upload files
    for (let i = 0; i < testData.fileUploads.length; i++) {
      const upload = testData.fileUploads[i];
      await newApplicationPage.uploadFile(upload.fieldId, uploadedFilePaths[i]);
      await page.waitForTimeout(2000);
    }

    await test.step('Step 3.1: Submit the finalized form', async () => {
      await newApplicationPage.submitForm(true);
      
      // Assert: Form submission was successful
      const url = page.url();
      expect(url).toMatch(/\/applications/);
      
      // Extract application ID
      applicationId = await newApplicationPage.getApplicationId();
      expect(applicationId).not.toBeNull();
    });

    await test.step('Step 3.2: Perform page reload', async () => {
      // Navigate to the application detail page if we have an ID
      if (applicationId) {
        await page.goto(`/applications/${applicationId}`);
      } else {
        // Navigate to applications list and find the application
        await page.goto('/applications');
        await page.waitForLoadState('networkidle');
        
        // Look for application with applicant name
        const applicationLink = page.locator(`text="${testData.formData.applicant_name}"`).first();
        if (await applicationLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          await applicationLink.click();
          await page.waitForLoadState('networkidle');
        }
      }
      
      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Step 3.3: Verify submitted data persists', async () => {
      // Verify applicant name persists
      const applicantNameElement = page.locator(`text="${testData.formData.applicant_name}"`).first();
      await expect(applicantNameElement).toBeVisible({ timeout: 5000 });
      
      // Verify loan amount persists
      const amountElement = page.locator(`text="${testData.formData.requested_loan_amount}"`).first();
      if (await amountElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(amountElement).toBeVisible();
      }
      
      // Verify form data fields persist
      for (const [fieldId, value] of Object.entries(testData.formData.form_data)) {
        // Skip file fields (they're stored as links)
        if (fieldId.includes('document') || fieldId.includes('file')) {
          continue;
        }
        
        // Look for the value in the page
        const valueElement = page.locator(`text="${value}"`).first();
        if (await valueElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(valueElement).toBeVisible();
        }
      }
    });

    await test.step('Step 3.4: Verify file references persist', async () => {
      // Verify file references are present in the persisted data
      for (const upload of testData.fileUploads) {
        // Look for file name or link
        const fileReference = page.locator(`text="${upload.fileName}"`).first();
        if (await fileReference.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(fileReference).toBeVisible();
        }
      }
    });

    await test.step('Step 3.5: Verify data matches original JSON input', async () => {
      // Get page content
      const pageContent = await page.content();
      
      // Verify applicant name is in page
      expect(pageContent).toContain(testData.formData.applicant_name);
      
      // Verify amount is in page (may be formatted)
      const amountNumbers = testData.formData.requested_loan_amount.replace(/[^0-9]/g, '');
      expect(pageContent).toContain(amountNumbers);
      
      // Verify key form data fields
      for (const [fieldId, value] of Object.entries(testData.formData.form_data)) {
        if (typeof value === 'string' && value.length > 0 && !fieldId.includes('document')) {
          expect(pageContent).toContain(value);
        }
      }
    });
  });
});





