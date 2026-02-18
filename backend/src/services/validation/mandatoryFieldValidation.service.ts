/**
 * Strict Mandatory Field Validation Service
 *
 * Uses simple form config (Form Link + Record Titles). File fields are satisfied by
 * checklist: added_to_link or to_be_shared. Blocks submission if mandatory fields are missing.
 *
 * Used in POST /loan-applications/:id/submit endpoint
 */

import { getSimpleFormConfig } from '../formConfig/simpleFormConfig.service.js';

/** Indian PAN format: 5 letters + 4 digits + 1 letter */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

function isPanField(field: { fieldId: string; label: string; type: string }): boolean {
  const t = (field.type || '').toLowerCase();
  const id = (field.fieldId || '').toLowerCase();
  const label = (field.label || '').toLowerCase();
  return t === 'pan' || id.includes('pan') || label.includes('pan');
}

function isValidPan(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim().toUpperCase();
  return PAN_REGEX.test(trimmed);
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
  }> = [];

  for (const cat of config.categories) {
    for (const f of cat.fields) {
      fieldConfigs.push({
        fieldId: f.fieldId,
        label: f.label,
        type: f.type,
        isMandatory: f.isRequired,
        category: cat.categoryId,
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
  }> = [];

  const formatErrors: Array<{ fieldId: string; label: string; message: string }> = [];

  mandatoryFields.forEach((field) => {
    const value = formData[field.fieldId];
    // For file fields (3-checkbox): added_to_link or to_be_shared counts as satisfied
    const fileFieldSatisfied = field.type === 'file' && (value === 'added_to_link' || value === 'to_be_shared');

    // Format validation for PAN fields (when value is present)
    if (isPanField(field) && value && typeof value === 'string' && value.trim().length > 0) {
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
      });
    }
  });

  // Also validate PAN format for any non-mandatory PAN field that has a value
  const allFieldConfigs = await loadFormFieldsConfig(clientId, productId);
  allFieldConfigs.forEach((field) => {
    if (!isPanField(field)) return;
    const value = formData[field.fieldId];
    if (!value || typeof value !== 'string' || value.trim().length === 0) return;
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


