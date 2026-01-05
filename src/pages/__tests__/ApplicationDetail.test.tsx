/**
 * Frontend Tests for ApplicationDetail Page (P0)
 * Tests documents list, query thread, status timeline, and AI summary sections
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationDetail } from '../ApplicationDetail';
import { apiService } from '../../services/api';
import { renderWithProviders, mockClientUser, mockKAMUser } from '../../test/helpers';
import { useParams } from 'react-router-dom';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// Mock API service
vi.mock('../../services/api', () => {
  const mockApiService = {
    getApplication: vi.fn(),
    getQueries: vi.fn(),
    getFileAuditLog: vi.fn(),
    generateAISummary: vi.fn(),
    raiseQueryToKAM: vi.fn(),
    raiseQueryToClient: vi.fn(),
    replyToQuery: vi.fn(),
    resolveQuery: vi.fn(),
  };
  return {
    apiService: mockApiService,
  };
});

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

describe('ApplicationDetail Page - P0 Tests', () => {
  const mockApplication = {
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
    form_data: {
      field1: 'value1',
      field2: 'value2',
    },
    documents: [
      {
        fileName: 'PAN Card',
        fieldId: 'pan_card',
        url: 'https://onedrive.com/pan.pdf',
      },
      {
        fileName: 'Aadhar Card',
        fieldId: 'aadhar_card',
        url: 'https://onedrive.com/aadhar.pdf',
      },
    ],
    aiFileSummary: 'This is an AI-generated summary of the application.',
  };

  const mockQueries = [
    {
      rootQuery: {
        id: 'query1',
        actor: 'KAM User',
        raised_by: 'kam-1',
        raised_to_role: 'client',
        query_text: 'Please provide more details for field X',
        message: 'Please provide more details for field X',
        timestamp: '2024-01-16T10:00:00Z',
        targetUserRole: 'client',
        resolved: false,
      },
      replies: [
        {
          id: 'reply1',
          actor: 'Client User',
          message: 'Here are the additional details.',
          timestamp: '2024-01-16T14:00:00Z',
        },
      ],
      isResolved: false,
    },
  ];

  const mockStatusHistory = [
    {
      id: 'status1',
      from_status: null,
      to_status: 'draft',
      changed_by: 'client-1',
      notes: 'Application created',
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'status2',
      from_status: 'draft',
      to_status: 'pending_kam_review',
      changed_by: 'client-1',
      notes: 'Application submitted',
      created_at: '2024-01-15T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as any).mockReturnValue({ id: 'app1' });

    // Default mock implementations
    (apiService.getApplication as any).mockResolvedValue({
      success: true,
      data: mockApplication,
    });

    (apiService.getQueries as any).mockResolvedValue({
      success: true,
      data: mockQueries,
    });

    (apiService.getFileAuditLog as any).mockResolvedValue({
      success: true,
      data: mockStatusHistory.map(item => ({
        ...item,
        actionEventType: 'status_change',
      })),
    });

    (apiService.generateAISummary as any).mockResolvedValue({
      success: true,
      data: { summary: 'Generated AI summary' },
    });
  });

  describe('M4-FE-001: Documents List Rendering', () => {
    it('should render documents list when application has documents', async () => {
      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalledWith('app1');
      });

      // Wait for documents section to render
      await waitFor(() => {
        expect(screen.getByText(/Documents/i)).toBeInTheDocument();
      });

      // Check that document names are displayed
      expect(screen.getByText(/PAN Card/i)).toBeInTheDocument();
      expect(screen.getByText(/Aadhar Card/i)).toBeInTheDocument();

      // Check that download buttons are present
      const downloadButtons = screen.getAllByRole('button', { name: /download/i });
      expect(downloadButtons.length).toBeGreaterThan(0);
    });

    it('should not render documents section when no documents exist', async () => {
      const appWithoutDocs = { ...mockApplication, documents: [] };
      (apiService.getApplication as any).mockResolvedValue({
        success: true,
        data: appWithoutDocs,
      });

      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalled();
      });

      // Documents section should not be rendered
      await waitFor(() => {
        const documentsSection = screen.queryByText(/Documents \(\d+\)/i);
        expect(documentsSection).not.toBeInTheDocument();
      });
    });
  });

  describe('M4-FE-002: Query Thread Rendering', () => {
    it('should render query threads with root queries and replies', async () => {
      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalled();
        expect(apiService.getQueries).toHaveBeenCalled();
      });

      // Wait for queries section to render
      await waitFor(() => {
        expect(screen.getByText(/Queries & Communication/i)).toBeInTheDocument();
      });

      // Check that root query is displayed
      expect(screen.getByText(/Please provide more details for field X/i)).toBeInTheDocument();

      // Check that reply is displayed
      expect(screen.getByText(/Here are the additional details/i)).toBeInTheDocument();

      // Check that query status badges are shown
      const openBadge = screen.queryByText(/Open/i);
      expect(openBadge).toBeInTheDocument();
    });

    it('should show empty state when no queries exist', async () => {
      (apiService.getQueries as any).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getQueries).toHaveBeenCalled();
      });

      // Should show empty state message
      await waitFor(() => {
        expect(screen.getByText(/No queries yet/i)).toBeInTheDocument();
      });
    });

    it('should show resolved badge for resolved queries', async () => {
      const resolvedQueries = [
        {
          ...mockQueries[0],
          rootQuery: {
            ...mockQueries[0].rootQuery,
            resolved: true,
          },
          isResolved: true,
        },
      ];

      (apiService.getQueries as any).mockResolvedValue({
        success: true,
        data: resolvedQueries,
      });

      renderWithProviders(<ApplicationDetail />, {
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
        expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
      });
    });
  });

  describe('M4-FE-003: Status Timeline Rendering', () => {
    it('should render status history timeline', async () => {
      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalled();
        expect(apiService.getFileAuditLog).toHaveBeenCalled();
      });

      // Wait for status history section to render
      await waitFor(() => {
        expect(screen.getByText(/Status History/i)).toBeInTheDocument();
      });

      // Check that status items are displayed
      expect(screen.getByText(/Draft/i)).toBeInTheDocument();
      expect(screen.getByText(/Pending KAM Review/i)).toBeInTheDocument();

      // Check that notes are displayed
      expect(screen.getByText(/Application created/i)).toBeInTheDocument();
      expect(screen.getByText(/Application submitted/i)).toBeInTheDocument();
    });

    it('should show empty state when no status history exists', async () => {
      (apiService.getFileAuditLog as any).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getFileAuditLog).toHaveBeenCalled();
      });

      // Status history section should still be rendered but empty
      await waitFor(() => {
        expect(screen.getByText(/Status History/i)).toBeInTheDocument();
      });
    });
  });

  describe('M4-FE-004: AI Summary Section Rendering', () => {
    it('should render AI summary when available', async () => {
      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalled();
      });

      // Wait for AI summary section to render
      await waitFor(() => {
        expect(screen.getByText(/AI File Summary/i)).toBeInTheDocument();
      });

      // Check that summary content is displayed
      expect(screen.getByText(/This is an AI-generated summary/i)).toBeInTheDocument();

      // Check that refresh button is shown
      const refreshButton = screen.getByRole('button', { name: /Refresh Summary/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it('should show generate button when no AI summary exists', async () => {
      const appWithoutSummary = { ...mockApplication, aiFileSummary: null };
      (apiService.getApplication as any).mockResolvedValue({
        success: true,
        data: appWithoutSummary,
      });

      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalled();
      });

      // Wait for AI summary section to render
      await waitFor(() => {
        expect(screen.getByText(/AI File Summary/i)).toBeInTheDocument();
      });

      // Check that generate button is shown
      const generateButton = screen.getByRole('button', { name: /Generate Summary/i });
      expect(generateButton).toBeInTheDocument();

      // Check that empty state message is shown
      expect(screen.getByText(/No AI summary available yet/i)).toBeInTheDocument();
    });

    it('should call generateAISummary when generate button is clicked', async () => {
      const user = userEvent.setup();
      const appWithoutSummary = { ...mockApplication, aiFileSummary: null };
      (apiService.getApplication as any).mockResolvedValue({
        success: true,
        data: appWithoutSummary,
      });

      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalled();
      });

      // Find and click generate button
      const generateButton = screen.getByRole('button', { name: /Generate Summary/i });
      await user.click(generateButton);

      // Should call generateAISummary
      await waitFor(() => {
        expect(apiService.generateAISummary).toHaveBeenCalledWith('app1');
      });
    });

    it('should show loading state while generating AI summary', async () => {
      const user = userEvent.setup();
      const appWithoutSummary = { ...mockApplication, aiFileSummary: null };
      (apiService.getApplication as any).mockResolvedValue({
        success: true,
        data: appWithoutSummary,
      });

      // Delay the response to test loading state
      (apiService.generateAISummary as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: { summary: 'Generated' } }), 100))
      );

      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalled();
      });

      const generateButton = screen.getByRole('button', { name: /Generate Summary/i });
      await user.click(generateButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/Generating AI summary/i)).toBeInTheDocument();
      });
    });
  });

  describe('M4-FE-005: Application Not Found Handling', () => {
    it('should show not found message when application does not exist', async () => {
      (apiService.getApplication as any).mockResolvedValue({
        success: false,
        error: 'Application not found',
      });

      renderWithProviders(<ApplicationDetail />, {
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
        expect(apiService.getApplication).toHaveBeenCalled();
      });

      // Should show not found message
      await waitFor(() => {
        expect(screen.getByText(/Application not found/i)).toBeInTheDocument();
      });
    });
  });
});

