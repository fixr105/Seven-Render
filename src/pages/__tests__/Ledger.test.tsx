/**
 * Frontend Tests for Ledger Page (P0)
 * Tests ledger entries rendering, running balance, and payout request functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ledger } from '../Ledger';
import { renderWithProviders, mockClientUser } from '../../test/helpers';

// Mock API service
vi.mock('../../services/api', () => {
  const mockApiService = {
    getClientLedger: vi.fn(),
    createPayoutRequest: vi.fn(),
    getClientPayoutRequests: vi.fn(),
  };
  return {
    apiService: mockApiService,
  };
});

// Mock useLedger hook
vi.mock('../../hooks/useLedger', () => ({
  useLedger: vi.fn(),
}));

// Mock useNotifications hook
vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: 0,
  }),
}));

// Mock useNavigation hook
vi.mock('../../hooks/useNavigation', () => ({
  useNavigation: () => ({
    activeItem: null,
    handleNavigation: vi.fn(),
  }),
}));

import { useLedger } from '../../hooks/useLedger';

describe('Ledger Page - P0 Tests', () => {
  const mockLedgerEntries = [
    {
      id: 'entry1',
      Date: '2024-01-15',
      'Payout Amount': '10000',
      payoutAmount: 10000,
      Description: 'Commission from Application SF001',
      'Loan File': 'SF001',
      runningBalance: 10000,
      formattedAmount: '₹10,000',
      formattedBalance: '₹10,000',
    },
    {
      id: 'entry2',
      Date: '2024-01-20',
      'Payout Amount': '12500',
      payoutAmount: 12500,
      Description: 'Commission from Application SF002',
      'Loan File': 'SF002',
      runningBalance: 22500,
      formattedAmount: '₹12,500',
      formattedBalance: '₹22,500',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('M1-FE-001: Ledger Entries Rendering', () => {
    it('should render ledger entries from backend', async () => {
      (useLedger as any).mockReturnValue({
        entries: mockLedgerEntries,
        balance: 22500,
        loading: false,
        requestPayout: vi.fn(),
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/SF001/i)).toBeInTheDocument();
        expect(screen.getByText(/SF002/i)).toBeInTheDocument();
      });

      // Check that amounts are displayed
      expect(screen.getByText(/₹10,000/i)).toBeInTheDocument();
      expect(screen.getByText(/₹12,500/i)).toBeInTheDocument();
    });

    it('should display running balance correctly', async () => {
      (useLedger as any).mockReturnValue({
        entries: mockLedgerEntries,
        balance: 22500,
        loading: false,
        requestPayout: vi.fn(),
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        // Check for current balance display
        const balanceText = screen.getByText(/₹22,500|22500|balance/i);
        expect(balanceText).toBeInTheDocument();
      });

      // Check running balances in entries
      await waitFor(() => {
        expect(screen.getByText(/₹22,500/i)).toBeInTheDocument();
        expect(screen.getByText(/₹10,000/i)).toBeInTheDocument();
      });
    });

    it('should format currency amounts correctly', async () => {
      (useLedger as any).mockReturnValue({
        entries: mockLedgerEntries,
        balance: 22500,
        loading: false,
        requestPayout: vi.fn(),
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        // Check Indian currency format (₹ symbol, comma separators)
        const formattedAmounts = screen.getAllByText(/₹[\d,]+/i);
        expect(formattedAmounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('M1-FE-002: Payout Request Functionality', () => {
    it('should show "Request Payout" button when balance is positive', async () => {
      (useLedger as any).mockReturnValue({
        entries: mockLedgerEntries,
        balance: 22500,
        loading: false,
        requestPayout: vi.fn().mockResolvedValue({ success: true }),
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        const payoutButton = screen.getByRole('button', { name: /request payout|payout request/i });
        expect(payoutButton).toBeInTheDocument();
      });
    });

    it('should not show "Request Payout" button when balance is zero', async () => {
      (useLedger as any).mockReturnValue({
        entries: [],
        balance: 0,
        loading: false,
        requestPayout: vi.fn(),
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        const payoutButton = screen.queryByRole('button', { name: /request payout|payout request/i });
        // Button might not be shown or might be disabled
        if (payoutButton) {
          expect(payoutButton).toBeDisabled();
        }
      });
    });

    it('should open payout modal when "Request Payout" is clicked', async () => {
      const user = userEvent.setup();
      const mockRequestPayout = vi.fn().mockResolvedValue({ success: true });
      
      (useLedger as any).mockReturnValue({
        entries: mockLedgerEntries,
        balance: 22500,
        loading: false,
        requestPayout: mockRequestPayout,
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        const payoutButton = screen.getByRole('button', { name: /request payout|payout request/i });
        expect(payoutButton).toBeInTheDocument();
      });

      const payoutButton = screen.getByRole('button', { name: /request payout|payout request/i });
      await user.click(payoutButton);

      // Should open modal or show payout form
      await waitFor(() => {
        const modal = screen.queryByRole('dialog') || screen.queryByText(/payout|amount/i);
        expect(modal).toBeInTheDocument();
      });
    });

    it('should call requestPayout when payout is submitted', async () => {
      const user = userEvent.setup();
      const mockRequestPayout = vi.fn().mockResolvedValue({ success: true });
      
      (useLedger as any).mockReturnValue({
        entries: mockLedgerEntries,
        balance: 22500,
        loading: false,
        requestPayout: mockRequestPayout,
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        const payoutButton = screen.getByRole('button', { name: /request payout|payout request/i });
        expect(payoutButton).toBeInTheDocument();
      });

      const payoutButton = screen.getByRole('button', { name: /request payout|payout request/i });
      await user.click(payoutButton);

      // Wait for modal to open
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit|confirm|request/i });
        expect(submitButton).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit|confirm|request/i });
      await user.click(submitButton);

      // Should call requestPayout
      await waitFor(() => {
        expect(mockRequestPayout).toHaveBeenCalled();
      });
    });
  });

  describe('M1-FE-003: Empty and Loading States', () => {
    it('should show empty state when no ledger entries exist', async () => {
      (useLedger as any).mockReturnValue({
        entries: [],
        balance: 0,
        loading: false,
        requestPayout: vi.fn(),
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        const emptyMessage = screen.queryByText(/no entries|empty|no transactions/i);
        expect(emptyMessage || screen.queryByText(/balance.*0|₹0/i)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching ledger', () => {
      (useLedger as any).mockReturnValue({
        entries: [],
        balance: 0,
        loading: true,
        requestPayout: vi.fn(),
        raiseQuery: vi.fn(),
        flagPayout: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<Ledger />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      // Should show loading indicator
      expect(screen.getByText(/loading|fetching/i)).toBeInTheDocument();
    });
  });
});

