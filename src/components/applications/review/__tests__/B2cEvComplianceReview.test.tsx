import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { B2cEvComplianceReview } from '../B2cEvComplianceReview';

describe('B2cEvComplianceReview', () => {
  it('renders read-only compliance status without action buttons', () => {
    render(
      <B2cEvComplianceReview
        formData={{
          'compliance.vkycDone': false,
          '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
          '_meta.doRequest.requestedAt': '2026-01-02T00:00:00.000Z',
        }}
      />
    );

    expect(screen.getByTestId('b2c-compliance-review')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-review-vkyc')).toBeInTheDocument();
    expect(screen.getByTestId('b2c-do-request-review')).toBeInTheDocument();
    expect(screen.getByTestId('b2c-document-readiness-review')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark complete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark do processed/i })).not.toBeInTheDocument();
  });
});
