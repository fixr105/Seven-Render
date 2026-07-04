import { getPanValidationError } from '../utils/panValidation';
import { isValidEmailFormat, parseIndianMobile } from '../utils/basicApplicationFieldsValidation';
import type { B2cEvStage } from '../config/forms/b2cEvFormSchema';
import { isPanLookupSuccessful } from './b2cEvPanLookup';

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Dealer fields auto-filled from Client KYC — must be populated before submit. */
export const B2C_EV_DEALER_POPULATED_KEYS = [
  'dealer.id',
  'dealer.displayLabel',
  'dealer.tradeName',
  'dealer.name',
  'dealer.contact',
  'dealer.email',
  'dealer.gstNumber',
  'dealer.pan',
  'dealer.ifscCode',
] as const;

export interface B2cEvFormCompletion {
  isComplete: boolean;
  errors: Record<string, string>;
  missingByStage: Array<{ stageId: string; stageTitle: string; fieldLabels: string[] }>;
}

function validateDealerPopulated(formData: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of B2C_EV_DEALER_POPULATED_KEYS) {
    if (isEmptyValue(readValue(formData, key))) {
      errors[key] = 'Dealer profile is incomplete — contact your KAM';
    }
  }
  return errors;
}

function readValue(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value).trim();
}

function isEmptyValue(value: string): boolean {
  return value.length === 0;
}

export function syncB2cEvComputedFields(formData: Record<string, unknown>): Record<string, unknown> {
  const next = { ...formData };
  const firstName = readValue(next, 'borrower.firstName');
  const lastName = readValue(next, 'borrower.lastName');
  next['borrower.customerName'] = [firstName, lastName].filter(Boolean).join(' ').trim();

  const loanAmount = Number(String(next['loan.amount'] ?? '').replace(/,/g, '')) || 0;
  const processingFee = Number(String(next['loan.processingFee'] ?? '').replace(/,/g, '')) || 0;
  const gpsCharges = Number(String(next['loan.gpsCharges'] ?? '').replace(/,/g, '')) || 0;
  if (loanAmount > 0) {
    next['loan.processingFeePercent'] = ((processingFee / loanAmount) * 100).toFixed(2);
    next['loan.disbursalAmount'] = String(Math.max(loanAmount - processingFee - gpsCharges, 0));
  }

  if (!readValue(next, 'bank.customerName') && readValue(next, 'borrower.customerName')) {
    next['bank.customerName'] = readValue(next, 'borrower.customerName');
  }

  return next;
}

export function validateB2cEvStage(
  stage: B2cEvStage,
  formData: Record<string, unknown>,
  options: { loanProductId?: string; saveAsDraft?: boolean } = {}
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options.saveAsDraft) return errors;

  if (stage.id === 'product' && !options.loanProductId) {
    errors.loan_product_id = 'Loan product is required';
  }

  if (stage.id === 'product') {
    for (const field of stage.fields) {
      const value = readValue(formData, field.key);
      if (field.required && isEmptyValue(value)) {
        errors[field.key] = `${field.label} is required`;
        continue;
      }
      if (isEmptyValue(value)) continue;

      if (field.type === 'email' && !isValidEmailFormat(value)) {
        errors[field.key] = 'Please enter a valid email address';
      }
      if (field.type === 'tel') {
        const parsed = parseIndianMobile(value);
        if (parsed.ok === false) {
          errors[field.key] = 'Please enter a valid 10-digit Indian mobile number';
        }
      }
      if (field.key === '_meta.panLookup.panNumber') {
        const panError = getPanValidationError(value);
        if (panError) errors[field.key] = panError;
      }
    }
    if (Object.keys(errors).length > 0) return errors;
    if (!options.loanProductId) return errors;
    return errors;
  }

  if (stage.id === 'borrower' && !isPanLookupSuccessful(formData)) {
    errors['_meta.panLookup.status'] =
      'Borrower details must be verified on the Loan Product step before continuing';
    return errors;
  }

  if (stage.id === 'support-person') {
    const supportType = readValue(formData, '_meta.supportPersonType');
    if (!supportType || supportType === 'none') {
      errors['_meta.supportPersonType'] = 'Select co-applicant or guarantor';
    }
    return errors;
  }

  if (stage.id === 'review') return errors;

  for (const field of stage.fields) {
    if (field.readOnly) continue;
    const value = readValue(formData, field.key);
    if (field.required && isEmptyValue(value)) {
      errors[field.key] = `${field.label} is required`;
      continue;
    }
    if (isEmptyValue(value)) continue;

    if (field.type === 'email' && !isValidEmailFormat(value)) {
      errors[field.key] = 'Please enter a valid email address';
    }
    if (field.type === 'tel') {
      const parsed = parseIndianMobile(value);
      if (parsed.ok === false) {
        errors[field.key] = 'Please enter a valid 10-digit Indian mobile number';
      }
    }
    if (field.key.endsWith('.pan') || field.label.toLowerCase().includes('pan')) {
      const panError = getPanValidationError(value);
      if (panError) errors[field.key] = panError;
    }
    if (field.key === 'bank.ifscCode' || field.key === 'dealer.ifscCode') {
      const normalized = value.toUpperCase();
      if (normalized.length !== 11 || !IFSC_REGEX.test(normalized)) {
        errors[field.key] = 'IFSC must be 11 characters (e.g. HDFC0001885)';
      }
    }
  }

  return errors;
}

export function validateB2cEvForm(
  stages: B2cEvStage[],
  formData: Record<string, unknown>,
  loanProductId: string
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const stage of stages) {
    Object.assign(errors, validateB2cEvStage(stage, formData, { loanProductId }));
    if (stage.id === 'dealer') {
      Object.assign(errors, validateDealerPopulated(formData));
    }
  }
  if (!readValue(formData, 'borrower.customerName')) {
    errors['borrower.firstName'] = errors['borrower.firstName'] || 'Borrower name is required';
  }
  return errors;
}

export function getB2cEvFormCompletion(
  stages: B2cEvStage[],
  formData: Record<string, unknown>,
  loanProductId: string
): B2cEvFormCompletion {
  const errors = validateB2cEvForm(stages, formData, loanProductId);
  const missingByStage: B2cEvFormCompletion['missingByStage'] = [];

  for (const stage of stages) {
    if (stage.id === 'review') continue;
    const stageErrors = validateB2cEvStage(stage, formData, { loanProductId });
    if (stage.id === 'dealer') {
      Object.assign(stageErrors, validateDealerPopulated(formData));
    }
    const stageErrorKeys = Object.keys(stageErrors);
    if (stageErrorKeys.length === 0) continue;

    const fieldLabels = stageErrorKeys.map((key) => {
      if (key === 'loan_product_id') return 'Loan Product';
      const field = stage.fields.find((f) => f.key === key);
      return field?.label ?? key;
    });

    missingByStage.push({
      stageId: stage.id,
      stageTitle: stage.title,
      fieldLabels,
    });
  }

  return {
    isComplete: Object.keys(errors).length === 0,
    errors,
    missingByStage,
  };
}

export function validateBorrowerStageAccessible(formData: Record<string, unknown>): boolean {
  return isPanLookupSuccessful(formData);
}

export function clearSupportPersonFields(
  formData: Record<string, unknown>,
  type: 'co_applicant' | 'guarantor' | 'none'
): Record<string, unknown> {
  const next = { ...formData };
  const prefixes =
    type === 'co_applicant'
      ? ['guarantor.']
      : type === 'guarantor'
        ? ['coApplicant.']
        : ['coApplicant.', 'guarantor.'];
  for (const key of Object.keys(next)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      delete next[key];
    }
  }
  return next;
}
