import { describe, it, expect, jest } from '@jest/globals';
import {
  B2C_EV_FORM_TEMPLATE_ID,
  isB2cEvFormTemplate,
  validateB2cEvFormData,
} from '../b2cEvFormValidation.service.js';

const DEALER_PATCH: Record<string, unknown> = {
  '_meta.formTemplate': B2C_EV_FORM_TEMPLATE_ID,
  'dealer.id': 'SFDLR11030',
  'dealer.displayLabel': 'Ajay Enterprises',
  'dealer.tradeName': 'Ajay Enterprises',
  'dealer.name': 'Ajay Enterprises',
  'dealer.contact': '7905835489',
  'dealer.email': 'dealer@example.com',
  'dealer.gstNumber': '09BMCPG4250M1ZY',
  'dealer.pan': 'BMCPG4250M',
  'dealer.ifscCode': 'HDFC0001885',
};

const GEO_PHOTO_PATCH: Record<string, unknown> = {
  'geoPhotos.withSupportPerson.url': 'data:image/jpeg;base64,abc',
  'geoPhotos.withSupportPerson.latitude': '28.6139',
  'geoPhotos.withSupportPerson.longitude': '77.2090',
  'geoPhotos.withVehicle.url': 'data:image/jpeg;base64,def',
  'geoPhotos.withVehicle.latitude': '28.6139',
  'geoPhotos.withVehicle.longitude': '77.2090',
  'geoPhotos.atResidence.url': 'data:image/jpeg;base64,ghi',
  'geoPhotos.atResidence.latitude': '28.6139',
  'geoPhotos.atResidence.longitude': '77.2090',
};

function buildCompleteForm(): Record<string, unknown> {
  return {
    ...DEALER_PATCH,
    ...GEO_PHOTO_PATCH,
    '_meta.supportPersonType': 'co_applicant',
    'borrower.firstName': 'Rahul',
    'borrower.lastName': 'Sharma',
    'borrower.gender': 'Male',
    'borrower.dob': '1990-01-15',
    'borrower.fatherName': 'Father Name',
    'borrower.mobile': '9876543210',
    'borrower.email': 'rahul@example.com',
    'borrower.pan': 'ABCDE1234F',
    'borrower.drivingLicense': 'DL123456',
    'borrower.address.line1': 'Line 1',
    'borrower.address.village': 'Village',
    'borrower.address.pincode': '110001',
    'borrower.address.district': 'Delhi',
    'borrower.address.state': 'Delhi',
    'loan.amount': '150000',
    'loan.interestRate': '12',
    'loan.tenureMonths': '24',
    'loan.processingFee': '3000',
    'loan.gpsCharges': '500',
    'coApplicant.name': 'Co Name',
    'coApplicant.dob': '1992-02-02',
    'coApplicant.email': 'co@example.com',
    'coApplicant.pan': 'FGHIJ5678K',
    'coApplicant.address.line1': 'Co Line 1',
    'coApplicant.address.village': 'Co Village',
    'coApplicant.address.pincode': '110002',
    'coApplicant.address.district': 'Delhi',
    'coApplicant.address.state': 'Delhi',
    'coApplicant.drivingLicense': 'DL654321',
    'coApplicant.mobile': '9876543211',
    'coApplicant.relationship': 'Spouse',
    'insurance.cost': '5000',
    'insurance.provider': 'Provider',
    'insurance.policyNumber': 'POL001',
    'insurance.issuedDate': '2025-01-01',
    'insurance.periodMonths': '12',
    'vehicle.cost': '200000',
    'vehicle.manufacturingYear': '2024',
    'vehicle.invoiceDate': '2025-01-02',
    'vehicle.downpayment': '50000',
    'vehicle.registrationCost': '2000',
    'compliance.vkycDone': true,
    'compliance.loanAgreementSigned': true,
    'compliance.enachDone': true,
  };
}

describe('b2cEvFormValidation.service', () => {
  it('detects B2C EV form template', () => {
    expect(isB2cEvFormTemplate({ '_meta.formTemplate': B2C_EV_FORM_TEMPLATE_ID })).toBe(true);
    expect(isB2cEvFormTemplate({ '_meta.formTemplate': 'legacy' })).toBe(false);
  });

  it('fails validation for partial B2C form data', () => {
    const result = validateB2cEvFormData({ ...DEALER_PATCH }, 'LP001');
    expect(result.isValid).toBe(false);
    expect(result.missingFields.length).toBeGreaterThan(0);
    expect(result.missingFields.some((f) => f.fieldId === 'borrower.firstName')).toBe(true);
  });

  it('passes validation for complete sample payload', () => {
    const result = validateB2cEvFormData(buildCompleteForm(), 'LP001');
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
    expect(result.formatErrors).toHaveLength(0);
  });

  it('requires guarantor fields when guarantor branch is selected', () => {
    const form = {
      ...buildCompleteForm(),
      '_meta.supportPersonType': 'guarantor',
    };
    delete form['coApplicant.name'];

    const result = validateB2cEvFormData(form, 'LP001');
    expect(result.isValid).toBe(false);
    expect(result.missingFields.some((f) => f.fieldId.startsWith('guarantor.'))).toBe(true);
  });

  it('requires compliance checklist items before submit', () => {
    const form = { ...buildCompleteForm() };
    delete form['compliance.enachDone'];

    const result = validateB2cEvFormData(form, 'LP001');
    expect(result.isValid).toBe(false);
    expect(result.missingFields.some((f) => f.fieldId === 'compliance.enachDone')).toBe(true);
  });
});
