import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { B2CEvApplicationWizard } from '../B2CEvApplicationWizard';
import { apiService } from '../../../services/api';
import { renderWithProviders, mockClientUser } from '../../../test/helpers';
import { createInitialB2cEvFormData } from '../../../config/forms/b2cEvFormSchema';

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
const mockUseSearchParams = vi.fn(() => [new URLSearchParams('b2cEv=1'), vi.fn()] as const);
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => mockUseSearchParams(),
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
    mockUseSearchParams.mockReturnValue([new URLSearchParams('b2cEv=1'), vi.fn()] as const);
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
          '_meta.panLookup.cibilScore': '620',
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
    expect(screen.getByTestId('b2c-field-borrower-firstName')).not.toBeDisabled();
    expect(screen.getByTestId('b2c-field-borrower-drivingLicense')).toHaveValue('');
    expect(screen.getByTestId('b2c-field-borrower-drivingLicense')).not.toBeDisabled();
    expect(screen.getByTestId('b2c-field-borrower-pan')).toBeDisabled();
    expect(screen.getByTestId('b2c-field-borrower-address-line1')).toHaveValue(
      '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar'
    );
    expect(screen.getByTestId('b2c-field-borrower-address-village')).toHaveValue('Bhavnagar');
    expect(screen.getByTestId('b2c-field-borrower-address-pincode')).toHaveValue('364002');
    expect(screen.getByText('Address')).toBeInTheDocument();
  });

  it('shows CIBIL probability bar on borrower step without displaying the numeric score', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('cibil-probability-bar')).toBeInTheDocument();
    });

    expect(screen.getByText('Chances with co applicant')).toBeInTheDocument();
    expect(screen.queryByText('620')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b620\b/);

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.queryByTestId('cibil-probability-bar')).not.toBeInTheDocument();
    });
  });

  it('allows editing autofilled borrower fields and recomputes customer name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toHaveValue('RAHUL');
    });

    const firstNameInput = screen.getByTestId('b2c-field-borrower-firstName');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'AMIT');

    expect(firstNameInput).toHaveValue('AMIT');
    expect(screen.getByTestId('b2c-field-borrower-customerName')).toHaveValue('AMIT GONSALVES');
    expect(screen.getByTestId('b2c-field-borrower-pan')).toBeDisabled();
  });

  it('shows gender select placeholder when PAN JSON omits gender', async () => {
    (apiService.lookupBorrowerPan as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      data: {
        formDataPatch: {
          'borrower.firstName': 'RAHUL',
          'borrower.lastName': 'GONSALVES',
          'borrower.customerName': 'RAHUL GONSALVES',
        },
        lookupAt: '2026-04-07T12:00:00.000Z',
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toHaveValue('RAHUL');
    });

    expect(screen.queryByText('Select Gender')).toBeInTheDocument();
    expect(screen.getByTestId('b2c-field-borrower-gender')).not.toBeDisabled();
    expect(screen.getByTestId('b2c-field-borrower-gender')).toHaveValue('');
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

  it('auto-saves draft after debounced field edit when product is selected', async () => {
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    vi.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.selectOptions(screen.getByTestId('b2c-loan-product-select'), 'LP001');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });

      expect(apiService.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ saveAsDraft: true, productId: 'LP001' })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists KAM request timestamp via updateApplicationForm after createClientQuery', async () => {
    const completeFormData = {
      ...createInitialB2cEvFormData(),
      '_meta.formTemplate': 'b2c_ev_v1',
      '_meta.panLookup.status': 'success',
      '_meta.panLookup.inputHash': 'hash',
      '_meta.supportPersonType': 'co_applicant',
      '_meta.supportPanLookup.phase': 'profile',
      '_meta.supportPanLookup.status': 'success',
      'borrower.firstName': 'RAHUL',
      'borrower.lastName': 'GONSALVES',
      'borrower.customerName': 'RAHUL GONSALVES',
      'borrower.gender': 'Male',
      'borrower.dob': '1993-04-07',
      'borrower.fatherName': 'JOSEPH',
      'borrower.mobile': '9687599179',
      'borrower.email': 'rahul@example.com',
      'borrower.pan': 'BAIPG3083L',
      'borrower.address.line1': 'Line 1',
      'borrower.address.village': 'Village',
      'borrower.address.pincode': '364002',
      'borrower.address.district': 'District',
      'borrower.address.state': 'Gujarat',
      'loan.amount': '56522',
      'loan.interestRate': '35',
      'loan.tenureMonths': '12',
      'loan.processingFee': '4522',
      'loan.gpsCharges': '2000',
      'loan.processingFeePercent': '8',
      'loan.disbursalAmount': '50000',
      'dealer.id': 'SFDLR11030',
      'dealer.displayLabel': 'Dealer',
      'dealer.tradeName': 'Dealer',
      'dealer.name': 'Dealer',
      'dealer.contact': '7905835489',
      'dealer.email': 'dealer@example.com',
      'dealer.gstNumber': '09BMCPG4250M1ZY',
      'dealer.pan': 'BMCPG4250M',
      'dealer.ifscCode': 'HDFC0001885',
      'coApplicant.name': 'Co App',
      'coApplicant.dob': '1990-01-01',
      'coApplicant.email': 'co@example.com',
      'coApplicant.pan': 'ABCDE1234F',
      'coApplicant.address.line1': 'Co line 1',
      'coApplicant.address.village': 'Co village',
      'coApplicant.address.pincode': '364002',
      'coApplicant.address.district': 'District',
      'coApplicant.address.state': 'Gujarat',
      'coApplicant.drivingLicense': 'DL123',
      'coApplicant.mobile': '9999999999',
      'coApplicant.relationship': 'Spouse',
      'geoPhotos.withSupportPerson.url': 'https://cdn.example.com/with-support.jpg',
      'geoPhotos.withSupportPerson.fileName': 'with-support.jpg',
      'geoPhotos.withSupportPerson.latitude': '21.17',
      'geoPhotos.withSupportPerson.longitude': '72.83',
      'geoPhotos.withVehicle.url': 'https://cdn.example.com/with-vehicle.jpg',
      'geoPhotos.withVehicle.fileName': 'with-vehicle.jpg',
      'geoPhotos.withVehicle.latitude': '21.17',
      'geoPhotos.withVehicle.longitude': '72.83',
      'geoPhotos.atResidence.url': 'https://cdn.example.com/at-residence.jpg',
      'geoPhotos.atResidence.fileName': 'at-residence.jpg',
      'geoPhotos.atResidence.latitude': '21.17',
      'geoPhotos.atResidence.longitude': '72.83',
    };

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('draftId=draft-geo&b2cEv=1'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-geo',
        status: 'draft',
        applicantName: 'RAHUL GONSALVES',
        loanProduct: 'LP001',
        requestedLoanAmount: '56522',
        formData: completeFormData,
      },
    });
    (apiService.createClientQuery as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-stepper-step-geo-photos')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('b2c-stepper-step-geo-photos'));

    await waitFor(() => {
      expect(screen.getByTestId('compliance-request-kam-vkyc')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('compliance-request-kam-vkyc'));

    await waitFor(() => {
      expect(apiService.createClientQuery).toHaveBeenCalled();
      expect(apiService.updateApplicationForm).toHaveBeenCalledWith(
        'draft-geo',
        expect.objectContaining({
          '_meta.kamRequests.vkyc.requestedAt': expect.any(String),
        })
      );
    });
  });

  it('persists DO request timestamp via updateApplicationForm after createClientQuery', async () => {
    const completeFormData = {
      ...createInitialB2cEvFormData(),
      '_meta.formTemplate': 'b2c_ev_v1',
      '_meta.panLookup.status': 'success',
      '_meta.panLookup.inputHash': 'hash',
      '_meta.supportPersonType': 'co_applicant',
      '_meta.supportPanLookup.phase': 'profile',
      '_meta.supportPanLookup.status': 'success',
      'borrower.firstName': 'RAHUL',
      'borrower.lastName': 'GONSALVES',
      'borrower.customerName': 'RAHUL GONSALVES',
      'borrower.gender': 'Male',
      'borrower.dob': '1993-04-07',
      'borrower.fatherName': 'JOSEPH',
      'borrower.mobile': '9687599179',
      'borrower.email': 'rahul@example.com',
      'borrower.pan': 'BAIPG3083L',
      'borrower.address.line1': 'Line 1',
      'borrower.address.village': 'Village',
      'borrower.address.pincode': '364002',
      'borrower.address.district': 'District',
      'borrower.address.state': 'Gujarat',
      'loan.amount': '56522',
      'loan.interestRate': '35',
      'loan.tenureMonths': '12',
      'loan.processingFee': '4522',
      'loan.gpsCharges': '2000',
      'loan.processingFeePercent': '8',
      'loan.disbursalAmount': '50000',
      'dealer.id': 'SFDLR11030',
      'dealer.displayLabel': 'Dealer',
      'dealer.tradeName': 'Dealer',
      'dealer.name': 'Dealer',
      'dealer.contact': '7905835489',
      'dealer.email': 'dealer@example.com',
      'dealer.gstNumber': '09BMCPG4250M1ZY',
      'dealer.pan': 'BMCPG4250M',
      'dealer.ifscCode': 'HDFC0001885',
      'coApplicant.name': 'Co App',
      'coApplicant.dob': '1990-01-01',
      'coApplicant.email': 'co@example.com',
      'coApplicant.pan': 'ABCDE1234F',
      'coApplicant.address.line1': 'Co line 1',
      'coApplicant.address.village': 'Co village',
      'coApplicant.address.pincode': '364002',
      'coApplicant.address.district': 'District',
      'coApplicant.address.state': 'Gujarat',
      'coApplicant.drivingLicense': 'DL123',
      'coApplicant.mobile': '9999999999',
      'coApplicant.relationship': 'Spouse',
      'geoPhotos.withSupportPerson.url': 'https://cdn.example.com/with-support.jpg',
      'geoPhotos.withSupportPerson.fileName': 'with-support.jpg',
      'geoPhotos.withSupportPerson.latitude': '21.17',
      'geoPhotos.withSupportPerson.longitude': '72.83',
      'geoPhotos.withVehicle.url': 'https://cdn.example.com/with-vehicle.jpg',
      'geoPhotos.withVehicle.fileName': 'with-vehicle.jpg',
      'geoPhotos.withVehicle.latitude': '21.17',
      'geoPhotos.withVehicle.longitude': '72.83',
      'geoPhotos.atResidence.url': 'https://cdn.example.com/at-residence.jpg',
      'geoPhotos.atResidence.fileName': 'at-residence.jpg',
      'geoPhotos.atResidence.latitude': '21.17',
      'geoPhotos.atResidence.longitude': '72.83',
    };

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('draftId=draft-geo&b2cEv=1'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-geo',
        status: 'draft',
        applicantName: 'RAHUL GONSALVES',
        loanProduct: 'LP001',
        requestedLoanAmount: '56522',
        formData: completeFormData,
      },
    });
    (apiService.createClientQuery as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-stepper-step-geo-photos')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('b2c-stepper-step-geo-photos'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-wizard-request-do')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('b2c-wizard-request-do'));

    await waitFor(() => {
      expect(apiService.createClientQuery).toHaveBeenCalled();
      expect(apiService.updateApplicationForm).toHaveBeenCalledWith(
        'draft-geo',
        expect.objectContaining({
          '_meta.doRequest.requestedAt': expect.any(String),
        })
      );
    });
  });
});
