/**
 * B2C EV form validation — mirrors src/lib/b2cEvFormValidation.ts + b2cEvFormSchema.ts
 * Used when _meta.formTemplate === 'b2c_ev_v1'
 */

import { isValidEmailFormat, parseIndianMobile } from '../../utils/basicApplicationFields.validation.js';

export const B2C_EV_FORM_TEMPLATE_ID = 'b2c_ev_v1';

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const DEALER_POPULATED_KEYS = [
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

type FieldDef = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
};

const CO_APPLICANT_FIELDS: FieldDef[] = [
  { key: 'coApplicant.name', label: 'Co-Applicant Name', type: 'text', required: true },
  { key: 'coApplicant.dob', label: 'Date of Birth', type: 'date', required: true },
  { key: 'coApplicant.email', label: 'Email', type: 'email', required: true },
  { key: 'coApplicant.pan', label: 'PAN', type: 'text', required: true },
  { key: 'coApplicant.address.line1', label: 'Address Line 1', type: 'text', required: true },
  { key: 'coApplicant.address.village', label: 'Village', type: 'text', required: true },
  { key: 'coApplicant.address.pincode', label: 'Pincode', type: 'text', required: true },
  { key: 'coApplicant.address.district', label: 'District', type: 'text', required: true },
  { key: 'coApplicant.address.state', label: 'State', type: 'text', required: true },
  { key: 'coApplicant.drivingLicense', label: 'Driving Licence', type: 'text', required: true },
  { key: 'coApplicant.mobile', label: 'Mobile', type: 'tel', required: true },
  { key: 'coApplicant.relationship', label: 'Relationship with Borrower', type: 'select', required: true },
];

const GUARANTOR_FIELDS: FieldDef[] = [
  { key: 'guarantor.name', label: 'Guarantor Name', type: 'text', required: true },
  { key: 'guarantor.dob', label: 'Date of Birth', type: 'date', required: true },
  { key: 'guarantor.email', label: 'Email', type: 'email', required: true },
  { key: 'guarantor.pan', label: 'PAN', type: 'text', required: true },
  { key: 'guarantor.address.line1', label: 'Address Line 1', type: 'text', required: true },
  { key: 'guarantor.address.village', label: 'Village', type: 'text', required: true },
  { key: 'guarantor.address.pincode', label: 'Pincode', type: 'text', required: true },
  { key: 'guarantor.address.district', label: 'District', type: 'text', required: true },
  { key: 'guarantor.address.state', label: 'State', type: 'text', required: true },
  { key: 'guarantor.drivingLicense', label: 'Driving Licence', type: 'text', required: true },
  { key: 'guarantor.mobile', label: 'Mobile', type: 'tel', required: true },
  { key: 'guarantor.relationship', label: 'Relationship with Borrower', type: 'select', required: true },
];

