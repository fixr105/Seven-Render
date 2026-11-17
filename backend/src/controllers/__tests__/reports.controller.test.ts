/**
 * Ledger, client-wise, and commission reports are scoped to a KAM's clients.
 * A client id outside that set returns an empty 200, not 403.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { UserRole } from '../../config/constants.js';

const mockFetchTable = jest.fn<(table: string) => Promise<unknown[]>>();
const mockGetKAMManagedClientIds = jest.fn<(kamId: string) => Promise<string[]>>();

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: (table: string) => mockFetchTable(table),
  },
}));

jest.mock('../../services/rbac/rbacFilter.service.js', () => ({
  rbacFilterService: {
    getKAMManagedClientIds: (kamId: string) => mockGetKAMManagedClientIds(kamId),
  },
}));

jest.mock('../../services/reports/dailySummary.service.js', () => ({
  dailySummaryService: {
    generateDailySummary: jest.fn(),
    generateDateRangeSummary: jest.fn(),
    saveDailySummary: jest.fn(),
  },
}));

import { reportsController } from '../reports.controller.js';
import { dailySummaryService } from '../../services/reports/dailySummary.service.js';

const ledgerRows = [
  { Client: 'recMine', Date: '2026-11-02', 'Payout Amount': '100', Description: 'mine payout' },
  { Client: 'recOther', Date: '2026-11-03', 'Payout Amount': '40', Description: 'other payout' },
  { Client: 'recMine', Date: '2026-10-15', 'Payout Amount': '-25', Description: 'mine payin' },
  { Client: 'recMine', Date: '2026-01-01', 'Payout Amount': '999', Description: 'outside range' },
];

function response(): Response & { statusCode: number; body: unknown } {
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

function request(role: UserRole, query: Record<string, string>, kamId?: string): Request {
  return {
    user: {
      id: 'user-1',
      email: role === UserRole.KAM ? 'kam@test.local' : 'credit@test.local',
      role,
      kamId: kamId ?? null,
      name: 'Ada KAM',
    },
    query,
    params: {},
    body: {},
  } as unknown as Request;
}

describe('report ledger scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchTable.mockImplementation(async (table: string) => {
      if (table === 'Commission Ledger') return ledgerRows;
      if (table === 'Clients') {
        return [
          { id: 'recMine', 'Client ID': 'recMine', 'Client Name': 'Mine Motors' },
          { id: 'recOther', 'Client ID': 'recOther', 'Client Name': 'Other Autos' },
        ];
      }
      return [];
    });
    mockGetKAMManagedClientIds.mockResolvedValue(['recMine']);
  });

  it('returns only the KAM clients on /reports/ledger and every row for credit', async () => {
    const kamRes = response();
    await reportsController.getLedgerReport(
      request(UserRole.KAM, { from: '2026-10-01', to: '2026-11-30' }, 'kam-1'),
      kamRes
    );
    const kamBody = kamRes.body as { success: boolean; data: { entries: Array<{ Client: string }> } };
    expect(kamRes.statusCode).toBe(200);
    expect(kamBody.success).toBe(true);
    expect(kamBody.data.entries.map((row) => row.Client)).toEqual(['recMine', 'recMine']);

    const creditRes = response();
    await reportsController.getLedgerReport(
      request(UserRole.CREDIT, { from: '2026-10-01', to: '2026-11-30' }),
      creditRes
    );
    const creditBody = creditRes.body as { data: { entries: unknown[] } };
    expect(creditBody.data.entries).toHaveLength(3);
  });

  it('returns an empty 200 when a KAM asks for a client they do not manage', async () => {
    const res = response();
    await reportsController.getLedgerReport(
      request(UserRole.KAM, { from: '2026-10-01', to: '2026-11-30', clientId: 'recOther' }, 'kam-1'),
      res
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as { success: boolean; data: { entries: unknown[] } };
    expect(body.success).toBe(true);
    expect(body.data.entries).toEqual([]);
  });

  it('returns empty ledger and client-wise data when the KAM has zero clients', async () => {
    mockGetKAMManagedClientIds.mockResolvedValue([]);
    const ledgerRes = response();
    await reportsController.getLedgerReport(
      request(UserRole.KAM, { from: '2026-10-01', to: '2026-11-30' }, 'kam-1'),
      ledgerRes
    );
    expect((ledgerRes.body as { data: { entries: unknown[] } }).data.entries).toEqual([]);

    const clientRes = response();
    await reportsController.getClientWiseReport(
      request(UserRole.KAM, { from: '2026-10-01', to: '2026-11-30' }, 'kam-1'),
      clientRes
    );
    expect((clientRes.body as { data: { clients: unknown[] } }).data.clients).toEqual([]);
  });

  it('groups commission by month for the KAM only', async () => {
    const res = response();
    await reportsController.getCommissionReport(
      request(UserRole.KAM, { from: '2026-10-01', to: '2026-11-30' }, 'kam-1'),
      res
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      data: {
        months: Array<{
          month: string;
          totalPayoutAmount: number;
          totalPayinAmount: number;
          net: number;
          transactionCount: number;
        }>;
      };
    };
    expect(body.data.months).toEqual([
      {
        month: '2026-10',
        totalPayoutAmount: 0,
        totalPayinAmount: 25,
        net: -25,
        transactionCount: 1,
      },
      {
        month: '2026-11',
        totalPayoutAmount: 100,
        totalPayinAmount: 0,
        net: 100,
        transactionCount: 1,
      },
    ]);
  });
});

describe('daily summary visibility', () => {
  const generate = dailySummaryService.generateDailySummary as jest.MockedFunction<
    typeof dailySummaryService.generateDailySummary
  >;
  const save = dailySummaryService.saveDailySummary as jest.MockedFunction<
    typeof dailySummaryService.saveDailySummary
  >;
  const dateRange = dailySummaryService.generateDateRangeSummary as jest.MockedFunction<
    typeof dailySummaryService.generateDateRangeSummary
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetKAMManagedClientIds.mockResolvedValue(['recMine']);
    mockFetchTable.mockImplementation(async (table: string) => {
      if (table === 'Clients') {
        return [{ id: 'recMine', 'Client ID': 'recMine', 'Client Name': 'Mine Motors' }];
      }
      if (table === 'Daily Summary Report') {
        return [
          { id: 'r-all', 'Report Date': '2026-11-01', 'Summary Content': 'company', 'Generated Timestamp': '2026-11-01T00:00:00.000Z', Scope: 'all' },
          { id: 'r-mine', 'Report Date': '2026-11-02', 'Summary Content': '[[scope:kam:kam@test.local]]\nmine', 'Generated Timestamp': '2026-11-02T00:00:00.000Z' },
          { id: 'r-other', 'Report Date': '2026-11-03', 'Summary Content': 'other', 'Generated Timestamp': '2026-11-03T00:00:00.000Z', Scope: 'kam:other@test.local' },
          { id: 'r-legacy', 'Report Date': '2026-10-01', 'Summary Content': 'legacy', 'Generated Timestamp': '2026-10-01T00:00:00.000Z' },
        ];
      }
      return [];
    });
    generate.mockResolvedValue({
      reportDate: '2026-11-17',
      summaryContent: 'body',
      metrics: {} as never,
      generatedTimestamp: '2026-11-17T00:00:00.000Z',
    });
    save.mockResolvedValue('REPORT-1');
    dateRange.mockResolvedValue({
      from: '2026-11-01',
      to: '2026-11-17',
      metrics: {} as never,
      summaryContent: 'range',
    });
  });

  it('saves a KAM report with Scope kam:<email> and only their client ids', async () => {
    const res = response();
    await reportsController.generateDailySummary(
      {
        ...request(UserRole.KAM, {}, 'kam-1'),
        body: { date: '2026-11-17' },
      } as Request,
      res
    );
    expect(res.statusCode).toBe(200);
    expect(generate).toHaveBeenCalledWith(
      '2026-11-17',
      expect.objectContaining({
        clientIds: ['recMine'],
        clientNames: ['Mine Motors'],
        heading: "Report for Ada KAM's portfolio",
      })
    );
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        generatedBy: 'kam@test.local',
        scope: 'kam:kam@test.local',
      })
    );
  });

  it('lists company reports and this KAM only, hiding another KAM', async () => {
    const res = response();
    await reportsController.listDailySummaries(request(UserRole.KAM, { limit: '10' }, 'kam-1'), res);
    const body = res.body as { data: Array<{ id: string }> };
    expect(body.data.map((row) => row.id).sort()).toEqual(['r-all', 'r-legacy', 'r-mine']);
  });

  it('returns 404 when a KAM asks for another KAM daily report by date', async () => {
    const res = response();
    await reportsController.getDailySummary(
      { ...request(UserRole.KAM, {}, 'kam-1'), params: { date: '2026-11-03' } } as unknown as Request,
      res
    );
    expect(res.statusCode).toBe(404);
  });

  it('passes the KAM client ids into the date-range summary', async () => {
    const res = response();
    await reportsController.getDateRangeReport(
      request(UserRole.KAM, { from: '2026-11-01', to: '2026-11-17' }, 'kam-1'),
      res
    );
    expect(dateRange).toHaveBeenCalledWith(
      '2026-11-01',
      '2026-11-17',
      expect.objectContaining({ clientIds: ['recMine'], heading: "Report for Ada KAM's portfolio" })
    );
  });
});
