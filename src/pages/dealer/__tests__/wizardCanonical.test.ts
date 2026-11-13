import { describe, expect, it } from 'vitest';
import { canonicalFromWizardFormData } from '../wizardCanonical';

describe('canonicalFromWizardFormData', () => {
  it('maps borrower, loan, vehicle, and co-applicant fields', () => {
    const canonical = canonicalFromWizardFormData({
      'borrower.customerName': 'Ada Lovelace',
      'borrower.pan': 'ABCDE1234F',
      'borrower.mobile': '9876543210',
      'borrower.email': 'ada@example.com',
      'borrower.dob': '1990-01-02',
      'loan.amount': '4,50,000',
      'loan.tenureMonths': '36',
      'vehicle.cost': '500000',
      '_meta.supportPersonType': 'co_applicant',
      'coApplicant.name': 'Charles Babbage',
      'coApplicant.pan': 'BBBBB1234B',
      'coApplicant.mobile': '9123456789',
      'coApplicant.email': 'charles@example.com',
      'coApplicant.dob': '1980-05-05',
    });

    expect(canonical).toMatchObject({
      fullName: 'Ada Lovelace',
      pan: 'ABCDE1234F',
      mobile: '9876543210',
      requestedLoanAmount: 450000,
      preferredTenure: 36,
      onRoadPrice: 500000,
      employmentType: 'Salaried',
      coApplicant: {
        name: 'Charles Babbage',
        pan: 'BBBBB1234B',
        mobile: '9123456789',
      },
    });
  });
});