const BASE_REQUIRED_FIELDS: FieldDef[] = [
  { key: 'borrower.firstName', label: 'First Name', type: 'text', required: true },
  { key: 'borrower.lastName', label: 'Last Name', type: 'text', required: true },
  { key: 'borrower.gender', label: 'Gender', type: 'select', required: true },
  { key: 'borrower.dob', label: 'Date of Birth', type: 'date', required: true },
  { key: 'borrower.fatherName', label: 'Father Name', type: 'text', required: true },
  { key: 'borrower.mobile', label: 'Mobile Number', type: 'tel', required: true },
  { key: 'borrower.email', label: 'Email', type: 'email', required: true },
  { key: 'borrower.pan', label: 'PAN Card', type: 'text', required: true },
  { key: 'borrower.address.line1', label: 'Address Line 1', type: 'text', required: true },
  { key: 'borrower.address.village', label: 'Village', type: 'text', required: true },
  { key: 'borrower.address.pincode', label: 'Pincode', type: 'text', required: true },
  { key: 'borrower.address.district', label: 'District', type: 'text', required: true },
  { key: 'borrower.address.state', label: 'State', type: 'text', required: true },
  { key: 'loan.amount', label: 'Loan Amount', type: 'currency', required: true },
  { key: 'loan.interestRate', label: 'Interest Rate', type: 'percent', required: true },
  { key: 'loan.tenureMonths', label: 'Tenure (months)', type: 'number', required: true },
  { key: 'loan.processingFee', label: 'Processing Fee', type: 'currency', required: true },
  { key: 'loan.gpsCharges', label: 'GPS Charges / IOT', type: 'currency', required: true },
  { key: 'insurance.cost', label: 'Insurance Cost', type: 'currency', required: true },
  { key: 'insurance.provider', label: 'Insurance Provider', type: 'text', required: true },
  { key: 'insurance.policyNumber', label: 'Policy Number', type: 'text', required: true },
  { key: 'insurance.issuedDate', label: 'Policy Issued Date', type: 'date', required: true },
  { key: 'insurance.periodMonths', label: 'Period of Insurance (months)', type: 'number', required: true },
  { key: 'vehicle.cost', label: 'Cost of Vehicle', type: 'currency', required: true },
  { key: 'vehicle.manufacturingYear', label: 'Manufacturing Year', type: 'number', required: true },
  { key: 'vehicle.invoiceDate', label: 'Sales Invoice Date', type: 'date', required: true },
  { key: 'vehicle.downpayment', label: 'Downpayment Paid by Borrower', type: 'currency', required: true },
  { key: 'vehicle.registrationCost', label: 'Vehicle Registration Cost', type: 'currency', required: true },
];

const COMPLIANCE_REQUIRED_FIELDS: FieldDef[] = [
  { key: 'compliance.vkycDone', label: 'VKYC done', type: 'checkbox', required: true },
  { key: 'compliance.loanAgreementSigned', label: 'Loan agreement signed', type: 'checkbox', required: true },
  { key: 'compliance.enachDone', label: 'ENach done', type: 'checkbox', required: true },
];

function isComplianceValueTruthy(value: string): boolean {
  return value === 'true' || value === 'TRUE' || value === 'True';
}

export type B2cEvValidationResult = {
  isValid: boolean;
  errorMessage?: string;
  missingFields: Array<{ fieldId: string; label: string; type: string; displayKey?: string }>;
  formatErrors: Array<{ fieldId: string; message: string }>;
};

function readValue(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value).trim();
}

function normalizePan(value: string): string {
  return value.replace(/\s+/g, '').replace(/-/g, '').trim().toUpperCase();
}

function isPanField(field: FieldDef): boolean {
  return field.key.endsWith('.pan') || field.label.toLowerCase().includes('pan');
}

function validateFieldFormat(field: FieldDef, value: string): string | null {
  if (field.type === 'email' && !isValidEmailFormat(value)) {
    return 'Please enter a valid email address';
  }
  if (field.type === 'tel') {
    const parsed = parseIndianMobile(value);
    if (parsed.ok === false) {
      return 'Please enter a valid 10-digit Indian mobile number';
    }
  }
  if (isPanField(field)) {
    const normalized = normalizePan(value);
    if (normalized.length > 0 && !PAN_REGEX.test(normalized)) {
      return 'PAN must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F)';
    }
  }
  if (field.key === 'dealer.ifscCode') {
    const normalized = value.toUpperCase();
    if (normalized.length !== 11 || !IFSC_REGEX.test(normalized)) {
      return 'IFSC must be 11 characters (e.g. HDFC0001885)';
    }
  }
  return null;
}

export function isB2cEvFormTemplate(formData: Record<string, unknown>): boolean {
  return readValue(formData, '_meta.formTemplate') === B2C_EV_FORM_TEMPLATE_ID;
}

