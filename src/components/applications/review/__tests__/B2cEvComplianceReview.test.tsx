import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { B2cEvComplianceReview } from '../B2cEvComplianceReview';
import { fetchVkycByFileId } from '../../../../lib/vkycLinks';
import { apiService } from '../../../../services/api';
import { airtableWrite, DoPdfGenerationError, fillCkyc, fillLoanAgreement, fillSanctionLetter, requestDoPdf } from '../../../../services/engineClient';
import { DO_APPROVAL_CHECKLIST } from '../../../../lib/doApproval';
import * as stampFlow from '../../../../lib/postSubmitEngine/stampFlow';
import * as featureFlags from '../../../../lib/featureFlags';

vi.mock('../../../../lib/vkycLinks', () => ({
  fetchVkycByFileId: vi.fn(async () => null),
  completeVkycLink: vi.fn(async () => undefined),
}));

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'kam@test.local' } }),
}));

vi.mock('../../../../services/api', () => ({
  apiService: {
    kamB2cDoRequestAction: vi.fn(),
    kamB2cComplianceAction: vi.fn(),
  },
}));

vi.mock('../../../../services/engineClient', () => {
  class DoPdfGenerationError extends Error {
    constructor(reason: string) {
      super(`DO generation failed: ${reason}`);
      this.name = 'DoPdfGenerationError';
    }
  }
  return {
    DoPdfGenerationError,
    requestDoPdf: vi.fn(),
    airtableWrite: vi.fn(),
    airtableGet: vi.fn(async () => ({ records: [] })),
    fillSanctionLetter: vi.fn(async () => 'https://files.example/s.pdf'),
    fillLoanAgreement: vi.fn(async () => 'https://files.example/a.pdf'),
    fillCkyc: vi.fn(async () => 'https://files.example/c.pdf'),
  };
});

vi.mock('../../../../lib/featureFlags', () => ({
  isStampOrderEnabled: vi.fn(() => false),
  isEsignEnabled: vi.fn(() => false),
}));

vi.mock('../../../../lib/postSubmitEngine/dlaLead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lib/postSubmitEngine/dlaLead')>();
  return {
    ...actual,
    fireDlaLead: vi.fn(async (input: { formData: Record<string, unknown> }) => input.formData),
  };
});

vi.mock('../../../../lib/postSubmitEngine/stampFlow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lib/postSubmitEngine/stampFlow')>();
  return {
    ...actual,
    runStampFreeChecks: vi.fn(),
    placeStampOrder: vi.fn(),
    fetchStampStatus: vi.fn(),
    mergeSigningPack: vi.fn(),
  };
});

const pendingDoForm = {
  '_meta.doRequest.requestedAt': '2026-01-02T00:00:00.000Z',
  'borrower.customerName': 'Ajay Kumar',
  'borrower.pan': 'ABCDE1234F',
  'borrower.mobile': '9876543210',
  'loan.amount': '500000',
  productId: 'EV-1',
};

function openChecklist() {
  fireEvent.click(screen.getByTestId('do-request-approve'));
}

function tickChecks(count: number) {
  for (let index = 0; index < count; index += 1) {
    fireEvent.click(screen.getByTestId(`do-approval-check-${index}`));
  }
}

