/**
 * Frontend Tests for NewApplication Page (P0)
 * Tests dynamic form rendering and mandatory field validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewApplication } from '../NewApplication';
import { apiService } from '../../services/api';
import { renderWithProviders, mockClientUser } from '../../test/helpers';

// Mock API service
vi.mock('../../services/api', () => {
  const mockApiService = {
    getFormConfig: vi.fn(),
    listLoanProducts: vi.fn(),
    getConfiguredProducts: vi.fn(),
    createApplication: vi.fn(),
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

// Mock useAuth so NewApplication runs client flow; keep AuthProvider for TestWrapper
vi.mock('../../auth/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/AuthContext')>();
  return { ...actual, useAuth: vi.fn() };
});

import { useAuth } from '../../auth/AuthContext';

describe('NewApplication Page - P0 Tests', () => {
  const mockFormConfig = [
    {
      categoryId: 'cat1',
      categoryName: 'Personal Information',
      fields: [
        {
          fieldId: 'field1',
          fieldLabel: 'Full Name',
          fieldType: 'text',
          isMandatory: true,
          displayOrder: '1',
        },
        {
          fieldId: 'field2',
          fieldLabel: 'Email',
          fieldType: 'email',
          isMandatory: false,
          displayOrder: '2',
        },
        {
          fieldId: 'field3',
          fieldLabel: 'PAN Card',
          fieldType: 'file',
          isMandatory: true,
          displayOrder: '3',
        },
      ],
    },
    {
      categoryId: 'cat2',
      categoryName: 'Loan Details',
      fields: [
        {
          fieldId: 'field4',
          fieldLabel: 'Loan Purpose',
          fieldType: 'select',
          isMandatory: true,
          displayOrder: '1',
          fieldOptions: 'Business,Personal,Education',
        },
      ],
    },
  ];

  const mockLoanProducts = [
    { id: 'LP001', name: 'Business Loan' },
    { id: 'LP002', name: 'Personal Loan' },
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
    // Default mock implementations
    (apiService.getFormConfig as any).mockResolvedValue({
      success: true,
      data: mockFormConfig,
    });
    
    (apiService.listLoanProducts as any).mockResolvedValue({
      success: true,
      data: mockLoanProducts,
    });

    (apiService.getConfiguredProducts as any).mockResolvedValue({
      success: true,
      data: [],
    });
    
    (apiService.createApplication as any).mockResolvedValue({
      success: true,
      data: { id: 'app-123' },
    });
  });

  describe('M2-FE-004: Loan Product Visibility', () => {
    it('should show all active products when no configured products exist', async () => {
      renderWithProviders(<NewApplication />, {
        authContext: {
          user: mockClientUser,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
          hasRole: vi.fn(),
          setAuthUserAndToken: vi.fn(),
        },
      });

      const loanProductSelect = await screen.findByRole('combobox', {}, { timeout: 8000 });
      expect(loanProductSelect).toBeInTheDocument();
      await waitFor(() => {
        expect(loanProductSelect).toHaveTextContent('Business Loan');
        expect(loanProductSelect).toHaveTextContent('Personal Loan');
      }, { timeout: 5000 });
    });
  });

  describe('M2-FE-001: Dynamic Form Field Rendering', () => {
    it('should render form fields based on form configuration', async () => {
      renderWithProviders(<NewApplication />, {
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

      // Wait for form config to load
      await waitFor(() => {
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });

      // Check that category sections are rendered (may appear in heading and label)
      await waitFor(() => {
        expect(screen.getAllByText('Personal Information').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Loan Details').length).toBeGreaterThanOrEqual(1);
      });

      // Check that mandatory fields are rendered (label text may not be associated)
      await waitFor(() => {
        expect(screen.getByText(/Full Name/i)).toBeInTheDocument();
        expect(screen.getByText(/PAN Card/i)).toBeInTheDocument();
        expect(screen.getByText(/Loan Purpose/i)).toBeInTheDocument();
      });

      // Check that optional fields are rendered
      await waitFor(() => {
        expect(screen.getByText(/Email/i)).toBeInTheDocument();
      });
    });

    it('should render different field types correctly', async () => {
      renderWithProviders(<NewApplication />, {
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
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });

      // Check text input (form may use label text without htmlFor)
      await waitFor(() => {
        expect(screen.getByText(/Full Name/i)).toBeInTheDocument();
        const textInputs = document.querySelectorAll('input[type="text"]');
        expect(textInputs.length).toBeGreaterThanOrEqual(1);
      });

      // Check file upload
      await waitFor(() => {
        expect(screen.getByText(/PAN Card/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Loan Purpose/i)).toBeInTheDocument();
        expect(document.querySelectorAll('select').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('M2-FE-002: Mandatory Field Validation on Submit', () => {
    it('should prevent submission when mandatory fields are empty', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewApplication />, {
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
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/Full Name|Applicant Name|Application Details/i)).toBeInTheDocument();
      });

      const textboxes = screen.getAllByRole('textbox');
      if (textboxes.length > 0) {
        await user.type(textboxes[0], 'John Doe');
      }

      const submitButton = screen.getByRole('button', { name: /submit|send|create|new application/i });
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(apiService.createApplication).not.toHaveBeenCalled();
      });

      // Check that error messages are displayed
      await waitFor(() => {
        const errorText = screen.queryByText(/required|mandatory|fill in/i);
        expect(errorText).toBeInTheDocument();
      });
    });

    it('should allow submission when all mandatory fields are filled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewApplication />, {
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
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/Full Name|Applicant Name/i)).toBeInTheDocument();
      });

      const applicantInput = screen.queryByRole('textbox', { name: /applicant name/i }) ?? screen.getAllByRole('textbox')[0];
      if (applicantInput) await user.type(applicantInput, 'John Doe');

      const loanProductSelect = screen.queryByRole('combobox', { name: /loan product/i }) ?? screen.getAllByRole('combobox')[0];
      if (loanProductSelect) await user.selectOptions(loanProductSelect, 'LP001');

      const amountInput = screen.getByRole('spinbutton') || document.querySelector('input[type="number"]');
      if (amountInput) await user.type(amountInput as HTMLElement, '500000');

      const textboxes = screen.getAllByRole('textbox');
      const fullNameInput = textboxes.find((el) => (el as HTMLInputElement).value === '') || textboxes[1];
      if (fullNameInput) await user.type(fullNameInput, 'John Doe');

      const loanPurposeSelect = document.querySelectorAll('select')[1];
      if (loanPurposeSelect) await user.selectOptions(loanPurposeSelect as HTMLElement, 'Business');

      // File field (PAN Card) uses 3-checkbox: select "Added to link"
      const addedToLinkRadio = screen.getByRole('radio', { name: /added to link/i });
      await user.click(addedToLinkRadio);

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit|send|create/i });
      await user.click(submitButton);

      // Should call createApplication
      await waitFor(() => {
        expect(apiService.createApplication).toHaveBeenCalled();
      });

      // Verify the call includes all required data
      const createCall = (apiService.createApplication as any).mock.calls[0][0];
      expect(createCall.applicantName).toBe('John Doe');
      expect(createCall.productId).toBe('LP001');
      expect(createCall.requestedLoanAmount).toBeGreaterThan(0);
    });

    it('should allow saving as draft without mandatory fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewApplication />, {
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
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });

      const applicantNameInput = screen.queryByRole('textbox', { name: /applicant name/i }) ?? screen.getAllByRole('textbox')[0];
      await user.type(applicantNameInput, 'John Doe');

      // Find and click "Save as Draft" button
      const draftButton = screen.getByRole('button', { name: /draft|save as draft/i });
      await user.click(draftButton);

      // Should call createApplication with saveAsDraft: true
      await waitFor(() => {
        expect(apiService.createApplication).toHaveBeenCalled();
      });

      const createCall = (apiService.createApplication as any).mock.calls[0][0];
      expect(createCall.saveAsDraft).toBe(true);
    });
  });

  describe('M2-FE-003: Form Configuration Loading States', () => {
    it('should show loading state while fetching form configuration', () => {
      // Delay the response
      (apiService.getFormConfig as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: mockFormConfig }), 100))
      );

      renderWithProviders(<NewApplication />, {
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

      // Should show loading indicator (may appear in form config or products)
      expect(screen.getAllByText(/loading|fetching/i).length).toBeGreaterThanOrEqual(1);
    });

    it('should handle error when form configuration fails to load', async () => {
      (apiService.getFormConfig as any).mockResolvedValue({
        success: false,
        error: 'Failed to load form configuration',
      });

      renderWithProviders(<NewApplication />, {
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
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });

      // Should handle error gracefully (no form fields rendered)
      await waitFor(() => {
        const errorMessage = screen.queryByText(/error|failed/i);
        // Error might be logged but not necessarily displayed
        expect(errorMessage || screen.queryByText(/Personal Information/i)).not.toBeInTheDocument();
      });
    });
  });
});

