import { describe, it, expect } from '@jest/globals';
import {
  convertDobToIsoDate,
  mapPanLookupOutputToFormDataPatch,
  normalizeWebhookMobile,
  parseWebhookOutput,
} from '../panLookup.mapper.js';
import { validatePanLookupRequest } from '../panLookup.service.js';

describe('panLookup.mapper', () => {
  it('parses array webhook response with output wrapper', () => {
    const payload = [
      {
        output: {
          first_name: 'RAHUL',
          last_name: 'GONSALVES',
          cibil_score: '731',
        },
      },
    ];
    const output = parseWebhookOutput(payload);
    expect(output?.first_name).toBe('RAHUL');
    expect(output?.cibil_score).toBe('731');
  });

  it('converts DD/MM/YYYY date to ISO', () => {
    expect(convertDobToIsoDate('07/04/1993')).toBe('1993-04-07');
    expect(convertDobToIsoDate('invalid')).toBe('');
  });

  it('rejects masked mobile numbers', () => {
    expect(normalizeWebhookMobile('91XXXXXXXX77')).toBe('');
    expect(normalizeWebhookMobile('919876543377')).toBe('9876543377');
  });

  it('maps webhook output to borrower patch and excludes cibil from patch', () => {
    const patch = mapPanLookupOutputToFormDataPatch({
      first_name: 'RAHUL',
      last_name: 'GONSALVES',
      customer_name: 'RAHUL GONSALVES',
      gender: 'Male',
      date_of_birth: '07/04/1993',
      father_name: 'JOSEPH GONSALVES',
      mobile_number: '919876543377',
      email: 'rahul@example.com',
      pan_card: 'BAIPG3083L',
      cibil_score: '731',
    });

    expect(patch).toEqual({
      'borrower.firstName': 'RAHUL',
      'borrower.lastName': 'GONSALVES',
      'borrower.customerName': 'RAHUL GONSALVES',
      'borrower.gender': 'Male',
      'borrower.dob': '1993-04-07',
      'borrower.fatherName': 'JOSEPH GONSALVES',
      'borrower.mobile': '9876543377',
      'borrower.email': 'rahul@example.com',
      'borrower.pan': 'BAIPG3083L',
    });
    expect(patch).not.toHaveProperty('cibil_score');
    expect(patch).not.toHaveProperty('_meta.cibilScore');
  });

  it('returns empty patch fields for missing values', () => {
    const patch = mapPanLookupOutputToFormDataPatch({
      first_name: 'RAHUL',
      father_name: '',
      mobile_number: '91XXXXXXXX77',
    });
    expect(patch['borrower.firstName']).toBe('RAHUL');
    expect(patch['borrower.fatherName']).toBeUndefined();
    expect(patch['borrower.mobile']).toBeUndefined();
  });

  it('maps address fields from n8n output keys', () => {
    const patch = mapPanLookupOutputToFormDataPatch({
      first_name: 'Rahul',
      last_name: 'Gonsalves',
      'address Line 1': '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar',
      'village/City': 'Bhavnagar',
      pincode: '364002',
      district: 'Bhavnagar',
      state: 'Gujarat',
      cibil_score: '731',
    });

    expect(patch['borrower.address.line1']).toBe(
      '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar'
    );
    expect(patch['borrower.address.village']).toBe('Bhavnagar');
    expect(patch['borrower.address.pincode']).toBe('364002');
    expect(patch['borrower.address.district']).toBe('Bhavnagar');
    expect(patch['borrower.address.state']).toBe('Gujarat');
    expect(patch).not.toHaveProperty('cibil_score');
  });

  it('parses webhook payload with address fields in output wrapper', () => {
    const output = parseWebhookOutput([
      {
        output: {
          first_name: 'Rahul',
          'address Line 1': '107, Villa De Flores',
          pincode: '364002',
        },
      },
    ]);
    expect(output?.first_name).toBe('Rahul');
    expect(output?.['address Line 1']).toBe('107, Villa De Flores');
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
    expect(patch['borrower.lastName']).toBe('Gonsalves');
    expect(patch['borrower.address.line1']).toContain('Villa De Flores');
    expect(patch['borrower.address.village']).toBe('Bhavnagar');
    expect(patch['borrower.address.pincode']).toBe('364002');
    expect(patch['borrower.address.district']).toBe('Bhavnagar');
    expect(patch['borrower.address.state']).toBe('Gujarat');
    expect(patch).not.toHaveProperty('cibil_score');
  });

  it('maps webhook output to co-applicant patch with single name field', () => {
    const patch = mapPanLookupOutputToFormDataPatch(
      {
        first_name: 'PRIYA',
        last_name: 'SHARMA',
        customer_name: 'PRIYA SHARMA',
        date_of_birth: '07/04/1993',
        mobile_number: '919876543377',
        email: 'priya@example.com',
        pan_card: 'FGHIJ5678K',
        'address Line 1': '12 Main Street',
        'village/City': 'Delhi',
        pincode: '110001',
        district: 'Delhi',
        state: 'Delhi',
      },
      'coApplicant'
    );

    expect(patch['coApplicant.name']).toBe('PRIYA SHARMA');
    expect(patch['coApplicant.dob']).toBe('1993-04-07');
    expect(patch['coApplicant.mobile']).toBe('9876543377');
    expect(patch['coApplicant.address.line1']).toBe('12 Main Street');
    expect(patch).not.toHaveProperty('borrower.firstName');
  });
});

describe('validatePanLookupRequest', () => {
  it('accepts valid input', () => {
    expect(
      validatePanLookupRequest({
        mobileNumber: '9687599179',
        panNumber: 'BAIPG3083L',
        fullName: 'RAHUL YADAV',
      })
    ).toBeNull();
  });

  it('rejects invalid PAN', () => {
    expect(
      validatePanLookupRequest({
        mobileNumber: '9687599179',
        panNumber: 'INVALID',
        fullName: 'RAHUL YADAV',
      })
    ).toMatch(/PAN must be/);
  });
});
