import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
  },
}));

import {
  findClientKycRecord,
  normalizeClientKycRecord,
  clientKycToFormDataPatch,
} from '../clientKyc.service.js';

describe('clientKyc.service', () => {
  const sampleRecord = {
    id: 'reccJkJBh9Bqnu7VM',
    'Client ID': 'CLT-AJAY-001',
    'Login Email': 'NAGENDRA998451@GMAIL.COM',
    Status: 'Active',
    'KYC Verified': true,
    'Dealer ID': 'SFDLR11030',
    'Trade Name': 'Ajay Enterprises',
    'Dealer Name': 'Ajay Enterprises',
    'Dealer Contact': '7905835489',
    'Dealer Email': 'NAGENDRA998451@GMAIL.COM',
    'GST Number': '09BMCPG4250M1ZY',
    'Dealer PAN': 'BMCPG4250M',
    'Dealer Address': 'FLAT NO -00047 NASHIRABAD SAGARPALI BALLIA',
    'Dealer City': 'BALLIA',
    'Dealer State': 'UTTAR PRADESH',
    'Dealer Pincode': '277001',
    'Dealer Bank Name': 'HDFC BANK',
    'Dealer Account Number': '50200041062642',
    'Dealer IFSC Code': 'HDFC0001885',
    'Name in Bank': 'NAGENDRA KUMAR GUPTA',
  };

  it('normalizes Airtable record into dealer profile', () => {
    const profile = normalizeClientKycRecord(sampleRecord);
    expect(profile.dealerId).toBe('SFDLR11030');
    expect(profile.displayLabel).toBe('Ajay Enterprises - 7905835489');
    expect(profile.kycVerified).toBe(true);
  });

  it('matches by Client ID first', () => {
    const records = [
      { ...sampleRecord, 'Client ID': 'OTHER' },
      sampleRecord,
    ];
    const match = findClientKycRecord(records, ['CLT-AJAY-001'], 'other@example.com');
    expect(match).toEqual(sampleRecord);
  });

  it('matches USER-* client id from login', () => {
    const records = [{ ...sampleRecord, 'Client ID': 'USER-1776170387392-b7n4q1v5z' }];
    const match = findClientKycRecord(records, ['USER-1776170387392-b7n4q1v5z'], '');
    expect(match).toEqual(records[0]);
  });

  it('falls back to login email', () => {
    const records = [{ ...sampleRecord, 'Client ID': '' }];
    const match = findClientKycRecord(records, ['MISSING'], 'nagendra998451@gmail.com');
    expect(match).toEqual(records[0]);
  });

  it('ignores inactive records', () => {
    const records = [{ ...sampleRecord, Status: 'Inactive' }];
    const match = findClientKycRecord(records, ['CLT-AJAY-001'], 'nagendra998451@gmail.com');
    expect(match).toBeNull();
  });

  it('allows non-standard active status values', () => {
    const records = [{ ...sampleRecord, Status: '55', 'Client ID': 'USER-1776170387392-b7n4q1v5z' }];
    const match = findClientKycRecord(records, ['USER-1776170387392-b7n4q1v5z'], '');
    expect(match).toEqual(records[0]);
  });

  it('maps profile to form_data dealer keys', () => {
    const profile = normalizeClientKycRecord(sampleRecord);
    const patch = clientKycToFormDataPatch(profile);
    expect(patch['dealer.id']).toBe('SFDLR11030');
    expect(patch['dealer.displayLabel']).toBe('Ajay Enterprises - 7905835489');
    expect(patch['_meta.dealerKycVerified']).toBe(true);
  });
});
