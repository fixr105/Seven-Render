import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { B2cEvApplicationReview } from '../B2cEvApplicationReview';

vi.mock('../KamClientKycPanel', () => ({
  KamClientKycPanel: () => <div data-testid="kam-client-kyc-panel" />,
}));

vi.mock('../../CibilProbabilityBar', () => ({
  CibilProbabilityBar: () => <div data-testid="cibil-probability-bar" />,
}));

vi.mock('../../../services/api', () => ({
  apiService: {
    kamB2cComplianceAction: vi.fn(),
    kamB2cDoRequestAction: vi.fn(),
  },
}));

const baseFormData = {
  '_meta.formTemplate': 'b2c_ev_v1',
  '_meta.supportPersonType': 'none',
  'borrower.firstName': 'Ajay',
  'borrower.lastName': 'Kumar',
  'borrower.cibilScore': '720',
  'borrower.mobile': '9876543210',
  'loan.amount': '500000',
  'compliance.vkycDone': 'false',
  '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
};

describe('B2cEvApplicationReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders staged review and compliance section', () => {
    render(
      <B2cEvApplicationReview
        formData={baseFormData}
        applicationId="app-1"
        userRole="kam"
        clientId="CL-1"
      />
    );

    expect(screen.getByTestId('b2c-ev-application-review')).toBeInTheDocument();
    expect(screen.getByTestId('cibil-probability-bar')).toBeInTheDocument();
    expect(screen.getByTestId('kam-client-kyc-panel')).toBeInTheDocument();
    expect(screen.getByTestId('b2c-compliance-review')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-review-vkyc')).toBeInTheDocument();
  });
});
