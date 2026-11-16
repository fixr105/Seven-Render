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
    uploadToUrl: vi.fn(async () => 'https://files.example/aadhaar.jpg'),
    multiLenderRank: vi.fn(),
    fillSanctionLetter: vi.fn(),
    fillLoanAgreement: vi.fn(),
    fillCkyc: vi.fn(),
  };
});

vi.mock('../../../lib/postSubmitEngine/dlaLead', () => ({
  fireDlaLead: vi.fn(async ({ formData }: { formData: Record<string, unknown> }) => formData),
}));

vi.mock('../../../lib/postSubmitEngine/stampFlow', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/postSubmitEngine/stampFlow')>(
    '../../../lib/postSubmitEngine/stampFlow'
  );
  return {
    ...actual,
    runStampFreeChecks: vi.fn(async () => ({ ok: false, message: 'held in test' })),
    fetchStampStatus: vi.fn(),
    placeStampOrder: vi.fn(),
    mergeSigningPack: vi.fn(),
  };
});

vi.mock('../../../lib/postSubmitEngine/esignFlow', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/postSubmitEngine/esignFlow')>(
    '../../../lib/postSubmitEngine/esignFlow'
  );
  return {
    ...actual,
    runEsignPrechecks: vi.fn(async () => ({ ok: false, message: 'held in test' })),
    fetchEsignStatus: vi.fn(),
    sendEsign: vi.fn(),
  };
});

function renderResumed(formData: Record<string, unknown>, resumePhase: string) {
  return renderWithProviders(
    <PostSubmitEngineFlow
      session={{
        fileId: 'SFMWHK65WO',
        recordId: 'recoa21al0APAct0k',
        formData: { '_meta.fileId': 'SFMWHK65WO', ...formData },
        resumePhase: resumePhase as never,
      }}
    />
  );
}

