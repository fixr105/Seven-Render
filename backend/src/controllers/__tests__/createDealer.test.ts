/**
 * POST /api/users/create-dealer
 * KAM or admin creates a client login from the password entered on the form.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
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
  if (tableName === 'Loan Products') return [{ 'Product ID': 'LP012', 'Product Name': 'B2C EV' }];
  return [];
});

const mockListClientKyc = jest.fn(async () => [...clientKycStore]);

const mockPostUserAccount = jest.fn(async (data: Record<string, unknown>) => {
  userAccountsStore.push({ ...data, id: `recUSER${userAccountsStore.length + 1}` });
  return { success: true, id: userAccountsStore[userAccountsStore.length - 1].id };
});

const mockPostClient = jest.fn(async (data: Record<string, unknown>) => {
  const recordId = typeof data.id === 'string' && data.id.startsWith('rec') ? data.id : 'recCLIENT1';
  const row = { ...data, id: recordId };
  const existing = clientsStore.findIndex((item) => item.id === recordId);
  if (existing >= 0) clientsStore[existing] = row;
  else clientsStore.push(row);
  return { success: true, id: recordId };
});

const mockPostClientKyc = jest.fn(async (data: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const recordId = typeof data.id === 'string' && data.id.startsWith('rec') ? data.id : 'recKYC1';
  const row = { ...data, id: recordId };
  const existing = clientKycStore.findIndex((item) => item.id === recordId);
  if (existing >= 0) clientKycStore[existing] = row;
  else clientKycStore.push(row);
  return { success: true, id: recordId };
});

const mockPostAdminActivityLog = jest.fn(async () => ({ success: true }));
const mockGetUserAccounts = jest.fn(async () => [...userAccountsStore]);
const mockInvalidateCacheMultiple = jest.fn();

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: (tableName: string) => mockFetchTable(tableName),
    listClientKyc: () => mockListClientKyc(),
    postUserAccount: (data: Record<string, unknown>) => mockPostUserAccount(data),
    postClient: (data: Record<string, unknown>) => mockPostClient(data),
    postClientKyc: (data: Record<string, unknown>) => mockPostClientKyc(data),
    postAdminActivityLog: () => mockPostAdminActivityLog(),
    getUserAccounts: () => mockGetUserAccounts(),
    invalidateCacheMultiple: (names: string[]) => mockInvalidateCacheMultiple(names),
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

function requestAs(role: UserRole, body: Record<string, unknown> = {}): Request {
  return {
    user: {
      id: 'caller-1',
      email: 'kam@test.local',
      role,
      name: 'Test KAM',
    },
    body,
    params: {},
    query: {},
  } as Request;
}

function dealerBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const kycOverrides = (overrides.kyc && typeof overrides.kyc === 'object')
    ? overrides.kyc as Record<string, unknown>
    : {};
  const { kyc: _kyc, ...rest } = overrides;
  return {
    clientName: 'Qalexim Motors',
    primaryContactName: 'Qalexim Motors',
    email: 'dealer@example.com',
    password: 'Secret123',
    enabledModules: ['M1', 'M3', 'M4', 'M5'],
    products: 'LP012',
    commissionRate: 0,
    status: 'Active',
    kyc: {
      tradeName: 'Qalexim Motors',
      dealerName: 'Qalexim Motors',
      dealerContact: '9043963606',
      gstNumber: '34GUFPS3547K1Z3',
      dealerPan: 'GUFPS3547K',
      kycVerified: true,
      kycVerifiedDate: '2026-11-18',
      notes: '',
      address: 'Ground Floor, No. 134, Lenin Nagar',
      city: 'Puducherry',
      state: 'Puducherry',
      pincode: '605008',
      bankName: 'State Bank of India',
      accountNumber: '44392819978',
      ifsc: 'SBIN0000900',
      nameInBank: 'Qalexim Motors',
      selectedDealerDisplay: 'Qalexim Motors',
      ...kycOverrides,
    },
    assignedKam: 'USER-FROM-BODY',
    ...rest,
  };
}

function seedCaller() {
  userAccountsStore = [{
    id: 'recKAM',
    Username: 'kam@test.local',
    Kam_ID: 'USER-SESSION-KAM',
    Role: 'kam',
    'Account Status': 'Active',
    Password: 'not-the-dealer',
  }];
}

const usersController = new UsersController();

describe('createDealer', () => {
  beforeEach(() => {
    userAccountsStore = [];
    clientsStore = [];
    clientKycStore = [];
    seedCaller();
    mockFetchTable.mockClear();
    mockListClientKyc.mockClear();
    mockPostUserAccount.mockClear();
    mockPostClient.mockClear();
    mockPostClientKyc.mockClear();
    mockPostAdminActivityLog.mockClear();
    mockGetUserAccounts.mockClear();
    mockInvalidateCacheMultiple.mockClear();
    AuthService.clearUserAccountsCache();
  });

  it('writes Clients, Client KYC, the link update, then the login', async () => {
    const req = requestAs(UserRole.KAM, dealerBody());
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(201);
    expect(mockPostClient).toHaveBeenCalledTimes(2);
    expect(mockPostClientKyc).toHaveBeenCalledTimes(1);
    expect(mockPostUserAccount).toHaveBeenCalledTimes(1);
    const order = [
      mockPostClient.mock.invocationCallOrder[0],
      mockPostClientKyc.mock.invocationCallOrder[0],
      mockPostClient.mock.invocationCallOrder[1],
      mockPostUserAccount.mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));

    const created = mockPostClient.mock.calls[0][0] as Record<string, unknown>;
    const kyc = mockPostClientKyc.mock.calls[0][0] as Record<string, unknown>;
    const linked = mockPostClient.mock.calls[1][0] as Record<string, unknown>;
    const login = mockPostUserAccount.mock.calls[0][0] as Record<string, unknown>;
    const clientId = created['Client ID'];

    expect(created.id).toBeUndefined();
    expect(kyc.id).toBeUndefined();
    expect(login.id).toBeUndefined();
    expect(kyc['Client ID']).toBe(clientId);
    expect(login.client_ID).toBe(clientId);
    expect(kyc['Client Link']).toEqual(['recCLIENT1']);
    expect(linked.id).toBe('recCLIENT1');
    expect(linked['Client KYC']).toEqual(['recKYC1']);
    expect(linked['Client Name']).toBe(created['Client Name']);
    expect(linked['Primary Contact Name']).toBe(created['Primary Contact Name']);
    expect(linked['Contact Email / Phone']).toBe(created['Contact Email / Phone']);
    expect(linked['Assigned KAM']).toBe('USER-SESSION-KAM');
    expect(linked['Enabled Modules']).toBe('M1, M3, M4, M5');
    expect(linked['Commission Rate']).toBe(0);
    expect(linked.Status).toBe('Active');
    expect(linked.Products).toBe('LP012');
    expect(login.Role).toBe('client');
    expect(login.Kam_ID).toBe('');
    expect(login.NBFC_ID).toBe('');
    expect(login.CreditTeam_ID).toBe('');
    expect(login['Last Login']).toBeUndefined();
    const body = res.body as { clientId: string; clientRecordId: string; kycRecordId: string; role: string };
    expect(body.clientId).toBe(clientId);
    expect(body.clientRecordId).toBe('recCLIENT1');
    expect(body.kycRecordId).toBe('recKYC1');
    expect(body.role).toBe('client');
  });

  it('stores a bcrypt hash that logs in as the client', async () => {
    const req = requestAs(UserRole.KAM, dealerBody());
    const res = createMockResponse();
    await usersController.createDealer(req, res);

    const login = mockPostUserAccount.mock.calls[0][0] as { Password: string };
    expect(login.Password.startsWith('$2')).toBe(true);
    await expect(bcrypt.compare('Secret123', login.Password)).resolves.toBe(true);

    const authed = await authService.validateCredentials('dealer@example.com', 'Secret123');
    expect(authed?.role).toBe(UserRole.CLIENT);
  });

  it('keeps the password, hash, account number, and PAN out of the response and logs', async () => {
    const logs: string[] = [];
    const logSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.map((item) => String(item)).join(' '));
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      logs.push(args.map((item) => String(item)).join(' '));
    });
    const req = requestAs(UserRole.KAM, dealerBody());
    const res = createMockResponse();
    await usersController.createDealer(req, res);
    logSpy.mockRestore();
    errorSpy.mockRestore();

    const packed = `${JSON.stringify(res.body)} ${logs.join('\n')}`;
    expect(packed).not.toContain('Secret123');
    expect(packed).not.toContain('44392819978');
    expect(packed).not.toContain('GUFPS3547K');
    expect(packed).not.toContain('$2a$');
    expect(packed).not.toContain('$2b$');
  });

  it('rejects a duplicate email and a duplicate PAN before writing', async () => {
    userAccountsStore.push({
      Username: 'dealer@example.com',
      Role: 'client',
      'Account Status': 'Active',
    });
    const emailRes = createMockResponse();
    await usersController.createDealer(requestAs(UserRole.KAM, dealerBody()), emailRes);
    expect(emailRes.statusCode).toBe(409);
    expect((emailRes.body as { error_type: string }).error_type).toBe('DUPLICATE_EMAIL');
    expect(mockPostClient).not.toHaveBeenCalled();

    userAccountsStore = [];
    seedCaller();
    clientKycStore = [{ 'Dealer PAN': 'gufps3547k' }];
    const panRes = createMockResponse();
    await usersController.createDealer(requestAs(UserRole.KAM, dealerBody()), panRes);
    expect(panRes.statusCode).toBe(409);
    expect((panRes.body as { error_type: string }).error_type).toBe('DUPLICATE_PAN');
    expect(mockPostClient).not.toHaveBeenCalled();
    expect(mockPostClientKyc).not.toHaveBeenCalled();
    expect(mockPostUserAccount).not.toHaveBeenCalled();
  });

  it.each<[string, unknown, string]>([
    ['clientName', 'A', 'clientName'],
    ['password', 'short', 'password'],
    ['password', 'abcdefgh', 'password'],
    ['email', 'not-an-email', 'email'],
    ['enabledModules', ['M9'], 'enabledModules'],
    ['products', 'LP999', 'products'],
    ['commissionRate', 101, 'commissionRate'],
  ])('rejects %s and writes nothing', async (field, value, errorField) => {
    const res = createMockResponse();
    await usersController.createDealer(requestAs(UserRole.KAM, dealerBody({ [field]: value })), res);
    expect(res.statusCode).toBe(400);
    const errors = (res.body as { errors: Array<{ field: string }> }).errors;
    expect(errors.some((item) => item.field === errorField)).toBe(true);
    expect(mockPostClient).not.toHaveBeenCalled();
  });

  it.each<[string, string]>([
    ['dealerContact', '1234567890'],
    ['dealerPan', 'BADPAN'],
    ['address', ''],
    ['city', ''],
    ['state', 'Not A State'],
    ['pincode', '000000'],
    ['bankName', ''],
    ['accountNumber', '1234'],
    ['ifsc', 'BAD'],
    ['kycVerifiedDate', '2099-01-01'],
    ['nameInBank', 'A'],
  ])('rejects kyc.%s and writes nothing', async (field, value) => {
    const res = createMockResponse();
    await usersController.createDealer(
      requestAs(UserRole.KAM, dealerBody({ kyc: { [field]: value } })),
      res
    );
    expect(res.statusCode).toBe(400);
    const errors = (res.body as { errors: Array<{ field: string }> }).errors;
    expect(errors.some((item) => item.field === field)).toBe(true);
    expect(mockPostClient).not.toHaveBeenCalled();
  });

  it('rejects a GSTIN whose PAN part differs', async () => {
    const res = createMockResponse();
    await usersController.createDealer(
      requestAs(UserRole.KAM, dealerBody({ kyc: { gstNumber: '34AAAAA0000A1Z5' } })),
      res
    );
    expect(res.statusCode).toBe(400);
    const errors = (res.body as { errors: Array<{ field: string }> }).errors;
    expect(errors.some((item) => item.field === 'gstNumber')).toBe(true);
    expect(mockPostClient).not.toHaveBeenCalled();
  });

  it('retries step B against the same Clients row', async () => {
    mockPostClientKyc.mockResolvedValueOnce({ error: 'airtable down' });
    const first = createMockResponse();
    await usersController.createDealer(requestAs(UserRole.KAM, dealerBody()), first);
    expect(first.statusCode).toBe(502);
    const failure = first.body as { step: string; resume: { clientId: string; clientRecordId: string } };
    expect(failure.step).toBe('B');
    expect(failure.resume.clientRecordId).toBe('recCLIENT1');
    expect(mockPostUserAccount).not.toHaveBeenCalled();

    const second = createMockResponse();
    await usersController.createDealer(
      requestAs(UserRole.KAM, dealerBody({ resume: failure.resume })),
      second
    );
    expect(second.statusCode).toBe(201);
    expect(clientsStore).toHaveLength(1);
    expect(clientsStore[0].id).toBe('recCLIENT1');
    expect(clientKycStore).toHaveLength(1);
    expect(mockPostUserAccount).toHaveBeenCalledTimes(1);
    const retryCreate = mockPostClient.mock.calls[1][0] as { id?: string };
    expect(retryCreate.id).toBe('recCLIENT1');
  });

  it('assigns the session Kam_ID and leaves admin blank', async () => {
    const kamRes = createMockResponse();
    await usersController.createDealer(requestAs(UserRole.KAM, dealerBody()), kamRes);
    expect((mockPostClient.mock.calls[0][0] as { 'Assigned KAM': string })['Assigned KAM']).toBe('USER-SESSION-KAM');

    clientsStore = [];
    clientKycStore = [];
    userAccountsStore = userAccountsStore.filter((row) => row.Username !== 'dealer@example.com');
    mockPostClient.mockClear();
    const adminRes = createMockResponse();
    await usersController.createDealer(
      requestAs(UserRole.ADMIN, dealerBody({ email: 'admin-dealer@example.com' })),
      adminRes
    );
    expect(adminRes.statusCode).toBe(201);
    expect((mockPostClient.mock.calls[0][0] as { 'Assigned KAM': string })['Assigned KAM']).toBe('');
  });

  it('refuses a client caller', async () => {
    const res = createMockResponse();
    await usersController.createDealer(requestAs(UserRole.CLIENT, dealerBody()), res);
    expect(res.statusCode).toBe(403);
    expect(mockPostClient).not.toHaveBeenCalled();
    expect(mockPostClientKyc).not.toHaveBeenCalled();
    expect(mockPostUserAccount).not.toHaveBeenCalled();
  });

  it('numbers the next KYC record from the published rows', async () => {
    clientKycStore = [
      { 'Client KYC Record': 'KYC46', 'Dealer ID': 'DLR10' },
      { 'Client KYC Record': 'KYC12', 'Dealer ID': 'DLR4' },
    ];
    const res = createMockResponse();
    await usersController.createDealer(requestAs(UserRole.KAM, dealerBody()), res);
    const kyc = mockPostClientKyc.mock.calls[0][0] as Record<string, string>;
    expect(kyc['Client KYC Record']).toBe('KYC47');
    expect(kyc['Dealer ID']).toBe('DLR11');

    clientKycStore = [];
    mockPostClientKyc.mockClear();
    clientsStore = [];
    const empty = createMockResponse();
    await usersController.createDealer(
      requestAs(UserRole.KAM, dealerBody({ email: 'second@example.com' })),
      empty
    );
    const first = mockPostClientKyc.mock.calls[0][0] as Record<string, string>;
    expect(first['Client KYC Record']).toBe('KYC1');
    expect(first['Dealer ID']).toBe('DLR1');
  });

  it('does not keep a shared default password in source', () => {
    const short = ['pass', '@', '123'].join('');
    const forbidden = [short, `${short}4`];
    const roots = [
      path.resolve(process.cwd(), 'src'),
      path.resolve(process.cwd(), '../src'),
    ];
    const hits: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'dist') continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
        const text = fs.readFileSync(full, 'utf8');
        if (forbidden.some((needle) => text.includes(needle))) hits.push(full);
      }
    };
    roots.forEach(walk);
    expect(hits).toEqual([]);
  });
});
