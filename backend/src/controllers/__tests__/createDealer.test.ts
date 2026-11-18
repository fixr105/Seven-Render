/**
 * POST /api/users/create-dealer
 * KAM or admin creates a client login from the password entered on the form.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { UsersController } from '../users.controller.js';
import { UserRole } from '../../config/constants.js';
import { AuthService, authService } from '../../auth/auth.service.js';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

type StoreRecord = Record<string, unknown> & { id?: string };

let userAccountsStore: StoreRecord[] = [];
let clientsStore: StoreRecord[] = [];
let clientKycStore: StoreRecord[] = [];

const mockFetchTable = jest.fn(async (tableName: string) => {
  if (tableName === 'User Accounts') return [...userAccountsStore];
  if (tableName === 'Clients') return [...clientsStore];
  if (tableName === 'Client KYC') return [...clientKycStore];
  return [];
});

const mockPostUserAccount = jest.fn(async (data: Record<string, unknown>) => {
  const id = String(data.id || '');
  userAccountsStore.push({ ...data, id });
  return { success: true, id };
});

const mockPostClient = jest.fn(async (data: Record<string, unknown>) => {
  const id = String(data.id || data['Client ID'] || '');
  clientsStore.push({ ...data, id });
  return { success: true, id: 'recCLIENT1' };
});

const mockPostClientKyc = jest.fn(async (data: Record<string, unknown>) => {
  const id = String(data.id || data['Client KYC Record'] || '');
  clientKycStore.push({ ...data, id: 'recKYC1' });
  return { success: true, id: 'recKYC1' };
});

const mockPostAdminActivityLog = jest.fn(async () => ({ success: true }));

const mockGetUserAccounts = jest.fn(async () => [...userAccountsStore]);

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: (tableName: string) => mockFetchTable(tableName),
    postUserAccount: (data: Record<string, unknown>) => mockPostUserAccount(data),
    postClient: (data: Record<string, unknown>) => mockPostClient(data),
    postClientKyc: (data: Record<string, unknown>) => mockPostClientKyc(data),
    postAdminActivityLog: () => mockPostAdminActivityLog(),
    getUserAccounts: () => mockGetUserAccounts(),
  },
}));

function createMockResponse(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

function requestAs(role: UserRole, body: Record<string, unknown> = {}, kamId?: string): Request {
  return {
    user: {
      id: 'caller-1',
      email: 'kam@test.local',
      role,
      name: 'Test KAM',
      kamId: kamId ?? null,
    },
    body,
    params: {},
    query: {},
  } as Request;
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key.toLowerCase());
      collectKeys(child, keys);
    }
  }
  return keys;
}

function dealerBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    email: 'dealer@example.com',
    name: 'New Dealer',
    password: 'Secret123',
    dealerContact: '9043963606',
    gstNumber: '34GUFPS3547K1Z3',
    dealerPan: 'GUFPS3547K',
    dealerPincode: '605008',
    dealerIfscCode: 'SBIN0000900',
    enabledModules: ['M1', 'M3', 'M4', 'M5'],
    products: 'LP012',
    ...overrides,
  };
}

describe('POST /users/create-dealer', () => {
  let usersController: UsersController;

  beforeEach(() => {
    usersController = new UsersController();
    userAccountsStore = [];
    clientsStore = [];
    clientKycStore = [];
    AuthService.clearUserAccountsCache();
    jest.clearAllMocks();
  });

  it('hashes the submitted password, writes all three tables, and omits secrets', async () => {
    clientKycStore.push({ 'Client KYC Record': 'KYC47', 'Dealer ID': 'DLR46' });
    const req = requestAs(
      UserRole.KAM,
      dealerBody({
        email: '  NewDealer@Example.com ',
        name: '  dealer name ',
      }),
      'USER-1767430965768-xkughnmb6'
    );
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      email: 'newdealer@example.com',
      name: 'DEALER NAME',
      role: 'client',
      clientId: expect.any(String),
    });

    const keys = collectKeys(res.body);
    expect(keys).not.toContain('password');
    expect(keys).not.toContain('hash');
    expect(keys).not.toContain('pin');

    const clientId = (res.body as { clientId: string }).clientId;
    expect(mockPostClient).toHaveBeenCalledTimes(2);
    expect(mockPostClientKyc).toHaveBeenCalledTimes(1);
    expect(mockPostUserAccount).toHaveBeenCalledTimes(1);
    expect(mockPostClient.mock.invocationCallOrder[0]).toBeLessThan(
      mockPostClientKyc.mock.invocationCallOrder[0]
    );
    expect(mockPostClientKyc.mock.invocationCallOrder[0]).toBeLessThan(
      mockPostClient.mock.invocationCallOrder[1]
    );
    expect(mockPostClient.mock.invocationCallOrder[1]).toBeLessThan(
      mockPostUserAccount.mock.invocationCallOrder[0]
    );

    const firstClient = mockPostClient.mock.calls[0][0] as Record<string, unknown>;
    expect(firstClient['Client ID']).toBe(clientId);
    expect(firstClient['Products']).toBe('LP012');
    expect(firstClient['Enabled Modules']).toBe('M1, M3, M4, M5');
    expect(firstClient['Commission Rate']).toBe('0');
    expect(firstClient['Assigned KAM']).toBe('USER-1767430965768-xkughnmb6');

    const kyc = mockPostClientKyc.mock.calls[0][0] as Record<string, unknown>;
    expect(kyc['Client ID']).toBe(clientId);
    expect(kyc['Client KYC Record']).toBe('KYC48');
    expect(kyc['Dealer ID']).toBe('DLR47');
    expect(kyc['Client Link']).toEqual(['recCLIENT1']);
    expect(kyc['GST Number']).toBe('34GUFPS3547K1Z3');

    const linked = mockPostClient.mock.calls[1][0] as Record<string, unknown>;
    expect(linked['Client KYC']).toEqual(['recKYC1']);

    const payload = mockPostUserAccount.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.Username).toBe('newdealer@example.com');
    expect(payload.Role).toBe('client');
    expect(payload.client_ID).toBe(clientId);
    expect(payload.Kam_ID).toBe('');
    expect(payload.NBFC_ID).toBe('');
    expect(payload.CreditTeam_ID).toBe('');
    expect(payload['Last Login']).toBeUndefined();
    expect(payload['Account Status']).toBe('Active');
    expect(payload['Associated Profile']).toBe('DEALER NAME');
    expect(payload.Password).not.toBe('Secret123');
    expect(await bcrypt.compare('Secret123', String(payload.Password))).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('pass@123');

    const loggedIn = await authService.validateCredentials('newdealer@example.com', 'Secret123');
    expect(loggedIn).not.toBeNull();
    expect(loggedIn?.role).toBe(UserRole.CLIENT);
    expect(loggedIn?.email).toBe('newdealer@example.com');
  });

  it('returns the Airtable error and does not create a login when Clients fails', async () => {
    mockPostClient.mockResolvedValueOnce({
      success: false,
      id: '',
      error: 'Unknown field name: Products',
    } as { success: boolean; id: string; error?: string });
    const req = requestAs(UserRole.KAM, dealerBody(), 'KAM-77');
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: 'Unknown field name: Products',
    });
    expect(mockPostClientKyc).not.toHaveBeenCalled();
    expect(mockPostUserAccount).not.toHaveBeenCalled();
  });

  it('creates a Clients row that a GET by email returns with the dealer name and Active status', async () => {
    const req = requestAs(UserRole.KAM, dealerBody());
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as { success: boolean; email: string; name: string; clientId: string };
    expect(body.success).toBe(true);
    expect(body.clientId).toEqual(expect.any(String));
    expect(body.clientId.length).toBeGreaterThan(0);

    const clients = await mockFetchTable('Clients');
    const row = clients.find((client) =>
      String(client['Contact Email / Phone'] ?? '')
        .toLowerCase()
        .includes('dealer@example.com')
    );

    expect(row).toBeDefined();
    expect(row?.['Client Name']).toBe('NEW DEALER');
    expect(row?.Status).toBe('Active');
    expect(row?.['Client ID'] ?? row?.id).toBe(body.clientId);
  });

  it('rejects an existing email without creating a duplicate row', async () => {
    userAccountsStore.push({
      id: 'USER-existing',
      Username: 'Existing@Example.com',
      Password: 'already-hashed',
      Role: 'client',
      'Account Status': 'Active',
    });

    const req = requestAs(UserRole.KAM, dealerBody({ email: 'existing@example.com', name: 'Someone' }));
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: 'A user with this email already exists',
    });
    expect(mockPostUserAccount).not.toHaveBeenCalled();
    expect(userAccountsStore).toHaveLength(1);
  });

  it('returns 403 when the caller is a client', async () => {
    const req = requestAs(UserRole.CLIENT, {
      email: 'newdealer@example.com',
      name: 'Dealer Name',
    });
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(403);
    expect(mockPostUserAccount).not.toHaveBeenCalled();
  });

  it('sets Assigned KAM to the creating KAM id', async () => {
    const req = requestAs(UserRole.KAM, dealerBody(), 'KAM-77');
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockPostClient).toHaveBeenCalledWith(
      expect.objectContaining({ 'Assigned KAM': 'KAM-77' })
    );
  });

  it('leaves Assigned KAM blank when an admin creates the dealer', async () => {
    const req = requestAs(UserRole.ADMIN, dealerBody());
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(200);
    const payload = mockPostClient.mock.calls[0][0] as Record<string, unknown>;
    expect(payload['Assigned KAM'] ?? '').toBe('');
  });
});
