import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { B2CEvApplicationWizard } from '../B2CEvApplicationWizard';
import { apiService } from '../../../services/api';
import {
  airtableGet,
  lookupBureauCacheByPan,
  qualifyApplicant,
} from '../../../services/engineClient';
import { renderWithProviders, mockClientUser } from '../../../test/helpers';
import { createInitialB2cEvFormData } from '../../../config/forms/b2cEvFormSchema';

vi.mock('../../../services/api', () => ({
  apiService: {
    listLoanProducts: vi.fn(),
    getClientKyc: vi.fn(),
    getFormConfig: vi.fn(),
    getApplication: vi.fn(),
    createApplication: vi.fn(),
    updateApplicationForm: vi.fn(),
    submitApplication: vi.fn(),
    validateApplicationSubmission: vi.fn(),
    createClientQuery: vi.fn(),
    getCibilRateMatrix: vi.fn(),
    getCibilChances: vi.fn(),
    proceedSevenOne: vi.fn(),
  },
}));

vi.mock('../PostSubmitEngineFlow', () => ({
  PostSubmitEngineFlow: () => <div data-testid="post-submit-engine-flow" />,
}));

vi.mock('../../../lib/postSubmitEngine/rejectOnCreditFail', () => ({
  writeApplicationRejectedOnCreditFail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/engineClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/engineClient')>();
  return {
    ...actual,
    qualifyApplicant: vi.fn(),
    lookupBureauCacheByPan: vi.fn(),
    airtableWrite: vi.fn().mockResolvedValue({}),
    airtableGet: vi.fn(),
    ENGINE_BASE_ID: 'appzbyi8q7pJRl1cd',
  };
});

const fireEventOverride = vi.hoisted(() => ({
  current: null as
    | null
    | ((
        event: string,
        input: { formData: Record<string, unknown> }
      ) => Promise<Record<string, unknown>>),
}));

vi.mock('../../../lib/crmEvents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/crmEvents')>();
  return {
    ...actual,
    fireEvent: (
      event: string,
      input: { formData: Record<string, unknown> }
    ) => {
      if (fireEventOverride.current) return fireEventOverride.current(event, input);
      return actual.fireEvent(event as never, input as never);
    },
  };
});

vi.mock('../../../lib/lenderBrePricing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/lenderBrePricing')>();
  return {
    ...actual,
    getPricing: vi.fn().mockResolvedValue({
      rule_id: 7,
      nbfc_partner: 'Fintree',
      roi_pct: 28,
      pf_pct: 6.75,
      eligible: true,
    }),
  };
});

const defaultQualifyPass = {
  ok: true,
  pass: true,
  is_ntc: false,
  kill_code: null,
  failed: [],
  missing: [],
  bureau_ref: 'AL-TEST',
  cached: false,
  applicant: {
    name: 'RAHUL GONSALVES',
    dob: '1993-04-07',
    pan: 'BAIPG3083L',
    mobile: '9687599179',
    email: 'rahul@example.com',
    gender: 'Male',
    addresses: [
      {
        line1: '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar',
        line2: null,
        line3: null,
        city: 'Bhavnagar',
        state_code: '24',
        pin: '364002',
      },
    ],
  },
};

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

/** Product Next runs bureau + lender-find and stays; second Next advances. */
const advancePastSection1 = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId('b2c-wizard-next'));
  await waitFor(() => {
    expect(screen.getByTestId('finding-lender-panel')).toHaveTextContent(/Lender found/i);
  });
  await user.click(screen.getByTestId('b2c-wizard-next'));
};

/** Qualify applicant does not include fatherName/district — fill required leftovers. */
const completeBorrowerMissingRequired = async (
  user: ReturnType<typeof userEvent.setup>
) => {
  await waitFor(() => {
    expect(screen.getByTestId('b2c-field-borrower-firstName')).toBeInTheDocument();
  });
  const father = screen.getByTestId('b2c-field-borrower-fatherName') as HTMLInputElement;
  if (!father.value) await user.type(father, 'JOSEPH GONSALVES');
  const district = screen.getByTestId(
    'b2c-field-borrower-address-district'
  ) as HTMLInputElement;
  if (!district.value) await user.type(district, 'Bhavnagar');
};

const fillAndFreezeLoanStage = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => {
    expect(screen.getByTestId('loan-calc-preview-rate')).toHaveTextContent(/% p\.a\./);
  });
  await user.type(screen.getByTestId('loan-calc-vehicle-price'), '100000');
  await user.selectOptions(screen.getByTestId('loan-calc-gst-rate'), '0.05');
  await user.type(screen.getByTestId('loan-calc-insurance'), '2000');
  await user.type(screen.getByTestId('loan-calc-registration'), '1000');
  await user.type(screen.getByTestId('loan-calc-accessories'), '1000');
  await user.type(screen.getByTestId('loan-calc-customer-payment'), '20000');
  await waitFor(() => {
    const tenureSelect = screen.getByTestId('loan-calc-tenure') as HTMLSelectElement;
    expect(Array.from(tenureSelect.options).map((option) => option.value)).toEqual([
      '12',
      '18',
      '24',
    ]);
  });
  await user.selectOptions(screen.getByTestId('loan-calc-tenure'), '18');
  await user.click(screen.getByTestId('loan-calc-freeze'));
};

