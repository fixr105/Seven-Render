import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostSubmitEngineFlow } from '../PostSubmitEngineFlow';
import { renderWithProviders } from '../../../test/helpers';
import * as engineClient from '../../../services/engineClient';

vi.mock('../../../services/engineClient', async () => {
  const actual = await vi.importActual<typeof import('../../../services/engineClient')>(
    '../../../services/engineClient'
  );
  return {
    ...actual,
    qualifyApplicant: vi.fn(),
    airtableGet: vi.fn().mockResolvedValue({ records: [{ id: 'recTEST123' }] }),
    airtableWrite: vi.fn().mockResolvedValue({ ok: true }),
    multiLenderRank: vi.fn(),
    uploadFileToUrl: vi.fn(),
    fillSanctionLetter: vi.fn(),
    fillLoanAgreement: vi.fn(),
    fillCkyc: vi.fn(),
  };
});

const GAURAV_FAIL = {
  ok: true,
  pass: false,
  score: null,
  kill_code: 'CC_OVERDUE_GT_5000',
  borrower_message:
    "Sorry, this application does not meet the lender's current criteria.",
  bureau_ref: 'AL6af8a7ed455e6eef248c45f2',
  is_ntc: false,
  failed: [{ parameter: 'cc_overdue', rejection_code: 'CC_OVERDUE_GT_5000' }],
  applicant: {
    name: 'GAURAV PAL',
    pan: 'BYYPP3849P',
    mobile: '9041677762',
  },
};

const CO_APPLICANT_FORM = {
  'borrower.customerName': 'GAURAV PAL',
  'borrower.pan': 'BYYPP3849P',
  'borrower.mobile': '9041677762',
  'borrower.email': 'gaurajpali@gmail.com',
  'loan.amount': '117720',
  '_meta.pricing': { roi_pct: 28 },
  '_meta.supportPersonType': 'co_applicant',
  'coApplicant.name': 'PRIYA SHARMA',
  'coApplicant.pan': 'ABCDE1234F',
  'coApplicant.mobile': '9876543210',
};

function renderFlow(
  qualifyResult?: Record<string, unknown> | null,
  formData: Record<string, unknown> = {
    'borrower.customerName': 'GAURAV PAL',
    'borrower.pan': 'BYYPP3849P',
    'borrower.mobile': '9041677762',
    'borrower.email': 'gaurajpali@gmail.com',
    'loan.amount': '117720',
  }
) {
  return renderWithProviders(
    <PostSubmitEngineFlow
      session={{
        fileId: 'FILE-GAURAV-TEST',
        recordId: 'recTEST123',
        formData,
        qualifyResult: qualifyResult === undefined ? undefined : (qualifyResult as never),
      }}
    />
  );
}

