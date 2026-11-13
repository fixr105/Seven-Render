import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QualifyStep } from '../QualifyStep';
import { enginePost } from '../../../services/engineClient';
import type { SubmittedApplication } from '../ApplicationFormStep';

vi.mock('../../../services/engineClient', () => ({
  enginePost: vi.fn(),
}));

const application: SubmittedApplication = {
  recordId: 'rec123',
  fileId: 'SFTEST1234',
  values: {},
  includeCoApplicant: false,
  canonical: {
    fullName: 'Ada Lovelace',
    pan: 'ABCDE1234F',
    mobile: '9876543210',
    email: 'ada@example.com',
    dob: '1990-01-02',
    employmentType: 'Salaried',
    monthlyIncome: 80000,
    existingObligations: 5000,
    requestedLoanAmount: 450000,
    preferredTenure: 36,
    onRoadPrice: 500000,
    selectType: 'EMI',
    coApplicant: null,
  },
};

async function settle(apply: () => void) {
  await act(async () => {
    apply();
    await new Promise((resolve) => queueMicrotask(resolve));
    await new Promise((resolve) => queueMicrotask(resolve));
  });
}

function renderStep(onQualified = vi.fn(), onRejected = vi.fn(), app = application) {
  render(
    <MemoryRouter>
      <QualifyStep application={app} formFields={app.values} onQualified={onQualified} onRejected={onRejected} />
    </MemoryRouter>
  );
  return { onQualified, onRejected };
}

describe('QualifyStep', () => {
  beforeEach(() => {
    vi.mocked(enginePost).mockReset();
  });

  it('shows the eligibility loader and sends the submitted applicant to qualify', async () => {
    let resolveQualify: (value: unknown) => void = () => undefined;
    vi.mocked(enginePost).mockImplementation((tool) => {
      if (tool === 'qualify') {
        return new Promise((resolve) => {
          resolveQualify = resolve;
        });
      }
      return Promise.resolve({});
    });

    renderStep();

    expect(screen.getByRole('status').textContent).toContain('Checking eligibility...');
    expect(screen.getByText('Running background checks')).toBeInTheDocument();
    await waitFor(() =>
      expect(enginePost).toHaveBeenCalledWith(
        'qualify',
        expect.objectContaining({
          mobile: '9876543210',
          pan: 'ABCDE1234F',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          consent_bureau: true,
          application_id: 'SFTEST1234',
          product_code: 'ev_dealer',
        })
      )
    );
    await settle(() => resolveQualify({ ok: true, pass: false }));
  });

  it('rejects without showing kill codes or bureau fields', async () => {
    const onRejected = vi.fn();
    vi.mocked(enginePost).mockImplementation((tool) => {
      if (tool === 'qualify') {
        return Promise.resolve({
          ok: true,
          pass: false,
          kill_code: 'DPD_FOUND_IN_LAST_3M',
          score: 510,
          failed: [{ rejection_code: 'DPD_FOUND_IN_LAST_3M' }],
          borrower_message: 'Sorry, this application does not meet the lender criteria.',
        });
      }
      return Promise.resolve({});
    });

    renderStep(vi.fn(), onRejected);

    await waitFor(() => expect(onRejected).toHaveBeenCalledOnce());
    expect(screen.queryByText(/DPD_FOUND_IN_LAST_3M/)).not.toBeInTheDocument();
    expect(screen.queryByText(/510/)).not.toBeInTheDocument();
    expect(enginePost).toHaveBeenCalledWith(
      'airtable_write',
      expect.objectContaining({
        table: 'Loan Applications',
        action: 'update',
        record_id: 'rec123',
        fields: expect.objectContaining({ Status: 'Rejected' }),
      })
    );
    expect(enginePost).not.toHaveBeenCalledWith('multi_lender_rank', expect.anything());
  });

  it('marks a pass as qualified and continues without ranking yet', async () => {
    const onQualified = vi.fn();
    vi.mocked(enginePost).mockImplementation((tool) => {
      if (tool === 'qualify') {
        return Promise.resolve({
          ok: true,
          pass: true,
          is_ntc: false,
          score: 742,
          applicant: { name: 'Ada Lovelace', pan: 'ABCDE1234F' },
        });
      }
      return Promise.resolve({});
    });

    renderStep(onQualified);

    await waitFor(() => expect(onQualified).toHaveBeenCalledOnce());
    expect(screen.queryByText(/742/)).not.toBeInTheDocument();
    expect(screen.queryByText('ABCDE1234F')).not.toBeInTheDocument();
    expect(enginePost).toHaveBeenCalledWith(
      'airtable_write',
      expect.objectContaining({
        fields: expect.objectContaining({ Status: 'Qualified', 'Form Data': '{}' }),
      })
    );
    const tools = vi.mocked(enginePost).mock.calls.map((call) => call[0]);
    expect(tools).toEqual(['qualify', 'airtable_write']);
    expect(onQualified.mock.calls[0][0].qualifyResult).toMatchObject({ ok: true, pass: true });
  });

  it('runs co-applicant qualify without blocking on co fail', async () => {
    const onQualified = vi.fn();
    const withCo: SubmittedApplication = {
      ...application,
      includeCoApplicant: true,
      canonical: {
        ...application.canonical,
        coApplicant: {
          name: 'Charles Babbage',
          pan: 'BBBBB1234B',
          mobile: '9123456789',
          email: 'charles@example.com',
          dob: '1980-01-01',
        },
      },
    };
    vi.mocked(enginePost).mockImplementation((tool, body) => {
      if (tool === 'qualify') {
        const payload = body as { application_id?: string };
        if (String(payload.application_id || '').endsWith('-CO')) {
          return Promise.resolve({ ok: true, pass: false, score: 400 });
        }
        return Promise.resolve({ ok: true, pass: true, score: 742 });
      }
      return Promise.resolve({});
    });

    renderStep(onQualified, vi.fn(), withCo);

    await waitFor(() => expect(onQualified).toHaveBeenCalledOnce());
    const qualifyCalls = vi.mocked(enginePost).mock.calls.filter((call) => call[0] === 'qualify');
    expect(qualifyCalls).toHaveLength(2);
    expect(onQualified.mock.calls[0][0].coApplicantResult).toMatchObject({ ok: true, pass: false });
  });

  it('shows a generic retry screen for config and network failures', async () => {
    const user = userEvent.setup();
    let resolveFirst: (value: unknown) => void = () => undefined;
    let rejectRetry: (reason: Error) => void = () => undefined;
    vi.mocked(enginePost)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectRetry = reject;
          })
      );

    renderStep();
    await settle(() => {
      resolveFirst({ ok: false, state: 'CONFIG_ERROR', error: "Config table needs key 'bureau_url'" });
    });

    expect(screen.getByRole('heading', { name: 'Unable to check eligibility' })).toBeInTheDocument();
    expect(screen.queryByText(/bureau_url/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByRole('status').textContent).toContain('Checking eligibility...');
    await settle(() => {
      rejectRetry(new Error('Engine qualify: 500 PAN ABCDE1234F'));
    });

    expect(screen.getByRole('heading', { name: 'Unable to check eligibility' })).toBeInTheDocument();
    expect(screen.queryByText(/ABCDE1234F/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Home' })).toBeInTheDocument();
  });
});
