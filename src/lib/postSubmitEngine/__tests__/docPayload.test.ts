import { describe, expect, it } from 'vitest';
import { buildDocPayload } from '../docPayload';
import type { DisplayOffer } from '../types';

const OFFER: DisplayOffer = {
  id: 'value',
  label: 'Seven Fincorp — Value',
  amount: 111725,
  roi: 28,
  pf: 7541,
  emi: 7672,
  tenure: 18,
  apr: 28,
  real_lender_id: 'Fintree',
  source: {},
};

describe('buildDocPayload', () => {
  it('formats signing_date and declaration dates as DD/MM/YYYY', () => {
    const payload = buildDocPayload(
      {
        'borrower.firstName': 'GOVIND',
        'borrower.lastName': 'PANDEY',
        'borrower.aadhaar': '1234 5678 9012',
        'coApplicant.name': 'SHARAN KRISHNAN S',
        'coApplicant.aadhaar': '987654321098',
      },
      OFFER,
      'SFMWHK65WO'
    );
    const caseBlock = payload.case as { signing_date: string };
    const borrower = payload.borrower as {
      declaration_date: string;
      aadhaar_last4: string;
    };
    const guarantor = payload.guarantor as {
      declaration_date: string;
      aadhaar_last4: string;
    };
    expect(caseBlock.signing_date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(borrower.declaration_date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(guarantor.declaration_date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(borrower.aadhaar_last4).toBe('9012');
    expect(guarantor.aadhaar_last4).toBe('1098');
  });

  it('never sends XXXX for aadhaar_last4 when aadhaar is missing', () => {
    const payload = buildDocPayload(
      { 'borrower.firstName': 'GOVIND' },
      OFFER,
      'SF1'
    );
    const borrower = payload.borrower as { aadhaar_last4: string };
    const guarantor = payload.guarantor as { aadhaar_last4: string };
    expect(borrower.aadhaar_last4).toBe('');
    expect(guarantor.aadhaar_last4).toBe('');
    expect(JSON.stringify(payload)).not.toContain('XXXX');
  });
});
