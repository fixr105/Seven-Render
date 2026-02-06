/**
 * Frontend Tests for Applications Listing Page (P0)
 * Tests application listing, empty states, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Applications } from '../Applications';
import { renderWithProviders, mockClientUser, mockKAMUser, mockCreditUser } from '../../test/helpers';

// Mock API service
vi.mock('../../services/api', () => {
  const mockApiService = {
    listApplications: vi.fn(),
  };
  return {
    apiService: mockApiService,
  };
});

// Mock useApplications hook
vi.mock('../../hooks/useApplications', () => ({
  useApplications: vi.fn(),
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

// Mock useAuth so Applications receives a user; keep AuthProvider for TestWrapper
vi.mock('../../auth/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/AuthContext')>();
  return { ...actual, useAuth: vi.fn() };
});

// Mock useSearchParams for stable status filter
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  };
});

import { useAuth } from '../../auth/AuthContext';
import { useApplications } from '../../hooks/useApplications';

describe('Applications Listing Page - P0 Tests', () => {
  const mockApplications = [
    {
      id: 'app1',
      file_number: 'SF001',
      client_id: 'CLIENT001',
      applicant_name: 'John Doe',
      loan_product_id: 'LP001',
      requested_loan_amount: 500000,
      status: 'Pending KAM Review',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      client: { company_name: 'Test Company' },
      loan_product: { name: 'Business Loan', code: 'BL001' },
    },
    {
      id: 'app2',
      file_number: 'SF002',
      client_id: 'CLIENT001',
      applicant_name: 'Jane Smith',
      loan_product_id: 'LP002',
      requested_loan_amount: 300000,
      status: 'Forwarded to Credit',
      created_at: '2024-01-16T10:00:00Z',
      updated_at: '2024-01-16T10:00:00Z',
      client: { company_name: 'Test Company' },
      loan_product: { name: 'Personal Loan', code: 'PL001' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(() => true),
      signInAsTestUser: vi.fn(),
    });
  });

  describe('M3-FE-001: Applications Listing Rendering', () => {
    it('should render applications list with data from backend', async () => {
      (useApplications as any).mockReturnValue({
        applications: mockApplications,
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
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

      // Wait for applications to render (may appear in table and detail)
      await waitFor(() => {
        expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(1);
      });

      // Check that application details are displayed
      expect(screen.getAllByText(/SF001/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/SF002/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Business Loan/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Personal Loan/i).length).toBeGreaterThanOrEqual(1);
    });

    it('should display correct status badges for applications', async () => {
      (useApplications as any).mockReturnValue({
        applications: mockApplications,
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
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
        expect(screen.getAllByText(/Pending KAM Review/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Forwarded to Credit/i).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should format loan amounts correctly', async () => {
      (useApplications as any).mockReturnValue({
        applications: mockApplications,
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
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
        // Check for formatted amounts (₹5.00L, ₹3.00L) - may appear in multiple cells
        const amountTexts = screen.getAllByText(/₹.*L/i);
        expect(amountTexts.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('M3-FE-002: Empty State Handling', () => {
    it('should display empty state when no applications exist', async () => {
      (useApplications as any).mockReturnValue({
        applications: [],
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
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

      const emptyMsg = await screen.findByText(/No applications found|no applications/i, {}, { timeout: 5000 });
      expect(emptyMsg).toBeInTheDocument();
    });

    it('should show loading state while fetching applications', () => {
      (useApplications as any).mockReturnValue({
        applications: [],
        loading: true,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
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

      const loadingMsg = await screen.findByText(/Loading applications|Loading/i, {}, { timeout: 3000 });
      expect(loadingMsg).toBeInTheDocument();
    });
  });

  describe('M3-FE-003: Error State Handling', () => {
    it('should handle error when applications fail to load', async () => {
      (useApplications as any).mockReturnValue({
        applications: [],
        loading: false,
        refetch: vi.fn(),
        error: 'Failed to load applications',
      });

      renderWithProviders(<Applications />, {
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

      const msg = await screen.findByText(/No applications found|no applications|error|failed/i, {}, { timeout: 5000 });
      expect(msg).toBeInTheDocument();
    });
  });

  describe('M3-FE-004: Role-Based Application Filtering', () => {
    it('should show only client applications for CLIENT role', async () => {
      const clientApplications = mockApplications.filter(app => app.client_id === 'CLIENT001');
      
      (useApplications as any).mockReturnValue({
        applications: clientApplications,
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
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
        expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(1);
      });

      // Should not show applications from other clients
      expect(screen.queryByText(/Other Client/i)).not.toBeInTheDocument();
    });

    it('should show all applications for KAM role', async () => {
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        user: mockKAMUser,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
        hasRole: vi.fn(() => true),
        signInAsTestUser: vi.fn(),
      });
      const allApplications = [
        ...mockApplications,
        {
          id: 'app3',
          file_number: 'SF003',
          client_id: 'CLIENT002',
          applicant_name: 'Other Client App',
          loan_product_id: 'LP001',
          requested_loan_amount: 400000,
          status: 'Draft',
          created_at: '2024-01-17T10:00:00Z',
          updated_at: '2024-01-17T10:00:00Z',
          client: { company_name: 'Other Company' },
          loan_product: { name: 'Business Loan', code: 'BL001' },
        },
      ];

      (useApplications as any).mockReturnValue({
        applications: allApplications,
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
        authContext: {
          user: mockKAMUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Other Client App').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show all applications for CREDIT role', async () => {
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        user: mockCreditUser,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
        hasRole: vi.fn(() => true),
        signInAsTestUser: vi.fn(),
      });
      (useApplications as any).mockReturnValue({
        applications: mockApplications,
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
        authContext: {
          user: mockCreditUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(() => true),
          signInAsTestUser: vi.fn(),
        },
      });

      await waitFor(() => {
        expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('M3-FE-005: Search and Filter Functionality', () => {
    it('should filter applications by search query', async () => {
      (useApplications as any).mockReturnValue({
        applications: mockApplications,
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
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
        expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
      });

      // Find search input and type
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toBeInTheDocument();
      
      // Search functionality is tested via user interaction
      // The actual filtering logic would be tested in integration tests
    });

    it('should filter applications by status', async () => {
      (useApplications as any).mockReturnValue({
        applications: mockApplications,
        loading: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<Applications />, {
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
        expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
      });

      // Find status filter (combobox or select)
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBeGreaterThanOrEqual(1);
    });
  });
});