describe('B2CEvApplicationWizard submit gating', () => {
  beforeEach(() => {
    fireEventOverride.current = null;
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
    (apiService.getFormConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValue(defaultQualifyPass);
    (lookupBureauCacheByPan as ReturnType<typeof vi.fn>).mockResolvedValue(null);
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
    (apiService.getCibilRateMatrix as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        { start_cibil: 0, end_cibil: 900, pf_pct: 8, roi_pct: 35, band_label: 'Default' },
      ],
    });
    (apiService.getCibilChances as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { score: 67, label: 'High Chance' },
    });
    (apiService.proceedSevenOne as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { newStatus: 'seven_one' },
    });
    (airtableGet as ReturnType<typeof vi.fn>).mockImplementation(async (input: { table?: string }) => {
      if (input.table === 'Lenders') {
        return {
          ok: true,
          count: 1,
          records: [
            {
              name: 'Fintree',
              status: 'active',
              min_ticket: 50000,
              max_ticket: 150000,
              tenure_months: '12,18,24',
            },
          ],
        };
      }
      return { ok: true, count: 0, records: [] };
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

  it('uppercases step-1 Full Name and PAN as typed and sends them to qualify', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId('b2c-loan-product-select'), 'LP001');
    await user.type(screen.getByTestId('b2c-field-_meta-panLookup-mobileNumber'), '7355621712');
    await user.type(screen.getByTestId('b2c-field-_meta-panLookup-panNumber'), 'hsjpp5704a');
    await user.type(screen.getByTestId('b2c-field-_meta-panLookup-fullName'), 'govind pandey');

    expect(screen.getByTestId('b2c-field-_meta-panLookup-panNumber')).toHaveValue('HSJPP5704A');
    expect(screen.getByTestId('b2c-field-_meta-panLookup-fullName')).toHaveValue('GOVIND PANDEY');
    expect(screen.getByTestId('b2c-field-_meta-panLookup-panNumber')).toHaveAttribute(
      'autocapitalize',
      'characters'
    );
    expect(screen.getByTestId('b2c-field-_meta-panLookup-fullName')).toHaveAttribute(
      'autocapitalize',
      'characters'
    );

    await advancePastSection1(user);

    await waitFor(() => {
      expect(qualifyApplicant).toHaveBeenCalled();
    });
    const payload = (qualifyApplicant as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(payload.PAN_Number || payload.pan).toBe('HSJPP5704A');
    expect(payload.Full_Name || payload.name).toBe('GOVIND PANDEY');
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

  it('advances to manual borrower profile when qualify has no applicant details', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      pass: true,
      bureau_ref: 'AL-EMPTY',
      applicant: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);

    await waitFor(() => {
      expect(screen.getByTestId('borrower-pan-manual-message')).toBeInTheDocument();
    });

    expect(screen.getByTestId('borrower-pan-manual-message')).toHaveTextContent(
      /No details found, please enter manually/i
    );
    expect(screen.getByTestId('b2c-field-borrower-firstName')).toHaveValue('RAHUL');
    expect(screen.getByTestId('b2c-field-borrower-lastName')).toHaveValue('YADAV');
    expect(screen.getByTestId('b2c-field-borrower-pan')).toHaveValue('BAIPG3083L');
    expect(screen.getByTestId('b2c-field-borrower-mobile')).toHaveValue('9687599179');
    expect(qualifyApplicant).toHaveBeenCalled();
    expect(lookupBureauCacheByPan).not.toHaveBeenCalled();
  });

  it('autofills borrower profile and address from qualify applicant', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);

    await waitFor(() => {
      expect(qualifyApplicant).toHaveBeenCalled();
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
    expect(screen.queryByTestId('borrower-bureau-address-select')).not.toBeInTheDocument();
    expect(lookupBureauCacheByPan).not.toHaveBeenCalled();
  });

  it('lets the borrower pick a second bureau address', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...defaultQualifyPass,
      applicant: {
        ...defaultQualifyPass.applicant,
        addresses: [
          ...defaultQualifyPass.applicant.addresses,
          {
            line1: '88 Lake Road',
            line2: null,
            line3: null,
            city: 'Madurai',
            state_code: '33',
            pin: '625001',
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);

    await waitFor(() => {
      expect(screen.getByTestId('borrower-bureau-address-select')).toBeInTheDocument();
    });
    expect(screen.getByTestId('b2c-field-borrower-address-line1')).toHaveValue(
      '107, Villa De Flores, Catholic Society, Vidhyanagar, Bhavnagar'
    );

    await user.selectOptions(screen.getByTestId('borrower-bureau-address-select'), '1');

    expect(screen.getByTestId('b2c-field-borrower-address-line1')).toHaveValue('88 Lake Road');
    expect(screen.getByTestId('b2c-field-borrower-address-village')).toHaveValue('Madurai');
    expect(screen.getByTestId('b2c-field-borrower-address-pincode')).toHaveValue('625001');
    expect(screen.getByTestId('b2c-field-borrower-address-state')).toHaveValue('Tamil Nadu');
  });

  it('shows Finding a lender panel then advances; never shows chances bar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('finding-lender-panel')).toHaveTextContent(/Lender found/i);
    });
    expect(qualifyApplicant).toHaveBeenCalled();
    expect(screen.queryByTestId('cibil-probability-bar')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('cibil-probability-bar')).not.toBeInTheDocument();
  });

  it('still opens borrower details after a lender is found and the CRM write returns', async () => {
    let releaseCrm: (() => void) | undefined;
    const crmGate = new Promise<void>((resolve) => {
      releaseCrm = resolve;
    });
    fireEventOverride.current = async (_event, input) => {
      const snapshot = { ...input.formData };
      await crmGate;
      return {
        ...snapshot,
        '_meta.crm': { sent: [{ id: 'evt-1' }], pending: [] },
      };
    };

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('finding-lender-panel')).toHaveTextContent(/Lender found/i);
    });

    await act(async () => {
      releaseCrm?.();
      await crmGate;
      await Promise.resolve();
      await Promise.resolve();
    });

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/must be verified on the Loan Product step/i)
    ).not.toBeInTheDocument();
  });

  it('loads borrower details when Borrower opens without a saved PAN flag', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-pan-open&stage=borrower'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);
    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-pan-open',
        status: 'draft',
        loanProduct: 'LP001',
        formData: {
          ...createInitialB2cEvFormData(),
          '_meta.panLookup.mobileNumber': '9687599179',
          '_meta.panLookup.panNumber': 'BAIPG3083L',
          '_meta.panLookup.fullName': 'RAHUL GONSALVES',
          '_meta.panLookup.status': 'pending',
          '_meta.wizard.lastStageId': 'borrower',
        },
      },
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/must be verified on the Loan Product step/i)
    ).not.toBeInTheDocument();
  });

  it('advances past score-only null kill (Engine score gap) when applicant present', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...defaultQualifyPass,
      pass: false,
      kill_code: 'KILLED',
      failed: [{ parameter: 'score' }],
      bureau_ref: 'AL-govind',
    });
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toHaveValue('RAHUL');
    });
    expect(screen.queryByText(/Cannot proceed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/below minimum/i)).not.toBeInTheDocument();
  });

  it('hard-rejects with expandable +N reasons and greys remaining steps', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      pass: false,
      failed: [
        { rejection_code: 'CC_OVERDUE_GT_5000' },
        { rejection_code: 'DPD_FOUND_IN_LAST_3M' },
        { rejection_code: 'DPD_FOUND_IN_LAST_6M' },
        { rejection_code: 'OVERDUE_FOUND_IN_LAST_12M' },
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('finding-lender-panel')).toHaveTextContent(/Rejected/i);
    });
    expect(screen.getByTestId('qualify-overflow-chip')).toHaveTextContent('+2');
    expect(screen.queryByTestId('qualify-overflow-list')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('qualify-overflow-chip'));
    expect(screen.getByTestId('qualify-overflow-list')).toBeInTheDocument();

    expect(screen.getByTestId('b2c-wizard-next')).toBeDisabled();
    expect(screen.getByTestId('b2c-stepper-step-borrower')).toBeDisabled();
    expect(screen.getByTestId('b2c-stepper-step-borrower').className).toMatch(/opacity-45/);
  });

  it('advances when new to credit also fails the score floor', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...defaultQualifyPass,
      pass: false,
      kill_code: 'KILLED',
      failed: [
        { parameter: 'ntc', rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
        { parameter: 'score', rejection_code: 'CIBIL_BELOW_680' },
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('finding-lender-panel')).toHaveTextContent(
        /Lender path available/i
      );
    });
    expect(screen.queryByText(/Rejected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lending criteria/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('b2c-wizard-next')).toBeEnabled();

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-borrower-firstName')).toBeInTheDocument();
    });
  });

  it('allows editing autofilled borrower fields and recomputes customer name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);

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

  it('shows gender select placeholder when qualify applicant omits gender', async () => {
    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      pass: true,
      bureau_ref: 'AL-TEST',
      applicant: {
        name: 'RAHUL GONSALVES',
        dob: null,
        email: null,
        gender: null,
        addresses: [],
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);

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
    await advancePastSection1(user);
    await completeBorrowerMissingRequired(user);

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await fillAndFreezeLoanStage(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-dealer-id')).toHaveValue('SFDLR11030');
    });

    expect(screen.getByTestId('b2c-field-dealer-tradeName')).toHaveValue('Ajay Enterprises');
    expect(screen.getByTestId('b2c-field-dealer-contact')).toHaveValue('7905835489');
  });

  it('shows why Next did not advance when loan values are not frozen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);
    await completeBorrowerMissingRequired(user);

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('loan-calculator')).toBeInTheDocument();
    });

    await waitFor(() => {
      const tenureSelect = screen.getByTestId('loan-calc-tenure') as HTMLSelectElement;
      expect(Array.from(tenureSelect.options).map((option) => option.value)).toEqual([
        '12',
        '18',
        '24',
      ]);
    });

    await user.click(screen.getByTestId('b2c-wizard-next'));

    expect(screen.getByTestId('b2c-step-advance-blocker')).toHaveTextContent(
      /Freeze Values/i
    );
    expect(screen.getByTestId('loan-calculator')).toBeInTheDocument();
  });

  it(
    'verifies co-applicant via qualify (not Bureau Cache) and advances to geo photos',
    async () => {
    (apiService.getClientKyc as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        clientId: 'USER-1',
        displayLabel: 'Dealer',
        formDataPatch: {
          'dealer.id': 'SFDLR11030',
          'dealer.displayLabel': 'Ajay Enterprises',
          'dealer.tradeName': 'Ajay Enterprises',
          'dealer.name': 'Ajay Enterprises',
          'dealer.contact': '7905835489',
          'dealer.email': 'dealer@example.com',
          'dealer.gstNumber': '09BMCPG4250M1ZY',
          'dealer.pan': 'BMCPG4250M',
          'dealer.ifscCode': 'HDFC0001885',
        },
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);
    await completeBorrowerMissingRequired(user);

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await fillAndFreezeLoanStage(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-dealer-id')).toHaveValue('SFDLR11030');
    });

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('support-person-co_applicant')).toBeInTheDocument();
    });

    (qualifyApplicant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      pass: true,
      bureau_ref: 'AL-CO',
      cached: true,
      failed: [],
      applicant: {
        name: 'PRIYA SHARMA',
        dob: '1992-02-02',
        pan: 'FGHIJ5678K',
        mobile: '9876543211',
        email: 'priya@example.com',
        gender: 'Female',
        addresses: [
          {
            line1: '12 Main Street',
            line2: null,
            line3: null,
            city: 'Delhi',
            state_code: '07',
            pin: '110001',
          },
        ],
      },
    });

    await user.click(screen.getByTestId('support-person-co_applicant'));
    await user.type(screen.getByTestId('b2c-field-_meta-supportPanLookup-mobileNumber'), '9876543211');
    await user.type(screen.getByTestId('b2c-field-_meta-supportPanLookup-panNumber'), 'FGHIJ5678K');
    await user.type(screen.getByTestId('b2c-field-_meta-supportPanLookup-fullName'), 'PRIYA SHARMA');
    await user.click(screen.getByTestId('b2c-support-bureau-consent'));
    await user.click(screen.getByTestId('b2c-support-pan-verify'));

    await waitFor(() => {
      expect(screen.getByTestId('support-bureau-pass')).toBeInTheDocument();
    });

    expect(qualifyApplicant).toHaveBeenCalled();
    const lastCall = (qualifyApplicant as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      Full_Name: 'Priya Sharma',
      Mobile_Number: '9876543211',
      PAN_Number: 'FGHIJ5678K',
    });
    expect(lastCall).toHaveProperty('consent_bureau_at');
    expect(lookupBureauCacheByPan).not.toHaveBeenCalled();

    expect(screen.getByTestId('b2c-field-coApplicant-name')).toHaveValue('PRIYA SHARMA');
    expect(screen.getByTestId('b2c-field-coApplicant-dob')).toHaveValue('1992-02-02');
    expect(screen.getByTestId('b2c-field-coApplicant-address-state')).toHaveValue('Delhi');

    await user.type(screen.getByTestId('b2c-field-coApplicant-address-district'), 'Delhi');
    await user.type(screen.getByTestId('b2c-field-coApplicant-drivingLicense'), 'DL654321');
    await user.selectOptions(screen.getByTestId('b2c-field-coApplicant-relationship'), 'Spouse');

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-stepper-step-geo-photos')).toBeInTheDocument();
    });
  },
    30000
  );

  it('does not show Submit until the last step', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await advancePastSection1(user);
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

  it('does not auto-save draft after debounced field edit', async () => {
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

      expect(apiService.createApplication).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not persist Express draft on Next after product qualify (non-rec id)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toBeInTheDocument();
    });

    await fillStageOne(user);
    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(qualifyApplicant).toHaveBeenCalled();
      expect(screen.getByTestId('finding-lender-panel')).toHaveTextContent(/Lender found/i);
    });

    expect(apiService.createApplication).not.toHaveBeenCalled();
    expect(apiService.updateApplicationForm).not.toHaveBeenCalled();
  });

  it('falls back to createApplication when updateApplicationForm returns Application not found', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-1'),
      vi.fn(),
    ] as const);
    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-1',
        status: 'draft',
        loanProduct: 'LP001',
        formData: {
          ...createInitialB2cEvFormData(),
          '_meta.formTemplate': 'b2c_ev_v1',
        },
      },
    });
    (apiService.updateApplicationForm as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Application not found',
    });
    (apiService.createApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { loanApplicationId: 'draft-1', fileId: 'SF001' },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-_meta-panLookup-mobileNumber')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(apiService.updateApplicationForm).toHaveBeenCalled();
      expect(apiService.createApplication).toHaveBeenCalled();
    });
  }, 10000);

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
    (apiService.createClientQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { queryId: 'QUERY-VKYC-1' },
    });

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
      expect(apiService.createClientQuery).toHaveBeenCalledWith(
        'draft-geo',
        expect.objectContaining({
          requestKind: 'b2c_compliance',
          itemId: 'vkyc',
        })
      );
      expect(apiService.updateApplicationForm).toHaveBeenCalledWith(
        'draft-geo',
        expect.objectContaining({
          '_meta.kamRequests.vkyc.requestedAt': expect.any(String),
          '_meta.kamRequests.vkyc.queryId': 'QUERY-VKYC-1',
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
      'compliance.vkycDone': 'true',
      'compliance.loanAgreementSigned': 'true',
      'compliance.enachDone': 'true',
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
    (apiService.createClientQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { queryId: 'QUERY-DO-1' },
    });

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
      expect(apiService.createClientQuery).toHaveBeenCalledWith(
        'draft-geo',
        expect.objectContaining({ requestKind: 'b2c_do' })
      );
      expect(apiService.updateApplicationForm).toHaveBeenCalledWith(
        'draft-geo',
        expect.objectContaining({
          '_meta.doRequest.requestedAt': expect.any(String),
          '_meta.doRequest.queryId': 'QUERY-DO-1',
        })
      );
      expect(screen.getByTestId('b2c-step-advance-blocker')).toHaveTextContent(
        /Insurance and Vehicle will unlock after the DO is processed/i
      );
    });
  });

  it('keeps insurance and vehicle locked until KAM fulfills DO', async () => {
    const completeFormData = {
      ...createInitialB2cEvFormData(),
      '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
    };

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('draftId=draft-locked&b2cEv=1'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-locked',
        status: 'draft',
        applicantName: 'RAHUL GONSALVES',
        loanProduct: 'LP001',
        formData: completeFormData,
      },
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-stepper-step-insurance')).toBeInTheDocument();
    });

    expect(screen.getByTestId('b2c-stepper-step-insurance')).toBeDisabled();
  });

  it('shows Continue to Insurance and advances after KAM fulfills DO', async () => {
    const completeFormData = {
      ...createInitialB2cEvFormData(),
      '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
      '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z',
      '_meta.doRequest.status': 'approved',
      'compliance.vkycDone': 'true',
      'compliance.loanAgreementSigned': 'true',
      'compliance.enachDone': 'true',
      'geoPhotos.withSupportPerson.url': 'https://cdn.example.com/with-support.jpg',
      'geoPhotos.withSupportPerson.latitude': '21.17',
      'geoPhotos.withSupportPerson.longitude': '72.83',
      'geoPhotos.withVehicle.url': 'https://cdn.example.com/with-vehicle.jpg',
      'geoPhotos.withVehicle.latitude': '21.17',
      'geoPhotos.withVehicle.longitude': '72.83',
      'geoPhotos.atResidence.url': 'https://cdn.example.com/at-residence.jpg',
      'geoPhotos.atResidence.latitude': '21.17',
      'geoPhotos.atResidence.longitude': '72.83',
    };

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('draftId=draft-do-fulfilled&b2cEv=1&stage=geo-photos'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-do-fulfilled',
        status: 'draft',
        applicantName: 'RAHUL GONSALVES',
        loanProduct: 'LP001',
        formData: completeFormData,
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-wizard-next')).toBeInTheDocument();
    });

    expect(screen.getByTestId('b2c-wizard-next')).toHaveTextContent('Continue to Insurance');
    expect(screen.queryByTestId('b2c-wizard-request-do')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-insurance-cost')).toBeInTheDocument();
    });
  });

  it('stays on Insurance after advancing when URL still has stage=geo-photos', async () => {
    const completeFormData = {
      ...createInitialB2cEvFormData(),
      '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z',
      '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z',
      '_meta.doRequest.status': 'approved',
      'compliance.vkycDone': 'true',
      'compliance.loanAgreementSigned': 'true',
      'compliance.enachDone': 'true',
      'geoPhotos.withSupportPerson.url': 'https://cdn.example.com/with-support.jpg',
      'geoPhotos.withSupportPerson.latitude': '21.17',
      'geoPhotos.withSupportPerson.longitude': '72.83',
      'geoPhotos.withVehicle.url': 'https://cdn.example.com/with-vehicle.jpg',
      'geoPhotos.withVehicle.latitude': '21.17',
      'geoPhotos.withVehicle.longitude': '72.83',
      'geoPhotos.atResidence.url': 'https://cdn.example.com/at-residence.jpg',
      'geoPhotos.atResidence.latitude': '21.17',
      'geoPhotos.atResidence.longitude': '72.83',
    };

    const urlParams = new URLSearchParams('draftId=draft-do-fulfilled&b2cEv=1&stage=geo-photos');
    const setSearchParams = vi.fn(
      (updater: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) => {
        const next =
          typeof updater === 'function' ? updater(urlParams) : updater;
        for (const key of [...urlParams.keys()]) {
          urlParams.delete(key);
        }
        next.forEach((value, key) => urlParams.set(key, value));
      }
    );

    mockUseSearchParams.mockReturnValue([urlParams, setSearchParams] as ReturnType<
      typeof mockUseSearchParams
    >);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-do-fulfilled',
        status: 'draft',
        applicantName: 'RAHUL GONSALVES',
        loanProduct: 'LP001',
        formData: completeFormData,
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-wizard-next')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('b2c-wizard-next'));

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-insurance-cost')).toBeInTheDocument();
    });

    const insuranceCost = screen.getByTestId('b2c-field-insurance-cost');
    await user.type(insuranceCost, '5000');

    await waitFor(() => {
      expect(screen.getByTestId('b2c-field-insurance-cost')).toBeInTheDocument();
      expect(screen.queryByTestId('b2c-field-geoPhotos-withSupportPerson-url')).not.toBeInTheDocument();
    });

    expect(urlParams.get('stage')).toBe('insurance');
  });
});

