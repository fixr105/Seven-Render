/**
 * Strict Mandatory Field Validation Service
 *
 * Uses simple form config (Form Link + Record Titles). File fields are satisfied by
 * checklist: added_to_link or to_be_shared. Blocks submission if mandatory fields are missing.
 *
 * Used in POST /loan-applications/:id/submit endpoint
 */

import { getSimpleFormConfig } from '../formConfig/simpleFormConfig.service.js';

/** Indian PAN format: 5 letters + 4 digits + 1 letter. Normalize by stripping spaces/dashes before validation. */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

function normalizePanInput(value: string): string {
  return value.replace(/\s+/g, '').replace(/-/g, '').trim().toUpperCase();
}

function isPanField(field: { fieldId: string; label: string; type: string }): boolean {
  const t = (field.type || '').toLowerCase();
  const id = (field.fieldId || '').toLowerCase();
  const label = (field.label || '').toLowerCase();
  return t === 'pan' || id.includes('pan') || label.includes('pan');
}

function isValidPan(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const normalized = normalizePanInput(value);
  return normalized.length === 0 || PAN_REGEX.test(normalized);
}

/** PAN key aliases that clients may send (e.g. from different form versions). */
const PAN_KEY_ALIASES = ['pan', 'pan_card', 'pan_number'];

/** File/document radio option values; do not run PAN format validation on these. */
const FILE_OPTION_VALUES = new Set([
  'Yes, Added to Folder',
  'Awaiting, Will Update Folder',
  'added_to_link',
  'to_be_shared',
  'yes_added_to_folder',
  'awaiting_will_update',
  'Not Available',
  'not_available',
]);

function isFileOptionValue(value: unknown): boolean {
  if (value == null) return false;
  const s = typeof value === 'string' ? value.trim() : String(value).trim();
  return s.length > 0 && FILE_OPTION_VALUES.has(s);
}

/**
 * Resolve value for a field from formData. For PAN fields, also check common aliases.
 */
function getFieldValue(
  formData: Record<string, any>,
  field: { fieldId: string; label: string; type: string; displayKey?: string },
  isPan: boolean
): unknown {
  const displayKey = (field as any).displayKey;
  let value = formData[displayKey] ?? formData[field.fieldId];
  if (isPan && (value == null || (typeof value === 'string' && value.trim().length === 0))) {
    for (const key of PAN_KEY_ALIASES) {
      const v = formData[key];
      if (v != null && typeof v === 'string' && v.trim().length > 0) {
        value = v;
        break;
      }
    }
  }
  return value;
}

/**
 * Mandatory field validation result
 */
export interface MandatoryFieldValidationResult {
  isValid: boolean;
  missingFields: Array<{
    fieldId: string;
    label: string;
    type: string;
    displayKey?: string;
  }>;
  formatErrors?: Array<{
    fieldId: string;
    label: string;
    message: string;
  }>;
  errorMessage?: string;
}

/**
 * Load form fields configuration for a client/product.
 * Uses product-embedded config (Section N, Field N) when available; else Product Documents.
 */
async function loadFormFieldsConfig(
  clientId: string,
  productId?: string
): Promise<Array<{
  fieldId: string;
  label: string;
  type: string;
  isMandatory: boolean;
  category: string;
}>> {
  let config: { categories: Array<{ categoryId: string; fields: Array<{ fieldId: string; label: string; type: string; isRequired: boolean }> }> };
  if (productId) {
    const { getFormConfigForProduct } = await import('../formConfig/productFormConfig.service.js');
    config = await getFormConfigForProduct(productId);
  } else {
    config = await getSimpleFormConfig(clientId, undefined);
  }
  if (config.categories.length === 0 && productId) {
    config = await getSimpleFormConfig(clientId, undefined);
  }

  const fieldConfigs: Array<{
    fieldId: string;
    label: string;
    type: string;
    isMandatory: boolean;
    category: string;
    categoryName: string;
    displayKey: string;
  }> = [];

  const defaultCategoryName = 'Documents';
  for (const cat of config.categories) {
    const categoryName = (cat as any).categoryName || (cat as any)['Category Name'] || cat.categoryId || defaultCategoryName;
    for (const f of cat.fields) {
      const displayKey = `${f.label} - ${categoryName}`;
      fieldConfigs.push({
        fieldId: f.fieldId,
        label: f.label,
        type: f.type,
        isMandatory: f.isRequired,
        category: cat.categoryId,
        categoryName,
        displayKey,
      });
    }
  }

  return fieldConfigs;
}

