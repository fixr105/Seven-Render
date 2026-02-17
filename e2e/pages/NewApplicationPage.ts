/**
 * Page Object Model for New Application Page
 * Provides clean selectors and methods for form interaction
 */

import { Page, Locator, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface FormTestData {
  formData: {
    applicant_name: string;
    loan_product_id: string;
    requested_loan_amount: string;
    form_data: Record<string, any>;
  };
  fileUploads: Array<{
    fieldId: string;
    fileName: string;
    fileType: string;
  }>;
  formConfig: {
    categories: Array<{
      categoryId: string;
      categoryName: string;
      description: string;
      fields: Array<{
        fieldId: string;
        label: string;
        type: string;
        isRequired: boolean;
        placeholder?: string;
      }>;
    }>;
  };
}

export class NewApplicationPage {
  readonly page: Page;

  // Core form fields
  readonly applicantNameInput: Locator;
  readonly loanProductSelect: Locator;
  readonly requestedAmountInput: Locator;
  readonly submitButton: Locator;
  readonly saveDraftButton: Locator;

  // Dynamic form fields (will be located by data attributes)
  readonly formContainer: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly loadFormButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Core form selectors
    this.applicantNameInput = page.locator('[data-testid="applicant-name-input"], input[id="applicant_name"], input[name="applicant_name"], input[placeholder*="Applicant"]').first();
    this.loanProductSelect = page.locator('[data-testid="loan-product-select"], select[id="loan_product_id"], select[name="loan_product_id"]').first();
    this.requestedAmountInput = page.locator('input[id="requested_loan_amount"], input[name="requested_loan_amount"]').first();
    this.submitButton = page.locator('button:has-text("Submit"), button:has-text("Create Application"), button[type="submit"]:not(:has-text("Draft"))').first();
    this.saveDraftButton = page.locator('button:has-text("Save Draft"), button:has-text("Draft")').first();
    
    // Container and messages
    this.formContainer = page.locator('form, [data-testid="new-application-form"]').first();
    this.successMessage = page.locator('text=/success|created|submitted/i, [data-testid="success-message"]').first();
    this.errorMessage = page.locator('.text-error, [role="alert"]').first();
    this.loadFormButton = page.locator('[data-testid="load-form-button"], button:has-text("Load form")').first();
  }

  /**
   * Wait for at least one form category section to be visible (indicates form config loaded)
   */
  async waitForFormCategoriesVisible(timeout = 15000): Promise<void> {
    const categoryPattern = this.page.locator('text=/Personal|KYC|Document|Information|Checklist|Income|Asset|Invoice|Security|Additional/i').first();
    await expect(categoryPattern).toBeVisible({ timeout });
  }

  /**
   * Select a loan product by name or ID, then wait for form config to load.
   * Clicks "Load form" if form is still empty after 3s.
   */
  async selectProductAndWaitForForm(productNameOrId: string): Promise<void> {
    await this.loanProductSelect.waitFor({ state: 'visible', timeout: 10000 });
    // Wait for product option to appear (products loaded from API)
    await this.page.locator(`select option:has-text("${productNameOrId}")`).first()
      .waitFor({ state: 'attached', timeout: 15000 })
      .catch(() => this.page.waitForTimeout(3000));

    // Try select by label first, then by value
    const optionByLabel = this.page.locator(`[data-testid="loan-product-select"] option:has-text("${productNameOrId}"), select[id="loan_product_id"] option:has-text("${productNameOrId}"), select[name="loan_product_id"] option:has-text("${productNameOrId}")`).first();
    if (await optionByLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.loanProductSelect.selectOption({ label: productNameOrId });
    } else {
      await this.loanProductSelect.selectOption({ value: productNameOrId });
    }

    // Wait for form to load (either auto-load on product change or after Load form click)
    const formLoaded = await this.page.locator('text=/Personal|KYC|Document|Information|Checklist|Income|Asset|Invoice|Security|Additional/i').first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!formLoaded) {
      // Form still empty - click Load form
      if (await this.loadFormButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.loadFormButton.click();
        await this.waitForFormCategoriesVisible(15000);
      } else {
        await this.waitForFormCategoriesVisible(15000);
      }
    }
  }

  /**
   * Navigate to new application page
   */
  async goto() {
    await this.page.goto('/applications/new');
    await this.page.waitForLoadState('networkidle');
    // Fail fast if redirected to login (auth issue)
    if (this.page.url().includes('/login')) {
      throw new Error('Redirected to /login - auth may have failed. Check credentials and API base URL.');
    }
    // Wait for form to be visible - applicant name or loan product select (whichever loads first)
    const formReady = this.page.locator('[data-testid="applicant-name-input"], [data-testid="loan-product-select"], input[id="applicant_name"]').first();
    await formReady.waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * Fill core application fields from JSON data
   */
  async fillCoreFields(data: FormTestData['formData']) {
    // Fill applicant name
    await this.applicantNameInput.fill(data.applicant_name);
    
    // Select loan product (wait for options to load)
    if (data.loan_product_id) {
      await this.loanProductSelect.waitFor({ state: 'visible', timeout: 5000 });
      await this.loanProductSelect.selectOption({ value: data.loan_product_id });
    } else {
      // Select first available product if ID not provided
      await this.loanProductSelect.waitFor({ state: 'visible', timeout: 5000 });
      const options = await this.loanProductSelect.locator('option').count();
      if (options > 1) {
        await this.loanProductSelect.selectOption({ index: 1 });
      }
    }
    
    // Fill requested amount
    await this.requestedAmountInput.fill(data.requested_loan_amount);
  }

  /**
   * Fill dynamic form fields based on JSON structure
   */
  async fillDynamicFields(formConfig: FormTestData['formConfig'], formData: Record<string, any>) {
    // Wait for form configuration to load
    await this.page.waitForTimeout(2000);

    // Iterate through categories and fields
    for (const category of formConfig.categories) {
      for (const field of category.fields) {
        const fieldId = field.fieldId;
        const value = formData[fieldId];

        if (value === undefined || value === null) {
          continue;
        }

        // Locate field by various possible selectors
        const fieldSelectors = [
          `input[id="${fieldId}"]`,
          `input[name="${fieldId}"]`,
          `input[data-field-id="${fieldId}"]`,
          `select[id="${fieldId}"]`,
          `select[name="${fieldId}"]`,
          `textarea[id="${fieldId}"]`,
          `textarea[name="${fieldId}"]`,
        ];

        let fieldElement: Locator | null = null;
        for (const selector of fieldSelectors) {
          const element = this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
            fieldElement = element;
            break;
          }
        }

        if (!fieldElement) {
          // Try to find by label text
          const label = this.page.locator(`label:has-text("${field.label}")`).first();
          if (await label.isVisible({ timeout: 1000 }).catch(() => false)) {
            const input = label.locator('..').locator('input, select, textarea').first();
            if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
              fieldElement = input;
            }
          }
        }

        if (fieldElement) {
          const fieldType = field.type;
          
          if (fieldType === 'text' || fieldType === 'email' || fieldType === 'number') {
            await fieldElement.fill(String(value));
          } else if (fieldType === 'select' || fieldType === 'dropdown') {
            await fieldElement.selectOption({ value: String(value) });
          } else if (fieldType === 'checkbox') {
            const isChecked = await fieldElement.isChecked();
            if (value && !isChecked) {
              await fieldElement.check();
            } else if (!value && isChecked) {
              await fieldElement.uncheck();
            }
          } else if (fieldType === 'textarea') {
            await fieldElement.fill(String(value));
          }
        }
      }
    }
  }

  /**
   * Upload file to a specific field
   */
  async uploadFile(fieldId: string, filePath: string) {
    // Locate file input for the field
    const fileInputSelectors = [
      `input[type="file"][data-field-id="${fieldId}"]`,
      `input[type="file"][name="${fieldId}"]`,
      `input[type="file"][id="${fieldId}"]`,
    ];

    let fileInput: Locator | null = null;
    for (const selector of fileInputSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        fileInput = element;
        break;
      }
    }

    // If not found, try to find by label
    if (!fileInput) {
      const label = this.page.locator(`label:has-text("${fieldId}"), label:contains("${fieldId}")`).first();
      if (await label.isVisible({ timeout: 1000 }).catch(() => false)) {
        const input = label.locator('..').locator('input[type="file"]').first();
        if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
          fileInput = input;
        }
      }
    }

    if (!fileInput) {
      throw new Error(`File input for field ${fieldId} not found`);
    }

    // Upload file
    await fileInput.setInputFiles(filePath);

    // Wait for upload to complete (look for success indicator)
    await this.page.waitForSelector(
      `text=/uploaded|success|complete/i, [data-field-id="${fieldId}"] .text-success`,
      { timeout: 10000 }
    ).catch(() => {
      // If no success message, wait a bit for upload to process
      return this.page.waitForTimeout(3000);
    });
  }

  /**
   * Verify file appears in attached list
   */
  async verifyFileAttached(fieldId: string, fileName: string): Promise<boolean> {
    // Look for file name in the UI - try multiple strategies
    const fileSelectors = [
      `[data-field-id="${fieldId}"]:has-text("${fileName}")`,
      `text="${fileName}"`,
      `[data-testid="uploaded-file-${fieldId}"]:has-text("${fileName}")`,
      // Also check for partial match (file name without extension)
      `text="${fileName.split('.')[0]}"`,
    ];

    for (const selector of fileSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        return true;
      }
    }

    // Fallback: check if any file is shown for this field
    const fieldContainer = this.page.locator(`[data-field-id="${fieldId}"], [data-testid="file-upload-${fieldId}"]`).first();
    if (await fieldContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if there's any file list or uploaded file indicator
      const hasFiles = await fieldContainer.locator('text=/file|upload|document/i').count() > 0;
      if (hasFiles) {
        return true;
      }
    }

    return false;
  }

  /**
   * Submit the form
   */
  async submitForm(expectSuccess = true) {
    await this.submitButton.click();
    
    if (expectSuccess) {
      // Wait for success message or navigation
      await Promise.race([
        this.successMessage.waitFor({ state: 'visible', timeout: 10000 }),
        this.page.waitForURL(/\/applications/, { timeout: 10000 }),
      ]);
    }
  }

  /**
   * Verify form structure matches JSON configuration
   */
  async verifyFormStructure(formConfig: FormTestData['formConfig']): Promise<void> {
    // Verify categories are present
    for (const category of formConfig.categories) {
      const categoryTitle = this.page.locator(`text="${category.categoryName}"`).first();
      await expect(categoryTitle).toBeVisible({ timeout: 5000 });
    }

    // Verify fields are present
    for (const category of formConfig.categories) {
      for (const field of category.fields) {
        // Look for field label
        const fieldLabel = this.page.locator(`label:has-text("${field.label}"), text="${field.label}"`).first();
        await expect(fieldLabel).toBeVisible({ timeout: 5000 });
      }
    }
  }

  /**
   * Get application ID from URL or page
   */
  async getApplicationId(): Promise<string | null> {
    // Try to extract from URL
    const urlMatch = this.page.url().match(/\/applications\/([^\/]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Try to find in page content
    const fileIdElement = this.page.locator('[data-testid="file-id"], text=/SF\\d+/').first();
    if (await fileIdElement.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await fileIdElement.textContent();
      return text?.trim() || null;
    }

    return null;
  }

  /**
   * Verify form data persists after reload
   */
  async verifyPersistedData(expectedData: FormTestData['formData']): Promise<void> {
    // Reload page
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');

    // Verify core fields
    const applicantName = await this.applicantNameInput.inputValue();
    expect(applicantName).toBe(expectedData.applicant_name);

    const amount = await this.requestedAmountInput.inputValue();
    expect(amount).toContain(expectedData.requested_loan_amount.replace(/[^0-9]/g, ''));
  }
}

