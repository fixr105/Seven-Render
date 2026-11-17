import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { PostSubmitEngineFlow } from '../PostSubmitEngineFlow';
import { renderWithProviders } from '../../../test/helpers';
import * as engineClient from '../../../services/engineClient';
import { calculateEmi, roundRupee } from '../../../lib/loanCalculator';
import * as lenderBrePricing from '../../../lib/lenderBrePricing';

vi.mock('../../../services/engineClient', async () => {
  const actual = await vi.importActual<typeof import('../../../services/engineClient')>(
    '../../../services/engineClient'
  );
  return {
    ...actual,
    qualifyApplicant: vi.fn(),
    airtableGet: vi.fn(),
    airtableWrite: vi.fn().mockResolvedValue({ ok: true }),
    multiLenderRank: vi.fn(),
    uploadFileToUrl: vi.fn(),
    fillSanctionLetter: vi.fn(),
    fillLoanAgreement: vi.fn(),
    fillCkyc: vi.fn(),
  };
});

vi.mock('../../../lib/kycRequiredDocs', () => ({
  areRequiredKycDocsUploaded: () => true,
  hasCompletedWizardKycDocuments: () => false,
}));

vi.mock('../../../lib/lenderBrePricing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/lenderBrePricing')>();
  return {
    ...actual,
    getPricing: vi.fn(),
  };
});

const PASS = {
  ok: true,
  pass: true,
  score: 750,
  bureau_ref: 'AL-OFFERS',
  is_ntc: false,
  failed: [],
  applicant: {
    name: 'GOVIND PANDEY',
    pan: 'HSJPP5704A',
    mobile: '7355621712',
  },
};

const FROZEN_FORM = {
  'borrower.customerName': 'GOVIND PANDEY',
  'borrower.pan': 'HSJPP5704A',
  'borrower.mobile': '7355621712',
  'borrower.email': 'govind@example.com',
  productId: 'LP012',
  'loan.amount': '111725',
  'loan.tenureMonths': '18',
  '_meta.kycDocuments.documentsString': 'pan_card:https://x/p.jpg|p.jpg',
};

const LENDER_ROW = {
  id: 'recLender1',
  name: 'Fintree',
  status: 'active',
  min_ticket: 50000,
  max_ticket: 150000,
  roi_pct: 99,
  pf_pct: 99,
  tenure_months: '12,18,24',
};

const PRICING_OK = {
  rule_id: 7,
  nbfc_partner: 'Fintree',
  roi_pct: 28,
  pf_pct: 6.75,
  eligible: true as const,
};

function mockAirtableForOffers(lenders: Record<string, unknown>[] = [LENDER_ROW]) {
  vi.mocked(engineClient.airtableGet).mockImplementation(async (input: { table?: string }) => {
    if (input.table === 'Lenders') {
      return { ok: true, count: lenders.length, records: lenders };
    }
    if (input.table === 'Config') {
      return {
        ok: true,
        count: 1,
        records: [{ id: 'recCfg', key: 'default_lender', value: 'Fintree' }],
      };
    }
    if (input.table === 'Loan Applications') {
      return { ok: true, count: 1, records: [{ id: 'recTEST123' }] };
    }
    return { ok: true, count: 0, records: [] };
  });
}

function renderOffersFlow(formData: Record<string, unknown> = FROZEN_FORM) {
  return renderWithProviders(
    <PostSubmitEngineFlow
      session={{
        fileId: 'SFMWHK65WO',
        recordId: 'recTEST123',
        formData,
      }}
    />
  );
}

describe('PostSubmitEngineFlow local buildOffers + BRE pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(engineClient.qualifyApplicant).mockResolvedValue(PASS as never);
    vi.mocked(lenderBrePricing.getPricing).mockResolvedValue(PRICING_OK);
    mockAirtableForOffers();
  });

  it('one active lender gives two offers from BRE pricing; never calls multi_lender_rank; hides lender name', async () => {
    renderOffersFlow();

    await waitFor(() => {
      expect(screen.getByText('Seven Fincorp — Value')).toBeInTheDocument();
      expect(screen.getByText('Seven Fincorp — Standard')).toBeInTheDocument();
    });

    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
    expect(lenderBrePricing.getPricing).toHaveBeenCalled();
    expect(screen.queryByText(/Fintree/i)).not.toBeInTheDocument();

    const valueFee = roundRupee(111725 * 0.0675);
    const standardRoi = 30;
    const standardEmi = calculateEmi(111725, 18, standardRoi);
    expect(screen.getByText('28% p.a.')).toBeInTheDocument();
    expect(screen.getByText('30% p.a.')).toBeInTheDocument();
    expect(screen.getByText(`${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(calculateEmi(111725, 18, 28))}/month`)).toBeInTheDocument();
    expect(screen.getByText(`${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(standardEmi)}/month`)).toBeInTheDocument();
    expect(valueFee).toBe(roundRupee(111725 * 6.75 / 100));
  });

  it('amount outside ticket range stops with plain reason', async () => {
    renderOffersFlow({ ...FROZEN_FORM, 'loan.amount': '40000' });

    await waitFor(() => {
      expect(screen.getByTestId('post-submit-offers-error')).toHaveTextContent(
        'Loan amount must be between ₹50,000 and ₹1,50,000'
      );
    });
    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
  });

  it('tenure not in list stops with plain reason', async () => {
    renderOffersFlow({ ...FROZEN_FORM, 'loan.tenureMonths': '36' });

    await waitFor(() => {
      expect(screen.getByTestId('post-submit-offers-error')).toHaveTextContent(
        'Tenure must be one of 12, 18, 24 months'
      );
    });
    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
  });

  it('Eligible false → rejection path; no offers', async () => {
    vi.mocked(lenderBrePricing.getPricing).mockResolvedValue({
      rule_id: 1,
      nbfc_partner: 'Fintree',
      roi_pct: 0,
      pf_pct: 0,
      eligible: false,
    });
    renderOffersFlow();
    await waitFor(() => {
      expect(screen.getByText(/not eligible with the lender/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Seven Fincorp — Value')).not.toBeInTheDocument();
  });
});
