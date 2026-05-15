import { describe, it, expect } from '@jest/globals';
import {
  parseApplicableStatusesForApi,
  normalizeApplicableStatusKey,
  APPLICABLE_STATUSES_AIRTABLE_FIELD,
  getDefaultApplicableStatuses,
} from '../loanProductStatuses.service.js';
import { LoanStatus } from '../../../config/constants.js';

describe('parseApplicableStatusesForApi', () => {
  it('returns empty array when field missing or blank', () => {
    expect(parseApplicableStatusesForApi(undefined)).toEqual([]);
    expect(parseApplicableStatusesForApi('')).toEqual([]);
    expect(parseApplicableStatusesForApi('   ')).toEqual([]);
  });

  it('parses valid JSON array with keys and labels', () => {
    const raw = JSON.stringify([
      { key: 'under_kam_review', label: 'KAM queue', order: 5 },
      { key: 'pending_credit_review', label: 'Credit', order: 10 },
    ]);
    const out = parseApplicableStatusesForApi(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: 'under_kam_review', label: 'KAM queue', order: 5 });
    expect(out[1].key).toBe('pending_credit_review');
  });

  it('drops invalid keys and keeps valid ones', () => {
    const raw = JSON.stringify([
      { key: 'not_a_real_status', label: 'Bad', order: 1 },
      { key: 'draft', label: 'Draft', order: 2 },
    ]);
    const out = parseApplicableStatusesForApi(raw);
    expect(out.some((e) => e.key === 'draft')).toBe(true);
    expect(out.some((e) => e.key === 'not_a_real_status')).toBe(false);
  });

  it('returns empty when JSON is not an array', () => {
    const out = parseApplicableStatusesForApi('{"foo":1}');
    expect(out).toEqual([]);
  });

  it('returns empty when JSON is malformed string', () => {
    const out = parseApplicableStatusesForApi('not json');
    expect(out).toEqual([]);
  });

  it('returns empty when array parses but all keys invalid', () => {
    const raw = JSON.stringify([{ key: 'invalid', label: 'X', order: 1 }]);
    const out = parseApplicableStatusesForApi(raw);
    expect(out).toEqual([]);
  });

  it('normalizes alias keys in catalog entries', () => {
    const raw = JSON.stringify([{ key: 'pending_kam_review', label: 'Alias', order: 1 }]);
    const out = parseApplicableStatusesForApi(raw);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe(LoanStatus.UNDER_KAM_REVIEW);
  });

  it('accepts qualified in JSON and stores canonical in_negotiation key', () => {
    const raw = JSON.stringify([{ key: 'qualified', label: 'Qualified', order: 1 }]);
    const out = parseApplicableStatusesForApi(raw);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe(LoanStatus.IN_NEGOTIATION);
  });
});

describe('normalizeApplicableStatusKey', () => {
  it('maps legacy aliases to canonical keys', () => {
    expect(normalizeApplicableStatusKey('pending_kam_review')).toBe(LoanStatus.UNDER_KAM_REVIEW);
    expect(normalizeApplicableStatusKey('forwarded_to_credit')).toBe(LoanStatus.PENDING_CREDIT_REVIEW);
  });

  it('maps business-label keys used in Applicable Statuses / UI to canonical LoanStatus', () => {
    expect(normalizeApplicableStatusKey('qualified')).toBe(LoanStatus.IN_NEGOTIATION);
    expect(normalizeApplicableStatusKey('Qualified')).toBe(LoanStatus.IN_NEGOTIATION);
    expect(normalizeApplicableStatusKey('submitted')).toBe(LoanStatus.UNDER_KAM_REVIEW);
    expect(normalizeApplicableStatusKey('Submitted')).toBe(LoanStatus.UNDER_KAM_REVIEW);
  });

  it('normalizes spaces and hyphens', () => {
    expect(normalizeApplicableStatusKey('Under KAM Review')).toBe(LoanStatus.UNDER_KAM_REVIEW);
  });
});

describe('getDefaultApplicableStatuses', () => {
  it('returns full canonical list for tooling', () => {
    const out = getDefaultApplicableStatuses();
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((e) => e.key === LoanStatus.DRAFT)).toBe(true);
  });
});

describe('APPLICABLE_STATUSES_AIRTABLE_FIELD', () => {
  it('matches Airtable column name', () => {
    expect(APPLICABLE_STATUSES_AIRTABLE_FIELD).toBe('Applicable Statuses');
  });
});
