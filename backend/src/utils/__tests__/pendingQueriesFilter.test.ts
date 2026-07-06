import { describe, expect, it } from '@jest/globals';
import {
  buildResolvedQueryIds,
  filterPendingQueries,
  isActionableQuery,
  isUnresolved,
} from '../pendingQueriesFilter.js';

describe('pendingQueriesFilter', () => {
  it('isUnresolved treats False, false, and empty as unresolved', () => {
    expect(isUnresolved({ Resolved: 'False' })).toBe(true);
    expect(isUnresolved({ Resolved: 'false' })).toBe(true);
    expect(isUnresolved({ Resolved: '' })).toBe(true);
    expect(isUnresolved({ Resolved: 'True' })).toBe(false);
  });

  it('isActionableQuery excludes replies and resolved action types', () => {
    expect(
      isActionableQuery({
        'Action/Event Type': 'query_raised',
        'Details/Message': 'Need docs',
      })
    ).toBe(true);
    expect(
      isActionableQuery({
        'Action/Event Type': 'query_resolved',
        'Details/Message': 'Query Q1 resolved',
      })
    ).toBe(false);
    expect(
      isActionableQuery({
        'Action/Event Type': 'query_raised',
        'Details/Message': 'Reply to query Q1: here',
      })
    ).toBe(false);
  });

  it('buildResolvedQueryIds parses parent tag and legacy format', () => {
    const ids = buildResolvedQueryIds([
      {
        id: 'res-1',
        'Action/Event Type': 'query_resolved',
        'Details/Message': '[[parent:Q-ROOT-1]] resolved',
      },
      {
        id: 'res-2',
        'Action/Event Type': 'query_resolved',
        'Details/Message': 'Query Q-ROOT-2 resolved: done',
      },
    ]);
    expect(ids.has('Q-ROOT-1')).toBe(true);
    expect(ids.has('Q-ROOT-2')).toBe(true);
  });

  it('filterPendingQueries excludes resolved queries and filters by target role', () => {
    const auditLogs = [
      {
        id: 'Q1',
        File: 'SF001',
        Resolved: 'False',
        'Action/Event Type': 'query_raised',
        'Details/Message': 'Need PAN',
        'Target User/Role': 'credit_team',
      },
      {
        id: 'Q2',
        File: 'SF002',
        Resolved: 'True',
        'Action/Event Type': 'query_raised',
        'Details/Message': 'Old query',
        'Target User/Role': 'credit_team',
      },
      {
        id: 'Q3',
        File: 'SF003',
        Resolved: 'False',
        'Action/Event Type': 'query_raised',
        'Details/Message': 'For KAM',
        'Target User/Role': 'kam',
      },
      {
        id: 'res-1',
        'Action/Event Type': 'query_resolved',
        'Details/Message': 'Query Q4 resolved: ok',
      },
      {
        id: 'Q4',
        File: 'SF004',
        Resolved: 'False',
        'Action/Event Type': 'query_raised',
        'Details/Message': 'Still open in Airtable',
        'Target User/Role': 'credit_team',
      },
    ];
    const applications = [
      { id: 'app-1', 'File ID': 'SF001' },
      { id: 'app-4', 'File ID': 'SF004' },
    ];

    const creditPending = filterPendingQueries(auditLogs, {
      targetRole: 'credit_team',
      applications,
    });

    expect(creditPending.map((q) => q.id)).toEqual(['Q1']);
  });
});
