/**
 * Module 2: Form Validation Service
 * 
 * Implements soft validation (warnings, still allow submit)
 * Validates required fields, data types, formats
 */

import { LoanStatus } from '../../config/constants.js';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  missingRequiredFields: string[];
}

/**
 * Field validation rules
 */
export interface FieldValidationRule {
  fieldId: string;
  label: string;
  required: boolean;
  type: 'text' | 'file' | 'date' | 'number' | 'select' | 'checkbox' | 'textarea' | 'email' | 'phone' | 'pan' | 'aadhaar';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => string | null; // Returns error message or null
}

/**
 * Validate form data against form configuration
 * 
 * Module 2: Soft validation - returns warnings but allows submission
 * 
 * @param formData - Form data to validate
 * @param formConfig - Form configuration from backend
 * @param uploadedFiles - Uploaded files by field ID
 * @returns Validation result with warnings and errors
 */
export function validateFormData(
  formData: Record<string, any>,
  formConfig: any[],
  uploadedFiles: Record<string, File[]>
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const missingRequiredFields: string[] = [];

  // Extract all fields from form config
  const allFields: FieldValidationRule[] = [];
  formConfig.forEach((category: any) => {
    (category.fields || []).forEach((field: any) => {
      allFields.push({
        fieldId: field.fieldId || field['Field ID'],
        label: field.label || field['Field Label'],
        required: field.isRequired || field['Is Required'] === 'True',
        type: field.type || field['Field Type'] || 'text',
      });
    });
  });

  // Validate each field
  allFields.forEach((field) => {
    const value = formData[field.fieldId];
    const hasFile = uploadedFiles[field.fieldId] && uploadedFiles[field.fieldId].length > 0;

    // Check required fields
    if (field.required) {
      if (field.type === 'file') {
        if (!hasFile && (!value || value.trim().length === 0)) {
          missingRequiredFields.push(field.label);
          warnings.push(`Required document missing: ${field.label}`);
        }
      } else {
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          missingRequiredFields.push(field.label);
          warnings.push(`Required field missing: ${field.label}`);
        }
      }
    }

    // Type-specific validation (warnings only, not errors)
    if (value && typeof value === 'string' && value.trim().length > 0) {
      switch (field.type) {
        case 'email':
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(value)) {
            warnings.push(`${field.label} may not be a valid email address`);
          }
          break;
        case 'phone':
          const phonePattern = /^[\d\s\-\+\(\)]+$/;
          if (!phonePattern.test(value) || value.replace(/\D/g, '').length < 10) {
            warnings.push(`${field.label} may not be a valid phone number`);
          }
          break;
        case 'pan':
          const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
          if (!panPattern.test(value.toUpperCase())) {
            warnings.push(`${field.label} may not be a valid PAN format (e.g., ABCDE1234F)`);
          }
          break;
        case 'aadhaar':
          const aadhaarPattern = /^[0-9]{12}$/;
          if (!aadhaarPattern.test(value.replace(/\s+/g, ''))) {
            warnings.push(`${field.label} may not be a valid Aadhaar number (12 digits)`);
          }
          break;
      }
    }
  });

  // Soft validation: warnings don't block submission
  // Only critical errors (like missing core fields) would block
  const isValid = missingRequiredFields.length === 0 || missingRequiredFields.length < allFields.filter(f => f.required).length;

  return {
    isValid,
    warnings,
    errors: [], // No hard errors in soft validation
    missingRequiredFields,
  };
}

/**
 * Validate PAN format
 */
export function validatePAN(pan: string): boolean {
  if (!pan) return false;
  const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panPattern.test(pan.trim().toUpperCase());
}

/**
 * Validate Aadhaar format
 */
export function validateAadhaar(aadhaar: string): boolean {
  if (!aadhaar) return false;
  const aadhaarPattern = /^[0-9]{12}$/;
  return aadhaarPattern.test(aadhaar.replace(/\s+/g, ''));
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}






