import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../../utils/logger.js', () => ({
  defaultLogger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

import {
  convertDobToIsoDate,
  hasBorrowerPatchData,
  hasSupportPersonPatchData,
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

  it('converts DD-MM-YYYY hyphen date to ISO', () => {
    expect(convertDobToIsoDate('07-04-1993')).toBe('1993-04-07');
    expect(convertDobToIsoDate('1993-04-07')).toBe('1993-04-07');
  });

  it('parses live n8n payload with hyphen DOB into meaningful borrower patch', () => {
    const payload = [
      {
        output: {
          first_name: 'RAHUL',
          last_name: 'GONSALVES',
          customer_name: 'RAHUL GONSALVES',
          gender: '',
          date_of_birth: '07-04-1993',
          father_name: 'JOSEPH GONSALVES',
          mobile_number: '9081908777',
          email: 'rahulgonsalves@hotmail.com',
          pan_card: 'BAIPG3083L',
          cibil_score: '569',
          'address Line 1':
            'NO 107 VILLA DE FLORES CATHOLIC SOCIETY, VIDHYANAGAR, OPP: LAW COLLEGE, BHAVNAGAR',
          'village/City': 'BHAVNAGAR',
          pincode: '364002',
          district: 'BHAVNAGAR',
          state: 'GUJARAT',
        },
      },
    ];
    const output = parseWebhookOutput(payload);
    expect(output?.first_name).toBe('RAHUL');
    const patch = mapPanLookupOutputToFormDataPatch(output!);
    expect(patch['borrower.dob']).toBe('1993-04-07');
    expect(patch['borrower.address.line1']).toContain('VILLA DE FLORES');
    expect(patch['_meta.panLookup.cibilScore']).toBe('569');
    expect(hasBorrowerPatchData(patch)).toBe(true);
  });

  it('parses double-encoded JSON string body', () => {
    const inner = [
      {
        output: {
          first_name: 'RAHUL',
          'address Line 1': '107 Villa',
        },
      },
    ];
    const output = parseWebhookOutput(JSON.stringify(inner));
    expect(output?.first_name).toBe('RAHUL');
    expect(output?.['address Line 1']).toBe('107 Villa');
  });

  it('parses output field that is a JSON string of the profile', () => {
    const profile = {
      first_name: 'RAHUL',
      customer_name: 'RAHUL GONSALVES',
      'address Line 1': '107 Villa',
    };
    const output = parseWebhookOutput([{ output: JSON.stringify(profile) }]);
    expect(output?.first_name).toBe('RAHUL');
    expect(output?.['address Line 1']).toBe('107 Villa');
  });

  it('rejects output that is a plain error string', () => {
    expect(parseWebhookOutput([{ output: 'PAN returned no records' }])).toBeNull();
  });

  it('rejects empty array webhook body', () => {
    expect(parseWebhookOutput([])).toBeNull();
  });

  it('rejects output object without profile keys', () => {
    expect(parseWebhookOutput([{ output: { error: 'no hit' } }])).toBeNull();
  });

  it('rejects masked mobile numbers', () => {
    expect(normalizeWebhookMobile('91XXXXXXXX77')).toBe('');
    expect(normalizeWebhookMobile('919876543377')).toBe('9876543377');
  });

  it('maps webhook output to borrower patch with cibil in meta only', () => {
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
      '_meta.panLookup.cibilScore': '731',
    });
    expect(patch).not.toHaveProperty('cibil_score');
    expect(patch).not.toHaveProperty('borrower.cibil');
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

  it('treats cibil-only patch as not meaningful borrower data', () => {
    const patch = mapPanLookupOutputToFormDataPatch({ cibil_score: '731' });
    expect(hasBorrowerPatchData(patch)).toBe(false);
  });

  it('treats pan-only co-applicant patch as not meaningful support data', () => {
    const patch = mapPanLookupOutputToFormDataPatch({ pan_card: 'FGHIJ5678K' }, 'coApplicant');
    expect(hasSupportPersonPatchData(patch, 'coApplicant')).toBe(false);
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
    expect(patch['_meta.panLookup.cibilScore']).toBe('731');
    expect(patch).not.toHaveProperty('cibil_score');
  });

  it('parses webhook output with address fields in output wrapper', () => {
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
    expect(patch['_meta.panLookup.cibilScore']).toBe('731');
    expect(patch).not.toHaveProperty('cibil_score');
  });

  it('parses webhook payload with address fields in output wrapper', () => {
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
