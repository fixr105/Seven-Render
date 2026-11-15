import { describe, expect, it } from 'vitest';
import { getApplicantParty, getSupportPersonParty } from '../supportPersonParty';

describe('supportPersonParty', () => {
  it('resolves co-applicant as second party', () => {
    const result = getSupportPersonParty({
      '_meta.supportPersonType': 'co_applicant',
      'coApplicant.name': 'Rita',
      'coApplicant.mobile': '9876543210',
      'coApplicant.email': 'rita@example.com',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.party.label).toBe('Co-applicant');
      expect(result.party.name).toBe('RITA');
      expect(result.party.mobile).toBe('9876543210');
    }
  });

  it('resolves guarantor as second party (label only)', () => {
    const result = getSupportPersonParty({
      '_meta.supportPersonType': 'guarantor',
      'guarantor.name': 'Suresh',
      'guarantor.mobile': '9123456789',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.party.label).toBe('Guarantor');
      expect(result.party.prefix).toBe('guarantor');
    }
  });

  it('STOPs when name or mobile missing', () => {
    const result = getSupportPersonParty({
      '_meta.supportPersonType': 'guarantor',
      'guarantor.name': 'Only Name',
    });
    expect(result.ok).toBe(false);
  });

  it('reads applicant party', () => {
    const a = getApplicantParty({
      'borrower.customerName': 'Govind',
      'borrower.mobile': '7355621712',
      'borrower.email': 'g@x.com',
    });
    expect(a.name).toBe('GOVIND');
    expect(a.mobile).toBe('7355621712');
  });
});
