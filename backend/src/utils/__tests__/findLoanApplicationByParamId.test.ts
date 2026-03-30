import { describe, it, expect } from '@jest/globals';
import { findLoanApplicationByParamId } from '../findLoanApplicationByParamId.js';

describe('findLoanApplicationByParamId', () => {
  const apps = [
    { id: 'recABC', 'File ID': 'M1-001', Client: 'c1' },
    { id: 'recXYZ', 'File ID': 'M1-002', Client: 'c2' },
  ];

  it('finds by Airtable record id', () => {
    expect(findLoanApplicationByParamId(apps, 'recABC')).toEqual(apps[0]);
  });

  it('finds by File ID', () => {
    expect(findLoanApplicationByParamId(apps, 'M1-002')).toEqual(apps[1]);
  });

  it('finds case-insensitively', () => {
    expect(findLoanApplicationByParamId(apps, 'm1-001')).toEqual(apps[0]);
    expect(findLoanApplicationByParamId(apps, 'recabc')).toEqual(apps[0]);
  });

  it('returns undefined when missing', () => {
    expect(findLoanApplicationByParamId(apps, 'nope')).toBeUndefined();
    expect(findLoanApplicationByParamId([], 'recABC')).toBeUndefined();
  });
});
