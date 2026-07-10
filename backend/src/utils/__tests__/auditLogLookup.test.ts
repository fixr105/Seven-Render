import { describe, expect, it } from '@jest/globals';
import {
  auditLogEntryMatchesFile,
  findAuditLogEntryByIdentifier,
  readAuditLogIdentifier,
} from '../auditLogLookup.js';

describe('auditLogLookup', () => {
  const entry = {
    id: 'recAudit001',
    'Log Entry ID': 'QUERY-123',
    File: 'SF-001',
    Actor: 'client@example.com',
  };

  it('finds entries by Log Entry ID when id is an Airtable record id', () => {
    expect(findAuditLogEntryByIdentifier([entry], 'QUERY-123')).toBe(entry);
    expect(findAuditLogEntryByIdentifier([entry], 'recAudit001')).toBe(entry);
  });

  it('reads a stable identifier for threading', () => {
    expect(readAuditLogIdentifier(entry)).toBe('recAudit001');
  });

  it('matches file ids across field variants', () => {
    expect(auditLogEntryMatchesFile(entry, 'SF-001')).toBe(true);
    expect(auditLogEntryMatchesFile(entry, 'SF-999')).toBe(false);
  });
});
