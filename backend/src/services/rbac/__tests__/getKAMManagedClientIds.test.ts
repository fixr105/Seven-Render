/**
 * getKAMManagedClientIds: when Assigned KAM = KAM ID and user.kamId = record id,
 * the client is still included (resolution via KAM Users).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { rbacFilterService } from '../rbacFilter.service.js';

const mockFetchTable = jest.fn();
jest.mock('../../airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: (...args: unknown[]) => mockFetchTable(...args),
  },
}));

describe('getKAMManagedClientIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes client when Assigned KAM = KAM ID and kamId = KAM Users record id', async () => {
    const kamUserRecordId = 'recKAM001';
    const kamIdBusiness = 'KAM001';
    const clientId = 'recClient1';

    mockFetchTable.mockImplementation(async (table: string) => {
      if (table === 'Clients') {
        return [{ id: clientId, 'Client ID': clientId, 'Assigned KAM': kamIdBusiness }];
      }
      if (table === 'KAM Users') {
        return [{ id: kamUserRecordId, 'KAM ID': kamIdBusiness }];
      }
      return [];
    });

    const result = await rbacFilterService.getKAMManagedClientIds(kamUserRecordId);

    expect(result).toContain(clientId);
    expect(mockFetchTable).toHaveBeenCalledWith('Clients');
    expect(mockFetchTable).toHaveBeenCalledWith('KAM Users');
  });
});
