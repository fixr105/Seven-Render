import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DoColumnLink } from '../DoColumnLink';
import { RecentApplicationsSection } from '../../dashboard/RecentApplicationsSection';
import type { LoanApplication } from '../../../hooks/useApplications';

function application(overrides: Partial<LoanApplication> & { DO?: string } = {}): LoanApplication {
  return {
    id: 'rec1',
    file_number: 'SF001',
    client_id: 'c1',
    applicant_name: 'Ajay',
    loan_product_id: null,
    requested_loan_amount: 500000,
    status: 'pending',
    assigned_credit_analyst: null,
    assigned_nbfc_id: null,
    lender_decision_status: null,
    lender_decision_date: null,
    lender_decision_remarks: null,
    approved_loan_amount: null,
    ai_file_summary: null,
    form_data: {},
    created_at: '2026-11-01T00:00:00.000Z',
    submitted_at: null,
    updated_at: '2026-11-02T00:00:00.000Z',
    client: { company_name: 'Dealer' },
    loan_product: { name: 'EV', code: 'EV' },
    ...overrides,
  };
}

describe('DO column', () => {
  it('renders View DO for an https link and an em dash otherwise', () => {
    const { rerender } = render(<DoColumnLink value="https://files.example/do.pdf" />);
    const link = screen.getByTestId('do-column-view');
    expect(link).toHaveAttribute('href', 'https://files.example/do.pdf');
    expect(link).toHaveAttribute('target', '_blank');

    rerender(<DoColumnLink value="" />);
    expect(screen.getByTestId('do-column-empty')).toHaveTextContent('—');
  });

  it('shows the dashboard cell from form data', () => {
    render(
      <RecentApplicationsSection
        role="kam"
        loading={false}
        applications={[
          application({
            form_data: {
              '_meta.doApproval': { doUrl: 'https://files.example/meta.pdf', checklist: ['IoT live'] },
            },
          }),
          application({ id: 'rec2', file_number: 'SF002', form_data: {} }),
        ]}
        onViewAll={() => undefined}
        onRowClick={() => undefined}
      />
    );

    const links = screen.getAllByTestId('do-column-view');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', 'https://files.example/meta.pdf');
    expect(screen.getAllByTestId('do-column-empty')[0]).toHaveTextContent('—');
  });
});
