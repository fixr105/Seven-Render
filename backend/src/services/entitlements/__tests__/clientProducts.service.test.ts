import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UserRole } from '../../../config/constants.js';
import {
  ClientProductEntitlementCode,
  resolveClientAssignedProducts,
  resolveClientRecord,
} from '../clientProducts.service.js';
import { n8nClient } from '../../airtable/n8nClient.js';

jest.mock('../../airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
    getUserAccounts: jest.fn(),
  },
}));

const mockN8nClient = n8nClient as unknown as {
  fetchTable: jest.Mock;
  getUserAccounts: jest.Mock;
};

const clientUser = {
  id: 'user-1',
  email: 'client@example.com',
  role: UserRole.CLIENT,
  clientId: null,
};

describe('resolveClientRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockN8nClient.getUserAccounts.mockResolvedValue([] as never);
  });

  it('matches client by email in Contact Email/Phone', async () => {
    mockN8nClient.fetchTable.mockResolvedValue([
      {
        id: 'rec-1',
        'Client ID': 'CL001',
        'Contact Email/Phone': 'client@example.com | +91 99999',
        'Assigned Products': 'LP012',
      },
    ] as never);

    const result = await resolveClientRecord(clientUser as any);

    expect(result).toEqual({
      clientId: 'CL001',
      clientRecord: expect.objectContaining({ 'Client ID': 'CL001' }),
    });
  });

  it('matches client by Associated Profile name when email does not match', async () => {
    mockN8nClient.fetchTable.mockResolvedValue([
      {
        id: 'rec-2',
        'Client ID': 'CL002',
        'Client Name': 'Vadukavsk',
        products: 'LP012',
      },
    ] as never);
    mockN8nClient.getUserAccounts.mockResolvedValue([
      {
        id: 'user-1',
        Username: 'client@example.com',
        'Associated Profile': 'Vadukavsk',
      },
    ] as never);

    const result = await resolveClientRecord(clientUser as any);

    expect(result.clientId).toBe('CL002');
  });

  it('recovers from stale JWT clientId using email fallback', async () => {
    mockN8nClient.fetchTable.mockResolvedValue([
      {
        id: 'rec-3',
        'Client ID': 'CL003',
        'Contact Email / Phone': 'client@example.com',
        products: 'LP012',
      },
    ] as never);

    const result = await resolveClientRecord({
      ...clientUser,
      clientId: 'stale-id',
    } as any);

    expect(result.clientId).toBe('CL003');
  });

  it('throws CLIENT_NOT_LINKED when no client record can be resolved', async () => {
    mockN8nClient.fetchTable.mockResolvedValue([] as never);

    await expect(resolveClientRecord(clientUser as any)).rejects.toMatchObject({
      statusCode: 401,
      code: ClientProductEntitlementCode.CLIENT_NOT_LINKED,
    });
  });
});

describe('resolveClientAssignedProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockN8nClient.getUserAccounts.mockResolvedValue([] as never);
  });

  it('returns empty assignedProductIds when client has no assigned products', async () => {
    mockN8nClient.fetchTable.mockResolvedValue([
      {
        id: 'rec-1',
        'Client ID': 'CL001',
        'Contact Email/Phone': 'client@example.com',
        products: '',
      },
    ] as never);

    const result = await resolveClientAssignedProducts(clientUser as any);

    expect(result).toEqual({
      clientId: 'CL001',
      assignedProductIds: [],
    });
  });
});
