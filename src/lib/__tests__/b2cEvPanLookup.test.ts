import { describe, it, expect } from 'vitest';
import {
  applyBorrowerManualProfilePhase,
  buildBorrowerManualProfilePatch,
  buildPanLookupInputHash,
  clearBorrowerFields,
  isPanLookupManual,
  mapPanLookupOutputToFormDataPatch,
  migratePanLookupDraftFields,
} from '../b2cEvPanLookup';
import { createInitialB2cEvFormData } from '../../config/forms/b2cEvFormSchema';

describe('b2cEvPanLookup', () => {
  it('maps webhook output with cibil stored in meta only', () => {
    const patch = mapPanLookupOutputToFormDataPatch({
      first_name: 'RAHUL',
      last_name: 'GONSALVES',
      cibil_score: '731',
    });
    expect(patch['borrower.firstName']).toBe('RAHUL');
    expect(patch['borrower.lastName']).toBe('GONSALVES');
    expect(patch['_meta.panLookup.cibilScore']).toBe('731');
    expect(patch).not.toHaveProperty('cibil_score');
    expect(patch).not.toHaveProperty('borrower.cibil');
  });

  it('builds stable input hash from lookup fields', () => {
    const hash = buildPanLookupInputHash({
      '_meta.panLookup.mobileNumber': '9687599179',
      '_meta.panLookup.panNumber': 'BAIPG3083L',
      '_meta.panLookup.fullName': 'RAHUL YADAV',
      '_meta.panLookup.borrowerEmail': '',
    });
    expect(hash).toBe('9687599179|BAIPG3083L|RAHUL YADAV|');
  });

  it('clears borrower fields and cibil meta before re-applying lookup patch', () => {
    const cleared = clearBorrowerFields({
      'borrower.firstName': 'Old',
      'borrower.pan': 'OLDPAN1234A',
      '_meta.panLookup.cibilScore': '700',
      'dealer.id': 'SFDLR11030',
    });
    expect(cleared['borrower.firstName']).toBeUndefined();
    expect(cleared['_meta.panLookup.cibilScore']).toBeUndefined();
    expect(cleared['dealer.id']).toBe('SFDLR11030');
  });

  it('maps address fields from n8n output keys', () => {
    const patch = mapPanLookupOutputToFormDataPatch({
      first_name: 'Rahul',
      'address Line 1': '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar',
      'village/City': 'Bhavnagar',
      pincode: '364002',
      district: 'Bhavnagar',
      state: 'Gujarat',
      cibil_score: '731',
    });

    expect(patch['borrower.address.line1']).toContain('Villa De Flores');
    expect(patch['borrower.address.village']).toBe('Bhavnagar');
    expect(patch['borrower.address.pincode']).toBe('364002');
    expect(patch['_meta.panLookup.cibilScore']).toBe('731');
  });

  it('maps address fields with mixed-case live n8n keys', () => {
    const patch = mapPanLookupOutputToFormDataPatch({
      First_Name: 'Rahul',
      Last_Name: 'Gonsalves',
      'Address Line 1': '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar',
      'Village/City': 'Bhavnagar',
      Pincode: '364002',
      District: 'Bhavnagar',
      State: 'Gujarat',
      cibil_score: '731',
    } as Record<string, string>);

    expect(patch['borrower.firstName']).toBe('Rahul');
    expect(patch['borrower.address.line1']).toContain('Villa De Flores');
    expect(patch['borrower.address.village']).toBe('Bhavnagar');
    expect(patch['borrower.address.pincode']).toBe('364002');
    expect(patch['borrower.address.district']).toBe('Bhavnagar');
    expect(patch['borrower.address.state']).toBe('Gujarat');
  });

  it('migrates legacy recipientEmail draft key to borrowerEmail', () => {
    const migrated = migratePanLookupDraftFields({
      '_meta.panLookup.recipientEmail': 'old@example.com',
    });
    expect(migrated['_meta.panLookup.borrowerEmail']).toBe('old@example.com');
    expect(migrated['_meta.panLookup.recipientEmail']).toBeUndefined();
  });

  it('maps guarantor prefix to guarantor form keys', () => {
    const patch = mapPanLookupOutputToFormDataPatch(
      {
        customer_name: 'JOHN DOE',
        pan_card: 'ABCDE1234F',
        mobile_number: '9876543210',
      },
      'guarantor'
    );
    expect(patch['guarantor.name']).toBe('JOHN DOE');
    expect(patch['guarantor.pan']).toBe('ABCDE1234F');
    expect(patch['guarantor.mobile']).toBe('9876543210');
  });

  it('seeds borrower profile fields from PAN lookup inputs', () => {
    const formData = {
      ...createInitialB2cEvFormData(),
      '_meta.panLookup.mobileNumber': '9687599179',
      '_meta.panLookup.panNumber': 'BAIPG3083L',
      '_meta.panLookup.fullName': 'RAHUL YADAV',
      '_meta.panLookup.borrowerEmail': 'rahul@example.com',
    };

    expect(buildBorrowerManualProfilePatch(formData)).toEqual({
      'borrower.firstName': 'RAHUL',
      'borrower.lastName': 'YADAV',
      'borrower.customerName': 'RAHUL YADAV',
      'borrower.pan': 'BAIPG3083L',
      'borrower.mobile': '9687599179',
      'borrower.email': 'rahul@example.com',
    });
  });

  it('enters manual borrower profile phase with status manual', () => {
    const formData = {
      ...createInitialB2cEvFormData(),
      '_meta.panLookup.mobileNumber': '9687599179',
      '_meta.panLookup.panNumber': 'BAIPG3083L',
      '_meta.panLookup.fullName': 'RAHUL YADAV',
    };

    const next = applyBorrowerManualProfilePhase(formData, 'hash-1');

    expect(next['_meta.panLookup.status']).toBe('manual');
    expect(next['borrower.firstName']).toBe('RAHUL');
    expect(next['borrower.lastName']).toBe('YADAV');
    expect(isPanLookupManual(next)).toBe(true);
  });
});
