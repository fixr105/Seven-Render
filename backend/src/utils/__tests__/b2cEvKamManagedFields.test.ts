import { describe, it, expect } from '@jest/globals';
import { preserveB2cKamManagedFields } from '../b2cEvKamManagedFields.js';

describe('preserveB2cKamManagedFields', () => {
  it('preserves KAM-approved compliance when client sends false', () => {
    const existing = {
      'compliance.vkycDone': 'true',
      '_meta.kamRequests.vkyc.requestedAt': '',
    };
    const merged = {
      'compliance.vkycDone': false,
      '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
    };

    const result = preserveB2cKamManagedFields(existing, merged);

    expect(result['compliance.vkycDone']).toBe('true');
    expect(result['_meta.kamRequests.vkyc.requestedAt']).toBe('');
  });

  it('preserves DO fulfillment fields when client draft omits them', () => {
    const existing = {
      '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
      '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z',
      '_meta.doRequest.fulfilledBy': 'kam@test.local',
      '_meta.doRequest.status': 'approved',
    };
    const merged = {
      '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
      '_meta.doRequest.fulfilledAt': '',
      '_meta.doRequest.status': '',
    };

    const result = preserveB2cKamManagedFields(existing, merged);

    expect(result['_meta.doRequest.fulfilledAt']).toBe('2026-01-02T00:00:00.000Z');
    expect(result['_meta.doRequest.fulfilledBy']).toBe('kam@test.local');
    expect(result['_meta.doRequest.status']).toBe('approved');
  });

  it('preserves DO rejection metadata when client sends stale requestedAt', () => {
    const existing = {
      '_meta.doRequest.requestedAt': '',
      '_meta.doRequest.status': 'rejected',
      '_meta.doRequest.rejectionReason': 'Incomplete folder',
      '_meta.doRequest.rejectedAt': '2026-01-03T00:00:00.000Z',
    };
    const merged = {
      '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
      '_meta.doRequest.status': 'pending',
    };

    const result = preserveB2cKamManagedFields(existing, merged);

    expect(result['_meta.doRequest.requestedAt']).toBe('');
    expect(result['_meta.doRequest.status']).toBe('rejected');
    expect(result['_meta.doRequest.rejectionReason']).toBe('Incomplete folder');
  });

  it('allows client updates when KAM has not approved compliance', () => {
    const existing = { 'compliance.vkycDone': false };
    const merged = { 'compliance.vkycDone': false, 'borrower.mobile': '9999999999' };

    const result = preserveB2cKamManagedFields(existing, merged);

    expect(result['borrower.mobile']).toBe('9999999999');
  });
});
