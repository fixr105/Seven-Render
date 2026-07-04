import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyApplicationStatusChange,
  statusRequiresDisbursementFields,
} from '../applicationStatusMutations';
import { apiService } from '../../services/api';

vi.mock('../../services/api', () => ({
  apiService: {
    markInNegotiation: vi.fn(),
    markDisbursed: vi.fn(),
    markDisbursedNBFC: vi.fn(),
    closeApplication: vi.fn(),
    updateCreditApplicationStatus: vi.fn(),
    updateKAMApplicationStatus: vi.fn(),
  },
}));

describe('statusRequiresDisbursementFields', () => {
  it('returns true for disbursed status', () => {
    expect(statusRequiresDisbursementFields('disbursed')).toBe(true);
    expect(statusRequiresDisbursementFields('Disbursed')).toBe(true);
  });

  it('returns false for other statuses', () => {
    expect(statusRequiresDisbursementFields('approved')).toBe(false);
  });
});

describe('applyApplicationStatusChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.markInNegotiation).mockResolvedValue({ success: true });
    vi.mocked(apiService.markDisbursed).mockResolvedValue({ success: true });
    vi.mocked(apiService.markDisbursedNBFC).mockResolvedValue({ success: true });
    vi.mocked(apiService.closeApplication).mockResolvedValue({ success: true });
    vi.mocked(apiService.updateCreditApplicationStatus).mockResolvedValue({ success: true });
    vi.mocked(apiService.updateKAMApplicationStatus).mockResolvedValue({ success: true });
  });

  it('routes credit in_negotiation to markInNegotiation', async () => {
    await applyApplicationStatusChange({
      applicationId: 'app-1',
      userRole: 'credit_team',
      newStatus: 'in_negotiation',
    });
    expect(apiService.markInNegotiation).toHaveBeenCalledWith('app-1');
  });

  it('routes credit disbursed to markDisbursed with amount', async () => {
    await applyApplicationStatusChange({
      applicationId: 'app-1',
      userRole: 'credit_team',
      newStatus: 'disbursed',
      disbursedAmount: '500000',
      disbursedDate: '2026-01-15',
    });
    expect(apiService.markDisbursed).toHaveBeenCalledWith('app-1', {
      disbursedAmount: '500000',
      disbursedDate: '2026-01-15',
    });
  });

  it('routes admin closed to closeApplication', async () => {
    await applyApplicationStatusChange({
      applicationId: 'app-1',
      userRole: 'admin',
      newStatus: 'closed',
      notes: 'Archive',
    });
    expect(apiService.closeApplication).toHaveBeenCalledWith('app-1', 'Archive');
  });

  it('routes credit generic status to updateCreditApplicationStatus', async () => {
    await applyApplicationStatusChange({
      applicationId: 'app-1',
      userRole: 'credit_team',
      newStatus: 'approved',
      notes: 'OK',
    });
    expect(apiService.updateCreditApplicationStatus).toHaveBeenCalledWith('app-1', 'approved', 'OK');
  });

  it('routes kam to updateKAMApplicationStatus', async () => {
    await applyApplicationStatusChange({
      applicationId: 'app-1',
      userRole: 'kam',
      newStatus: 'query_with_client',
    });
    expect(apiService.updateKAMApplicationStatus).toHaveBeenCalledWith(
      'app-1',
      'query_with_client',
      undefined
    );
  });

  it('routes nbfc disbursed to markDisbursedNBFC', async () => {
    await applyApplicationStatusChange({
      applicationId: 'app-1',
      userRole: 'nbfc',
      newStatus: 'disbursed',
      disbursedAmount: '100000',
    });
    expect(apiService.markDisbursedNBFC).toHaveBeenCalledWith('app-1', {
      disbursedAmount: '100000',
      disbursedDate: expect.any(String),
    });
  });

  it('returns error when disbursed without amount', async () => {
    const result = await applyApplicationStatusChange({
      applicationId: 'app-1',
      userRole: 'credit_team',
      newStatus: 'disbursed',
    });
    expect(result.success).toBe(false);
    expect(result.requiresDisbursementFields).toBe(true);
    expect(apiService.markDisbursed).not.toHaveBeenCalled();
  });
});
