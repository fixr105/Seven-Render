import { describe, it, expect } from 'vitest';
import {
  B2C_EV_STAGES,
  createInitialB2cEvFormData,
  getVisibleB2cEvStages,
} from '../../config/forms/b2cEvFormSchema';
import { getB2cEvFormCompletion } from '../b2cEvFormValidation';

const DEALER_PATCH: Record<string, unknown> = {
  'dealer.id': 'SFDLR11030',
  'dealer.displayLabel': 'Ajay Enterprises - 7905835489',
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

function buildCompleteCoApplicantForm(): Record<string, unknown> {
  return {
    ...createInitialB2cEvFormData(),
    ...DEALER_PATCH,
    ...GEO_PHOTO_PATCH,
    '_meta.panLookup.status': 'success',
    '_meta.panLookup.mobileNumber': '9876543210',
    '_meta.panLookup.panNumber': 'ABCDE1234F',
    '_meta.panLookup.fullName': 'Rahul Sharma',
    '_meta.supportPersonType': 'co_applicant',
    '_meta.supportPanLookup.status': 'success',
    '_meta.supportPanLookup.phase': 'profile',
    '_meta.supportPanLookup.inputHash': 'co_applicant|9876543211|FGHIJ5678K|Co Name|',
    '_meta.supportPanLookup.completedAt': '2026-01-01T00:00:00.000Z',
    'borrower.firstName': 'Rahul',
    'borrower.lastName': 'Sharma',
    'borrower.customerName': 'Rahul Sharma',
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
    'bank.customerName': 'Rahul Sharma',
    'bank.name': 'HDFC Bank',
    'bank.accountNumber': '1234567890',
    'bank.ifscCode': 'HDFC0001885',
    'bank.branchAddress': 'Branch Address',
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
  };
}

describe('getB2cEvFormCompletion', () => {
  it('returns incomplete when borrower fields are missing', () => {
    const formData = { ...createInitialB2cEvFormData(), ...DEALER_PATCH };
    const stages = getVisibleB2cEvStages(formData);
    const result = getB2cEvFormCompletion(stages, formData, 'LP001');

    expect(result.isComplete).toBe(false);
    expect(result.missingByStage.some((s) => s.stageId === 'borrower')).toBe(true);
  });

  it('returns complete for a full form with co-applicant', () => {
    const formData = buildCompleteCoApplicantForm();
    const stages = getVisibleB2cEvStages(formData);
    const result = getB2cEvFormCompletion(stages, formData, 'LP001');

    expect(result.isComplete).toBe(true);
    expect(result.missingByStage).toHaveLength(0);
  });

  it('does not require borrower driving license', () => {
    const formData = buildCompleteCoApplicantForm();
    delete formData['borrower.drivingLicense'];
    const stages = getVisibleB2cEvStages(formData);
    const result = getB2cEvFormCompletion(stages, formData, 'LP001');

    expect(result.isComplete).toBe(true);
    expect(result.errors['borrower.drivingLicense']).toBeUndefined();
  });

  it('requires guarantor fields when guarantor is selected, not co-applicant', () => {
    const formData = {
      ...buildCompleteCoApplicantForm(),
      '_meta.supportPersonType': 'guarantor',
      '_meta.supportPanLookup.inputHash': 'guarantor|9876543211|FGHIJ5678K|Co Name|',
    };
    delete formData['coApplicant.name'];

    const stages = getVisibleB2cEvStages(formData);
    const result = getB2cEvFormCompletion(stages, formData, 'LP001');

    expect(result.isComplete).toBe(false);
    expect(result.missingByStage.some((s) => s.stageId === 'support-person')).toBe(true);
  });

  it('flags missing dealer KYC fields', () => {
    const formData = createInitialB2cEvFormData();
    const stages = getVisibleB2cEvStages(formData);
    const result = getB2cEvFormCompletion(stages, formData, 'LP001');

    expect(result.isComplete).toBe(false);
    expect(result.missingByStage.some((s) => s.stageId === 'dealer')).toBe(true);
  });

  it('validates product stage requires loan product id', () => {
    const formData = buildCompleteCoApplicantForm();
    const stages = B2C_EV_STAGES;
    const result = getB2cEvFormCompletion(stages, formData, '');

    expect(result.isComplete).toBe(false);
    expect(result.errors.loan_product_id).toBeDefined();
  });
});
