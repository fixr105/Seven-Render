import { describe, it, expect } from '@jest/globals';
import {
  parseApplicableStatusesFromProduct,
  getDefaultApplicableStatuses,
  APPLICABLE_STATUSES_AIRTABLE_FIELD,
} from '../loanProductStatuses.service.js';
import { LoanStatus } from '../../../config/constants.js';

describe('parseApplicableStatusesFromProduct', () => {
  it('returns full default catalog when field missing', () => {
    const out = parseApplicableStatusesFromProduct({});
    expect(out.length).toBe(getDefaultApplicableStatuses().length);
    expect(out.some((e) => e.key === LoanStatus.DRAFT)).toBe(true);
  });

  it('parses valid JSON array with keys and labels', () => {
    const raw = JSON.stringify([
      { key: 'under_kam_review', label: 'KAM queue', order: 5 },
      { key: 'pending_credit_review', label: 'Credit', order: 10 },
    ]);
    const out = parseApplicableStatusesFromProduct({
      [APPLICABLE_STATUSES_AIRTABLE_FIELD]: raw,
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: 'under_kam_review', label: 'KAM queue', order: 5 });
    expect(out[1].key).toBe('pending_credit_review');
  });

  it('drops invalid keys and keeps valid ones', () => {
    const raw = JSON.stringify([
      { key: 'not_a_real_status', label: 'Bad', order: 1 },
      { key: 'draft', label: 'Draft', order: 2 },
    ]);
    const out = parseApplicableStatusesFromProduct({ [APPLICABLE_STATUSES_AIRTABLE_FIELD]: raw }, 'LP001');
    expect(out.some((e) => e.key === 'draft')).toBe(true);
    expect(out.some((e) => e.key === 'not_a_real_status')).toBe(false);
  });

  it('falls back to default when JSON is not an array', () => {
    const out = parseApplicableStatusesFromProduct({
      [APPLICABLE_STATUSES_AIRTABLE_FIELD]: '{"foo":1}',
    });
    expect(out.length).toBe(getDefaultApplicableStatuses().length);
  });

  it('falls back to default when JSON is malformed string', () => {
    const out = parseApplicableStatusesFromProduct({
      [APPLICABLE_STATUSES_AIRTABLE_FIELD]: 'not json',
    });
    expect(out.length).toBe(getDefaultApplicableStatuses().length);
  });

  it('falls back to default when array parses but all keys invalid', () => {
    const raw = JSON.stringify([{ key: 'invalid', label: 'X', order: 1 }]);
    const out = parseApplicableStatusesFromProduct({ [APPLICABLE_STATUSES_AIRTABLE_FIELD]: raw });
    expect(out.length).toBe(getDefaultApplicableStatuses().length);
  });
});
