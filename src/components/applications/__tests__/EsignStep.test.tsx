import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EsignStep } from '../EsignStep';
import * as esignFlow from '../../../lib/postSubmitEngine/esignFlow';
import * as featureFlags from '../../../lib/featureFlags';

vi.mock('../../../lib/postSubmitEngine/esignFlow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/postSubmitEngine/esignFlow')>();
  return {
    ...actual,
    pingEsignTool: vi.fn(async () => ({ ok: true as const })),
    runEsignPrechecks: vi.fn(),
    sendEsign: vi.fn(),
    fetchEsignStatus: vi.fn(),
  };
});

vi.mock('../../../lib/featureFlags', () => ({
  isStampOrderEnabled: vi.fn(() => false),
  isEsignEnabled: vi.fn(() => false),
}));

const CONFIG = {
  sign_project: 'seven_dealer_ev',
  sign_title: 'Loan Agreement',
  sign_reason: 'Loan Agreement Execution',
  sign_method: 'aadhaar_otp',
  sign_position_default: 'bottom-right',
  sign_all_pages: true,
  sign_order: 'sequential',
  sign_geo_required: true,
  sign_video_required: false,
  sign_position_applicant: 'bottom-right',
  sign_position_co_applicant: 'bottom-left',
};

const FORM = {
  'borrower.customerName': 'GOVIND',
  'borrower.mobile': '7355621712',
  'borrower.email': 'govind@example.com',
  '_meta.supportPersonType': 'co_applicant',
  'coApplicant.name': 'RITA',
  'coApplicant.mobile': '9876543210',
  'coApplicant.email': 'rita@example.com',
  '_meta.signing': {
    pack_url: 'https://cdn.example/pack.pdf',
    esign_ready: true,
  },
};

describe('EsignStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlags.isEsignEnabled).mockReturnValue(false);
    vi.mocked(esignFlow.pingEsignTool).mockResolvedValue({ ok: true });
    vi.mocked(esignFlow.runEsignPrechecks).mockResolvedValue({
      ok: true,
      config: CONFIG,
      applicant: {
        name: 'GOVIND',
        email: 'govind@example.com',
        mobile: '7355621712',
        label: 'Applicant',
        emailKey: 'borrower.email',
      },
      support: {
        name: 'RITA',
        email: 'rita@example.com',
        mobile: '9876543210',
        label: 'Co-applicant',
        emailKey: 'coApplicant.email',
      },
      packUrl: 'https://cdn.example/pack.pdf',
      esignReady: true,
    });
  });

  it('flag off shows the send button and does not post until it is clicked', async () => {
    render(
      <EsignStep
        fileId="SF1"
        formData={FORM}
        writeFormData={vi.fn()}
        onSigned={vi.fn()}
        onBackToStamp={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByTestId('esign-send-button')).toBeInTheDocument());
    expect(screen.getByTestId('paid-call-preview')).toHaveTextContent('No paid eSign is sent');
    expect(esignFlow.sendEsign).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toContain('g***@example.com');
    expect(document.body.innerHTML).not.toContain('govind@example.com');
  });

  it('writes refId before POST when flag on', async () => {
    vi.mocked(featureFlags.isEsignEnabled).mockReturnValue(true);
    const writes: Record<string, unknown>[] = [];
    const write = vi.fn(async (_f: Record<string, unknown>, next?: Record<string, unknown>) => {
      if (next) writes.push(next);
    });
    vi.mocked(esignFlow.sendEsign).mockResolvedValue({
      status: 200,
      data: { ok: true, documentId: 'doc-1', stage: 'pending' },
    });
    vi.mocked(esignFlow.fetchEsignStatus).mockResolvedValue({
      status: 200,
      data: { ok: true, stage: 'pending', signatories: [] },
    });

    const user = userEvent.setup();
    render(
      <EsignStep
        fileId="SF1"
        formData={FORM}
        writeFormData={write}
        onSigned={vi.fn()}
        onBackToStamp={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByTestId('esign-send-button')).toBeInTheDocument());
    await user.click(screen.getByTestId('esign-send-button'));
    await user.click(screen.getByTestId('esign-confirm-send'));
    await waitFor(() => expect(esignFlow.sendEsign).toHaveBeenCalled());
    const withRef = writes.find(
      (w) => Boolean((w['_meta.esign'] as { refId?: string } | undefined)?.refId)
    );
    expect(withRef).toBeTruthy();
    expect(document.body.innerHTML).not.toMatch(/documentId|n8n-fvmj/i);
  });

  it('shows email input when precheck needs emails', async () => {
    vi.mocked(esignFlow.runEsignPrechecks).mockResolvedValue({
      ok: false,
      message: 'Email addresses are required for eSign.',
      needsEmails: true,
      missing: { supportEmail: true },
    });
    render(
      <EsignStep
        fileId="SF1"
        formData={{ ...FORM, 'coApplicant.email': '' }}
        writeFormData={vi.fn()}
        onSigned={vi.fn()}
        onBackToStamp={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByTestId('esign-support-email')).toBeInTheDocument());
  });

  it('reopen with documentId status only', async () => {
    vi.mocked(esignFlow.fetchEsignStatus).mockResolvedValue({
      status: 200,
      data: { ok: true, stage: 'pending', signatories: [] },
    });
    render(
      <EsignStep
        fileId="SF1"
        formData={{
          ...FORM,
          '_meta.esign': { refId: 'SF1-SIGN1', documentId: 'doc-existing' },
        }}
        writeFormData={vi.fn()}
        onSigned={vi.fn()}
        onBackToStamp={vi.fn()}
      />
    );
    await waitFor(() => expect(esignFlow.fetchEsignStatus).toHaveBeenCalled());
    expect(esignFlow.sendEsign).not.toHaveBeenCalled();
  });
});
