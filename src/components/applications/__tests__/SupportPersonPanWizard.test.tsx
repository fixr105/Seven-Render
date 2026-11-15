import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupportPersonPanWizard } from '../SupportPersonPanWizard';
import { createInitialB2cEvFormData } from '../../../config/forms/b2cEvFormSchema';
import type { BureauOutcome } from '../../../lib/runBureauAndFill';

const baseProps = {
  fieldErrors: {},
  loading: false,
  loadingMessage: '',
  lookupError: null as string | null,
  bureauOutcome: null as BureauOutcome | null,
  manualMode: false,
  autofilledKeys: [] as string[],
  consentChecked: false,
  addresses: [] as BureauOutcome['addresses'],
  addressIndex: 0,
  onFieldChange: vi.fn(),
  onSupportTypeChange: vi.fn(),
  onConsentChange: vi.fn(),
  onVerify: vi.fn(),
  onUseDifferent: vi.fn(),
  onEnterManual: vi.fn(),
  onAddressIndexChange: vi.fn(),
};

describe('SupportPersonPanWizard', () => {
  it('uppercases co-applicant Full Name and PAN as typed', async () => {
    const user = userEvent.setup();
    const onFieldChange = vi.fn();
    render(
      <SupportPersonPanWizard
        {...baseProps}
        onFieldChange={onFieldChange}
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          '_meta.supportPanLookup.fullName': '',
          '_meta.supportPanLookup.mobileNumber': '',
          '_meta.supportPanLookup.panNumber': '',
        }}
      />
    );

    await user.type(screen.getByTestId('b2c-field-_meta-supportPanLookup-panNumber'), 'k');
    await user.type(screen.getByTestId('b2c-field-_meta-supportPanLookup-fullName'), 's');
    expect(onFieldChange).toHaveBeenCalledWith('_meta.supportPanLookup.panNumber', 'K');
    expect(onFieldChange).toHaveBeenCalledWith('_meta.supportPanLookup.fullName', 'S');
    expect(screen.getByTestId('b2c-field-_meta-supportPanLookup-panNumber')).toHaveAttribute(
      'autocapitalize',
      'characters'
    );
  });

  it('disables Verify until name, mobile, PAN and consent are valid', async () => {
    const user = userEvent.setup();
    const onConsentChange = vi.fn();
    const { rerender } = render(
      <SupportPersonPanWizard
        {...baseProps}
        onConsentChange={onConsentChange}
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          '_meta.supportPanLookup.fullName': 'AB',
          '_meta.supportPanLookup.mobileNumber': '9876543210',
          '_meta.supportPanLookup.panNumber': 'ABCDE1234F',
        }}
      />
    );

    expect(screen.getByTestId('b2c-support-pan-verify')).toBeDisabled();

    rerender(
      <SupportPersonPanWizard
        {...baseProps}
        consentChecked={false}
        onConsentChange={onConsentChange}
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          '_meta.supportPanLookup.fullName': 'PRIYA SHARMA',
          '_meta.supportPanLookup.mobileNumber': '9876543210',
          '_meta.supportPanLookup.panNumber': 'ABCDE1234F',
        }}
      />
    );
    expect(screen.getByTestId('b2c-support-pan-verify')).toBeDisabled();

    rerender(
      <SupportPersonPanWizard
        {...baseProps}
        consentChecked
        onConsentChange={onConsentChange}
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          '_meta.supportPanLookup.fullName': 'PRIYA SHARMA',
          '_meta.supportPanLookup.mobileNumber': '9876543210',
          '_meta.supportPanLookup.panNumber': 'ABCDE1234F',
        }}
      />
    );
    expect(screen.getByTestId('b2c-support-pan-verify')).not.toBeDisabled();
    await user.click(screen.getByTestId('b2c-support-bureau-consent'));
    expect(onConsentChange).toHaveBeenCalled();
  });

  it('shows loading copy while verifying', () => {
    render(
      <SupportPersonPanWizard
        {...baseProps}
        loading
        loadingMessage="Checking co-applicant…"
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
        }}
      />
    );
    expect(screen.getByTestId('support-pan-phase-loading')).toHaveTextContent(
      /Checking co-applicant/i
    );
  });

  it('shows pass profile with From bureau tags', () => {
    const outcome: BureauOutcome = {
      status: 'pass',
      raw: { ok: true, pass: true },
      formDataPatch: { 'coApplicant.name': 'PRIYA SHARMA' },
      reasons: [],
      addresses: [],
      autofilledKeys: ['coApplicant.name', 'coApplicant.dob'],
      meta: {
        status: 'pass',
        is_ntc: false,
        bureau_ref: 'AL1',
        cached: false,
        failed_codes: [],
        checked_at: '2026-11-15T01:00:00.000Z',
        pan: 'ABCDE1234F',
      },
      metaKey: '_meta.coApplicantBureau',
    };
    render(
      <SupportPersonPanWizard
        {...baseProps}
        bureauOutcome={outcome}
        autofilledKeys={outcome.autofilledKeys}
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          'coApplicant.name': 'PRIYA SHARMA',
          'coApplicant.pan': 'ABCDE1234F',
          'coApplicant.dob': '1992-09-30',
        }}
      />
    );
    expect(screen.getByTestId('support-bureau-pass')).toHaveTextContent(/verified/i);
    expect(screen.getByTestId('bureau-tag-coApplicant-name')).toBeInTheDocument();
  });

  it('shows manual entry message when empty applicant', () => {
    render(
      <SupportPersonPanWizard
        {...baseProps}
        manualMode
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          '_meta.supportPanLookup.status': 'manual',
        }}
      />
    );
    expect(screen.getByTestId('support-pan-profile-message')).toHaveTextContent(
      /No details found, please enter manually/i
    );
  });

  it('shows fail as check results only — not a rejection', async () => {
    const user = userEvent.setup();
    const onUseDifferent = vi.fn();
    const outcome: BureauOutcome = {
      status: 'fail',
      raw: { ok: true, pass: false },
      formDataPatch: { 'coApplicant.name': 'PRIYA SHARMA' },
      reasons: ['Credit card overdue amount exceeds limit'],
      addresses: [],
      autofilledKeys: ['coApplicant.name'],
      meta: {
        status: 'fail',
        is_ntc: false,
        bureau_ref: 'AL1',
        cached: false,
        failed_codes: ['CC_OVERDUE_GT_5000'],
        checked_at: '2026-11-15T01:00:00.000Z',
        pan: 'ABCDE1234F',
      },
      metaKey: '_meta.coApplicantBureau',
    };
    render(
      <SupportPersonPanWizard
        {...baseProps}
        bureauOutcome={outcome}
        onUseDifferent={onUseDifferent}
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          'coApplicant.name': 'PRIYA SHARMA',
        }}
      />
    );
    expect(screen.getByTestId('support-bureau-fail')).toHaveTextContent(
      /Check complete|does not reject/i
    );
    expect(screen.queryByTestId('support-bureau-continue-anyway')).not.toBeInTheDocument();
    expect(screen.queryByText(/Rejected/i)).not.toBeInTheDocument();
    await user.click(screen.getByTestId('support-bureau-use-different'));
    expect(onUseDifferent).toHaveBeenCalled();
  });
});
