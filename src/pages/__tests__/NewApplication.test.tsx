/**
 * Frontend Tests for NewApplication Page (P0)
 * Tests dynamic form rendering and mandatory field validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewApplication } from '../NewApplication';
import { apiService } from '../../services/api';
import { renderWithProviders, mockClientUser } from '../../test/helpers';

// Mock API service
vi.mock('../../services/api', () => {
  const mockApiService = {
    getFormConfig: vi.fn(),
    listLoanProducts: vi.fn(),
    createApplication: vi.fn(),
    uploadDocument: vi.fn(),
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
    
    // Default mock implementations
    (apiService.getFormConfig as any).mockResolvedValue({
      success: true,
      data: mockFormConfig,
    });
    
    (apiService.listLoanProducts as any).mockResolvedValue({
      success: true,
      data: mockLoanProducts,
    });
    
    (apiService.createApplication as any).mockResolvedValue({
      success: true,
      data: { id: 'app-123' },
    });
    
    (apiService.uploadDocument as any).mockResolvedValue({
      success: true,
      data: { shareLink: 'https://onedrive.com/file1', fileName: 'test.pdf' },
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

      // Check that category sections are rendered
      await waitFor(() => {
        expect(screen.getByText('Personal Information')).toBeInTheDocument();
        expect(screen.getByText('Loan Details')).toBeInTheDocument();
      });

      // Check that mandatory fields are rendered
      await waitFor(() => {
        expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/PAN Card/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Loan Purpose/i)).toBeInTheDocument();
      });

      // Check that optional fields are rendered
      await waitFor(() => {
        expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
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

      // Check text input
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Full Name/i);
        expect(nameInput).toBeInTheDocument();
        expect(nameInput.tagName).toBe('INPUT');
      });

      // Check file upload
      await waitFor(() => {
        const panCardField = screen.getByText(/PAN Card/i);
        expect(panCardField).toBeInTheDocument();
      });

      // Check select dropdown
      await waitFor(() => {
        const loanPurposeField = screen.getByLabelText(/Loan Purpose/i);
        expect(loanPurposeField).toBeInTheDocument();
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

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      });

      // Fill only applicant name and loan product (core fields)
      const applicantNameInput = screen.getByLabelText(/Applicant Name/i);
      await user.type(applicantNameInput, 'John Doe');

      // Try to submit without filling mandatory form fields
      const submitButton = screen.getByRole('button', { name: /submit|send|create/i });
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

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      });

      // Fill core required fields
      const applicantNameInput = screen.getByLabelText(/Applicant Name/i);
      await user.type(applicantNameInput, 'John Doe');

      // Select loan product
      const loanProductSelect = screen.getByLabelText(/Loan Product/i);
      await user.selectOptions(loanProductSelect, 'LP001');

      // Fill requested amount
      const amountInput = screen.getByLabelText(/Requested Loan Amount/i);
      await user.type(amountInput, '500000');

      // Fill mandatory form fields
      const fullNameInput = screen.getByLabelText(/Full Name/i);
      await user.type(fullNameInput, 'John Doe');

      const loanPurposeSelect = screen.getByLabelText(/Loan Purpose/i);
      await user.selectOptions(loanPurposeSelect, 'Business');

      // Upload mandatory file (mock file upload)
      const file = new File(['test'], 'pan.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/PAN Card/i).closest('div')?.querySelector('input[type="file"]');
      if (fileInput) {
        await user.upload(fileInput, file);
      }

      // Wait for file upload to complete
      await waitFor(() => {
        expect(apiService.uploadDocument).toHaveBeenCalled();
      }, { timeout: 3000 });

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

      // Fill only applicant name
      const applicantNameInput = screen.getByLabelText(/Applicant Name/i);
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

      // Should show loading indicator
      expect(screen.getByText(/loading|fetching/i)).toBeInTheDocument();
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

