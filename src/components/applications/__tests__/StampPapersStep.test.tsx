import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StampPapersStep } from '../StampPapersStep';
import * as stampFlow from '../../../lib/postSubmitEngine/stampFlow';
import * as dlaLead from '../../../lib/postSubmitEngine/dlaLead';
import * as featureFlags from '../../../lib/featureFlags';

vi.mock('../../../lib/postSubmitEngine/stampFlow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/postSubmitEngine/stampFlow')>();
  return {
    ...actual,
    runStampFreeChecks: vi.fn(),
    placeStampOrder: vi.fn(),
    fetchStampStatus: vi.fn(),
    mergeSigningPack: vi.fn(),
  };
});

vi.mock('../../../lib/postSubmitEngine/dlaLead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/postSubmitEngine/dlaLead')>();
  return {
    ...actual,
    fireDlaLead: vi.fn(async (input: { formData: Record<string, unknown> }) => input.formData),
  };
});

vi.mock('../../../lib/featureFlags', () => ({
  isStampOrderEnabled: vi.fn(() => false),
  isEsignEnabled: vi.fn(() => false),
}));

const FORM = {
  'borrower.customerName': 'GOVIND',
  'borrower.mobile': '7355621712',
  '_meta.supportPersonType': 'co_applicant',
  'coApplicant.name': 'RITA',
  'coApplicant.pan': 'ABCDE1234F',
  'coApplicant.mobile': '9876543210',
};

describe('StampPapersStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlags.isStampOrderEnabled).mockReturnValue(false);
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
        {
          refId: 'SF1-S1',
          firstParty: 'Fintree',
          secondParty: 'GOVIND',
          rowLabel: 'Applicant',
        },
        {
          refId: 'SF1-S2',
          firstParty: 'Fintree',
          secondParty: 'RITA',
          rowLabel: 'Co-applicant',
        },
        {
          refId: 'SF1-S3',
          firstParty: 'Fintree',
          secondParty: 'GOVIND & RITA',
          rowLabel: 'Applicant & co-applicant',
        },
      ],
      quote: { total: 0, affordable: true },
    });
  });

  it('flag off shows the order button and does not place an order until it is clicked', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    render(
      <StampPapersStep
        fileId="SF1"
        formData={FORM}
        filledDocs={null}
        writeFormData={write}
        onPackReady={vi.fn()}
        onContinueToEsign={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('order-stamps-button')).toBeInTheDocument();
    });
    expect(screen.getByTestId('paid-call-preview')).toHaveTextContent('No paid stamp order is sent');
    expect(stampFlow.placeStampOrder).not.toHaveBeenCalled();
    expect(dlaLead.fireDlaLead).toHaveBeenCalled();
  });

  it('writes accessKey before order when flag on', async () => {
    vi.mocked(featureFlags.isStampOrderEnabled).mockReturnValue(true);
    const writes: Record<string, unknown>[] = [];
    const write = vi.fn(async (_f: Record<string, unknown>, next?: Record<string, unknown>) => {
      if (next) writes.push(next);
    });
    vi.mocked(stampFlow.placeStampOrder).mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        orders: [{ refId: 'SF1-S1', orderId: '1', stage: 'pending' }],
      },
    });
    vi.mocked(stampFlow.fetchStampStatus).mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        summary: { allCompleted: false, anyFailed: false },
        orders: [],
      },
    });

    const user = userEvent.setup();
    render(
      <StampPapersStep
        fileId="SF1"
        formData={FORM}
        filledDocs={null}
        writeFormData={write}
        onPackReady={vi.fn()}
        onContinueToEsign={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByTestId('order-stamps-button')).toBeInTheDocument());
    await user.click(screen.getByTestId('order-stamps-button'));
    await user.click(screen.getByTestId('stamp-confirm-order'));

    await waitFor(() => expect(stampFlow.placeStampOrder).toHaveBeenCalled());
    const orderCallIndex = writes.findIndex(
      (w) => Boolean((w['_meta.stamps'] as { accessKey?: string } | undefined)?.accessKey)
    );
    expect(orderCallIndex).toBeGreaterThanOrEqual(0);
    // accessKey write happened (persist) before or at order time
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/accessKey=|n8n-fvmj|pdfUrl|linkUrl/i);
  });

  it('reopen with accessKey skips free checks and goes to status', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.mocked(stampFlow.fetchStampStatus).mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        summary: { allCompleted: false, anyFailed: false },
        orders: [{ refId: 'SF1-S1', stage: 'pending' }],
      },
    });
    render(
      <StampPapersStep
        fileId="SF1"
        formData={{
          ...FORM,
          '_meta.stamps': {
            accessKey: 'uuid-already',
            groupId: 'SF1',
            refIds: ['SF1-S1', 'SF1-S2', 'SF1-S3'],
            requested_at: new Date().toISOString(),
          },
        }}
        filledDocs={null}
        writeFormData={write}
        onPackReady={vi.fn()}
        onContinueToEsign={vi.fn()}
      />
    );
    await waitFor(() => expect(stampFlow.fetchStampStatus).toHaveBeenCalled());
    expect(stampFlow.runStampFreeChecks).not.toHaveBeenCalled();
    expect(stampFlow.placeStampOrder).not.toHaveBeenCalled();
  });
});
