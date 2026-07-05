import { describe, expect, it } from '@jest/globals';
import { mergeFormDataPatch, parseFormDataField } from '../mergeFormDataPatch.js';

describe('mergeFormDataPatch', () => {
  it('preserves _meta keys when patch only updates borrower fields', () => {
    const existing = {
      '_meta.formTemplate': 'b2c_ev_v1',
      '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
      'borrower.firstName': 'Ajay',
    };
    const patch = { 'borrower.firstName': 'Rahul' };
    const merged = mergeFormDataPatch(existing, patch);
    expect(merged['borrower.firstName']).toBe('Rahul');
    expect(merged['_meta.formTemplate']).toBe('b2c_ev_v1');
    expect(merged['_meta.kamRequests.vkyc.requestedAt']).toBe('2026-01-01T00:00:00.000Z');
  });

  it('allows explicit patch of _meta keys', () => {
    const existing = { '_meta.doRequest.requestedAt': '2026-01-01' };
    const patch = { '_meta.doRequest.fulfilledAt': '2026-01-02' };
    const merged = mergeFormDataPatch(existing, patch);
    expect(merged['_meta.doRequest.requestedAt']).toBe('2026-01-01');
    expect(merged['_meta.doRequest.fulfilledAt']).toBe('2026-01-02');
  });
});

describe('parseFormDataField', () => {
  it('parses JSON string', () => {
    expect(parseFormDataField('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns empty object for invalid JSON', () => {
    expect(parseFormDataField('not-json')).toEqual({});
  });
});
