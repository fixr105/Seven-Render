import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { B2cEvComplianceReview } from '../B2cEvComplianceReview';

describe('B2cEvComplianceReview', () => {
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
});
