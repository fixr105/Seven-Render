import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { n8nClient } from '../../airtable/n8nClient.js';
import {
  extractLoanProductMatchCandidates,
  getApplicationProductStatuses,
  isStatusConfiguredForApplication,
} from '../dynamicStatus.service.js';
import { parseApplicableStatusesForApi } from '../../products/loanProductStatuses.service.js';

jest.mock('../../airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
  },
}));

const mockFetchTable = n8nClient.fetchTable as jest.MockedFunction<typeof n8nClient.fetchTable>;

describe('getApplicationProductStatuses', () => {
  const applicableJson = JSON.stringify([
    { key: 'under_kam_review', label: 'Submitted', order: 10 },
    { key: 'pending_credit_review', label: 'Ready for Credit', order: 20 },
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches parseApplicableStatusesForApi on the same Loan Products row', async () => {
    mockFetchTable.mockResolvedValue([
      {
        id: 'recLP',
        'Product ID': 'LP010',
        'Product Name': 'Working Capital',
        'Applicable Statuses': applicableJson,
      },
    ]);

    const application = { 'Product ID': 'LP010', Status: 'draft' };
    const fromService = await getApplicationProductStatuses(application);
    const fromParser = parseApplicableStatusesForApi(applicableJson);
    expect(fromService).toEqual(fromParser);
  });

  it('resolves product by Product Name and returns same parse as raw field', async () => {
    mockFetchTable.mockResolvedValue([
      {
        id: 'recLP',
        'Product ID': 'LP010',
        'Product Name': 'Working Capital',
        'Applicable Statuses': applicableJson,
      },
    ]);

    const application = { 'Product Name': 'Working Capital' };
    const fromService = await getApplicationProductStatuses(application);
    expect(fromService).toEqual(parseApplicableStatusesForApi(applicableJson));
  });

  it('resolves product when Loan Product is an Airtable linked record array of objects', async () => {
    mockFetchTable.mockResolvedValue([
      {
        id: 'recLP',
        'Product ID': 'LP010',
        'Product Name': 'Working Capital',
        'Applicable Statuses': applicableJson,
      },
    ]);

    const application = { 'Loan Product': [{ id: 'recLP' }] };
    const fromService = await getApplicationProductStatuses(application);
    expect(fromService).toEqual(parseApplicableStatusesForApi(applicableJson));
    expect(mockFetchTable).toHaveBeenCalledWith('Loan Products', false);
  });

  it('extractLoanProductMatchCandidates never emits object stringification garbage', () => {
    const application = {
      'Loan Product': [{ id: 'recXYZ123', 'Product ID': 'P99' }] as unknown[],
    };
    const cands = extractLoanProductMatchCandidates(application as Record<string, unknown>);
    expect(cands.some((t) => t.includes('object'))).toBe(false);
    expect(cands).toContain('recxyz123');
    expect(cands).toContain('p99');
  });
});

describe('isStatusConfiguredForApplication', () => {
  const loanProductRow = {
    id: 'recLP',
    'Product ID': 'LP010',
    'Product Name': 'Working Capital',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows canonical status when Applicable Statuses is unset and product matches', async () => {
    mockFetchTable.mockResolvedValue([
      {
        ...loanProductRow,
        'Applicable Statuses': '',
      },
    ]);

    const app = { 'Loan Product': 'LP010' };
    await expect(isStatusConfiguredForApplication(app, 'in_negotiation')).resolves.toBe(true);
    await expect(isStatusConfiguredForApplication(app, 'bogus_status')).resolves.toBe(false);
  });

  it('allows canonical status when Applicable Statuses is JSON empty array', async () => {
    mockFetchTable.mockResolvedValue([
      {
        ...loanProductRow,
        'Applicable Statuses': '[]',
      },
    ]);

    await expect(isStatusConfiguredForApplication({ 'Loan Product': 'LP010' }, 'approved')).resolves.toBe(true);
  });

  it('matches configured status by catalogue label normalization (Qualified → in_negotiation)', async () => {
    const applicableJson = JSON.stringify([
      { key: 'in_negotiation', label: 'Qualified', order: 10 },
      { key: 'pending_credit_review', label: 'Under Finance Review', order: 20 },
    ]);
    mockFetchTable.mockResolvedValue([
      {
        ...loanProductRow,
        'Applicable Statuses': applicableJson,
      },
    ]);

    const app = { 'Loan Product': 'LP010' };
    await expect(isStatusConfiguredForApplication(app, 'in_negotiation')).resolves.toBe(true);
    await expect(isStatusConfiguredForApplication(app, 'Qualified')).resolves.toBe(true);
  });
});
