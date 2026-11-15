import { describe, expect, it } from 'vitest';
import {
  applyEnachToFormData,
  buildEnachDetails,
  maskBankAccountNumber,
  validateEnachForm,
} from '../enach';

describe('validateEnachForm', () => {
  it('accepts a valid form', () => {
    expect(
      validateEnachForm({
        accountHolderName: 'SHARAN KRISHNAN S',
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        confirmAccountNumber: '123456789012',
        ifscCode: 'hdfc0001234',
        accountType: 'Savings',
      })
    ).toEqual({});
  });

  it('rejects mismatched accounts and bad IFSC', () => {
    const errors = validateEnachForm({
      accountHolderName: 'AB',
      bankName: '',
      accountNumber: '123',
      confirmAccountNumber: '999',
      ifscCode: 'BAD',
      accountType: '',
    });
    expect(errors.accountHolderName).toBeTruthy();
    expect(errors.bankName).toBeTruthy();
    expect(errors.accountNumber).toBeTruthy();
    expect(errors.confirmAccountNumber).toBeTruthy();
    expect(errors.ifscCode).toBeTruthy();
    expect(errors.accountType).toBeTruthy();
  });
});

describe('maskBankAccountNumber', () => {
  it('masks all but last 4 digits', () => {
    expect(maskBankAccountNumber('123456789012')).toBe('••••••••9012');
  });
});

describe('applyEnachToFormData', () => {
  it('writes enach.* keys without creating other columns', () => {
    const next = applyEnachToFormData(
      { 'borrower.pan': 'KMPPS3552C' },
      buildEnachDetails({
        accountHolderName: 'SHARAN KRISHNAN S',
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        ifscCode: 'HDFC0001234',
        accountType: 'Savings',
      })
    );
    expect(next['enach.accountNumber']).toBe('123456789012');
    expect(next['enach.ifscCode']).toBe('HDFC0001234');
    expect(next['borrower.pan']).toBe('KMPPS3552C');
  });
});
