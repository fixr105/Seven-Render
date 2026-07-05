import { describe, it, expect } from '@jest/globals';
import {
  mapLoanStatusForAirtablePost,
  LOAN_APPLICATION_AIRTABLE_STATUS_LABELS,
} from '../loanApplicationAirtableStatus.js';

describe('mapLoanStatusForAirtablePost', () => {
  it('omits draft (not a valid Airtable option)', () => {
    expect(mapLoanStatusForAirtablePost('draft')).toBeUndefined();
    expect(mapLoanStatusForAirtablePost('Draft')).toBeUndefined();
  });

  it('maps internal slugs to Airtable labels', () => {
    expect(mapLoanStatusForAirtablePost('under_kam_review')).toBe('Submitted');
    expect(mapLoanStatusForAirtablePost('submitted')).toBe('Submitted');
    expect(mapLoanStatusForAirtablePost('query_with_client')).toBe('Dealer Unresponsive');
    expect(mapLoanStatusForAirtablePost('dealer_unresponsive')).toBe('Dealer Unresponsive');
    expect(mapLoanStatusForAirtablePost('pending_credit_review')).toBe('Under Finance Review');
    expect(mapLoanStatusForAirtablePost('in_negotiation')).toBe('Qualified');
    expect(mapLoanStatusForAirtablePost('qualified')).toBe('Qualified');
    expect(mapLoanStatusForAirtablePost('sent_to_nbfc')).toBe('DO Issued');
    expect(mapLoanStatusForAirtablePost('approved')).toBe('DO Issued');
    expect(mapLoanStatusForAirtablePost('rejected')).toBe('Rejected');
    expect(mapLoanStatusForAirtablePost('disbursed')).toBe('Disbursed');
  });

  it('passes through valid Airtable labels unchanged', () => {
    for (const label of LOAN_APPLICATION_AIRTABLE_STATUS_LABELS) {
      expect(mapLoanStatusForAirtablePost(label)).toBe(label);
    }
  });

  it('normalizes DO Issued with leading space from legacy Airtable data', () => {
    expect(mapLoanStatusForAirtablePost(' DO Issued')).toBe('DO Issued');
  });

  it('returns undefined for empty and unknown values', () => {
    expect(mapLoanStatusForAirtablePost('')).toBeUndefined();
    expect(mapLoanStatusForAirtablePost(null)).toBeUndefined();
    expect(mapLoanStatusForAirtablePost('not_a_real_status')).toBeUndefined();
  });
});
