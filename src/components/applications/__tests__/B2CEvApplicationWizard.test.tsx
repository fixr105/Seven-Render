import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { B2CEvApplicationWizard } from '../B2CEvApplicationWizard';
import { apiService } from '../../../services/api';
import { renderWithProviders, mockClientUser } from '../../../test/helpers';

vi.mock('../../../services/api', () => ({
  apiService: {
    listLoanProducts: vi.fn(),
    getClientKyc: vi.fn(),
    lookupBorrowerPan: vi.fn(),
    getApplication: vi.fn(),
    createApplication: vi.fn(),
    updateApplicationForm: vi.fn(),
    submitApplication: vi.fn(),
    validateApplicationSubmission: vi.fn(),
    createClientQuery: vi.fn(),
  },
}));

vi.mock('../../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useNavigation', () => ({
  useNavigation: () => ({
    activeItem: null,
    handleNavigation: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useSidebarItems', () => ({
  useSidebarItems: () => [],
}));

vi.mock('../../../auth/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../auth/AuthContext')>();
  return {
    ...actual,
    useAuth: vi.fn(() => ({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
    })),
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams('b2cEv=1'), vi.fn()],
  };
});

const fillStageOne = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.selectOptions(screen.getByTestId('b2c-loan-product-select'), 'LP001');
  await user.type(screen.getByTestId('b2c-field-_meta-panLookup-mobileNumber'), '9687599179');
  await user.type(screen.getByTestId('b2c-field-_meta-panLookup-panNumber'), 'BAIPG3083L');
  await user.type(screen.getByTestId('b2c-field-_meta-panLookup-fullName'), 'RAHUL YADAV');
};

describe('B2CEvApplicationWizard submit gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.listLoanProducts as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [{ productId: 'LP001', productName: 'EV Loan' }],
    });
    (apiService.getClientKyc as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Not found',
    });
    (apiService.lookupBorrowerPan as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        formDataPatch: {
          'borrower.firstName': 'RAHUL',
          'borrower.lastName': 'GONSALVES',
          'borrower.customerName': 'RAHUL GONSALVES',
          'borrower.gender': 'Male',
          'borrower.dob': '1993-04-07',
          'borrower.fatherName': 'JOSEPH GONSALVES',
          'borrower.mobile': '9687599179',
          'borrower.email': 'rahul@example.com',
          'borrower.pan': 'BAIPG3083L',
          'borrower.address.line1':
            '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar',
          'borrower.address.village': 'Bhavnagar',
          'borrower.address.pincode': '364002',
          'borrower.address.district': 'Bhavnagar',
          'borrower.address.state': 'Gujarat',
        },
        lookupAt: '2026-04-07T12:00:00.000Z',
      },
    });
    (apiService.createApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { loanApplicationId: 'draft-1', fileId: 'draft-1' },
    });
    (apiService.updateApplicationForm as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (apiService.submitApplication as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (apiService.validateApplicationSubmission as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {},
    });
    window.alert = vi.fn();
  });

  it('does not show Submit on the first step', async () => {
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('b2c-submit-application')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('Save draft calls createApplication with saveAsDraft true', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(apiService.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ saveAsDraft: true, productId: 'LP001' })
      );
    });
    expect(apiService.submitApplication).not.toHaveBeenCalled();
  });

  it('does not advance past stage 1 when PAN lookup fails', async () => {
    (apiService.lookupBorrowerPan as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'PAN lookup returned no borrower details',
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-pan-lookup-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    expect(screen.queryByTestId('b2c-field-borrower-firstName')).not.toBeInTheDocument();
  });

  it('autofills borrower profile and address on a single stage after successful PAN lookup', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(apiService.lookupBorrowerPan).toHaveBeenCalledWith({
        mobileNumber: '9687599179',
        panNumber: 'BAIPG3083L',
        fullName: 'RAHUL YADAV',
        borrowerEmail: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toHaveValue('RAHUL');
    });

    expect(screen.getByTestId('b2c-field-borrower-lastName')).toHaveValue('GONSALVES');
    expect(screen.getByTestId('b2c-field-borrower-drivingLicense')).toHaveValue('');
    expect(screen.getByTestId('b2c-field-borrower-address-line1')).toHaveValue(
      '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar'
    );
    expect(screen.getByTestId('b2c-field-borrower-address-village')).toHaveValue('Bhavnagar');
    expect(screen.getByTestId('b2c-field-borrower-address-pincode')).toHaveValue('364002');
    expect(screen.getByText('Address')).toBeInTheDocument();
  });

  it('autofills dealer stage from Client KYC on mount and when opened', async () => {
    const dealerPatch = {
      'dealer.id': 'SFDLR11030',
      'dealer.displayLabel': 'Ajay Enterprises - 7905835489',
      'dealer.tradeName': 'Ajay Enterprises',
      'dealer.name': 'Ajay Enterprises',
      'dealer.contact': '7905835489',
      'dealer.email': 'dealer@example.com',
      'dealer.gstNumber': '09BMCPG4250M1ZY',
      'dealer.pan': 'BMCPG4250M',
      'dealer.ifscCode': 'HDFC0001885',
    };

    (apiService.getClientKyc as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        clientId: 'USER-1776170387392-b7n4q1v5z',
        displayLabel: 'Ajay Enterprises - 7905835489',
        formDataPatch: dealerPatch,
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(apiService.getClientKyc).toHaveBeenCalled();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await user.type(screen.getByTestId('loan-calc-downpayment'), '15000');
    await user.type(screen.getByTestId('loan-calc-disbursement'), '50000');
    await user.click(screen.getByTestId('loan-calc-freeze'));
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-dealer-id')).toHaveValue('SFDLR11030');
    });

    expect(screen.getByTestId('b2c-field-dealer-tradeName')).toHaveValue('Ajay Enterprises');
    expect(screen.getByTestId('b2c-field-dealer-contact')).toHaveValue('7905835489');
  });

  it('does not show Submit until the last step', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));
    await user.click(screen.getByTestId('b2c-wizard-next'));
    await user.click(screen.getByTestId('b2c-wizard-next'));

    expect(screen.queryByTestId('b2c-submit-application')).not.toBeInTheDocument();
  });

  it('never calls createApplication with saveAsDraft false', async () => {
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(apiService.listLoanProducts).toHaveBeenCalled();
    });

    const calls = (apiService.createApplication as ReturnType<typeof vi.fn>).mock.calls;
    for (const [arg] of calls) {
      expect(arg?.saveAsDraft).not.toBe(false);
    }
  });
});
