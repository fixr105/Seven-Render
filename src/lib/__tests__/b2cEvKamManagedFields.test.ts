import { describe, it, expect } from 'vitest';
import {
  collectKamManagedFieldPatch,
  hasKamManagedFieldChanges,
  mergeKamManagedFieldsFromServer,
} from '../b2cEvKamManagedFields';

describe('b2cEvKamManagedFields', () => {
  it('merges KAM-approved compliance from server', () => {
    const local = { 'compliance.vkycDone': false };
    const server = {
      'compliance.vkycDone': 'true',
      '_meta.kamRequests.vkyc.requestedAt': '',
    };

    const merged = mergeKamManagedFieldsFromServer(local, server);

    expect(merged['compliance.vkycDone']).toBe('true');
    expect(merged['_meta.kamRequests.vkyc.requestedAt']).toBe('');
  });

  it('merges DO fulfillment from server', () => {
    const local = {
      '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
      '_meta.doRequest.fulfilledAt': '',
    };
    const server = {
      '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
      '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z',
      '_meta.doRequest.status': 'approved',
    };

    expect(hasKamManagedFieldChanges(local, server)).toBe(true);

    const merged = mergeKamManagedFieldsFromServer(local, server);

    expect(merged['_meta.doRequest.fulfilledAt']).toBe('2026-01-02T00:00:00.000Z');
    expect(merged['_meta.doRequest.status']).toBe('approved');
  });

  it('returns empty patch when server and local match', () => {
    const formData = {
      'compliance.vkycDone': 'true',
      '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z',
    };

    expect(collectKamManagedFieldPatch(formData, formData)).toEqual({});
    expect(hasKamManagedFieldChanges(formData, formData)).toBe(false);
  });
});