export function validateB2cEvFormData(
  formData: Record<string, unknown>,
  productId?: string
): B2cEvValidationResult {
  const missingFields: B2cEvValidationResult['missingFields'] = [];
  const formatErrors: B2cEvValidationResult['formatErrors'] = [];

  if (!productId) {
    missingFields.push({
      fieldId: 'loan_product_id',
      label: 'Loan Product',
      type: 'select',
      displayKey: 'loan_product_id',
    });
  }

  for (const key of DEALER_POPULATED_KEYS) {
    if (!readValue(formData, key)) {
      missingFields.push({
        fieldId: key,
        label: key.replace('dealer.', 'Dealer '),
        type: 'text',
        displayKey: key,
      });
    }
  }

  const supportType = readValue(formData, '_meta.supportPersonType');
  if (!supportType || supportType === 'none') {
    missingFields.push({
      fieldId: '_meta.supportPersonType',
      label: 'Co-applicant or Guarantor',
      type: 'select',
      displayKey: '_meta.supportPersonType',
    });
  }

  const supportFields =
    supportType === 'co_applicant'
      ? CO_APPLICANT_FIELDS
      : supportType === 'guarantor'
        ? GUARANTOR_FIELDS
        : [];

  const fieldsToValidate = [...BASE_REQUIRED_FIELDS, ...supportFields];

  const geoPhotoSlots = [
    {
      urlKey: 'geoPhotos.withSupportPerson.url',
      latitudeKey: 'geoPhotos.withSupportPerson.latitude',
      longitudeKey: 'geoPhotos.withSupportPerson.longitude',
      label: 'Upload geo tagged photo with borrower',
    },
    {
      urlKey: 'geoPhotos.withVehicle.url',
      latitudeKey: 'geoPhotos.withVehicle.latitude',
      longitudeKey: 'geoPhotos.withVehicle.longitude',
      label: 'Upload geo tagged photo of borrower with vehicle',
    },
    {
      urlKey: 'geoPhotos.atResidence.url',
      latitudeKey: 'geoPhotos.atResidence.latitude',
      longitudeKey: 'geoPhotos.atResidence.longitude',
      label: 'Upload geo tagged photo of borrower at residence location',
    },
  ] as const;

  for (const slot of geoPhotoSlots) {
    if (!readValue(formData, slot.urlKey)) {
      missingFields.push({
        fieldId: slot.urlKey,
        label: slot.label,
        type: 'file',
        displayKey: slot.urlKey,
      });
      continue;
    }
    const latitude = readValue(formData, slot.latitudeKey);
    const longitude = readValue(formData, slot.longitudeKey);
    if (!latitude || !longitude) {
      missingFields.push({
        fieldId: slot.latitudeKey,
        label: `${slot.label} location`,
        type: 'text',
        displayKey: slot.latitudeKey,
      });
    }
  }

  for (const field of fieldsToValidate) {
    if (!field.required) continue;
    const value = readValue(formData, field.key);
    if (!value) {
      missingFields.push({
        fieldId: field.key,
        label: field.label,
        type: field.type,
        displayKey: field.key,
      });
      continue;
    }
    const formatError = validateFieldFormat(field, value);
    if (formatError) {
      formatErrors.push({ fieldId: field.key, message: formatError });
    }
  }

  const firstName = readValue(formData, 'borrower.firstName');
  const lastName = readValue(formData, 'borrower.lastName');
  if (!firstName && !lastName && !readValue(formData, 'borrower.customerName')) {
    if (!missingFields.some((f) => f.fieldId === 'borrower.firstName')) {
      missingFields.push({
        fieldId: 'borrower.firstName',
        label: 'First Name',
        type: 'text',
        displayKey: 'borrower.firstName',
      });
    }
  }

  for (const field of COMPLIANCE_REQUIRED_FIELDS) {
    if (!isComplianceValueTruthy(readValue(formData, field.key))) {
      missingFields.push({
        fieldId: field.key,
        label: field.label,
        type: field.type,
        displayKey: field.key,
      });
    }
  }

  const isValid = missingFields.length === 0 && formatErrors.length === 0;
  return {
    isValid,
    errorMessage: isValid
      ? undefined
      : formatErrors.length > 0
        ? 'Please fix format errors before submitting'
        : 'Missing required fields',
    missingFields,
    formatErrors,
  };
}