describe('PostSubmitEngineFlow resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens delivery without qualifying again', async () => {
    renderResumed({ '_meta.esign': { stage: 'signed', documentId: 'doc-1' } }, 'done');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue to delivery' })).toBeInTheDocument();
    });
    expect(engineClient.qualifyApplicant).not.toHaveBeenCalled();
    expect(engineClient.fillSanctionLetter).not.toHaveBeenCalled();
    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
  });

  it('opens signing status without a second send or qualify', async () => {
    renderResumed({ '_meta.esign': { documentId: 'doc-1', stage: 'pending' } }, 'esign_step');
    await waitFor(() => {
      expect(screen.getByTestId('esign-step')).toBeInTheDocument();
    });
    expect(engineClient.qualifyApplicant).not.toHaveBeenCalled();
    expect(engineClient.fillSanctionLetter).not.toHaveBeenCalled();
  });

  it('opens the stamp step without filling documents again', async () => {
    renderResumed(
      {
        '_meta.docs.sanctionLetter': 'https://files.example/s.pdf',
        '_meta.docs.loanAgreement': 'https://files.example/a.pdf',
        '_meta.docs.ckyc': 'https://files.example/c.pdf',
      },
      'stamp_step'
    );
    await waitFor(() => {
      expect(screen.getByTestId('stamp-step')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(engineClient.fillSanctionLetter).not.toHaveBeenCalled();
    });
    expect(engineClient.qualifyApplicant).not.toHaveBeenCalled();
    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
  });

  it('opens eNACH when the offer is priced and the account is empty', async () => {
    renderResumed({ '_meta.pricing': { roi_pct: 28 } }, 'enach');
    expect(await screen.findByText(/Enter the bank account/i)).toBeInTheDocument();
    expect(engineClient.qualifyApplicant).not.toHaveBeenCalled();
    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
    expect(engineClient.fillSanctionLetter).not.toHaveBeenCalled();
  });

  it('opens document prep when eNACH is already stored', async () => {
    renderResumed(
      { '_meta.pricing': { roi_pct: 28 }, 'enach.accountNumber': '12345678901234' },
      'doc_fill'
    );
    expect(await screen.findByText(/Preparing your loan documents/i)).toBeInTheDocument();
    expect(engineClient.fillSanctionLetter).not.toHaveBeenCalled();
    expect(engineClient.qualifyApplicant).not.toHaveBeenCalled();
  });

  it('returns to documents with the saved file and a co-applicant row', async () => {
    renderResumed(
      {
        '_meta.postSubmitFlags': { qualifyFired: true },
        '_meta.qualifyResult': { pass: true },
        '_meta.supportPersonType': 'co_applicant',
        'coApplicant.name': 'RITA SHARMA',
        'coApplicant.pan': 'ABCDE1234F',
        'coApplicant.mobile': '9876543210',
        'borrower.customerName': 'GOVIND PANDEY',
        '_meta.postSubmit.uploads': {
          pan_card: {
            fieldId: 'pan_card',
            url: 'https://files.example/pan.jpg',
            filename: 'pan.jpg',
          },
        },
      },
      'documents'
    );
    expect(await screen.findByText('pan.jpg')).toBeInTheDocument();
    expect(screen.getByTestId('post-submit-doc-co_applicant_pan')).toHaveTextContent(
      /Co-applicant/i
    );
  });

  it('stores each document link as soon as that file is uploaded', async () => {
    const user = userEvent.setup();
    renderResumed(
      {
        '_meta.qualifyResult': { pass: true },
        'borrower.customerName': 'GOVIND PANDEY',
      },
      'documents'
    );
    const input = await screen.findByTestId('post-submit-doc-input-pan_card');
    await user.upload(input, new File(['pan'], 'pan.jpg', { type: 'image/jpeg' }));
    await waitFor(() => {
      const wroteThisFile = vi.mocked(engineClient.airtableWrite).mock.calls.some((call) => {
        const fields = (call[0] as { fields?: { Documents?: string } }).fields;
        return String(fields?.Documents || '').includes('pan_card:https://files.example/aadhaar.jpg|pan.jpg');
      });
      expect(wroteThisFile).toBe(true);
    });
  });

  it('saves eNACH when Proceed is clicked and the offer is only on the saved loan', async () => {
    const user = userEvent.setup();
    renderResumed(
      {
        '_meta.pricing': { roi_pct: 28 },
        'loan.amount': 111725,
        'loan.interestRate': 28,
        'loan.emiAmount': 8000,
        'loan.tenureMonths': 18,
      },
      'enach'
    );
    expect(await screen.findByText(/Enter the bank account/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Account Holder Name'), 'Govind Pandey');
    await user.type(screen.getByLabelText('Bank Name'), 'HDFC Bank');
    await user.type(screen.getByLabelText('Account Number'), '123456789012');
    await user.type(screen.getByLabelText('Confirm Account Number'), '123456789012');
    await user.type(screen.getByLabelText('IFSC Code'), 'HDFC0001234');
    await user.click(screen.getByRole('button', { name: 'Proceed to Documents' }));
    await waitFor(() => {
      expect(engineClient.airtableWrite).toHaveBeenCalled();
    });
    expect(screen.queryByText(/accepted offer is missing/i)).not.toBeInTheDocument();
  });

  it('opens offers without ranking again', async () => {
    renderResumed({ '_meta.qualifyResult': { pass: true } }, 'offer');
    expect(await screen.findByText(/Select your offer/i)).toBeInTheDocument();
    expect(engineClient.multiLenderRank).not.toHaveBeenCalled();
    expect(engineClient.qualifyApplicant).not.toHaveBeenCalled();
  });

  it('opens the eligibility screen without calling qualify', async () => {
    renderResumed({ '_meta.deadline': { deadline_at: '2026-11-16T00:00:00.000Z' } }, 'qualify');
    expect(await screen.findByText('Checking eligibility')).toBeInTheDocument();
    expect(engineClient.qualifyApplicant).not.toHaveBeenCalled();
  });
});
