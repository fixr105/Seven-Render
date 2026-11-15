/**
 * POST /api/users/create-dealer
 * KAM or admin creates a client login with the server-side default password.
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

const mockFetchTable = jest.fn(async (tableName: string) => {
  if (tableName === 'User Accounts') return [...userAccountsStore];
  return [];
});

const mockPostUserAccount = jest.fn(async (data: Record<string, unknown>) => {
  const id = String(data.id || '');
  userAccountsStore.push({ ...data, id });
  return { success: true, id };
});

const mockPostAdminActivityLog = jest.fn(async () => ({ success: true }));

const mockGetUserAccounts = jest.fn(async () => [...userAccountsStore]);

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: (tableName: string) => mockFetchTable(tableName),
    postUserAccount: (data: Record<string, unknown>) => mockPostUserAccount(data),
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

describe('POST /users/create-dealer', () => {
  let usersController: UsersController;

  beforeEach(() => {
    usersController = new UsersController();
    userAccountsStore = [];
    AuthService.clearUserAccountsCache();
    jest.clearAllMocks();
  });

  it('creates a client account with a bcrypt hash of pass@123 and omits secrets', async () => {
    const req = requestAs(UserRole.KAM, {
      email: '  NewDealer@Example.com ',
      name: '  dealer name ',
    });
    const res = createMockResponse();

    await usersController.createDealer(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      email: 'newdealer@example.com',
      name: 'DEALER NAME',
      role: 'client',
    });

    const keys = collectKeys(res.body);
    expect(keys).not.toContain('password');
    expect(keys).not.toContain('hash');
    expect(keys).not.toContain('pin');

    expect(mockPostUserAccount).toHaveBeenCalledTimes(1);
    const payload = mockPostUserAccount.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.Username).toBe('newdealer@example.com');
    expect(payload.Role).toBe('client');
    expect(payload['Account Status']).toBe('Active');
    expect(payload['Associated Profile']).toBe('DEALER NAME');
    expect(payload.Password).not.toBe('pass@123');
    expect(await bcrypt.compare('pass@123', String(payload.Password))).toBe(true);

    const loggedIn = await authService.validateCredentials('newdealer@example.com', 'pass@123');
    expect(loggedIn).not.toBeNull();
    expect(loggedIn?.role).toBe(UserRole.CLIENT);
    expect(loggedIn?.email).toBe('newdealer@example.com');
  });

  it('rejects an existing email without creating a duplicate row', async () => {
    userAccountsStore.push({
      id: 'USER-existing',
      Username: 'Existing@Example.com',
      Password: 'already-hashed',
      Role: 'client',
      'Account Status': 'Active',
    });

    const req = requestAs(UserRole.KAM, {
      email: 'existing@example.com',
      name: 'Someone',
    });
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
});