describe('B2cEvComplianceReview', () => {
  beforeEach(() => {
    vi.mocked(apiService.kamB2cDoRequestAction).mockReset();
    vi.mocked(requestDoPdf).mockReset();
    vi.mocked(airtableWrite).mockReset();
    vi.mocked(apiService.kamB2cDoRequestAction).mockResolvedValue({ success: true });
    vi.mocked(requestDoPdf).mockResolvedValue({
      url: 'https://files.example/do.pdf',
      fileName: 'DO.pdf',
    });
    vi.mocked(airtableWrite).mockResolvedValue({ ok: true });
    vi.mocked(fillSanctionLetter).mockClear();
    vi.mocked(fillLoanAgreement).mockClear();
    vi.mocked(fillCkyc).mockClear();
    vi.mocked(featureFlags.isStampOrderEnabled).mockReturnValue(false);
    vi.mocked(featureFlags.isEsignEnabled).mockReturnValue(false);
    vi.mocked(stampFlow.runStampFreeChecks).mockReset();
    vi.mocked(stampFlow.runStampFreeChecks).mockResolvedValue({
      ok: true,
      config: {
        stamp_state: 'Delhi',
        stamp_article_code: '5',
        stamp_purpose: 'Loan Agreement',
        stamp_denomination: 100,
        stamp_first_party: 'Fintree',
        stamp_project: 'seven_dealer_ev',
      },
      productId: 'p1',
      papers: [
        { refId: 'SF1-S1', firstParty: 'Fintree', secondParty: 'Ajay Kumar', rowLabel: 'Applicant' },
        { refId: 'SF1-S2', firstParty: 'Fintree', secondParty: 'Rita', rowLabel: 'Co-applicant' },
        {
          refId: 'SF1-S3',
          firstParty: 'Fintree',
          secondParty: 'Ajay Kumar & Rita',
          rowLabel: 'Applicant & co-applicant',
        },
      ],
      quote: { total: 300, affordable: true },
    });
    vi.mocked(stampFlow.fetchStampStatus).mockReset();
    vi.mocked(stampFlow.fetchStampStatus).mockResolvedValue({
      status: 200,
      data: { ok: true, summary: { allCompleted: false, anyFailed: false }, orders: [] },
    });
  });

  it('renders read-only compliance status without action buttons for clients', () => {
    render(
      <B2cEvComplianceReview
        formData={{
          'compliance.vkycDone': false,
          '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
          '_meta.doRequest.requestedAt': '2026-01-02T00:00:00.000Z',
        }}
        userRole="client"
        applicationId="rec-app-1"
      />
    );

    expect(screen.getByTestId('b2c-compliance-review')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-review-vkyc')).toBeInTheDocument();
    expect(screen.getByTestId('b2c-do-request-review')).toBeInTheDocument();
    expect(screen.queryByTestId('compliance-approve-vkyc')).not.toBeInTheDocument();
    expect(screen.queryByTestId('do-request-approve')).not.toBeInTheDocument();
  });

  it('shows approve and reject for pending KAM compliance requests', () => {
    render(
      <B2cEvComplianceReview
        formData={{
          'compliance.vkycDone': false,
          '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
        }}
        userRole="kam"
        applicationId="rec-app-1"
        highlightComplianceItem="vkyc"
      />
    );

    expect(screen.getByTestId('compliance-approve-vkyc')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-status-vkyc')).toHaveTextContent('Requested');
    expect(screen.getByTestId('compliance-approve-vkyc')).toBeEnabled();
    expect(screen.getByTestId('compliance-reject-vkyc')).toBeInTheDocument();
  });

  it('shows DO approve and reject for pending KAM DO requests', () => {
    render(
      <B2cEvComplianceReview
        formData={{
          '_meta.doRequest.requestedAt': '2026-01-02T00:00:00.000Z',
        }}
        userRole="kam"
        applicationId="rec-app-1"
        highlightDoRequest
      />
    );

    expect(screen.getByTestId('do-request-approve')).toHaveTextContent('Approve DO');
    expect(screen.getByTestId('do-request-reject')).toHaveTextContent('Reject DO');
  });

  it('enables Mark complete for an older file that only stored VKYC Requested', () => {
    render(
      <B2cEvComplianceReview
        formData={{ '_meta.vkyc.status': 'Requested' }}
        userRole="kam"
        applicationId="rec-app-1"
        fileId="SFMWHK65WO"
      />
    );

    expect(screen.getByTestId('compliance-approve-vkyc')).toBeEnabled();
    expect(screen.getByTestId('compliance-status-vkyc')).toHaveTextContent('Requested');
  });

  it('shows the waiting VKYC row when the saved file still says not requested', async () => {
    vi.mocked(fetchVkycByFileId).mockResolvedValueOnce({
      id: 'recVKYC',
      file_id: 'SFMWHK65WO',
      mobile: '9687599179',
      borrower_name: 'Govind',
      status: 'Requested',
      link: '',
      requested_at: '2026-11-17T00:00:00.000Z',
      link_at: '',
      done_at: '',
      done_by: '',
      remarks: '',
    });

    render(
      <B2cEvComplianceReview
        formData={{ '_meta.formTemplate': 'b2c_ev_v1' }}
        userRole="kam"
        applicationId="rec-app-1"
        fileId="SFMWHK65WO"
      />
    );

    expect(await screen.findByTestId('compliance-status-vkyc')).toHaveTextContent('Requested');
    expect(screen.getByTestId('compliance-approve-vkyc')).toBeEnabled();
  });

  it('keeps Send DO disabled until every checklist item is ticked', () => {
    render(
      <B2cEvComplianceReview formData={pendingDoForm} userRole="kam" applicationId="recAPP" />
    );
    openChecklist();
    expect(screen.getByTestId('do-approval-send')).toBeDisabled();
    tickChecks(4);
    expect(screen.getByTestId('do-approval-send')).toBeDisabled();
    fireEvent.click(screen.getByTestId('do-approval-check-4'));
    expect(screen.getByTestId('do-approval-send')).toBeEnabled();
  });

  it('writes the checklist before the webhook and fulfills only after a URL', async () => {
    const order: string[] = [];
    vi.mocked(apiService.kamB2cDoRequestAction).mockImplementation(async (_id, body) => {
      order.push(body.action);
      return { success: true };
    });
    vi.mocked(requestDoPdf).mockImplementation(async () => {
      order.push('webhook');
      return { url: 'https://files.example/do.pdf', fileName: 'DO.pdf' };
    });

    render(
      <B2cEvComplianceReview
        formData={pendingDoForm}
        userRole="admin"
        applicationId="recAPP"
        fileId="SF001"
      />
    );
    openChecklist();
    tickChecks(DO_APPROVAL_CHECKLIST.length);
    fireEvent.click(screen.getByTestId('do-approval-send'));

    expect(await screen.findByTestId('do-approval-done')).toBeInTheDocument();
    expect(order).toEqual(['save_checklist', 'webhook', 'fulfill']);
    const fulfillCall = vi.mocked(apiService.kamB2cDoRequestAction).mock.calls[1]?.[1];
    expect(fulfillCall?.doApproval?.doUrl).toBe('https://files.example/do.pdf');
    expect(fulfillCall?.doApproval?.checklist).toEqual([...DO_APPROVAL_CHECKLIST]);
    expect(fulfillCall?.doApproval?.approvedBy).toBe('kam@test.local');
    expect(vi.mocked(requestDoPdf).mock.calls[0]?.[0]).toMatchObject({
      file_id: 'SF001',
      application_id: 'recAPP',
      applicant_name: 'Ajay Kumar',
      lender: 'Fintree Finance Pvt Ltd',
      product_id: 'EV-1',
    });
    expect(airtableWrite).toHaveBeenCalledWith({
      table: 'Loan Applications',
      record_id: 'recAPP',
      fields: { DO: 'https://files.example/do.pdf' },
    });
    expect(screen.queryByTestId('do-request-approve')).not.toBeInTheDocument();
    expect(screen.getByTestId('do-approval-view')).toHaveAttribute('href', 'https://files.example/do.pdf');
  });

  it('does not fulfill when DO generation fails and keeps a retry', async () => {
    vi.mocked(requestDoPdf).mockRejectedValueOnce(new DoPdfGenerationError('template missing'));

    render(
      <B2cEvComplianceReview formData={pendingDoForm} userRole="kam" applicationId="recAPP" />
    );
    openChecklist();
    tickChecks(DO_APPROVAL_CHECKLIST.length);
    fireEvent.click(screen.getByTestId('do-approval-send'));

    expect(await screen.findByTestId('do-approval-error')).toHaveTextContent(
      'DO generation failed: template missing'
    );
    expect(screen.getByTestId('do-approval-checklist')).toBeInTheDocument();
    expect(screen.getByTestId('do-approval-retry')).toBeInTheDocument();
    expect(vi.mocked(apiService.kamB2cDoRequestAction).mock.calls.map((call) => call[1].action)).toEqual([
      'save_checklist',
    ]);
  });

  it('retries an HTTP failure with the same request and does not offer retry for a timeout', async () => {
    vi.mocked(requestDoPdf)
      .mockRejectedValueOnce(new Error('Could not generate DO. Try again.'))
      .mockResolvedValueOnce({ url: 'https://files.example/do.pdf', fileName: 'DO.pdf' });

    render(
      <B2cEvComplianceReview formData={pendingDoForm} userRole="kam" applicationId="recAPP" />
    );
    openChecklist();
    tickChecks(DO_APPROVAL_CHECKLIST.length);
    fireEvent.click(screen.getByTestId('do-approval-send'));
    expect(await screen.findByTestId('do-approval-retry')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('do-approval-retry'));
    await waitFor(() => {
      expect(requestDoPdf).toHaveBeenCalledTimes(2);
    });
    const first = vi.mocked(requestDoPdf).mock.calls[0]?.[0];
    const second = vi.mocked(requestDoPdf).mock.calls[1]?.[0];
    expect(second).toEqual(first);
  });

  it('does not offer a retry when the webhook does not respond', async () => {
    vi.mocked(requestDoPdf).mockRejectedValueOnce(new Error('No response. Check with ops.'));
    render(
      <B2cEvComplianceReview formData={pendingDoForm} userRole="kam" applicationId="recAPP" />
    );
    openChecklist();
    tickChecks(DO_APPROVAL_CHECKLIST.length);
    fireEvent.click(screen.getByTestId('do-approval-send'));
    expect(await screen.findByText('No response. Check with ops.')).toBeInTheDocument();
    expect(screen.queryByTestId('do-approval-retry')).not.toBeInTheDocument();
  });

  it('shows the saved approval and hides Approve DO on reload', () => {
    render(
      <B2cEvComplianceReview
        formData={{
          ...pendingDoForm,
          '_meta.doRequest.fulfilledAt': '2026-11-17T10:00:00.000Z',
          '_meta.doApproval': {
            checklist: [...DO_APPROVAL_CHECKLIST],
            approvedBy: 'kam@test.local',
            approvedAt: '2026-11-17T10:00:00.000Z',
            doUrl: 'https://files.example/saved.pdf',
          },
        }}
        userRole="kam"
        applicationId="recAPP"
      />
    );

    expect(screen.queryByTestId('do-request-approve')).not.toBeInTheDocument();
    expect(screen.getByTestId('do-approval-done')).toHaveTextContent('kam@test.local');
    expect(screen.getByTestId('do-approval-view')).toHaveAttribute('href', 'https://files.example/saved.pdf');
  });

  function lastWrittenForm(): Record<string, unknown> {
    const fields = vi.mocked(airtableWrite).mock.calls.at(-1)?.[0].fields as
      | Record<string, unknown>
      | undefined;
    return JSON.parse(String(fields?.['Form Data'] || '{}')) as Record<string, unknown>;
  }

  async function confirmMark(id: 'ekyc' | 'loanAgreement' | 'enach') {
    fireEvent.click(screen.getByTestId(`kam-compliance-mark-${id}`));
    fireEvent.click(screen.getByTestId('kam-compliance-confirm-submit'));
    await waitFor(() => {
      expect(screen.queryByTestId(`kam-compliance-mark-${id}`)).not.toBeInTheDocument();
    });
  }

  it('disables each confirmation while saving and writes the compliance record', async () => {
    let release: (value: { ok: true }) => void = () => undefined;
    vi.mocked(airtableWrite).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    render(
      <B2cEvComplianceReview
        formData={{ 'borrower.customerName': 'Ajay Kumar' }}
        userRole="kam"
        applicationId="recAPP"
      />
    );

    fireEvent.click(screen.getByTestId('kam-compliance-mark-ekyc'));
    expect(screen.getByTestId('kam-compliance-confirm')).toHaveTextContent(
      'Confirm eKYC is complete for Ajay Kumar on Fintree?'
    );
    fireEvent.click(screen.getByTestId('kam-compliance-confirm-submit'));
    expect(screen.getByTestId('kam-compliance-confirm-submit')).toBeDisabled();
    expect(screen.getByTestId('kam-compliance-mark-ekyc')).toBeDisabled();
    release({ ok: true });

    expect(await screen.findByTestId('kam-compliance-status-ekyc')).toHaveTextContent('eKYC Done ✓');
    expect(screen.getByTestId('kam-compliance-status-ekyc')).toHaveTextContent('kam@test.local');
    expect(screen.queryByTestId('kam-compliance-mark-ekyc')).not.toBeInTheDocument();
    expect(lastWrittenForm()['_meta.compliance.ekyc']).toMatchObject({
      status: 'done',
      confirmedBy: 'kam@test.local',
    });

    vi.mocked(airtableWrite).mockResolvedValue({ ok: true });
    await confirmMark('enach');
    expect(screen.getByTestId('kam-compliance-status-enach')).toHaveTextContent('eNACH Done ✓');
    expect(screen.getByTestId('compliance-status-enach')).toHaveTextContent('Done');
    expect(lastWrittenForm()['_meta.compliance.enach']).toMatchObject({
      status: 'done',
      confirmedBy: 'kam@test.local',
    });
  });

  it('keeps an earlier confirmation when the next one is saved after a stale refresh', async () => {
    const stale = { 'borrower.customerName': 'Ajay Kumar' };
    const { rerender } = render(
      <B2cEvComplianceReview formData={stale} userRole="kam" applicationId="recAPP" />
    );

    await confirmMark('ekyc');
    expect(screen.getByTestId('kam-compliance-status-ekyc')).toHaveTextContent('eKYC Done ✓');

    rerender(
      <B2cEvComplianceReview formData={{ ...stale }} userRole="kam" applicationId="recAPP" />
    );

    expect(screen.getByTestId('kam-compliance-status-ekyc')).toHaveTextContent('eKYC Done ✓');
    await confirmMark('enach');
    expect(screen.getByTestId('kam-compliance-status-ekyc')).toHaveTextContent('eKYC Done ✓');
    expect(screen.getByTestId('kam-compliance-status-enach')).toHaveTextContent('eNACH Done ✓');
    expect(lastWrittenForm()['_meta.compliance.ekyc']).toMatchObject({
      status: 'done',
      confirmedBy: 'kam@test.local',
    });
    expect(lastWrittenForm()['_meta.compliance.enach']).toMatchObject({
      status: 'done',
      confirmedBy: 'kam@test.local',
    });
  });

  it('keeps the loan agreement signing panel after a stale refresh', async () => {
    const stale = {
      'borrower.customerName': 'Ajay Kumar',
      'loan.amount': '500000',
      '_meta.docs.sanctionLetter': 'https://files.example/s.pdf',
      '_meta.docs.loanAgreement': 'https://files.example/a.pdf',
      '_meta.docs.ckyc': 'https://files.example/c.pdf',
    };
    const { rerender } = render(
      <B2cEvComplianceReview
        formData={stale}
        userRole="kam"
        applicationId="recAPP"
        fileId="SF1"
      />
    );

    await confirmMark('loanAgreement');
    expect(screen.getByTestId('kam-compliance-status-loanAgreement')).toHaveTextContent(
      'Loan Agreement Done'
    );
    expect(screen.getByTestId('kam-loan-agreement-progress')).toBeInTheDocument();

    rerender(
      <B2cEvComplianceReview
        formData={{ ...stale }}
        userRole="kam"
        applicationId="recAPP"
        fileId="SF1"
      />
    );

    expect(screen.getByTestId('kam-compliance-status-loanAgreement')).toHaveTextContent(
      'Loan Agreement Done'
    );
    expect(screen.getByTestId('kam-loan-agreement-progress')).toBeInTheDocument();
    expect(stampFlow.placeStampOrder).not.toHaveBeenCalled();
  });

  it('shows a saved confirmation without a button', () => {
    render(
      <B2cEvComplianceReview
        formData={{
          '_meta.compliance.ekyc': {
            status: 'done',
            confirmedBy: 'kam@test.local',
            confirmedAt: '2026-11-15T09:00:00.000Z',
          },
        }}
        userRole="kam"
        applicationId="recAPP"
      />
    );
    expect(screen.queryByTestId('kam-compliance-mark-ekyc')).not.toBeInTheDocument();
    expect(screen.getByTestId('kam-compliance-status-ekyc')).toHaveTextContent('eKYC Done ✓');
    expect(screen.getByTestId('kam-compliance-status-ekyc')).toHaveTextContent('kam@test.local');
  });

  it('starts stamp checks from Mark Loan Agreement Done and stops when ordering is off', async () => {
    render(
      <B2cEvComplianceReview
        formData={{
          'borrower.customerName': 'Ajay Kumar',
          'loan.amount': '500000',
          '_meta.docs.sanctionLetter': 'https://files.example/s.pdf',
          '_meta.docs.loanAgreement': 'https://files.example/a.pdf',
          '_meta.docs.ckyc': 'https://files.example/c.pdf',
        }}
        userRole="kam"
        applicationId="recAPP"
        fileId="SF1"
      />
    );
    await confirmMark('loanAgreement');
    expect(await screen.findByText(/quote ₹300/)).toBeInTheDocument();
    expect(screen.getByTestId('order-stamps-button')).toBeInTheDocument();
    expect(screen.getByTestId('paid-call-preview')).toBeInTheDocument();
    expect(stampFlow.runStampFreeChecks).toHaveBeenCalled();
    expect(stampFlow.placeStampOrder).not.toHaveBeenCalled();
    expect(screen.getByTestId('kam-compliance-status-loanAgreement')).toHaveTextContent(
      'Stamps & signing started'
    );
  });

  it('fills missing loan documents before stamp checks', async () => {
    render(
      <B2cEvComplianceReview
        formData={{
          'borrower.customerName': 'Ajay Kumar',
          'loan.amount': '500000',
        }}
        userRole="kam"
        applicationId="recAPP"
        fileId="SF1"
      />
    );
    await confirmMark('loanAgreement');
    await waitFor(() => expect(fillSanctionLetter).toHaveBeenCalled());
    expect(fillLoanAgreement).toHaveBeenCalled();
    expect(fillCkyc).toHaveBeenCalled();
    expect(await screen.findByTestId('order-stamps-button')).toBeInTheDocument();
  });

  it('does not restart stamp checks when an access key is already saved', async () => {
    render(
      <B2cEvComplianceReview
        formData={{
          'borrower.customerName': 'Ajay Kumar',
          '_meta.stamps': { accessKey: 'uuid-already', refIds: ['SF1-S1'] },
        }}
        userRole="kam"
        applicationId="recAPP"
        fileId="SF1"
      />
    );
    expect(await screen.findByTestId('kam-stamp-status')).toHaveTextContent('Ordering stamp papers…');
    await confirmMark('loanAgreement');
    expect(stampFlow.runStampFreeChecks).not.toHaveBeenCalled();
    expect(stampFlow.fetchStampStatus).toHaveBeenCalled();
  });

  it('shows read-only compliance status for dealer and client roles', () => {
    const formData = {
      '_meta.compliance.ekyc': {
        status: 'done',
        confirmedBy: 'kam@test.local',
        confirmedAt: '2026-11-15T09:00:00.000Z',
      },
    };
    const { rerender } = render(
      <B2cEvComplianceReview formData={formData} userRole="dealer" applicationId="recAPP" />
    );
    expect(screen.getByTestId('kam-compliance-status-ekyc')).toHaveTextContent('eKYC: Done');
    expect(screen.getByTestId('kam-compliance-status-enach')).toHaveTextContent('eNACH: Pending');
    expect(screen.queryByTestId('kam-compliance-mark-ekyc')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kam-compliance-mark-loanAgreement')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kam-compliance-mark-enach')).not.toBeInTheDocument();

    rerender(<B2cEvComplianceReview formData={formData} userRole="client" applicationId="recAPP" />);
    expect(screen.queryByTestId('kam-compliance-mark-ekyc')).not.toBeInTheDocument();
    expect(screen.getByTestId('kam-compliance-status-enach')).toHaveTextContent('eNACH: Pending');
  });

  it('shows the mark buttons to an admin', () => {
    render(
      <B2cEvComplianceReview
        formData={{ 'borrower.customerName': 'Ajay Kumar' }}
        userRole="admin"
        applicationId="recAPP"
      />
    );
    expect(screen.getByTestId('kam-compliance-mark-ekyc')).toBeEnabled();
    expect(screen.getByTestId('kam-compliance-mark-loanAgreement')).toBeEnabled();
    expect(screen.getByTestId('kam-compliance-mark-enach')).toBeEnabled();
  });

  it('pre-checks four DO items when eKYC, qualify, and eNACH are already done', () => {
    render(
      <B2cEvComplianceReview
        formData={{
          ...pendingDoForm,
          '_meta.compliance.ekyc': { status: 'done', confirmedBy: 'kam@test.local', confirmedAt: '2026-11-15T09:00:00.000Z' },
          '_meta.compliance.enach': { status: 'done', confirmedBy: 'kam@test.local', confirmedAt: '2026-11-15T09:20:00.000Z' },
          '_meta.qualifyResult': { pass: true },
        }}
        userRole="kam"
        applicationId="recAPP"
      />
    );
    openChecklist();
    expect(screen.getByTestId('do-approval-check-0')).toBeChecked();
    expect(screen.getByTestId('do-approval-check-1')).toBeChecked();
    expect(screen.getByTestId('do-approval-check-2')).toBeChecked();
    expect(screen.getByTestId('do-approval-check-3')).toBeChecked();
    expect(screen.getByTestId('do-approval-check-4')).not.toBeChecked();
    expect(screen.getByTestId('do-approval-send')).toBeDisabled();
    fireEvent.click(screen.getByTestId('do-approval-check-0'));
    expect(screen.getByTestId('do-approval-check-0')).not.toBeChecked();
    fireEvent.click(screen.getByTestId('do-approval-cancel'));
    openChecklist();
    expect(screen.getByTestId('do-approval-check-0')).toBeChecked();
    expect(screen.getByTestId('do-approval-check-4')).not.toBeChecked();
  });

  it('shows All complete when VKYC and the three confirmations are done', () => {
    const done = {
      status: 'done',
      confirmedBy: 'kam@test.local',
      confirmedAt: '2026-11-15T09:00:00.000Z',
    };
    render(
      <B2cEvComplianceReview
        formData={{
          'compliance.vkycDone': 'true',
          '_meta.compliance.ekyc': done,
          '_meta.compliance.loanAgreement': done,
          '_meta.compliance.enach': done,
        }}
        userRole="kam"
        applicationId="recAPP"
      />
    );
    expect(screen.getByTestId('kam-compliance-all-complete')).toHaveTextContent('All complete ✓');
    expect(screen.queryByTestId('kam-compliance-mark-ekyc')).not.toBeInTheDocument();
  });
});
