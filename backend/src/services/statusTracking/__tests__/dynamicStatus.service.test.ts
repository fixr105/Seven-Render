import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { n8nClient } from '../../airtable/n8nClient.js';
import {
  extractLoanProductMatchCandidates,
  getApplicationProductStatuses,
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
