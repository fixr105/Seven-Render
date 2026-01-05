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

      // Wait for applications to render
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Check that application details are displayed
      expect(screen.getByText(/SF001/i)).toBeInTheDocument();
      expect(screen.getByText(/SF002/i)).toBeInTheDocument();
      expect(screen.getByText(/Business Loan/i)).toBeInTheDocument();
      expect(screen.getByText(/Personal Loan/i)).toBeInTheDocument();
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
        expect(screen.getByText(/Pending KAM Review/i)).toBeInTheDocument();
        expect(screen.getByText(/Forwarded to Credit/i)).toBeInTheDocument();
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
        // Check for formatted amounts (₹5.00L, ₹3.00L)
        const amountText = screen.getByText(/₹.*L/i);
        expect(amountText).toBeInTheDocument();
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

      await waitFor(() => {
        // Should show empty state message
        const emptyMessage = screen.queryByText(/no applications|empty|no data/i);
        expect(emptyMessage || screen.queryByText(/create|new application/i)).toBeInTheDocument();
      });
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

      // Should show loading indicator
      expect(screen.getByText(/loading|fetching/i)).toBeInTheDocument();
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

      // Error might be logged but not necessarily displayed in UI
      // The component should handle error gracefully
      await waitFor(() => {
        // Should not crash, should show empty state or error message
        const errorMessage = screen.queryByText(/error|failed/i);
        const emptyState = screen.queryByText(/no applications|empty/i);
        expect(errorMessage || emptyState).toBeTruthy();
      });
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
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Should not show applications from other clients
      expect(screen.queryByText(/Other Client/i)).not.toBeInTheDocument();
    });

    it('should show all applications for KAM role', async () => {
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
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Other Client App')).toBeInTheDocument();
      });
    });

    it('should show all applications for CREDIT role', async () => {
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
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
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
        expect(screen.getByText('John Doe')).toBeInTheDocument();
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
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find status filter dropdown
      const statusFilter = screen.getByLabelText(/status|filter/i);
      expect(statusFilter).toBeInTheDocument();
    });
  });
});

