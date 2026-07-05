import { B2C_EV_GEO_PHOTO_SLOTS } from '../../lib/b2cEvGeoPhotos';

export const B2C_EV_FORM_TEMPLATE_ID = 'b2c_ev_v1';

export type SupportPersonType = 'co_applicant' | 'guarantor' | 'none';

export type B2cEvFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'date'
  | 'select'
  | 'number'
  | 'currency'
  | 'percent'
  | 'textarea'
  | 'geoPhoto';

export interface B2cEvFieldOption {
  value: string;
  label: string;
}

export interface B2cEvFieldDef {
  key: string;
  label: string;
  type: B2cEvFieldType;
  required?: boolean;
  placeholder?: string;
  options?: B2cEvFieldOption[];
  readOnly?: boolean;
  colSpan?: 1 | 2;
}

export interface B2cEvStage {
  id: string;
  title: string;
  description: string;
  fields: B2cEvFieldDef[];
  visibleWhen?: (formData: Record<string, unknown>) => boolean;
}

const GENDER_OPTIONS: B2cEvFieldOption[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

const CO_APPLICANT_RELATIONS: B2cEvFieldOption[] = [
  { value: 'Mother', label: 'Mother' },
  { value: 'Father', label: 'Father' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Sister', label: 'Sister' },
];

const GUARANTOR_RELATIONS: B2cEvFieldOption[] = [
  { value: 'Friend', label: 'Friend' },
  { value: 'Employer', label: 'Employer' },
  { value: 'Neighbour', label: 'Neighbour' },
  { value: 'Other', label: 'Other' },
];

const supportPersonFields = (prefix: 'coApplicant' | 'guarantor', relationOptions: B2cEvFieldOption[]): B2cEvFieldDef[] => [
  { key: `${prefix}.name`, label: prefix === 'coApplicant' ? 'Co-Applicant Name' : 'Guarantor Name', type: 'text', required: true },
  { key: `${prefix}.dob`, label: 'Date of Birth', type: 'date', required: true },
  { key: `${prefix}.email`, label: 'Email', type: 'email', required: true },
  { key: `${prefix}.pan`, label: 'PAN', type: 'text', required: true },
  { key: `${prefix}.address.line1`, label: 'Address Line 1', type: 'text', required: true, colSpan: 2 },
  { key: `${prefix}.address.line2`, label: 'Address Line 2', type: 'text' },
  { key: `${prefix}.address.village`, label: 'Village', type: 'text', required: true },
  { key: `${prefix}.address.pincode`, label: 'Pincode', type: 'text', required: true },
  { key: `${prefix}.address.district`, label: 'District', type: 'text', required: true },
  { key: `${prefix}.address.state`, label: 'State', type: 'text', required: true },
  { key: `${prefix}.drivingLicense`, label: 'Driving Licence', type: 'text', required: true },
  { key: `${prefix}.mobile`, label: 'Mobile', type: 'tel', required: true },
  {
    key: `${prefix}.relationship`,
    label: 'Relationship with Borrower',
    type: 'select',
    required: true,
    options: relationOptions,
  },
];

export const SUPPORT_PAN_LOOKUP_INPUT_FIELDS: B2cEvFieldDef[] = [
  { key: '_meta.supportPanLookup.mobileNumber', label: 'Mobile Number', type: 'tel', required: true },
  { key: '_meta.supportPanLookup.panNumber', label: 'PAN Number', type: 'text', required: true },
  { key: '_meta.supportPanLookup.fullName', label: 'Full Name', type: 'text', required: true, colSpan: 2 },
  { key: '_meta.supportPanLookup.email', label: 'Email', type: 'email' },
];

export function getSupportPersonProfileFields(
  supportType: SupportPersonType
): B2cEvFieldDef[] {
  if (supportType === 'co_applicant') {
    return supportPersonFields('coApplicant', CO_APPLICANT_RELATIONS);
  }
  if (supportType === 'guarantor') {
    return supportPersonFields('guarantor', GUARANTOR_RELATIONS);
  }
  return [];
}

export const B2C_EV_STAGES: B2cEvStage[] = [
  {
    id: 'product',
    title: 'Loan Product',
    description: 'Select the financing product and verify borrower PAN',
    fields: [
      { key: '_meta.panLookup.mobileNumber', label: 'Mobile Number', type: 'tel', required: true },
      { key: '_meta.panLookup.panNumber', label: 'PAN Number', type: 'text', required: true },
      { key: '_meta.panLookup.fullName', label: 'Full Name', type: 'text', required: true, colSpan: 2 },
      { key: '_meta.panLookup.borrowerEmail', label: 'Borrower Email', type: 'email' },
    ],
  },
  {
    id: 'borrower',
    title: 'Borrower',
    description: 'Auto-filled from PAN verification — edit if needed',
    fields: [
      { key: 'borrower.firstName', label: 'First Name', type: 'text', required: true },
      { key: 'borrower.lastName', label: 'Last Name', type: 'text', required: true },
      { key: 'borrower.customerName', label: 'Customer Name', type: 'text', readOnly: true },
      { key: 'borrower.gender', label: 'Gender', type: 'select', required: true, options: GENDER_OPTIONS },
      { key: 'borrower.dob', label: 'Date of Birth', type: 'date', required: true },
      { key: 'borrower.fatherName', label: 'Father Name', type: 'text', required: true },
      { key: 'borrower.mobile', label: 'Mobile Number', type: 'tel', required: true },
      { key: 'borrower.email', label: 'Email', type: 'email', required: true },
      { key: 'borrower.pan', label: 'PAN Card', type: 'text', required: true, readOnly: true },
      { key: 'borrower.drivingLicense', label: 'Driving License', type: 'text' },
      { key: 'borrower.address.line1', label: 'Address Line 1', type: 'text', required: true, colSpan: 2 },
      { key: 'borrower.address.line2', label: 'Address Line 2', type: 'text' },
      { key: 'borrower.address.village', label: 'Village', type: 'text', required: true },
      { key: 'borrower.address.pincode', label: 'Pincode', type: 'text', required: true },
      { key: 'borrower.address.district', label: 'District', type: 'text', required: true },
      { key: 'borrower.address.state', label: 'State', type: 'text', required: true },
    ],
  },
  {
    id: 'loan',
    title: 'Loan Details',
    description: 'Calculate and freeze loan amount, rate and fees',
    fields: [
      { key: 'loan.amount', label: 'Loan Amount (₹)', type: 'currency', required: true },
      { key: 'loan.interestRate', label: 'Interest Rate (%)', type: 'percent', required: true },
      { key: 'loan.tenureMonths', label: 'Tenure (months)', type: 'number', required: true },
      { key: 'loan.processingFee', label: 'Processing Fee (₹)', type: 'currency', required: true },
      { key: 'loan.gpsCharges', label: 'GPS Charges / IOT (₹)', type: 'currency', required: true },
      { key: 'loan.processingFeePercent', label: 'Processing Fee %', type: 'percent', readOnly: true },
      { key: 'loan.disbursalAmount', label: 'Disbursal Amount (₹)', type: 'currency', readOnly: true },
    ],
  },
  {
    id: 'dealer',
    title: 'Dealer',
    description: 'Auto-filled from your dealer profile',
    fields: [
      { key: 'dealer.displayLabel', label: 'Selected Dealer', type: 'text', readOnly: true, colSpan: 2 },
      { key: 'dealer.id', label: 'Dealer ID', type: 'text', readOnly: true },
      { key: 'dealer.tradeName', label: 'Trade Name', type: 'text', readOnly: true },
      { key: 'dealer.name', label: 'Dealer Name', type: 'text', readOnly: true },
      { key: 'dealer.contact', label: 'Dealer Contact', type: 'tel', readOnly: true },
      { key: 'dealer.email', label: 'Dealer Email', type: 'email', readOnly: true },
      { key: 'dealer.gstNumber', label: 'GST Number', type: 'text', readOnly: true },
      { key: 'dealer.pan', label: 'Dealer PAN', type: 'text', readOnly: true },
      { key: 'dealer.address', label: 'Dealer Address', type: 'textarea', readOnly: true, colSpan: 2 },
      { key: 'dealer.city', label: 'Dealer City', type: 'text', readOnly: true },
      { key: 'dealer.state', label: 'Dealer State', type: 'text', readOnly: true },
      { key: 'dealer.pincode', label: 'Dealer Pincode', type: 'text', readOnly: true },
      { key: 'dealer.bankName', label: 'Dealer Bank Name', type: 'text', readOnly: true },
      { key: 'dealer.accountNumber', label: 'Dealer Account Number', type: 'text', readOnly: true },
      { key: 'dealer.ifscCode', label: 'Dealer IFSC Code', type: 'text', readOnly: true },
      { key: 'dealer.nameInBank', label: 'Name in Bank', type: 'text', readOnly: true },
    ],
  },
  {
    id: 'support-person',
    title: 'Co-applicant / Guarantor',
    description: 'Verify PAN and complete co-applicant or guarantor details',
    fields: SUPPORT_PAN_LOOKUP_INPUT_FIELDS,
  },
  {
    id: 'geo-photos',
    title: 'Geo-tagged Photos',
    description: 'Upload photos with verified location at time of capture',
    fields: B2C_EV_GEO_PHOTO_SLOTS.map((slot) => ({
      key: slot.urlKey,
      label: slot.label,
      type: 'geoPhoto' as const,
      required: true,
      colSpan: 2 as const,
    })),
  },
  {
    id: 'insurance',
    title: 'Insurance',
    description: 'Policy information',
    fields: [
      { key: 'insurance.cost', label: 'Insurance Cost (₹)', type: 'currency', required: true },
      { key: 'insurance.provider', label: 'Insurance Provider', type: 'text', required: true },
      { key: 'insurance.policyNumber', label: 'Policy Number', type: 'text', required: true },
      { key: 'insurance.issuedDate', label: 'Policy Issued Date', type: 'date', required: true },
      { key: 'insurance.periodMonths', label: 'Period of Insurance (months)', type: 'number', required: true },
    ],
  },
  {
    id: 'vehicle',
    title: 'Vehicle Details',
    description: 'Cost and invoice information',
    fields: [
      { key: 'vehicle.cost', label: 'Cost of Vehicle (₹)', type: 'currency', required: true },
      { key: 'vehicle.manufacturingYear', label: 'Manufacturing Year', type: 'number', required: true },
      { key: 'vehicle.invoiceNumber', label: 'Sales Invoice Number', type: 'text' },
      { key: 'vehicle.invoiceDate', label: 'Sales Invoice Date', type: 'date', required: true },
      { key: 'vehicle.downpayment', label: 'Downpayment Paid by Borrower (₹)', type: 'currency', required: true },
      { key: 'vehicle.registrationCost', label: 'Vehicle Registration Cost (₹)', type: 'currency', required: true },
    ],
  },
];

export function getVisibleB2cEvStages(formData: Record<string, unknown>): B2cEvStage[] {
  return B2C_EV_STAGES.filter((stage) => {
    if (stage.visibleWhen && !stage.visibleWhen(formData)) return false;
    return true;
  });
}

export function createInitialB2cEvFormData(): Record<string, unknown> {
  return {
    '_meta.formTemplate': B2C_EV_FORM_TEMPLATE_ID,
    '_meta.loginDate': new Date().toISOString().slice(0, 10),
    '_meta.supportPersonType': 'none',
    '_meta.panLookup.status': 'pending',
    '_meta.panLookup.inputHash': '',
    '_meta.panLookup.completedAt': '',
    '_meta.supportPanLookup.status': 'pending',
    '_meta.supportPanLookup.inputHash': '',
    '_meta.supportPanLookup.completedAt': '',
    '_meta.supportPanLookup.phase': 'input',
    'compliance.vkycDone': false,
    'compliance.loanAgreementSigned': false,
    'compliance.enachDone': false,
    '_meta.kamRequests.vkyc.requestedAt': '',
    '_meta.kamRequests.loanAgreement.requestedAt': '',
    '_meta.kamRequests.enach.requestedAt': '',
    '_meta.doRequest.requestedAt': '',
  };
}
