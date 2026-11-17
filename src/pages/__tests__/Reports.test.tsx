/**
 * KAM reports page: scoped controls, commission tab, and empty states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Reports } from '../Reports';
import { renderWithProviders, mockClientUser, mockKAMUser } from '../../test/helpers';

vi.mock('../../services/api', () => ({
  apiService: {
    listDailySummaries: vi.fn(),
    getLatestDailySummary: vi.fn(),
    listClients: vi.fn(),
    getCommissionReport: vi.fn(),
    getLedgerReport: vi.fn(),
    generateDailySummary: vi.fn(),
  },
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }),
}));

vi.mock('../../auth/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/AuthContext')>();
  return { ...actual, useAuth: vi.fn() };
});

import { useAuth } from '../../auth/AuthContext';
import { apiService } from '../../services/api';

const mockedAuth = vi.mocked(useAuth);
const api = vi.mocked(apiService);

function monthStart(): string {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const year = from.getFullYear();
  const month = String(from.getMonth() + 1).padStart(2, '0');
  const day = String(from.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('Reports page for a KAM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listDailySummaries.mockResolvedValue({ success: true, data: [] });
    api.getLatestDailySummary.mockResolvedValue({ success: false, error: 'No report found' });
    api.listClients.mockResolvedValue({
      success: true,
      data: [{ clientId: 'recMine', clientName: 'Mine Motors' }],
    });
    api.getCommissionReport.mockResolvedValue({
      success: true,
      data: {
        months: [{ month: '2026-11', totalPayoutAmount: 100, totalPayinAmount: 25, net: 75, transactionCount: 2 }],
      },
    });
    api.getLedgerReport.mockResolvedValue({ success: true, data: { entries: [] } });
  });

  it('hides report actions from a client', async () => {
    mockedAuth.mockReturnValue({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
    });
    renderWithProviders(<Reports />);
    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate my report/i })).not.toBeInTheDocument();
  });

  it('shows Generate My Report, a client dropdown, and the current month', async () => {
    mockedAuth.mockReturnValue({
      user: mockKAMUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
    });
    renderWithProviders(<Reports />);

    expect(await screen.findByRole('button', { name: /generate my report/i })).toBeInTheDocument();
    expect(screen.getByText(/automated daily/i).className).toContain('text-sf-quiet');
    expect(screen.getAllByText(/no reports yet/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /^ledger$/i }));
    expect(screen.getByLabelText(/^from$/i)).toHaveValue(monthStart());
    expect(screen.getByLabelText(/^client$/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mine Motors' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/filter by client/i)).not.toBeInTheDocument();
  });

  it('renders the monthly commission report', async () => {
    mockedAuth.mockReturnValue({
      user: mockKAMUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
    });
    renderWithProviders(<Reports />);
    await screen.findByRole('button', { name: /generate my report/i });
    await userEvent.click(screen.getByRole('button', { name: /^commission$/i }));
    await userEvent.click(screen.getByRole('button', { name: /run report/i }));
    expect(await screen.findByText('2026-11')).toBeInTheDocument();
    expect(api.getCommissionReport).toHaveBeenCalled();
  });

  it('says there is no data when the ledger range is empty', async () => {
    mockedAuth.mockReturnValue({
      user: mockKAMUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
    });
    renderWithProviders(<Reports />);
    await screen.findByRole('button', { name: /generate my report/i });
    await userEvent.click(screen.getByRole('button', { name: /^ledger$/i }));
    await userEvent.click(screen.getByRole('button', { name: /run report/i }));
    expect(await screen.findByText(/no data for this period/i)).toBeInTheDocument();
  });

  it('tells a KAM with no clients to contact their manager and skips report calls', async () => {
    api.listClients.mockResolvedValue({ success: true, data: [] });
    mockedAuth.mockReturnValue({
      user: mockKAMUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
    });
    renderWithProviders(<Reports />);
    expect(await screen.findByText(/no clients assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/contact your manager/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(api.listDailySummaries).not.toHaveBeenCalled();
    });
  });
});
