import { describe, expect, it } from 'vitest';
import { getSubmitBlockers } from '../submitReadiness';

const ready: Record<string, unknown> = {
  loan_product_id: 'EV-1',
  'dealer.id': 'd1',
  'dealer.displayLabel': 'Seven Wheels',
  'dealer.tradeName': 'Seven Wheels',
  'dealer.name': 'Seven Wheels',
  'dealer.contact': '9876543210',
  'dealer.email': 'dealer@example.com',
  'dealer.gstNumber': '09BMCPG4250M1ZY',
  'dealer.pan': 'ABCDE1234F',
  'dealer.ifscCode': 'HDFC0001885',
  '_meta.supportPersonType': 'co_applicant',
  'coApplicant.name': 'Rita Rao',
  'coApplicant.dob': '1990-01-01',
  'coApplicant.email': 'rita@example.com',
  'coApplicant.pan': 'ABCDE1234F',
  'coApplicant.address.line1': '1 Road',
  'coApplicant.address.village': 'Andheri',
  'coApplicant.address.pincode': '400001',
  'coApplicant.address.district': 'Mumbai',
  'coApplicant.address.state': 'Maharashtra',
  'coApplicant.mobile': '9876543210',
  'coApplicant.relationship': 'Spouse',
  'borrower.firstName': 'Asha',
  'borrower.lastName': 'Rao',
  'borrower.gender': 'Female',
  'borrower.dob': '1992-02-02',
  'borrower.fatherName': 'Ravi',
  'borrower.mobile': '9876543210',
  'borrower.email': 'asha@example.com',
  'borrower.pan': 'ABCDE1234F',
  'borrower.address.line1': '1 Road',
  'borrower.address.village': 'Andheri',
  'borrower.address.pincode': '400001',
  'borrower.address.district': 'Mumbai',
  'borrower.address.state': 'Maharashtra',
  'loan.amount': '71395',
  'loan.interestRate': '18',
  'loan.tenureMonths': '24',
  'loan.processingFee': '1000',
  'loan.gpsCharges': '2000',
  'insurance.cost': '1500.50',
  'insurance.provider': 'ICICI Lombard',
  'insurance.policyNumber': 'POL123',
  'insurance.issuedDate': '2026-11-01',
  'insurance.periodMonths': '12',
  'vehicle.cost': '90000',
  'vehicle.manufacturingYear': '2024',
  'vehicle.invoiceDate': '2026-11-01',
  'vehicle.downpayment': '10000',
  'vehicle.registrationCost': '0',
  'geoPhotos.withSupportPerson.url': 'https://files.example/a.jpg',
  'geoPhotos.withSupportPerson.latitude': '19.076',
  'geoPhotos.withSupportPerson.longitude': '72.8777',
  'geoPhotos.withVehicle.url': 'https://files.example/b.jpg',
  'geoPhotos.withVehicle.latitude': '19.076',
  'geoPhotos.withVehicle.longitude': '72.8777',
  'geoPhotos.atResidence.url': 'https://files.example/c.jpg',
  'geoPhotos.atResidence.latitude': '19.076',
  'geoPhotos.atResidence.longitude': '72.8777',
  'compliance.vkycDone': 'true',
  'compliance.loanAgreementSigned': 'true',
  'compliance.enachDone': 'true',
};

describe('getSubmitBlockers', () => {
  it('lists the signing line when the loan pack is not signed', () => {
    const lines = getSubmitBlockers({ ...ready, 'compliance.loanAgreementSigned': false });
    expect(lines).toContain('Loan documents are not signed yet');
  });

  it('returns no lines when every Express requirement is met', () => {
    expect(getSubmitBlockers(ready)).toEqual([]);
  });
});
