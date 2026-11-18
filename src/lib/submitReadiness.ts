/**
 * Unmet Express POST /loan-applications/{id}/submit requirements for the B2C EV product.
 * Lines are plain language. This does not invent a value for any key.
 */

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

type FieldDef = { key: string; label: string; type: 'text' | 'email' | 'tel' | 'pan' | 'ifsc' };

const DEALER_FIELDS: FieldDef[] = [
  { key: 'dealer.id', label: 'Dealer id', type: 'text' },
  { key: 'dealer.displayLabel', label: 'Dealer display label', type: 'text' },
  { key: 'dealer.tradeName', label: 'Dealer trade name', type: 'text' },
  { key: 'dealer.name', label: 'Dealer name', type: 'text' },
  { key: 'dealer.contact', label: 'Dealer contact', type: 'text' },
  { key: 'dealer.email', label: 'Dealer email', type: 'email' },
  { key: 'dealer.gstNumber', label: 'Dealer GST number', type: 'text' },
  { key: 'dealer.pan', label: 'Dealer PAN', type: 'pan' },
  { key: 'dealer.ifscCode', label: 'Dealer IFSC', type: 'ifsc' },
];

const BORROWER_FIELDS: FieldDef[] = [
  { key: 'borrower.firstName', label: 'First name', type: 'text' },
  { key: 'borrower.lastName', label: 'Last name', type: 'text' },
  { key: 'borrower.gender', label: 'Gender', type: 'text' },
  { key: 'borrower.dob', label: 'Date of birth', type: 'text' },
  { key: 'borrower.fatherName', label: 'Father name', type: 'text' },
  { key: 'borrower.mobile', label: 'Mobile number', type: 'tel' },
  { key: 'borrower.email', label: 'Email', type: 'email' },
  { key: 'borrower.pan', label: 'PAN', type: 'pan' },
  { key: 'borrower.address.line1', label: 'Address line 1', type: 'text' },
  { key: 'borrower.address.village', label: 'Village', type: 'text' },
  { key: 'borrower.address.pincode', label: 'Pincode', type: 'text' },
  { key: 'borrower.address.district', label: 'District', type: 'text' },
  { key: 'borrower.address.state', label: 'State', type: 'text' },
];

const LOAN_FIELDS: FieldDef[] = [
  { key: 'loan.amount', label: 'Loan amount', type: 'text' },
  { key: 'loan.interestRate', label: 'Interest rate', type: 'text' },
  { key: 'loan.tenureMonths', label: 'Tenure', type: 'text' },
  { key: 'loan.processingFee', label: 'Processing fee', type: 'text' },
  { key: 'loan.gpsCharges', label: 'GPS charges', type: 'text' },
];

const INSURANCE_FIELDS: FieldDef[] = [
  { key: 'insurance.cost', label: 'Insurance cost', type: 'text' },
  { key: 'insurance.provider', label: 'Insurance provider', type: 'text' },
  { key: 'insurance.policyNumber', label: 'Policy number', type: 'text' },
  { key: 'insurance.issuedDate', label: 'Policy issued date', type: 'text' },
  { key: 'insurance.periodMonths', label: 'Insurance period', type: 'text' },
];

const VEHICLE_FIELDS: FieldDef[] = [
  { key: 'vehicle.cost', label: 'Vehicle cost', type: 'text' },
  { key: 'vehicle.manufacturingYear', label: 'Manufacturing year', type: 'text' },
  { key: 'vehicle.invoiceDate', label: 'Invoice date', type: 'text' },
  { key: 'vehicle.downpayment', label: 'Downpayment', type: 'text' },
  { key: 'vehicle.registrationCost', label: 'Registration cost', type: 'text' },
];

const CO_APPLICANT_FIELDS: FieldDef[] = [
  { key: 'coApplicant.name', label: 'Co-applicant name', type: 'text' },
  { key: 'coApplicant.dob', label: 'Co-applicant date of birth', type: 'text' },
  { key: 'coApplicant.email', label: 'Co-applicant email', type: 'email' },
  { key: 'coApplicant.pan', label: 'Co-applicant PAN', type: 'pan' },
  { key: 'coApplicant.address.line1', label: 'Co-applicant address', type: 'text' },
  { key: 'coApplicant.address.village', label: 'Co-applicant village', type: 'text' },
  { key: 'coApplicant.address.pincode', label: 'Co-applicant pincode', type: 'text' },
  { key: 'coApplicant.address.district', label: 'Co-applicant district', type: 'text' },
  { key: 'coApplicant.address.state', label: 'Co-applicant state', type: 'text' },
  { key: 'coApplicant.mobile', label: 'Co-applicant mobile', type: 'tel' },
  { key: 'coApplicant.relationship', label: 'Co-applicant relationship', type: 'text' },
];

