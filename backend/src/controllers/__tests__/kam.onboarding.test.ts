/**
 * KAM create-new-client onboarding route tests.
 * Covers POST /kam/clients through downstream client entitlement routes.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { KAMController } from '../kam.controller.js';
import { ClientController } from '../client.controller.js';
import { UserRole } from '../../config/constants.js';
import { AuthUser } from '../../types/auth.js';
import { ClientProductEntitlementCode } from '../../services/entitlements/clientProducts.service.js';
import { invalidateRbacRequestCache } from '../../services/rbac/rbacFilter.service.js';

type StoreRecord = Record<string, unknown> & { id: string };

const kamUserRecordId = 'recKAM001';
const kamBusinessId = 'KAM001';

let clientsStore: StoreRecord[] = [];
let userAccountsStore: StoreRecord[] = [];
let kamUsersStore: StoreRecord[] = [];

const mockFetchTable = jest.fn(async (tableName: string) => {
  if (tableName === 'Clients') return [...clientsStore];
  if (tableName === 'User Accounts') return [...userAccountsStore];
  if (tableName === 'KAM Users') return [...kamUsersStore];
  return [];
});

const mockPostClient = jest.fn(async (data: Record<string, unknown>) => {
  const id = String(data.id || data['Client ID'] || '');
  const existingIdx = clientsStore.findIndex(
    (c) => c.id === id || c['Client ID'] === id
  );
  const record = { ...data, id: id || `client-${Date.now()}` } as StoreRecord;
  if (existingIdx >= 0) {
    clientsStore[existingIdx] = { ...clientsStore[existingIdx], ...record };
  } else {
    clientsStore.push(record);
  }
  return { success: true, id: record.id };
});

const mockPostUserAccount = jest.fn(async (data: Record<string, unknown>) => {
  const id = String(data.id || '');
  userAccountsStore.push({ ...data, id } as StoreRecord);
  return { success: true, id };
});

const mockPostAdminActivityLog = jest.fn(async () => ({ success: true }));
const mockGetUserAccounts = jest.fn(async () => [...userAccountsStore]);

jest.mock('../../utils/adminLogger.js', () => ({
  logAdminActivity: jest.fn(async () => {}),
}));

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: (tableName: string) => mockFetchTable(tableName),
    postClient: (data: Record<string, unknown>) => mockPostClient(data),
    postUserAccount: (data: Record<string, unknown>) => mockPostUserAccount(data),
    postAdminActivityLog: () => mockPostAdminActivityLog(),
    getUserAccounts: () => mockGetUserAccounts(),
  },
}));

jest.mock('../../auth/auth.service.js', () => ({
  authService: {
    hashPassword: jest.fn(async () => 'hashed-temp-password'),
  },
}));

jest.mock('../../services/formConfig/productFormConfig.service.js', () => ({
  getFormConfigForProduct: jest.fn(async () => ({ categories: [{ id: 'cat1', fields: [] }] })),
}));

jest.mock('../../services/formConfig/simpleFormConfig.service.js', () => ({
  getSimpleFormConfig: jest.fn(async () => ({ categories: [] })),
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

function kamRequest(body: Record<string, unknown> = {}): Request {
  return {
    user: {
      id: 'kam-user-1',
      email: 'kam@test.local',
      role: UserRole.KAM,
      kamId: kamUserRecordId,
    },
    body,
    params: {},
    query: {},
  } as Request;
}

function clientRequest(
  user: Partial<AuthUser>,
  query: Record<string, string> = {}
): Request {
  return {
    user: {
      id: user.id || 'client-user-id',
      email: user.email || 'newclient@onboard.test',
      role: UserRole.CLIENT,
      clientId: user.clientId,
    },
    query,
    body: {},
    params: {},
  } as Request;
}

describe('KAM onboarding routes', () => {
  let kamController: KAMController;
  let clientController: ClientController;

  beforeEach(() => {
    kamController = new KAMController();
    clientController = new ClientController();
    clientsStore = [];
    userAccountsStore = [];
    kamUsersStore = [
      {
        id: kamUserRecordId,
        'KAM ID': kamBusinessId,
        Email: 'kam@test.local',
        Name: 'Test KAM',
      },
    ];
    jest.clearAllMocks();
    invalidateRbacRequestCache();
  });

  it('POST /kam/clients creates user account and client with linkable fields', async () => {
    const req = kamRequest({
      name: 'Onboard Test Co',
      contactPerson: 'Jane Contact',
      email: 'newclient@onboard.test',
      phone: '9876543210',
      commissionRate: '1.5',
      enabledModules: ['M1', 'M2'],
    });
    const res = createMockResponse();

    await kamController.createClient(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        clientId: expect.any(String),
        userId: expect.any(String),
        tempPassword: 'TempPassword123!',
      }),
    });

    expect(mockPostUserAccount).toHaveBeenCalledTimes(1);
    const userPayload = mockPostUserAccount.mock.calls[0][0] as Record<string, unknown>;
    expect(userPayload.Username).toBe('newclient@onboard.test');
    expect(userPayload['Associated Profile']).toBe('Onboard Test Co');

    expect(mockPostClient).toHaveBeenCalledTimes(1);
    const clientPayload = mockPostClient.mock.calls[0][0] as Record<string, unknown>;
    expect(clientPayload['Client Name']).toBe('Onboard Test Co');
    expect(clientPayload['Contact Email / Phone']).toBe('newclient@onboard.test / 9876543210');
    expect(clientPayload['Assigned KAM']).toBe(kamUserRecordId);
    expect(clientPayload['Assigned Products']).toBeUndefined();
  });

  it('GET /kam/clients lists newly created client for managing KAM', async () => {
    const createReq = kamRequest({
      name: 'Listed Client Co',
      email: 'listed@onboard.test',
      phone: '1111111111',
      commissionRate: '1.0',
    });
    const createRes = createMockResponse();
    await kamController.createClient(createReq, createRes);
    const clientId = (createRes.body as { data: { clientId: string } }).data.clientId;

    const listReq = kamRequest();
    const listRes = createMockResponse();
    await kamController.listClients(listReq, listRes);

    expect(listRes.statusCode).toBe(200);
    const data = (listRes.body as { data: Array<{ id?: string; clientId?: string }> }).data;
    expect(data.some((c) => c.id === clientId || c.clientId === clientId)).toBe(true);
  });

  it('GET /kam/clients/:id returns client details', async () => {
    const createReq = kamRequest({
      name: 'Detail Client Co',
      email: 'detail@onboard.test',
      phone: '2222222222',
      commissionRate: '1.0',
    });
    const createRes = createMockResponse();
    await kamController.createClient(createReq, createRes);
    const clientId = (createRes.body as { data: { clientId: string } }).data.clientId;

    const getReq = kamRequest();
    getReq.params = { id: clientId };
    const getRes = createMockResponse();
    await kamController.getClient(getReq, getRes);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        contactEmailPhone: 'detail@onboard.test / 2222222222',
      }),
    });
  });

  it('PUT /kam/clients/:id/assigned-products assigns products for New Application', async () => {
    const createReq = kamRequest({
      name: 'Product Client Co',
      email: 'products@onboard.test',
      phone: '3333333333',
      commissionRate: '1.0',
    });
    const createRes = createMockResponse();
    await kamController.createClient(createReq, createRes);
    const clientId = (createRes.body as { data: { clientId: string } }).data.clientId;

    const assignReq = kamRequest({ productIds: ['LP012', 'LP001'] });
    assignReq.params = { id: clientId };
    const assignRes = createMockResponse();
    await kamController.assignProductsToClient(assignReq, assignRes);

    expect(assignRes.statusCode).toBe(200);
    const stored = clientsStore.find((c) => c.id === clientId);
    expect(stored?.['Assigned Products']).toBe('LP012, LP001');
  });

  it('newly onboarded client fails client routes until products are assigned', async () => {
    const createReq = kamRequest({
      name: 'No Products Co',
      email: 'noproducts@onboard.test',
      phone: '4444444444',
      commissionRate: '1.0',
    });
    const createRes = createMockResponse();
    await kamController.createClient(createReq, createRes);
    const clientId = (createRes.body as { data: { clientId: string } }).data.clientId;

    const clientUser = {
      id: clientId,
      email: 'noproducts@onboard.test',
      clientId,
    };

    const productsReq = clientRequest(clientUser);
    const productsRes = createMockResponse();
    await clientController.getConfiguredProducts(productsReq, productsRes);
    expect(productsRes.statusCode).toBe(400);

    const formReq = clientRequest(clientUser, { productId: 'LP012' });
    const formRes = createMockResponse();
    await clientController.getFormConfig(formReq, formRes);
    expect(formRes.statusCode).toBe(403);
    expect(formRes.body).toMatchObject({
      code: ClientProductEntitlementCode.NO_PRODUCTS_ASSIGNED,
    });
  });

  it('after product assignment, client linking and entitlement routes succeed', async () => {
    const createReq = kamRequest({
      name: 'Full Flow Co',
      email: 'fullflow@onboard.test',
      phone: '5555555555',
      commissionRate: '1.0',
    });
    const createRes = createMockResponse();
    await kamController.createClient(createReq, createRes);
    const clientId = (createRes.body as { data: { clientId: string } }).data.clientId;

    const assignReq = kamRequest({ productIds: ['LP012'] });
    assignReq.params = { id: clientId };
    await kamController.assignProductsToClient(assignReq, createMockResponse());

    const clientUser = {
      id: clientId,
      email: 'fullflow@onboard.test',
      clientId: undefined as string | undefined,
    };

    const productsReq = clientRequest(clientUser);
    const productsRes = createMockResponse();
    await clientController.getConfiguredProducts(productsReq, productsRes);
    expect(productsRes.statusCode).toBe(200);
    expect((productsRes.body as { data: string[] }).data).toContain('LP012');

    const formReq = clientRequest(clientUser, { productId: 'LP012' });
    const formRes = createMockResponse();
    await clientController.getFormConfig(formReq, formRes);
    expect(formRes.statusCode).toBe(200);
    expect((formRes.body as { success: boolean }).success).toBe(true);
  });

  it('client links via email when JWT clientId is missing after onboarding', async () => {
    const createReq = kamRequest({
      name: 'Email Link Co',
      email: 'emaillink@onboard.test',
      phone: '6666666666',
      commissionRate: '1.0',
    });
    await kamController.createClient(createReq, createMockResponse());

    const assignReq = kamRequest({ productIds: ['LP012'] });
    assignReq.params = { id: String(mockPostClient.mock.calls.at(-1)?.[0]?.id) };
    await kamController.assignProductsToClient(assignReq, createMockResponse());

    const productsReq = clientRequest({ email: 'emaillink@onboard.test' });
    const productsRes = createMockResponse();
    await clientController.getConfiguredProducts(productsReq, productsRes);

    expect(productsRes.statusCode).toBe(200);
    expect((productsRes.body as { data: string[] }).data).toEqual(['LP012']);
  });

  it('PATCH /kam/clients/:id/modules updates enabled modules', async () => {
    const createReq = kamRequest({
      name: 'Modules Co',
      email: 'modules@onboard.test',
      phone: '7777777777',
      commissionRate: '1.0',
      enabledModules: ['M1'],
    });
    const createRes = createMockResponse();
    await kamController.createClient(createReq, createRes);
    const clientId = (createRes.body as { data: { clientId: string } }).data.clientId;

    const patchReq = kamRequest({ enabledModules: ['M1', 'M2', 'M3'] });
    patchReq.params = { id: clientId };
    const patchRes = createMockResponse();
    await kamController.updateClientModules(patchReq, patchRes);

    expect(patchRes.statusCode).toBe(200);
    const stored = clientsStore.find((c) => c.id === clientId);
    expect(stored?.['Enabled Modules']).toBe('M1, M2, M3');
  });
});
