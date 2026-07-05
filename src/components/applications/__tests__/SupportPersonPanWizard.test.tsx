import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupportPersonPanWizard } from '../SupportPersonPanWizard';
import { createInitialB2cEvFormData } from '../../../config/forms/b2cEvFormSchema';

describe('SupportPersonPanWizard', () => {
  it('shows type selection and PAN inputs in input phase', () => {
    render(
      <SupportPersonPanWizard
        formData={{ ...createInitialB2cEvFormData(), '_meta.supportPersonType': 'co_applicant' }}
        fieldErrors={{}}
        loading={false}
        loadingMessage=""
        lookupError={null}
        onFieldChange={vi.fn()}
        onSupportTypeChange={vi.fn()}
        onVerify={vi.fn()}
      />
    );

    expect(screen.getByTestId('support-person-co_applicant')).toBeInTheDocument();
    expect(screen.getByTestId('b2c-field-_meta-supportPanLookup-mobileNumber')).toBeInTheDocument();
    expect(screen.getByTestId('b2c-support-pan-verify')).toBeInTheDocument();
  });

  it('shows loading message in loading phase', () => {
    render(
      <SupportPersonPanWizard
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          '_meta.supportPanLookup.phase': 'loading',
        }}
        fieldErrors={{}}
        loading={true}
        loadingMessage="Fetching support person details… 120s remaining"
        lookupError={null}
        onFieldChange={vi.fn()}
        onSupportTypeChange={vi.fn()}
        onVerify={vi.fn()}
      />
    );

    expect(screen.getByTestId('support-pan-phase-loading')).toHaveTextContent('120s remaining');
  });

  it('shows editable profile fields in profile phase', () => {
    render(
      <SupportPersonPanWizard
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          '_meta.supportPanLookup.phase': 'profile',
          'coApplicant.name': 'PRIYA SHARMA',
          'coApplicant.pan': 'FGHIJ5678K',
        }}
        fieldErrors={{}}
        loading={false}
        loadingMessage=""
        lookupError={null}
        onFieldChange={vi.fn()}
        onSupportTypeChange={vi.fn()}
        onVerify={vi.fn()}
      />
    );

    const nameInput = screen.getByTestId('b2c-field-coApplicant-name');
    expect(nameInput).toHaveValue('PRIYA SHARMA');
    expect(nameInput).not.toHaveAttribute('readonly');
    expect(screen.getByTestId('b2c-field-coApplicant-relationship')).toBeInTheDocument();
  });

  it('shows manual entry message when PAN lookup had no results', () => {
    render(
      <SupportPersonPanWizard
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.supportPersonType': 'co_applicant',
          '_meta.supportPanLookup.phase': 'profile',
          '_meta.supportPanLookup.status': 'manual',
          'coApplicant.name': 'PRIYA SHARMA',
          'coApplicant.pan': 'FGHIJ5678K',
        }}
        fieldErrors={{}}
        loading={false}
        loadingMessage=""
        lookupError={null}
        onFieldChange={vi.fn()}
        onSupportTypeChange={vi.fn()}
        onVerify={vi.fn()}
      />
    );

    expect(screen.getByTestId('support-pan-profile-message')).toHaveTextContent(
      /PAN verification returned no results/i
    );
  });

  it('calls onVerify when Verify PAN is clicked', async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn();

    render(
      <SupportPersonPanWizard
        formData={{ ...createInitialB2cEvFormData(), '_meta.supportPersonType': 'guarantor' }}
        fieldErrors={{}}
        loading={false}
        loadingMessage=""
        lookupError={null}
        onFieldChange={vi.fn()}
        onSupportTypeChange={vi.fn()}
        onVerify={onVerify}
      />
    );

    await user.click(screen.getByTestId('b2c-support-pan-verify'));
    expect(onVerify).toHaveBeenCalled();
  });
});
