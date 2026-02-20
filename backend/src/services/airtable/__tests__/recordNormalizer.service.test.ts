/**
 * Unit tests for Record Normalizer service
 */

import { describe, it, expect } from '@jest/globals';
import { normalizeRecords } from '../recordNormalizer.service.js';

describe('normalizeRecords', () => {
  it('fills Client ID from clientId variant', () => {
    const records = [{ id: 'rec1', clientId: 'CL001' }];
    const result = normalizeRecords(records, 'Clients');
    expect(result[0]['Client ID']).toBe('CL001');
  });

  it('fills Product ID from productId variant', () => {
    const records = [{ id: 'rec1', productId: 'LP001' }];
    const result = normalizeRecords(records, 'Product Documents');
    expect(result[0]['Product ID']).toBe('LP001');
  });

  it('fills Record Title from recordTitle variant', () => {
    const records = [{ id: 'rec1', recordTitle: 'PAN Card' }];
    const result = normalizeRecords(records, 'Record Titles');
    expect(result[0]['Record Title']).toBe('PAN Card');
  });

  it('fills Form Data from form_data variant', () => {
    const records = [{ id: 'rec1', form_data: '{"key":"value"}' }];
    const result = normalizeRecords(records, 'Loan Application');
    expect(result[0]['Form Data']).toBe('{"key":"value"}');
  });

  it('normalizes Resolved boolean to True', () => {
    const records = [
      { id: 'rec1', Resolved: true },
      { id: 'rec2', Resolved: 'true' },
      { id: 'rec3', Resolved: 'True' },
    ];
    const result = normalizeRecords(records, 'File Auditing Log');
    expect(result[0].Resolved).toBe('True');
    expect(result[1].Resolved).toBe('True');
    expect(result[2].Resolved).toBe('True');
  });

  it('normalizes Resolved boolean to False', () => {
    const records = [
      { id: 'rec1', Resolved: false },
      { id: 'rec2', Resolved: 'false' },
    ];
    const result = normalizeRecords(records, 'File Auditing Log');
    expect(result[0].Resolved).toBe('False');
    expect(result[1].Resolved).toBe('False');
  });

  it('normalizes Is Required boolean', () => {
    const records = [{ id: 'rec1', 'Is Required': true }];
    const result = normalizeRecords(records, 'Record Titles');
    expect(result[0]['Is Required']).toBe('True');
  });

  it('preserves existing canonical keys', () => {
    const records = [{ id: 'rec1', 'Client ID': 'CL001', clientId: 'CL999' }];
    const result = normalizeRecords(records, 'Clients');
    expect(result[0]['Client ID']).toBe('CL001');
  });

  it('returns empty array unchanged', () => {
    const result = normalizeRecords([], 'Clients');
    expect(result).toEqual([]);
  });

  it('returns records with id when array has records', () => {
    const records = [{ id: 'rec1', Status: 'pending' }];
    const result = normalizeRecords(records, 'Loan Application');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('rec1');
  });
});
