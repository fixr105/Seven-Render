/**
 * Unit tests for QueryService.resolveQuery
 * Covers author-only resolution: only the query author can resolve, regardless of role
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QueryService } from '../query.service.js';

const mockPostFileAuditLog = jest.fn<() => Promise<void>>();
const mockFetchTable = jest.fn<() => Promise<unknown[]>>();

jest.mock('../../airtable/n8nClient.js', () => ({
  n8nClient: {
    get fetchTable() {
      return mockFetchTable;
    },
    get postFileAuditLog() {
      return mockPostFileAuditLog;
    },
  },
}));

jest.mock('../../notifications/notification.service.js', () => ({
  notificationService: {},
}));

describe('QueryService.resolveQuery', () => {
  let queryService: QueryService;

  const mockQuery = {
    id: 'QUERY-123',
    File: 'file-1',
    Actor: 'client@example.com',
    'Target User/Role': 'kam',
    Resolved: 'False',
    'Details/Message': 'Original query',
  };

  beforeEach(() => {
    queryService = new QueryService();
    jest.clearAllMocks();
    mockPostFileAuditLog.mockResolvedValue(undefined);
    mockFetchTable.mockResolvedValue([mockQuery]);
  });

  it('throws when query not found', async () => {
    mockFetchTable.mockResolvedValue([]);

    await expect(
      queryService.resolveQuery('nonexistent', 'file-1', 'client-1', 'user@example.com')
    ).rejects.toThrow('Query not found');
    expect(mockPostFileAuditLog).not.toHaveBeenCalled();
  });

  it('allows author (client) to resolve own query', async () => {
    await queryService.resolveQuery(
      'QUERY-123',
      'file-1',
      'client-1',
      'client@example.com',
      undefined,
      'client'
    );

    expect(mockPostFileAuditLog).toHaveBeenCalledTimes(2);
    expect(mockPostFileAuditLog).toHaveBeenNthCalledWith(1, expect.objectContaining({
      ...mockQuery,
      Resolved: 'True',
    }));
  });

  it('throws when KAM tries to resolve Credit\'s query (not author)', async () => {
    mockFetchTable.mockResolvedValue([{ ...mockQuery, Actor: 'credit@example.com' }]);

    await expect(
      queryService.resolveQuery(
        'QUERY-123',
        'file-1',
        'client-1',
        'kam@example.com',
        undefined,
        'kam'
      )
    ).rejects.toThrow('Only the query author can resolve this query');

    expect(mockPostFileAuditLog).not.toHaveBeenCalled();
  });

  it('throws when Credit tries to resolve KAM\'s query (not author)', async () => {
    mockFetchTable.mockResolvedValue([{ ...mockQuery, Actor: 'kam@example.com' }]);

    await expect(
      queryService.resolveQuery(
        'QUERY-123',
        'file-1',
        'client-1',
        'credit@example.com',
        undefined,
        'credit_team'
      )
    ).rejects.toThrow('Only the query author can resolve this query');

    expect(mockPostFileAuditLog).not.toHaveBeenCalled();
  });

  it('throws when non-author tries to resolve', async () => {
    await expect(
      queryService.resolveQuery(
        'QUERY-123',
        'file-1',
        'client-1',
        'other@example.com',
        undefined,
        'client'
      )
    ).rejects.toThrow('Only the query author can resolve this query');

    expect(mockPostFileAuditLog).not.toHaveBeenCalled();
  });

  it('allows resolution when query has no Actor (edge case)', async () => {
    mockFetchTable.mockResolvedValue([{ ...mockQuery, Actor: '' }]);

    await queryService.resolveQuery(
      'QUERY-123',
      'file-1',
      'client-1',
      'anyone@example.com',
      undefined,
      'client'
    );

    expect(mockPostFileAuditLog).toHaveBeenCalledTimes(2);
  });
});