/**
 * Validate mandatory fields for a loan application
 * 
 * @param formData - Form data from application (parsed from 'Form Data' field)
 * @param clientId - Client ID
 * @param productId - Product ID (optional)
 * @param documentLinks - Document links by field ID (for file fields)
 * @returns Validation result with missing mandatory fields
 */
export async function validateMandatoryFields(
  formData: Record<string, any>,
  clientId: string,
  productId?: string,
  documentLinks?: Record<string, string>
): Promise<MandatoryFieldValidationResult> {
  // Load form fields configuration
  const fieldConfigs = await loadFormFieldsConfig(clientId, productId);

  // Filter to only mandatory fields
  const mandatoryFields = fieldConfigs.filter((f) => f.isMandatory);

  // Validate each mandatory field
  const missingFields: Array<{
    fieldId: string;
    label: string;
    type: string;
    displayKey?: string;
  }> = [];

  const formatErrors: Array<{ fieldId: string; label: string; message: string }> = [];

  mandatoryFields.forEach((field) => {
    const value = getFieldValue(formData, field, isPanField(field));
    // File fields: satisfied by new values (Yes, Added to Folder, Awaiting, Will Update Folder)
    // or legacy values (added_to_link, to_be_shared)
    const fileFieldSatisfied = field.type === 'file' && (
      value === 'Yes, Added to Folder' || value === 'Awaiting, Will Update Folder' ||
      value === 'added_to_link' || value === 'to_be_shared' ||
      value === 'yes_added_to_folder' || value === 'awaiting_will_update'
    );

    // Format validation for PAN fields (when value is present). Skip for file-type or file-option values.
    if (
      isPanField(field) &&
      field.type !== 'file' &&
      value &&
      typeof value === 'string' &&
      value.trim().length > 0 &&
      !isFileOptionValue(value)
    ) {
      if (!isValidPan(value)) {
        formatErrors.push({
          fieldId: field.fieldId,
          label: field.label,
          message: 'Invalid PAN format. PAN must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F).',
        });
      }
    }

    // Check if field is empty
    let isEmpty = false;

    if (field.type === 'file') {
      isEmpty = !fileFieldSatisfied;
    } else if (field.type === 'checkbox') {
      // For checkboxes, check if value is true
      isEmpty = value !== true && value !== 'true';
    } else {
      // For other fields, check if value is empty or whitespace
      isEmpty = !value || (typeof value === 'string' && value.trim().length === 0);
    }

    if (isEmpty) {
      missingFields.push({
        fieldId: field.fieldId,
        label: field.label,
        type: field.type,
        displayKey: (field as any).displayKey,
      });
    }
  });

  // Also validate PAN format for any non-mandatory PAN field that has a value. Skip for file-type or file-option values.
  const allFieldConfigs = await loadFormFieldsConfig(clientId, productId);
  allFieldConfigs.forEach((field) => {
    if (!isPanField(field) || field.type === 'file') return;
    const value = getFieldValue(formData, field, true);
    if (!value || typeof value !== 'string' || value.trim().length === 0) return;
    if (isFileOptionValue(value)) return;
    if (formatErrors.some((e) => e.fieldId === field.fieldId)) return;
    if (!isValidPan(value)) {
      formatErrors.push({
        fieldId: field.fieldId,
        label: field.label,
        message: 'Invalid PAN format. PAN must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F).',
      });
    }
  });

  const isValid = missingFields.length === 0 && formatErrors.length === 0;

  if (!isValid) {
    const formDataKeys = Object.keys(formData).slice(0, 20).join(', ');
    console.warn('[validateMandatoryFields] Validation failed', {
      missingCount: missingFields.length,
      formatErrorCount: formatErrors.length,
      missingFieldIds: missingFields.map((f) => f.fieldId),
      formDataKeysSample: formDataKeys + (Object.keys(formData).length > 20 ? '...' : ''),
    });
  }

  return {
    isValid,
    missingFields,
    formatErrors: formatErrors.length > 0 ? formatErrors : undefined,
    errorMessage: isValid
      ? undefined
      : missingFields.length > 0
        ? `Missing ${missingFields.length} required field(s): ${missingFields.map((f) => f.label).join(', ')}`
        : formatErrors.length > 0
          ? formatErrors.map((e) => `${e.label}: ${e.message}`).join('; ')
          : undefined,
  };
}


