/**
 * KAM application mutation tests — RBAC and state machine on edit, query, status.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { KAMController } from '../kam.controller.js';
import { UserRole, LoanStatus } from '../../config/constants.js';

const managedClientId = 'CLIENT001';
const otherClientId = 'CLIENT999';
const kamUserRecordId = 'recKAM001';

let loanAppsStore: Record<string, unknown>[] = [];

const mockFetchTable = jest.fn(async (tableName: string) => {
  if (tableName === 'Loan Application') return [...loanAppsStore];
  if (tableName === 'File Auditing Log') return [];
  return [];
});

const mockPostLoanApplication = jest.fn(async (data: Record<string, unknown>) => {
  const id = String(data.id || '');
  const idx = loanAppsStore.findIndex((a) => a.id === id);
  if (idx >= 0) loanAppsStore[idx] = { ...loanAppsStore[idx], ...data };
  return { success: true };
});

const mockPostFileAuditLog = jest.fn(async () => ({ success: true }));
const mockPostAdminActivityLog = jest.fn(async () => ({ success: true }));

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: (tableName: string) => mockFetchTable(tableName),
    postLoanApplication: (data: Record<string, unknown>) => mockPostLoanApplication(data),
    postFileAuditLog: () => mockPostFileAuditLog(),
    postAdminActivityLog: () => mockPostAdminActivityLog(),
  },
}));

jest.mock('../../utils/adminLogger.js', () => ({
  logAdminActivity: jest.fn(async () => {}),
  AdminActionType: { UPDATE_APPLICATION: 'update_application' },
}));

jest.mock('../../services/rbac/rbacFilter.service.js', () => ({
  rbacFilterService: {
    filterLoanApplications: jest.fn(async (apps: unknown[], user: { kamId?: string }) => {
      if (user.kamId !== kamUserRecordId) return [];
      return (apps as Record<string, unknown>[]).filter(
        (a) => String(a.Client) === managedClientId
      );
    }),
  },
}));

jest.mock('../../services/queries/query.service.js', () => ({
  queryService: {
    createQuery: jest.fn(async () => 'QUERY-1'),
  },
}));

jest.mock('../../services/statusTracking/statusHistory.service.js', () => ({
  recordStatusChange: jest.fn(async () => {}),
}));

jest.mock('../../services/formConfig/formDataToChecklistTransformer.js', () => ({
  transformFormDataToChecklistFormat: jest.fn(async (_pid: string, data: unknown) => data),
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

function kamRequest(
  params: Record<string, string>,
  body: Record<string, unknown> = {}
): Request {
  return {
    user: {
      id: 'kam-user-1',
      email: 'kam@test.local',
      role: UserRole.KAM,
      kamId: kamUserRecordId,
    },
    params,
    body,
    query: {},
  } as Request;
}

describe('KAMController application mutations', () => {
  let controller: KAMController;

  beforeEach(() => {
    controller = new KAMController();
    loanAppsStore = [
      {
        id: 'rec-managed',
        'File ID': 'SF001',
        Client: managedClientId,
        Status: LoanStatus.UNDER_KAM_REVIEW,
        'Form Data': '{}',
      },
      {
        id: 'rec-other',
        'File ID': 'SF002',
        Client: otherClientId,
        Status: LoanStatus.UNDER_KAM_REVIEW,
      },
    ];
    jest.clearAllMocks();
  });

  it('editApplication denies access for unmanaged client application', async () => {
    const res = createMockResponse();
    await controller.editApplication(
      kamRequest({ id: 'rec-other' }, { formData: { foo: 'bar' } }),
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('editApplication updates managed application in KAM review', async () => {
    const res = createMockResponse();
    await controller.editApplication(
      kamRequest({ id: 'rec-managed' }, { formData: { foo: 'bar' }, notes: 'fix typo' }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(mockPostLoanApplication).toHaveBeenCalled();
  });

  it('updateStatus rejects invalid KAM transition to approved', async () => {
    const res = createMockResponse();
    await controller.updateStatus(
      kamRequest({ id: 'rec-managed' }, { status: LoanStatus.APPROVED }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(mockPostLoanApplication).not.toHaveBeenCalled();
  });

  it('updateStatus allows query_with_client from under_kam_review', async () => {
    const res = createMockResponse();
    await controller.updateStatus(
      kamRequest({ id: 'rec-managed' }, { status: LoanStatus.QUERY_WITH_CLIENT }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(mockPostLoanApplication).toHaveBeenCalled();
  });

  it('raiseQuery sets status to query_with_client for managed app', async () => {
    const res = createMockResponse();
    await controller.raiseQuery(
      kamRequest(
        { id: 'rec-managed' },
        { message: 'Need PAN', fieldsRequested: ['PAN'], documentsRequested: ['Bank statement'] }
      ),
      res
    );
    expect(res.statusCode).toBe(200);
    const updated = loanAppsStore.find((a) => a.id === 'rec-managed');
    expect(updated?.Status).toBe(LoanStatus.QUERY_WITH_CLIENT);
  });
});
