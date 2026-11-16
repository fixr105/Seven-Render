import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
  '_meta.panLookup.status': 'success',
  '_meta.panLookup.cibilScore': '720',
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

  it('lists saved KYC files with a count on a reopened draft', () => {
    render(
      <B2cEvApplicationReview
        formData={{
          ...baseFormData,
          '_meta.supportPersonType': 'co_applicant',
          'coApplicant.pan': 'ABCDE1234F',
          'coApplicant.mobile': '9876543210',
          '_meta.kycDocuments.uploads': {
            pan_card: { url: 'https://files.example/pan.jpg', filename: 'pan.jpg' },
            co_applicant_pan: { url: 'https://files.example/co.jpg', filename: 'co-pan.jpg' },
          },
        }}
        applicationId="app-1"
        userRole="kam"
        clientId="CL-1"
      />
    );

    const row = screen.getByRole('button', { name: /KYC & Documents/i });
    expect(row).toHaveTextContent('2 files');
    fireEvent.click(row);

    const panLink = screen.getByRole('link', { name: 'pan.jpg' });
    expect(panLink).toHaveAttribute('href', 'https://files.example/pan.jpg');
    expect(screen.getByText('PAN Card')).toBeInTheDocument();
    expect(screen.getByText('Applicant')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'co-pan.jpg' })).toHaveAttribute(
      'href',
      'https://files.example/co.jpg'
    );
    expect(screen.getByText('Co-applicant')).toBeInTheDocument();
  });

  it('says no documents were uploaded when the KYC section is empty', () => {
    render(
      <B2cEvApplicationReview
        formData={baseFormData}
        applicationId="app-1"
        userRole="client"
        clientId="CL-1"
      />
    );

    const row = screen.getByRole('button', { name: /KYC & Documents/i });
    expect(row).toHaveTextContent('0 files');
    fireEvent.click(row);
    expect(screen.getByText(/no documents uploaded/i)).toBeInTheDocument();
  });
});
