/**
 * Tests for API → UI transforms (client and edge-case shapes).
 */

import { describe, it, expect } from 'vitest';
import { mapClientFromApi } from '../applicationTransform';

describe('mapClientFromApi', () => {
  it('client: "Acme" → { company_name: "Acme" }', () => {
    expect(mapClientFromApi('Acme')).toEqual({ company_name: 'Acme' });
  });

  it('client: { name: "Acme" } → { company_name: "Acme" }', () => {
    expect(mapClientFromApi({ name: 'Acme' })).toEqual({ company_name: 'Acme' });
  });

  it('client: { ["Client Name"]: "Acme" } → { company_name: "Acme" }', () => {
    expect(mapClientFromApi({ 'Client Name': 'Acme' })).toEqual({ company_name: 'Acme' });
  });

  it('client: undefined → undefined', () => {
    expect(mapClientFromApi(undefined)).toBeUndefined();
  });

  it('client: null → undefined', () => {
    expect(mapClientFromApi(null)).toBeUndefined();
  });

  it('client: { company_name: "X" } → { company_name: "X" }', () => {
    expect(mapClientFromApi({ company_name: 'X' })).toEqual({ company_name: 'X' });
  });
});
