import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CibilProbabilityBar } from '../CibilProbabilityBar';

describe('CibilProbabilityBar', () => {
  it('renders nothing when score is null', () => {
    const { container } = render(<CibilProbabilityBar cibilScore={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows tier label without displaying the numeric score', () => {
    render(<CibilProbabilityBar cibilScore={620} />);
    expect(screen.getByTestId('cibil-probability-bar')).toBeInTheDocument();
    expect(screen.getByText('Chances with co applicant')).toBeInTheDocument();
    expect(screen.queryByText('620')).not.toBeInTheDocument();
    expect(screen.getByTestId('cibil-probability-marker')).toBeInTheDocument();
  });

  it('shows full chance label for high scores', () => {
    render(<CibilProbabilityBar cibilScore={720} />);
    expect(screen.getByText('90% chance')).toBeInTheDocument();
    expect(screen.queryByText('720')).not.toBeInTheDocument();
  });
});
