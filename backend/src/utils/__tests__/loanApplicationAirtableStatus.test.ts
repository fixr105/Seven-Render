import { describe, it, expect, jest } from '@jest/globals';
import { LoanStatus } from '../../config/constants.js';

jest.mock('../../services/statusTracking/dynamicStatus.service.js', () => ({
  normalizeDynamicStatus: jest.fn((status: string) => status),
}));

import {
  mapLoanStatusForAirtablePost,
  LOAN_APPLICATION_AIRTABLE_STATUS_LABELS,
  resolveStoredApplicationStatus,
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

describe('resolveStoredApplicationStatus', () => {
  it('treats empty and missing Status as draft', () => {
    expect(resolveStoredApplicationStatus(undefined)).toBe(LoanStatus.DRAFT);
    expect(resolveStoredApplicationStatus('')).toBe(LoanStatus.DRAFT);
    expect(resolveStoredApplicationStatus('   ')).toBe(LoanStatus.DRAFT);
  });

  it('maps Airtable labels and internal slugs to canonical status', () => {
    expect(resolveStoredApplicationStatus('Submitted')).toBe(LoanStatus.UNDER_KAM_REVIEW);
    expect(resolveStoredApplicationStatus('under_kam_review')).toBe(LoanStatus.UNDER_KAM_REVIEW);
    expect(resolveStoredApplicationStatus('Under Finance Review')).toBe(
      LoanStatus.PENDING_CREDIT_REVIEW
    );
  });
});
