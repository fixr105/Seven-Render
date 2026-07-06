import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApplicationQueryCounts } from '../useApplicationQueryCounts';
import { apiService } from '../../services/api';
import type { LoanApplication } from '../useApplications';

vi.mock('../../services/api', () => ({
  apiService: {
    getQueries: vi.fn(),
  },
}));

const makeApp = (id: string): LoanApplication => ({
  id,
  file_number: `SF${id}`,
  client_id: 'c1',
  applicant_name: 'Test',
  loan_product_id: null,
  requested_loan_amount: null,
  status: 'draft',
  assigned_credit_analyst: null,
  assigned_nbfc_id: null,
  lender_decision_status: null,
  lender_decision_date: null,
  lender_decision_remarks: null,
  approved_loan_amount: null,
  ai_file_summary: null,
  form_data: {},
  created_at: '2026-01-01',
  submitted_at: null,
  updated_at: '2026-01-01',
});

describe('useApplicationQueryCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when disabled', async () => {
    const { result } = renderHook(() =>
      useApplicationQueryCounts([makeApp('a1')], { enabled: false })
    );
    await waitFor(() => expect(result.current.loadingQueryCounts).toBe(false));
    expect(apiService.getQueries).not.toHaveBeenCalled();
    expect(result.current.queryCounts).toEqual({});
  });

  it('fetches counts for all applications when enabled', async () => {
    (apiService.getQueries as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [{ isResolved: false, rootQuery: { timestamp: '2026-07-01' }, replies: [] }],
    });

    const apps = [makeApp('a1'), makeApp('a2'), makeApp('a3')];
    const { result } = renderHook(() =>
      useApplicationQueryCounts(apps, { enabled: true })
    );

    await waitFor(() => expect(result.current.loadingQueryCounts).toBe(false));
    expect(apiService.getQueries).toHaveBeenCalledTimes(3);
    expect(result.current.queryCounts.a1?.unresolved).toBe(1);
  });

  it('handles API errors gracefully', async () => {
    (apiService.getQueries as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() =>
      useApplicationQueryCounts([makeApp('a1')], { enabled: true })
    );

    await waitFor(() => expect(result.current.loadingQueryCounts).toBe(false));
    expect(result.current.queryCounts.a1).toEqual({ unresolved: 0, lastActivity: null });
  });
});
