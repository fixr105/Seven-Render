import { describe, expect, it } from '@jest/globals';
import { isB2cMetadataOnlyFormPatch } from '../b2cEvFormPatchGuards.js';

describe('isB2cMetadataOnlyFormPatch', () => {
  it('returns true for _meta-only patches', () => {
    expect(
      isB2cMetadataOnlyFormPatch({
        '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
        '_meta.doRequest.queryId': 'QUERY-1',
      })
    ).toBe(true);
  });

  it('allows promoted field aliases alongside metadata', () => {
    expect(
      isB2cMetadataOnlyFormPatch({
        '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
        applicant_name: 'Test User',
      })
    ).toBe(true);
  });

  it('returns false when non-metadata business fields are included', () => {
    expect(
      isB2cMetadataOnlyFormPatch({
        '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
        'borrower.customerName': 'Test User',
      })
    ).toBe(false);
  });
});
