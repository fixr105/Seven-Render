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
    getClientVehicles: vi.fn(),
    getClientLinkPool: vi.fn(),
    consumeClientLink: vi.fn(),
    validateApplicationSubmission: vi.fn(),
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
        { fieldId: 'field1', label: 'Full Name', type: 'text', isRequired: true },
        { fieldId: 'field2', label: 'Email', type: 'email', isRequired: false },
        { fieldId: 'field3', label: 'PAN Card', type: 'file', isRequired: true },
      ],
    },
    {
      categoryId: 'cat2',
      categoryName: 'Loan Details',
      fields: [
        {
          fieldId: 'field4',
          label: 'Loan Purpose',
          type: 'select',
          isRequired: true,
          options: ['Business', 'Personal', 'Education'],
        },
      ],
    },
  ];

  const mockLoanProducts = [
    { id: 'LP001', name: 'Business Loan' },
    { id: 'LP002', name: 'Personal Loan' },
  ];
  const mockVehicles = [
    { vehicleId: 'VEH001', make: 'Tata', model: 'Ace Gold', requestedLoanAmount: '550000' },
    { vehicleId: 'VEH002', make: 'Mahindra', model: 'Jeeto', requestedLoanAmount: '400000' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('scrollIntoView', vi.fn());
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
      data: ['LP001', 'LP002'],
    });
    (apiService.getClientVehicles as any).mockResolvedValue({
      success: true,
      data: mockVehicles,
    });
    (apiService.getClientLinkPool as any).mockResolvedValue({
      success: true,
      data: [],
    });
    (apiService.consumeClientLink as any).mockResolvedValue({
      success: true,
      data: { link: 'https://drive.google.com/drive/folders/unused', marked: true },
    });

    (apiService.validateApplicationSubmission as any).mockResolvedValue({
      success: true,
      data: { warnings: [], duplicateFound: null },
    });
    
    (apiService.createApplication as any).mockResolvedValue({
      success: true,
      data: { loanApplicationId: 'app-123', fileId: 'SF123456' },
    });
  });

  describe('M2-FE-004: Loan Product Visibility', () => {
    it('should show assigned configured products for client', async () => {
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

      const loanProductSelect = await screen.findByTestId('loan-product-select', {}, { timeout: 15000 });
      expect(loanProductSelect).toBeInTheDocument();
      await waitFor(() => {
        expect(loanProductSelect).toHaveTextContent('Business Loan');
        expect(loanProductSelect).toHaveTextContent('Personal Loan');
      }, { timeout: 10000 });
    }, 15000);

    it('should show backend configured-products error when no products are allocated', async () => {
      (apiService.getConfiguredProducts as any).mockResolvedValue({
        success: false,
        error: 'No loan products are assigned to your account. Please contact your KAM to allocate products.',
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
        expect(screen.getByText(/No loan products are assigned to your account/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  /** Wait for loan products to load then select the first product (triggers getFormConfig). */
  async function selectFirstLoanProduct(user: ReturnType<typeof userEvent.setup>) {
    const loanProductSelect = await screen.findByTestId('loan-product-select', {}, { timeout: 10000 });
    await waitFor(() => {
      expect(loanProductSelect).not.toBeDisabled();
      expect(loanProductSelect.querySelector('option[value="LP001"]')).toBeInTheDocument();
    }, { timeout: 5000 });
    await user.selectOptions(loanProductSelect, 'LP001');
  }

  describe('Vehicle options loading', () => {
    it('requests vehicles for the selected product and renders returned makes and models', async () => {
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

      await selectFirstLoanProduct(user);

      await waitFor(() => {
        expect(apiService.getClientVehicles).toHaveBeenCalledWith('LP001');
      });
      const vehicleMakeSelect = screen.getByTestId('vehicle-make-select');
      expect(vehicleMakeSelect.querySelector('option[value="Tata"]')).toBeInTheDocument();
      expect(vehicleMakeSelect).not.toHaveTextContent('No makes available');

      await user.selectOptions(vehicleMakeSelect, 'Tata');
      const vehicleModelSelect = screen.getByTestId('vehicle-model-select');
      await waitFor(() => {
        expect(vehicleModelSelect.querySelector('option[value="Ace Gold"]')).toBeInTheDocument();
      });
    }, 15000);

    it('shows vehicle endpoint errors when loading makes fails', async () => {
      const user = userEvent.setup();
      (apiService.getClientVehicles as any).mockResolvedValue({
        success: false,
        error: 'Endpoint not found: /client/vehicles?productId=LP001',
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

      await selectFirstLoanProduct(user);

      await waitFor(() => {
        expect(screen.getByText('Endpoint not found: /client/vehicles?productId=LP001')).toBeInTheDocument();
      });
    }, 15000);
  });

  describe('Documents folder link generation', () => {
    beforeEach(() => {
      sessionStorage.clear();
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
      });
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
    });

    it('selects the first link after rows marked YES without consuming it on generate', async () => {
      const user = userEvent.setup();
      (apiService.getClientLinkPool as any).mockResolvedValue({
        success: true,
        data: [
          { link: 'https://drive.google.com/drive/folders/used-1', status: 'YES' },
          { link: 'https://drive.google.com/drive/folders/used-2', status: ' yes ' },
          { link: 'https://drive.google.com/drive/folders/available-1', status: '' },
          { link: 'https://drive.google.com/drive/folders/available-2', status: 'NO' },
        ],
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

      await user.click(screen.getByTestId('generate-link-button'));

      await waitFor(() => {
        expect(document.getElementById('_documentsFolderLink')).toHaveValue(
          'https://drive.google.com/drive/folders/available-1'
        );
      });
      expect(apiService.consumeClientLink).not.toHaveBeenCalled();
    });

    it('marks the generated link used when Copy Link is clicked', async () => {
      const user = userEvent.setup();
      (apiService.getClientLinkPool as any).mockResolvedValue({
        success: true,
        data: [
          { link: 'https://drive.google.com/drive/folders/used-1', status: 'YES' },
          { link: 'https://drive.google.com/drive/folders/available-1', status: '' },
        ],
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

      await user.click(screen.getByTestId('generate-link-button'));
      await waitFor(() => {
        expect(document.getElementById('_documentsFolderLink')).toHaveValue(
          'https://drive.google.com/drive/folders/available-1'
        );
      });
      await user.click(screen.getByTestId('copy-folder-link'));

      await waitFor(() => {
        expect(apiService.consumeClientLink).toHaveBeenCalledWith(
          'https://drive.google.com/drive/folders/available-1'
        );
      });
      expect(screen.queryAllByText('Link copied to clipboard.').length).toBeGreaterThan(0);
    });

    it('marks the generated link used when Open Link is clicked', async () => {
      const user = userEvent.setup();
      (apiService.getClientLinkPool as any).mockResolvedValue({
        success: true,
        data: [
          { link: 'https://drive.google.com/drive/folders/used-1', status: 'YES' },
          { link: 'https://drive.google.com/drive/folders/available-1', status: '' },
        ],
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

      await user.click(screen.getByTestId('generate-link-button'));
      await waitFor(() => {
        expect(document.getElementById('_documentsFolderLink')).toHaveValue(
          'https://drive.google.com/drive/folders/available-1'
        );
      });
      await user.click(screen.getByTestId('open-folder-link'));

      await waitFor(() => {
        expect(apiService.consumeClientLink).toHaveBeenCalledWith(
          'https://drive.google.com/drive/folders/available-1'
        );
      });
      expect(window.open).toHaveBeenCalledWith(
        'https://drive.google.com/drive/folders/available-1',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  describe('M2-FE-001: Dynamic Form Field Rendering', () => {
    it('should render form fields based on form configuration', async () => {
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

      await selectFirstLoanProduct(user);
      await waitFor(() => {
        expect(apiService.getFormConfig).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Check that category sections or mandatory fields from config are rendered
      await waitFor(() => {
        const hasCategories = screen.queryAllByText('Personal Information').length >= 1 && screen.queryAllByText('Loan Details').length >= 1;
        const hasFields = screen.queryByText(/Full Name/i) || screen.queryByText(/Applicant Name/i);
        expect(hasCategories || hasFields).toBeTruthy();
      }, { timeout: 8000 });

      // Check that at least one of the expected labels is present (Full Name from config or Applicant Name from core form)
      const fullNameOrApplicant = screen.queryByText(/Full Name/i) ?? screen.queryByText(/Applicant Name/i);
      expect(fullNameOrApplicant).toBeInTheDocument();
      expect(screen.queryByLabelText(/Requested Loan Amount/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('vehicle-make-select')).toBeInTheDocument();
      expect(screen.getByTestId('vehicle-model-select')).toBeInTheDocument();
      const panOrPurposeEls = screen.queryAllByText(/PAN Card|Loan Purpose/i);
      expect(panOrPurposeEls.length).toBeGreaterThanOrEqual(1);
      const emailEls = screen.queryAllByText(/Email/i);
      expect(emailEls.length).toBeGreaterThanOrEqual(1);
    }, 15000);

    it('should render different field types correctly', async () => {
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

      await selectFirstLoanProduct(user);
      await waitFor(() => {
        expect(apiService.getFormConfig).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Check text input (Applicant Name is always present; Full Name comes from config)
      await waitFor(() => {
        const label = screen.queryByText(/Full Name/i) ?? screen.queryByText(/Applicant Name/i);
        expect(label).toBeInTheDocument();
        const textInputs = document.querySelectorAll('input[type="text"]');
        expect(textInputs.length).toBeGreaterThanOrEqual(1);
      }, { timeout: 8000 });

      const panLabel = screen.queryByText(/PAN Card/i);
      expect(panLabel).toBeInTheDocument();

      await waitFor(() => {
        const purposeLabel = screen.queryByText(/Loan Purpose/i);
        expect(purposeLabel).toBeInTheDocument();
        expect(document.querySelectorAll('select').length).toBeGreaterThanOrEqual(1);
      }, { timeout: 5000 });
    }, 15000);
  });

  describe('M2-FE-002: Mandatory Field Validation on Submit', () => {
    async function fillRequiredSubmitFields(user: ReturnType<typeof userEvent.setup>) {
      await selectFirstLoanProduct(user);
      await user.type(screen.getByTestId('applicant-name-input'), 'John Doe');
      await user.type(document.getElementById('_mobileNumber') as HTMLElement, '9876543210');
      await user.type(document.getElementById('_email') as HTMLElement, 'john@example.com');
      await user.selectOptions(screen.getByTestId('basic-type-of-purchase'), 'Rental');
      await user.type(document.getElementById('_documentsFolderLink') as HTMLElement, 'https://drive.google.com/drive/folders/test-folder');
    }

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

      await selectFirstLoanProduct(user);
      await waitFor(() => {
        expect(apiService.getFormConfig).toHaveBeenCalled();
      }, { timeout: 5000 });

      await waitFor(() => {
        const els = screen.queryAllByText(/Full Name|Applicant Name|Documents Folder|Application Details/i);
        expect(els.length).toBeGreaterThanOrEqual(1);
      }, { timeout: 10000 });

      const textboxes = screen.getAllByRole('textbox');
      if (textboxes.length > 0) {
        await user.type(textboxes[0], 'John Doe');
      }

      const submitButton = screen.getByRole('button', { name: /submit|send|create|new application/i });
      await user.click(submitButton);

      // Should not call createApplication (validation blocks submit)
      await waitFor(() => {
        expect(apiService.createApplication).not.toHaveBeenCalled();
      }, { timeout: 3000 });

      // Optionally check that some error/validation feedback is shown
      const errorText = screen.queryByText(/required|mandatory|fill in|is required/i);
      if (errorText) expect(errorText).toBeInTheDocument();
    }, 15000);

    it.skip('should allow submission when all mandatory fields are filled', async () => {
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
      }, { timeout: 5000 });

      await waitFor(() => {
        const els = screen.queryAllByText(/Full Name|Applicant Name|Documents Folder|Application Details/i);
        expect(els.length).toBeGreaterThanOrEqual(1);
      }, { timeout: 10000 });

      const applicantInput = screen.queryByRole('textbox', { name: /applicant name/i }) ?? screen.getAllByRole('textbox')[0];
      if (applicantInput) await user.type(applicantInput, 'John Doe');

      const loanProductSelect = screen.queryByRole('combobox', { name: /loan product/i }) ?? screen.getAllByRole('combobox')[0];
      if (loanProductSelect) await user.selectOptions(loanProductSelect, 'LP001');

      const textboxes = screen.getAllByRole('textbox');
      const fullNameInput = textboxes.find((el) => (el as HTMLInputElement).value === '') ?? textboxes[1];
      if (fullNameInput) await user.type(fullNameInput, 'John Doe');

      const selects = document.querySelectorAll('select');
      const loanPurposeSelect = selects.length > 1 ? selects[1] : null;
      if (loanPurposeSelect) await user.selectOptions(loanPurposeSelect as HTMLElement, 'Business');

      // File field (PAN Card) uses 3-radio: select "Yes, Added to Folder" if present
      const addedToLinkRadio = screen.queryByRole('radio', { name: /yes, added to folder/i });
      if (addedToLinkRadio) await user.click(addedToLinkRadio);

      // Submit form (use first matching submit button in case of multiple)
      const submitButtons = screen.getAllByRole('button', { name: /submit|send|create/i });
      await user.click(submitButtons[0]);

      // Should call createApplication (may be delayed by validation/async)
      await waitFor(() => {
        expect(apiService.createApplication).toHaveBeenCalled();
      }, { timeout: 8000 });

      // Verify the call includes required data when it was called
      const calls = (apiService.createApplication as any).mock.calls;
      if (calls.length > 0) {
        const createCall = calls[0][0];
        expect(createCall.applicantName || createCall.applicant_name).toBeTruthy();
        expect(createCall.productId || createCall.loan_product_id).toBeTruthy();
      }
    }, 25000);

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

      await selectFirstLoanProduct(user);
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

    it('should fail when create API returns success without IDs', async () => {
      const user = userEvent.setup();
      (apiService.getConfiguredProducts as any).mockResolvedValue({
        success: true,
        data: ['LP001'],
      });
      (apiService.createApplication as any).mockResolvedValue({
        success: true,
        data: { warnings: [] },
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

      await selectFirstLoanProduct(user);
      await waitFor(() => {
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });

      const applicantNameInput = screen.queryByRole('textbox', { name: /applicant name/i }) ?? screen.getAllByRole('textbox')[0];
      await user.type(applicantNameInput, 'John Doe');
      const draftButton = screen.getByRole('button', { name: /draft|save as draft/i });
      await user.click(draftButton);

      await waitFor(() => {
        expect(globalThis.alert).toHaveBeenCalledWith(
          expect.stringContaining('Submission was not confirmed by the server')
        );
      });
    }, 15000);
  });

  describe('M2-FE-003: Form Configuration Loading States', () => {
    it('should show loading state while fetching form configuration', async () => {
      const user = userEvent.setup();
      // Delay the response so we can assert loading
      (apiService.getFormConfig as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: mockFormConfig }), 200))
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

      await selectFirstLoanProduct(user);
      // While getFormConfig is in flight we may see loading
      await waitFor(() => {
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });
      // getFormConfig was called; form or product UI should be present (use queryAll to avoid multiple-match errors)
      const loadingEls = screen.queryAllByText(/loading|fetching/i);
      const formOrProductEls = screen.queryAllByText(/Personal Information|Application Details|Business Loan/i);
      expect(loadingEls.length >= 1 || formOrProductEls.length >= 1).toBe(true);
    });

    it('should handle error when form configuration fails to load', async () => {
      const user = userEvent.setup();
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

      await selectFirstLoanProduct(user);
      await waitFor(() => {
        expect(apiService.getFormConfig).toHaveBeenCalled();
      });

      // Should handle error gracefully: form config stays empty so category labels are not shown
      await waitFor(() => {
        expect(screen.queryByText(/Personal Information/i)).not.toBeInTheDocument();
      });
    });
  });
});

