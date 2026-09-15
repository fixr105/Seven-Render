import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CibilProbabilityBar } from '../CibilProbabilityBar';

vi.mock('../../../lib/b2cEvCibilProbability', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/b2cEvCibilProbability')>(
    '../../../lib/b2cEvCibilProbability'
  );
  return {
    ...actual,
    fetchCibilChances: vi.fn(),
  };
});

import { fetchCibilChances } from '../../../lib/b2cEvCibilProbability';

describe('CibilProbabilityBar', () => {
  beforeEach(() => {
    vi.mocked(fetchCibilChances).mockReset();
  });

  it('renders nothing when cibilScore is null', () => {
    const { container } = render(<CibilProbabilityBar cibilScore={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows label from fetched chances', async () => {
    vi.mocked(fetchCibilChances).mockResolvedValue({
      score: 40,
      label: 'Chances with Co-applicant',
    });
    render(<CibilProbabilityBar cibilScore={620} />);
    await waitFor(() => {
      expect(screen.getByTestId('cibil-probability-bar')).toBeInTheDocument();
    });
    expect(screen.getByText('Chances with Co-applicant')).toBeInTheDocument();
    expect(screen.getByTestId('cibil-probability-marker')).toBeInTheDocument();
  });

  it('uses controlled chances without fetching', () => {
    render(
      <CibilProbabilityBar
        cibilScore={720}
        chances={{ score: 90, label: 'High Chance' }}
      />
    );
    expect(screen.getByText('High Chance')).toBeInTheDocument();
    expect(fetchCibilChances).not.toHaveBeenCalled();
  });
});