describe('B2CEvApplicationWizard productId query param', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue([new URLSearchParams('b2cEv=1'), vi.fn()] as const);
    (apiService.listLoanProducts as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        { productId: 'LP001', productName: 'EV Loan' },
        { productId: 'LP012', productName: 'EV Fleet Loan' },
      ],
    });
    (apiService.getClientKyc as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Not found',
    });
    (apiService.getFormConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });
    (apiService.createApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { loanApplicationId: 'draft-1', fileId: 'draft-1' },
    });
    (apiService.updateApplicationForm as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    window.alert = vi.fn();
  });

  it('pre-selects loan product from ?productId=', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&productId=LP012'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toHaveValue('LP012');
    });
  });

  it('draft product wins over ?productId= when draftId is present', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-override&productId=LP012'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-override',
        status: 'draft',
        applicantName: 'DRAFT USER',
        loanProduct: 'LP001',
        requestedLoanAmount: '0',
        formData: createInitialB2cEvFormData(),
      },
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(apiService.getApplication).toHaveBeenCalledWith('draft-override');
    });

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toHaveValue('LP001');
    });
  });

  it('hydrates loan_product_id from Loan Product + formData.productId and lets Request DO proceed', async () => {
    (apiService.listLoanProducts as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        { productId: 'LP001', productName: 'EV Loan' },
        { productId: 'LP012', productName: 'B2C EV' },
      ],
    });

    const uploads = {
      pan_card: { url: 'https://cdn.example.com/pan.jpg', filename: 'pan.jpg' },
      aadhaar_front: { url: 'https://cdn.example.com/af.jpg', filename: 'af.jpg' },
      aadhaar_back: { url: 'https://cdn.example.com/ab.jpg', filename: 'ab.jpg' },
      passport_photo: { url: 'https://cdn.example.com/photo.jpg', filename: 'photo.jpg' },
      co_applicant_pan: { url: 'https://cdn.example.com/co_pan.jpg', filename: 'co_pan.jpg' },
      co_applicant_aadhaar: {
        url: 'https://cdn.example.com/co_aadhaar.jpg',
        filename: 'co_aadhaar.jpg',
      },
    };

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-lp012-hydrate&stage=kyc-documents'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-lp012-hydrate',
        status: 'draft',
        applicantName: 'GOVIND PANDEY',
        // Express shape — no camelCase loanProduct
        'Loan Product': 'LP012',
        'File ID': 'SFMWHK65WO',
        requestedLoanAmount: '111725',
        formData: {
          ...createInitialB2cEvFormData(),
          productId: 'LP012',
          '_meta.fileId': 'SFMWHK65WO',
          '_meta.supportPersonType': 'co_applicant',
          '_meta.vkyc.status': 'Done',
          '_meta.kycDocuments.uploads': uploads,
          'coApplicant.pan': 'KMPPS3552C',
          'borrower.customerName': 'GOVIND PANDEY',
          'borrower.mobile': '7355621712',
        },
      },
    });

    (airtableGet as ReturnType<typeof vi.fn>).mockImplementation(async (input: { table?: string }) => {
      if (input.table === 'VKYC Links') {
        return {
          ok: true,
          count: 1,
          records: [
            {
              id: 'recVkyc1',
              file_id: 'SFMWHK65WO',
              status: 'Done',
              link: 'https://meet.google.com/test-link',
            },
          ],
        };
      }
      return { ok: true, count: 0, records: [] };
    });

    (apiService.createClientQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { queryId: 'QUERY-DO-HYDRATE' },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(apiService.getApplication).toHaveBeenCalledWith('draft-lp012-hydrate');
    });

    // Save draft stays disabled until loan_product_id is hydrated (= LP012).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('kyc-documents-step')).toBeInTheDocument();
      expect(screen.getByTestId('kyc-doc-pan_card')).toHaveTextContent(/pan\.jpg/i);
      expect(screen.getByText(/Video KYC complete/i)).toBeInTheDocument();
      expect(screen.getByTestId('b2c-wizard-request-do')).toBeEnabled();
    });

    await user.click(screen.getByTestId('b2c-wizard-request-do'));

    await waitFor(() => {
      expect(apiService.createClientQuery).toHaveBeenCalledWith(
        'draft-lp012-hydrate',
        expect.objectContaining({ requestKind: 'b2c_do' })
      );
      expect(apiService.updateApplicationForm).toHaveBeenCalledWith(
        'draft-lp012-hydrate',
        expect.objectContaining({ loan_product_id: 'LP012' })
      );
    });

    expect(screen.queryByText(/Please select a loan product before saving/i)).not.toBeInTheDocument();
  });

  it('Express-miss path hydrates loan_product_id from Loan Product and productId', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=recExpressMissProduct'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Draft not found',
    });

    (airtableGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      count: 1,
      records: [
        {
          id: 'recExpressMissProduct',
          'Loan Product': 'LP012',
          'File ID': 'SFMISS01',
          'Form Data': JSON.stringify({
            ...createInitialB2cEvFormData(),
            productId: 'LP012',
          }),
        },
      ],
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(airtableGet).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('b2c-loan-product-select')).toHaveValue('LP012');
    });
  });

  it('hydrates applicant_name from Applicant Name and borrower.customerName', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-name-hydrate'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-name-hydrate',
        status: 'draft',
        // Airtable-shaped — no applicant_name / applicantName
        'Applicant Name': 'GOVIND PANDEY',
        'Loan Product': 'LP012',
        formData: {
          ...createInitialB2cEvFormData(),
          productId: 'LP012',
          // no borrower.customerName — must resolve via Applicant Name
        },
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(apiService.updateApplicationForm).toHaveBeenCalledWith(
        'draft-name-hydrate',
        expect.objectContaining({ applicant_name: 'GOVIND PANDEY' })
      );
    });
  });

  it('hydrates requested_loan_amount from Requested Loan Amount and loan.amount', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-amount-hydrate'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-amount-hydrate',
        status: 'draft',
        applicantName: 'GOVIND PANDEY',
        'Loan Product': 'LP012',
        // Airtable-shaped — no requested_loan_amount / requestedLoanAmount
        'Requested Loan Amount': 111725,
        formData: {
          ...createInitialB2cEvFormData(),
          productId: 'LP012',
          'borrower.customerName': 'GOVIND PANDEY',
          // no loan.amount — must resolve via Requested Loan Amount
        },
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(apiService.updateApplicationForm).toHaveBeenCalledWith(
        'draft-amount-hydrate',
        expect.objectContaining({ requested_loan_amount: '111725' })
      );
    });
  });

  it('hydrates _meta.fileId from File ID / fileId when form_data omits it', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-fileid-hydrate'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-fileid-hydrate',
        status: 'draft',
        applicantName: 'GOVIND PANDEY',
        'Loan Product': 'LP012',
        'File ID': 'SFMWHK65WO',
        fileId: 'SFMWHK65WO',
        formData: {
          ...createInitialB2cEvFormData(),
          productId: 'LP012',
          'borrower.customerName': 'GOVIND PANDEY',
          // intentionally no _meta.fileId
        },
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(apiService.updateApplicationForm).toHaveBeenCalledWith(
        'draft-fileid-hydrate',
        expect.objectContaining({ '_meta.fileId': 'SFMWHK65WO' })
      );
    });
  });

  it('opens the saved borrower stage instead of eNACH when continue editing a ranked file', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-enach-jump'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-enach-jump',
        status: 'draft',
        applicantName: 'GOVIND PANDEY',
        loanProduct: 'LP012',
        formData: {
          ...createInitialB2cEvFormData(),
          productId: 'LP012',
          '_meta.fileId': 'SFMWHK65WO',
          '_meta.wizard.lastStageId': 'borrower',
          '_meta.postSubmitFlags': { rankStarted: true },
          '_meta.postSubmitPhase': 'post_offer',
          '_meta.pricing': { roi_pct: 28 },
          'borrower.customerName': 'GOVIND PANDEY',
          'borrower.firstName': 'GOVIND',
          'loan.amount': '111725',
        },
      },
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    expect(await screen.findByRole('button', { name: /go back to loan product/i })).toBeInTheDocument();
    expect(screen.queryByTestId('post-submit-engine-flow')).not.toBeInTheDocument();
  });

  it('opens the last filled loan stage for an older file with no saved stage', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-old-loan'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-old-loan',
        status: 'draft',
        applicantName: 'GOVIND PANDEY',
        loanProduct: 'LP012',
        formData: {
          ...createInitialB2cEvFormData(),
          productId: 'LP012',
          '_meta.fileId': 'SFMWHK65WO',
          '_meta.postSubmitFlags': { rankStarted: true },
          '_meta.postSubmitPhase': 'post_offer',
          '_meta.pricing': { roi_pct: 28 },
          'borrower.customerName': 'GOVIND PANDEY',
          'loan.amount': '111725',
        },
      },
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    expect(await screen.findByTestId('loan-calculator-stage1')).toBeInTheDocument();
    expect(screen.queryByTestId('post-submit-engine-flow')).not.toBeInTheDocument();
  });

  it('opens KYC for an older priced draft that has two uploads and no saved stage', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-old-partial'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-old-partial',
        status: 'draft',
        applicantName: 'GOVIND PANDEY',
        loanProduct: 'LP012',
        formData: {
          ...createInitialB2cEvFormData(),
          productId: 'LP012',
          '_meta.fileId': 'SFMWHK65WO',
          '_meta.pricing': { roi_pct: 28, pf_pct: 6.75, rule_id: 7 },
          '_meta.postSubmitPhase': 'post_offer',
          '_meta.kycDocuments.uploads': {
            pan_card: { url: 'https://cdn.example/pan.jpg', filename: 'pan.jpg' },
            aadhaar_front: { url: 'https://cdn.example/aadhaar.jpg', filename: 'aadhaar.jpg' },
          },
        },
      },
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    expect(await screen.findByTestId('kyc-documents-step')).toBeInTheDocument();
    expect(screen.queryByTestId('post-submit-engine-flow')).not.toBeInTheDocument();
  });

  it('stays on KYC when a priced draft has only two uploads', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('b2cEv=1&draftId=draft-partial-kyc&stage=kyc-documents'),
      vi.fn(),
    ] as ReturnType<typeof mockUseSearchParams>);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-partial-kyc',
        status: 'draft',
        applicantName: 'GOVIND PANDEY',
        loanProduct: 'LP012',
        formData: {
          ...createInitialB2cEvFormData(),
          productId: 'LP012',
          '_meta.fileId': 'SFMWHK65WO',
          '_meta.wizard.lastStageId': 'kyc-documents',
          '_meta.pricing': { roi_pct: 28, pf_pct: 6.75, rule_id: 7 },
          '_meta.postSubmitPhase': 'post_offer',
          '_meta.kycDocuments.uploads': {
            pan_card: { url: 'https://cdn.example/pan.jpg', filename: 'pan.jpg' },
            aadhaar_front: { url: 'https://cdn.example/aadhaar.jpg', filename: 'aadhaar.jpg' },
          },
        },
      },
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    expect(await screen.findByTestId('kyc-documents-step')).toBeInTheDocument();
    expect(screen.queryByTestId('post-submit-engine-flow')).not.toBeInTheDocument();
  });

  it('opens stamps and clears a stale wizard stage when all three documents exist', async () => {
    const urlParams = new URLSearchParams('b2cEv=1&draftId=draft-stamps&stage=support-person');
    const setSearchParams = vi.fn(
      (updater: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) => {
        const next = typeof updater === 'function' ? updater(urlParams) : updater;
        for (const key of [...urlParams.keys()]) urlParams.delete(key);
        next.forEach((value, key) => urlParams.set(key, value));
      }
    );
    mockUseSearchParams.mockReturnValue([urlParams, setSearchParams] as ReturnType<
      typeof mockUseSearchParams
    >);

    (apiService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        id: 'draft-stamps',
        status: 'draft',
        applicantName: 'GOVIND PANDEY',
        loanProduct: 'LP012',
        formData: {
          ...createInitialB2cEvFormData(),
          '_meta.fileId': 'SFMWHK65WO',
          '_meta.docs.sanctionLetter': 'https://cdn.example/sanction.pdf',
          '_meta.docs.loanAgreement': 'https://cdn.example/agreement.pdf',
          '_meta.docs.ckyc': 'https://cdn.example/ckyc.pdf',
        },
      },
    });

    renderWithProviders(<B2CEvApplicationWizard />);

    await waitFor(() => {
      expect(screen.getByTestId('post-submit-engine-flow')).toBeInTheDocument();
    });
    expect(urlParams.get('stage')).toBeNull();
    expect(urlParams.get('step')).toBeNull();
    expect(screen.queryByTestId('support-person-co_applicant')).not.toBeInTheDocument();
  });
});
