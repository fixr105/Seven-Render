import { describe, expect, it } from '@jest/globals';
import { buildApplicationCountByClientId } from '../applicationClientCounts.js';

describe('buildApplicationCountByClientId', () => {
  it('counts applications for both Airtable record ids and business Client IDs', () => {
    const clients = [
      { id: 'recClient1', 'Client ID': 'CLIENT001' },
      { id: 'recClient2', 'Client ID': 'CLIENT002' },
    ];
    const applications = [
      { id: 'recApp1', 'File ID': 'SF001', Client: 'recClient1', 'Last Updated': '2025-01-01T10:00:00Z' },
      { id: 'recApp2', 'File ID': 'SF002', Client: 'CLIENT001', 'Last Updated': '2025-01-02T10:00:00Z' },
      { id: 'recApp3', 'File ID': 'SF003', Client: ['recClient2'], 'Last Updated': '2025-01-03T10:00:00Z' },
      { id: 'recApp4', 'File ID': 'SF004', Client: { id: 'recClient2' }, 'Last Updated': '2025-01-04T10:00:00Z' },
    ];

    const counts = buildApplicationCountByClientId(clients, applications);

    expect(counts.get('recClient1')).toBe(2);
    expect(counts.get('CLIENT001')).toBe(2);
    expect(counts.get('recClient2')).toBe(2);
    expect(counts.get('CLIENT002')).toBe(2);
  });

  it('deduplicates repeated application rows by File ID before counting', () => {
    const clients = [{ id: 'recClient1', 'Client ID': 'CLIENT001' }];
    const applications = [
      { id: 'old', 'File ID': 'SF001', Client: 'CLIENT001', 'Last Updated': '2025-01-01T10:00:00Z' },
      { id: 'new', 'File ID': 'SF001', Client: 'CLIENT001', 'Last Updated': '2025-01-02T10:00:00Z' },
    ];

    const counts = buildApplicationCountByClientId(clients, applications);

    expect(counts.get('CLIENT001')).toBe(1);
  });
});