const NTC_ONLY = {
  ok: true,
  pass: false,
  kill_code: 'NTC_BANK_STATEMENT_REQUIRED',
  failed: [{ parameter: 'ntc', rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' }],
  borrower_message: 'New to credit — bank statement required',
};

function formDataFromWrite(call: unknown[]): Record<string, unknown> {
  const arg = call[0] as { fields?: { 'Form Data'?: string } };
  const raw = arg.fields?.['Form Data'];
  if (typeof raw !== 'string' || !raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('PostSubmitEngineFlow qualify hard gate (BYYPP3849P)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(engineClient.qualifyApplicant).mockResolvedValue(GAURAV_FAIL);
  });

  it('stops at rejection when live qualify returns pass:false — never shows documents or offers', async () => {
    renderFlow(null);

    await waitFor(
      () => {
        expect(screen.getByTestId('post-submit-not-eligible-reason')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(screen.queryByText(/Upload documents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 5 of 12/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 7 of 12/i)).not.toBeInTheDocument();
    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
  });

  it('always calls /engine/qualify even if session has a prior pass — never reuse BRE', async () => {
    const stalePass = {
      ok: true,
      pass: true,
      score: 750,
      bureau_ref: 'AL-STALE',
    };
    // Live BRE fails — must win over stale session pass.
    vi.mocked(engineClient.qualifyApplicant).mockResolvedValue(GAURAV_FAIL);
    renderFlow(stalePass);

    await waitFor(() => {
      expect(screen.getByTestId('post-submit-not-eligible-reason')).toBeInTheDocument();
    });

    expect(engineClient.qualifyApplicant).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Upload documents/i)).not.toBeInTheDocument();
    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
  });

  it('opens bank statement upload when live qualify is NTC-only (not from cached session pass/fail)', async () => {
    const ntcOnly = {
      ok: true,
      pass: false,
      kill_code: 'NTC_BANK_STATEMENT_REQUIRED',
      failed: [{ parameter: 'ntc', rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' }],
      borrower_message: 'New to credit — bank statement required',
    };
    vi.mocked(engineClient.qualifyApplicant).mockResolvedValue(ntcOnly);
    // Stale session pass must not skip the live call or open documents.
    renderFlow({ ok: true, pass: true, score: 800, bureau_ref: 'AL-OLD' });

    await waitFor(() => {
      expect(screen.getByTestId('post-submit-ntc-upload')).toBeInTheDocument();
    });
    expect(engineClient.qualifyApplicant).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Bank Statement Required/i)).toBeInTheDocument();
    expect(screen.queryByTestId('post-submit-not-eligible-reason')).not.toBeInTheDocument();
    expect(screen.queryByText(/Upload documents/i)).not.toBeInTheDocument();
  });

  it('continues to the co-applicant check when the statement is uploaded and qualify is still NTC-only', async () => {
    const user = userEvent.setup();
    vi.mocked(engineClient.uploadFileToUrl).mockResolvedValue(
      'https://files.example/statement.pdf'
    );
    vi.mocked(engineClient.qualifyApplicant).mockImplementation(async (payload) => {
      if (String(payload.PAN_Number || '') === 'ABCDE1234F') return NTC_ONLY;
      return NTC_ONLY;
    });
    renderFlow(null, CO_APPLICANT_FORM);

    await waitFor(() => {
      expect(screen.getByTestId('post-submit-ntc-upload')).toBeInTheDocument();
    });
    await waitFor(() => {
      const wrotePending = vi.mocked(engineClient.airtableWrite).mock.calls.some((call) => {
        return formDataFromWrite(call)['_meta.ntcBankStatement.pending'] === true;
      });
      expect(wrotePending).toBe(true);
    });

    const input = screen.getByTestId('post-submit-ntc-input');
    await user.upload(input, new File(['statement'], 'statement.pdf', { type: 'application/pdf' }));

    await waitFor(() => {
      expect(screen.getByText(/Upload documents/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('post-submit-not-eligible-reason')).not.toBeInTheDocument();
    expect(screen.queryByTestId('post-submit-ntc-upload')).not.toBeInTheDocument();
    expect(engineClient.qualifyApplicant).toHaveBeenCalledWith(
      expect.objectContaining({
        PAN_Number: 'ABCDE1234F',
        Mobile_Number: '9876543210',
        application_id: 'FILE-GAURAV-TEST-CO',
      })
    );
    const clearedPending = vi.mocked(engineClient.airtableWrite).mock.calls.some((call) => {
      return formDataFromWrite(call)['_meta.ntcBankStatement.pending'] === false;
    });
    expect(clearedPending).toBe(true);
  });

  it('rejects a non-NTC failure after the statement upload and does not check the co-applicant', async () => {
    const user = userEvent.setup();
    vi.mocked(engineClient.uploadFileToUrl).mockResolvedValue(
      'https://files.example/statement.pdf'
    );
    vi.mocked(engineClient.qualifyApplicant).mockImplementation(async (payload) => {
      if (payload.has_bank_statement === true) return GAURAV_FAIL;
      return NTC_ONLY;
    });
    renderFlow(null, CO_APPLICANT_FORM);

    await waitFor(() => {
      expect(screen.getByTestId('post-submit-ntc-upload')).toBeInTheDocument();
    });
    await user.upload(
      screen.getByTestId('post-submit-ntc-input'),
      new File(['statement'], 'statement.pdf', { type: 'application/pdf' })
    );

    await waitFor(() => {
      expect(screen.getByTestId('post-submit-not-eligible-reason')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Upload documents/i)).not.toBeInTheDocument();
    expect(engineClient.qualifyApplicant).not.toHaveBeenCalledWith(
      expect.objectContaining({ PAN_Number: 'ABCDE1234F' })
    );
  });
});
