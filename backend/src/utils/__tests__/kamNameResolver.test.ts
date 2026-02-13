/**
 * Unit tests for KAM name resolver
 */

import { describe, it, expect } from '@jest/globals';
import { buildKAMNameMap, resolveKAMName } from '../kamNameResolver.js';

describe('buildKAMNameMap', () => {
  it('resolves KAM ID to name from KAM Users by id', () => {
    const kamUsers = [
      { id: 'recKAM1', 'KAM ID': 'KAM001', Name: 'Sagar' },
    ];
    const map = buildKAMNameMap(kamUsers);
    expect(map.get('recKAM1')).toBe('Sagar');
    expect(map.get('KAM001')).toBe('Sagar');
  });

  it('resolves by KAM ID field when different from record id', () => {
    const kamUsers = [
      { id: 'recXYZ', 'KAM ID': 'USER-1767430957573-81645wu26', Name: 'Rahul' },
    ];
    const map = buildKAMNameMap(kamUsers);
    expect(map.get('recXYZ')).toBe('Rahul');
    expect(map.get('USER-1767430957573-81645wu26')).toBe('Rahul');
  });

  it('handles multiple KAM users', () => {
    const kamUsers = [
      { id: 'rec1', 'KAM ID': 'KAM001', Name: 'Sagar' },
      { id: 'rec2', 'KAM ID': 'KAM002', Name: 'Priya' },
    ];
    const map = buildKAMNameMap(kamUsers);
    expect(map.get('KAM001')).toBe('Sagar');
    expect(map.get('KAM002')).toBe('Priya');
  });

  it('handles KAM user with only id (no KAM ID field)', () => {
    const kamUsers = [{ id: 'recOnly', Name: 'Single' }];
    const map = buildKAMNameMap(kamUsers);
    expect(map.get('recOnly')).toBe('Single');
  });
});

describe('resolveKAMName', () => {
  const kamNameMap = new Map<string, string>([
    ['KAM001', 'Sagar'],
    ['USER-123', 'Rahul'],
  ]);

  it('returns KAM name when found', () => {
    expect(resolveKAMName('KAM001', kamNameMap)).toBe('Sagar');
    expect(resolveKAMName('USER-123', kamNameMap)).toBe('Rahul');
  });

  it('returns raw ID when KAM not found', () => {
    expect(resolveKAMName('UNKNOWN-ID', kamNameMap)).toBe('UNKNOWN-ID');
  });

  it('handles empty or missing Assigned KAM', () => {
    expect(resolveKAMName('', kamNameMap)).toBe('');
    expect(resolveKAMName(undefined, kamNameMap)).toBe('');
    expect(resolveKAMName(null, kamNameMap)).toBe('');
  });

  it('trims whitespace in lookup', () => {
    const mapWithSpaces = new Map([['KAM001', 'Sagar']]);
    expect(resolveKAMName('  KAM001  ', mapWithSpaces)).toBe('Sagar');
  });
});