const GUARANTOR_FIELDS: FieldDef[] = [
  { key: 'guarantor.name', label: 'Guarantor name', type: 'text' },
  { key: 'guarantor.dob', label: 'Guarantor date of birth', type: 'text' },
  { key: 'guarantor.email', label: 'Guarantor email', type: 'email' },
  { key: 'guarantor.pan', label: 'Guarantor PAN', type: 'pan' },
  { key: 'guarantor.address.line1', label: 'Guarantor address', type: 'text' },
  { key: 'guarantor.address.village', label: 'Guarantor village', type: 'text' },
  { key: 'guarantor.address.pincode', label: 'Guarantor pincode', type: 'text' },
  { key: 'guarantor.address.district', label: 'Guarantor district', type: 'text' },
  { key: 'guarantor.address.state', label: 'Guarantor state', type: 'text' },
  { key: 'guarantor.drivingLicense', label: 'Guarantor driving licence', type: 'text' },
  { key: 'guarantor.mobile', label: 'Guarantor mobile', type: 'tel' },
  { key: 'guarantor.relationship', label: 'Guarantor relationship', type: 'text' },
];

const GEO_SLOTS = [
  { url: 'geoPhotos.withSupportPerson.url', lat: 'geoPhotos.withSupportPerson.latitude', lng: 'geoPhotos.withSupportPerson.longitude', label: 'Photo with the borrower' },
  { url: 'geoPhotos.withVehicle.url', lat: 'geoPhotos.withVehicle.latitude', lng: 'geoPhotos.withVehicle.longitude', label: 'Photo of the borrower with the vehicle' },
  { url: 'geoPhotos.atResidence.url', lat: 'geoPhotos.atResidence.latitude', lng: 'geoPhotos.atResidence.longitude', label: 'Photo of the borrower at the residence' },
] as const;

function readText(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value).trim();
}

function expressComplianceTrue(value: unknown): boolean {
  const text = value == null ? '' : String(value).trim();
  return text === 'true' || text === 'TRUE' || text === 'True';
}

function formatError(field: FieldDef, value: string): string | null {
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `${field.label} is not a valid email`;
  }
  if (field.type === 'tel' && !/^[6-9]\d{9}$/.test(value.replace(/\s+/g, ''))) {
    return `${field.label} is not a valid 10-digit mobile number`;
  }
  if (field.type === 'pan' && !PAN_REGEX.test(value.replace(/\s+/g, '').toUpperCase())) {
    return `${field.label} is not a valid PAN`;
  }
  if (field.type === 'ifsc' && !IFSC_REGEX.test(value.toUpperCase())) {
    return `${field.label} is not a valid IFSC`;
  }
  return null;
}

function pushField(lines: string[], formData: Record<string, unknown>, field: FieldDef) {
  const value = readText(formData, field.key);
  if (!value) {
    lines.push(`${field.label} is missing`);
    return;
  }
  const format = formatError(field, value);
  if (format) lines.push(format);
}

export function getSubmitBlockers(formData: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const productId =
    readText(formData, 'loan_product_id') ||
    readText(formData, 'productId') ||
    readText(formData, 'loanProductId');
  if (!productId) lines.push('Loan product is missing');

  for (const field of DEALER_FIELDS) pushField(lines, formData, field);

  const supportType = readText(formData, '_meta.supportPersonType');
  if (!supportType || supportType === 'none') {
    lines.push('Co-applicant or guarantor is not selected');
  } else if (supportType === 'co_applicant') {
    for (const field of CO_APPLICANT_FIELDS) pushField(lines, formData, field);
  } else if (supportType === 'guarantor') {
    for (const field of GUARANTOR_FIELDS) pushField(lines, formData, field);
  } else {
    lines.push('Co-applicant or guarantor is not selected');
  }

  for (const field of [...BORROWER_FIELDS, ...LOAN_FIELDS, ...INSURANCE_FIELDS, ...VEHICLE_FIELDS]) {
    pushField(lines, formData, field);
  }

  for (const slot of GEO_SLOTS) {
    if (!readText(formData, slot.url)) {
      lines.push(`${slot.label} is missing`);
      continue;
    }
    if (!readText(formData, slot.lat) || !readText(formData, slot.lng)) {
      lines.push(`${slot.label} location is missing`);
    }
  }

  if (!expressComplianceTrue(formData['compliance.vkycDone'])) {
    lines.push('Video KYC is not done');
  }
  if (!expressComplianceTrue(formData['compliance.loanAgreementSigned'])) {
    lines.push('Loan documents are not signed yet');
  }
  if (!expressComplianceTrue(formData['compliance.enachDone'])) {
    lines.push('eNACH is not confirmed by your manager');
  }

  return lines;
}
