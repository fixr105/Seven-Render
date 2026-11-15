import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

function renderFlow(qualifyResult?: Record<string, unknown> | null) {
  return renderWithProviders(
    <PostSubmitEngineFlow
      session={{
        fileId: 'FILE-GAURAV-TEST',
        recordId: 'recTEST123',
        formData: {
          'borrower.customerName': 'GAURAV PAL',
          'borrower.pan': 'BYYPP3849P',
          'borrower.mobile': '9041677762',
          'borrower.email': 'gaurajpali@gmail.com',
          'loan.amount': '117720',
        },
        qualifyResult: qualifyResult === undefined ? undefined : (qualifyResult as never),
      }}
    />
  );
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
});
