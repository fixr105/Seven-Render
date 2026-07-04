import { describe, it, expect } from '@jest/globals';
import {
  resolveLoanApplicationCoreFields,
  mergeFormDataJson,
} from '../loanApplicationCoreFields.js';

describe('resolveLoanApplicationCoreFields', () => {
  it('reads snake_case keys from merged form data', () => {
    const result = resolveLoanApplicationCoreFields({
      applicant_name: 'Jane Doe',
      loan_product_id: 'LP001',
      requested_loan_amount: '500000',
    });

    expect(result).toEqual({
      applicantName: 'Jane Doe',
      productId: 'LP001',
      requestedLoanAmount: '500000',
    });
  });

  it('reads camelCase keys from merged form data', () => {
    const result = resolveLoanApplicationCoreFields({
      applicantName: 'John Smith',
      productId: 'LP002',
      requestedLoanAmount: '750000',
    });

    expect(result).toEqual({
      applicantName: 'John Smith',
      productId: 'LP002',
      requestedLoanAmount: '750000',
    });
  });

  it('falls back to existing record top-level columns', () => {
    const result = resolveLoanApplicationCoreFields(
      {},
      {
        'Applicant Name': 'Existing Name',
        'Loan Product': 'LP010',
        'Requested Loan Amount': '100000',
      }
    );

    expect(result).toEqual({
      applicantName: 'Existing Name',
      productId: 'LP010',
      requestedLoanAmount: '100000',
    });
  });

  it('prefers merged form data over existing record', () => {
    const result = resolveLoanApplicationCoreFields(
      { applicant_name: 'Updated Name' },
      {
        'Applicant Name': 'Old Name',
        'Loan Product': 'LP010',
        'Requested Loan Amount': '100000',
      }
    );

    expect(result.applicantName).toBe('Updated Name');
    expect(result.productId).toBe('LP010');
    expect(result.requestedLoanAmount).toBe('100000');
  });

  it('falls back to parsed Form Data JSON on existing record', () => {
    const result = resolveLoanApplicationCoreFields(
      {},
      {
        'Form Data': JSON.stringify({
          applicant_name: 'From JSON',
          loan_product_id: 'LP099',
          requested_loan_amount: '250000',
        }),
      }
    );

    expect(result).toEqual({
      applicantName: 'From JSON',
      productId: 'LP099',
      requestedLoanAmount: '250000',
    });
  });
});

describe('mergeFormDataJson', () => {
  it('merges incoming form data over existing JSON', () => {
    const merged = mergeFormDataJson(
      {
        'Form Data': JSON.stringify({ pan: 'ABCDE1234F', applicant_name: 'Old' }),
      },
      { applicant_name: 'New', email: 'test@example.com' }
    );

    expect(merged).toEqual({
      pan: 'ABCDE1234F',
      applicant_name: 'New',
      email: 'test@example.com',
    });
  });
});
