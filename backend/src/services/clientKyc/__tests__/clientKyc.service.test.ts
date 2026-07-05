import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
  },
}));

jest.mock('../../entitlements/clientProducts.service.js', () => ({
  resolveClientRecord: jest.fn(),
}));

import { n8nClient } from '../../airtable/n8nClient.js';
import { resolveClientRecord } from '../../entitlements/clientProducts.service.js';
import {
  findClientKycRecord,
  getClientKycForUser,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes Airtable record into dealer profile', () => {
    const profile = normalizeClientKycRecord(sampleRecord);
    expect(profile.dealerId).toBe('SFDLR11030');
    expect(profile.displayLabel).toBe('Ajay Enterprises - 7905835489');
    expect(profile.kycVerified).toBe(true);
  });

  it('matches by resolved Client ID only', () => {
    const records = [
      { ...sampleRecord, 'Client ID': 'OTHER' },
      sampleRecord,
    ];
    const match = findClientKycRecord(records, 'CLT-AJAY-001');
    expect(match).toEqual(sampleRecord);
  });

  it('matches USER-* client id from Clients table', () => {
    const records = [{ ...sampleRecord, 'Client ID': 'USER-1776170387392-b7n4q1v5z' }];
    const match = findClientKycRecord(records, 'USER-1776170387392-b7n4q1v5z');
    expect(match).toEqual(records[0]);
  });

  it('does not match by login email when Client ID differs', () => {
    const records = [{ ...sampleRecord, 'Client ID': '' }];
    const match = findClientKycRecord(records, 'MISSING');
    expect(match).toBeNull();
  });

  it('does not match KYC keyed to User Account id when Clients client id differs', () => {
    const records = [{ ...sampleRecord, 'Client ID': 'USER-1776170387392-b7n4q1v5z' }];
    const match = findClientKycRecord(records, 'USER-1776170387391-a8k3m9p2x');
    expect(match).toBeNull();
  });

  it('ignores inactive records', () => {
    const records = [{ ...sampleRecord, Status: 'Inactive' }];
    const match = findClientKycRecord(records, 'CLT-AJAY-001');
    expect(match).toBeNull();
  });

  it('allows non-standard active status values', () => {
    const records = [{ ...sampleRecord, Status: '55', 'Client ID': 'USER-1776170387392-b7n4q1v5z' }];
    const match = findClientKycRecord(records, 'USER-1776170387392-b7n4q1v5z');
    expect(match).toEqual(records[0]);
  });

  it('maps profile to form_data dealer keys', () => {
    const profile = normalizeClientKycRecord(sampleRecord);
    const patch = clientKycToFormDataPatch(profile);
    expect(patch['dealer.id']).toBe('SFDLR11030');
    expect(patch['dealer.displayLabel']).toBe('Ajay Enterprises - 7905835489');
    expect(patch['_meta.dealerKycVerified']).toBe(true);
  });

  it('loads KYC when resolved Client ID matches KYC row', async () => {
    jest.mocked(resolveClientRecord).mockResolvedValue({
      clientId: 'CLT-AJAY-001',
      clientRecord: {},
    });
    jest.mocked(n8nClient.fetchTable).mockResolvedValue([sampleRecord]);

    const profile = await getClientKycForUser({
      id: 'USER-1776170387392-b7n4q1v5z',
      email: 'nagendra998451@gmail.com',
      role: 'client',
      clientId: 'CLT-AJAY-001',
    } as any);

    expect(profile?.dealerId).toBe('SFDLR11030');
    expect(profile?.clientId).toBe('CLT-AJAY-001');
  });

  it('returns null when no KYC row matches resolved Client ID', async () => {
    jest.mocked(resolveClientRecord).mockResolvedValue({
      clientId: 'USER-1776170387391-a8k3m9p2x',
      clientRecord: {},
    });
    jest.mocked(n8nClient.fetchTable).mockResolvedValue([
      { ...sampleRecord, 'Client ID': 'USER-1776170387392-b7n4q1v5z' },
    ]);

    const profile = await getClientKycForUser({
      id: 'USER-1776170387392-b7n4q1v5z',
      email: 'vadukavsk@gmail.com',
      role: 'client',
      clientId: 'USER-1776170387391-a8k3m9p2x',
    } as any);

    expect(profile).toBeNull();
  });

  it('propagates error when client record is not linked', async () => {
    jest.mocked(resolveClientRecord).mockRejectedValue(new Error('Client account not linked'));
    jest.mocked(n8nClient.fetchTable).mockResolvedValue([sampleRecord]);

    await expect(
      getClientKycForUser({
        id: 'rec-user-1',
        email: 'nagendra998451@gmail.com',
        role: 'client',
        clientId: null,
      } as any)
    ).rejects.toThrow('Client account not linked');
  });
});
