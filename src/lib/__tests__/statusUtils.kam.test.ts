import { describe, it, expect } from 'vitest';
import { getAllowedNextStatusesForKam, normalizeStatus } from '../statusUtils';

describe('getAllowedNextStatusesForKam', () => {
  it('returns query and forward from under_kam_review', () => {
    const allowed = getAllowedNextStatusesForKam('under_kam_review');
    expect(allowed).toContain('query_with_client');
    expect(allowed).toContain('pending_credit_review');
  });

  it('returns back to review and forward from query_with_client', () => {
    const allowed = getAllowedNextStatusesForKam('query_with_client');
    expect(allowed).toContain('under_kam_review');
    expect(allowed).toContain('pending_credit_review');
  });

  it('normalizes aliases before lookup', () => {
    const allowed = getAllowedNextStatusesForKam('pending_kam_review');
    expect(allowed.length).toBeGreaterThan(0);
    expect(normalizeStatus('pending_kam_review')).toBe('under_kam_review');
  });
});
