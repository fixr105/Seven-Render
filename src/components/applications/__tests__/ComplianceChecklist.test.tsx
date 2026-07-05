import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComplianceChecklist } from '../ComplianceChecklist';
import { createInitialB2cEvFormData } from '../../../config/forms/b2cEvFormSchema';

describe('ComplianceChecklist', () => {
  it('renders three compliance rows with request buttons', () => {
    render(
      <ComplianceChecklist
        formData={createInitialB2cEvFormData()}
        fieldErrors={{}}
        requestingItemId={null}
        onCheckboxChange={vi.fn()}
        onRequestFromKam={vi.fn()}
      />
    );

    expect(screen.getByTestId('compliance-item-vkyc')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-item-loanAgreement')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-item-enach')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-request-kam-vkyc')).toHaveTextContent('Request from KAM');
  });

  it('calls onRequestFromKam when request button is clicked', async () => {
    const user = userEvent.setup();
    const onRequestFromKam = vi.fn();

    render(
      <ComplianceChecklist
        formData={createInitialB2cEvFormData()}
        fieldErrors={{}}
        requestingItemId={null}
        onCheckboxChange={vi.fn()}
        onRequestFromKam={onRequestFromKam}
      />
    );

    await user.click(screen.getByTestId('compliance-request-kam-enach'));
    expect(onRequestFromKam).toHaveBeenCalledWith('enach');
  });

  it('disables loan agreement request button when checkbox is checked', () => {
    render(
      <ComplianceChecklist
        formData={{
          ...createInitialB2cEvFormData(),
          'compliance.loanAgreementSigned': true,
        }}
        fieldErrors={{}}
        requestingItemId={null}
        onCheckboxChange={vi.fn()}
        onRequestFromKam={vi.fn()}
      />
    );

    expect(screen.getByTestId('compliance-request-kam-loanAgreement')).toBeDisabled();
    expect(screen.getByTestId('compliance-request-kam-vkyc')).not.toBeDisabled();
  });

  it('disables request button after item was requested', () => {
    render(
      <ComplianceChecklist
        formData={{
          ...createInitialB2cEvFormData(),
          '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
        }}
        fieldErrors={{}}
        requestingItemId={null}
        onCheckboxChange={vi.fn()}
        onRequestFromKam={vi.fn()}
      />
    );

    expect(screen.getByTestId('compliance-request-kam-vkyc')).toBeDisabled();
    expect(screen.getByTestId('compliance-requested-vkyc')).toBeInTheDocument();
  });
});
