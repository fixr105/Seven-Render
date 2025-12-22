/**
 * Strict Mandatory Field Validation Service
 * 
 * Enforces "Is Mandatory" flag from Form Fields Airtable table (tbl5oZ6zI0dc5eutw)
 * Blocks submission if any mandatory fields are missing
 * 
 * Used in POST /loan-applications/:id/submit endpoint
 */

import { n8nClient } from '../airtable/n8nClient.js';

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
  errorMessage?: string;
}

/**
 * Load form fields configuration for a client/product
 * Returns fields with their mandatory status
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
  // Fetch form configuration tables
  const [mappings, categories, fields] = await Promise.all([
    n8nClient.fetchTable('Client Form Mapping'),
    n8nClient.fetchTable('Form Categories'),
    n8nClient.fetchTable('Form Fields'),
  ]);

  // Filter mappings for this client
  let clientMappings = mappings.filter((m) => {
    const mappingClientId = m.Client || m.client || m['Client ID'];
    return mappingClientId === clientId || 
           mappingClientId === clientId?.toString() ||
           clientId === mappingClientId?.toString();
  });

  // Filter by productId if specified
  if (productId) {
    clientMappings = clientMappings.filter((m) => {
      const mappingProductId = m['Product ID'] || m.productId;
      return !mappingProductId || mappingProductId === productId || mappingProductId === productId?.toString();
    });
  }

  // Get category IDs that have mappings for this client
  const mappedCategoryIds = new Set(
    clientMappings.map((m) => m.Category || m.category).filter(Boolean)
  );

  // Get active categories
  const activeCategories = categories.filter((cat) => {
    const categoryId = cat['Category ID'] || cat.id || cat.categoryId;
    const isActive = cat.Active === 'True' || cat.active === true;
    return isActive && mappedCategoryIds.has(categoryId);
  });

  // Build field configuration with mandatory status
  const fieldConfigs: Array<{
    fieldId: string;
    label: string;
    type: string;
    isMandatory: boolean;
    category: string;
  }> = [];

  activeCategories.forEach((cat) => {
    const categoryId = cat['Category ID'] || cat.id || cat.categoryId;
    
    // Find all fields for this category
    const categoryFields = fields.filter((f) => {
      const fieldCategory = f.Category || f.category;
      const fieldActive = f.Active === 'True' || f.active === true;
      return fieldCategory === categoryId && fieldActive;
    });

    categoryFields.forEach((f) => {
      // Find mapping for this field (if exists)
      const mapping = clientMappings.find(
        (m) => (m.Category || m.category) === categoryId
      );

      // Determine if field is mandatory:
      // 1. Check "Is Mandatory" flag from Form Fields table (primary source)
      // 2. Check "Is Required" flag from Client Form Mapping (can override)
      const isMandatoryFromField = f['Is Mandatory'] === 'True' || f.isMandatory === true;
      const isRequiredFromMapping = mapping?.['Is Required'] === 'True' || mapping?.isRequired === true;
      
      // Field is mandatory if either flag is true
      const isMandatory = isMandatoryFromField || isRequiredFromMapping;

      fieldConfigs.push({
        fieldId: f['Field ID'] || f.fieldId || f.id,
        label: f['Field Label'] || f.fieldLabel || f.label,
        type: f['Field Type'] || f.fieldType || f.type || 'text',
        isMandatory,
        category: categoryId,
      });
    });
  });

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

  mandatoryFields.forEach((field) => {
    const value = formData[field.fieldId];
    const hasDocument = documentLinks?.[field.fieldId] && documentLinks[field.fieldId].trim().length > 0;

    // Check if field is empty
    let isEmpty = false;

    if (field.type === 'file') {
      // For file fields, check if document link exists
      isEmpty = !hasDocument && (!value || (typeof value === 'string' && value.trim().length === 0));
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

  const isValid = missingFields.length === 0;

  return {
    isValid,
    missingFields,
    errorMessage: isValid
      ? undefined
      : `Missing ${missingFields.length} required field(s): ${missingFields.map((f) => f.label).join(', ')}`,
  };
}

