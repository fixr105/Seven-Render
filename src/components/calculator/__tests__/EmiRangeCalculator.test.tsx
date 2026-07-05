import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../i18n';
import { EmiRangeCalculator } from '../EmiRangeCalculator';
import { calculateEmiRangePreview } from '../../../lib/loanCalculator';

describe('EmiRangeCalculator', () => {
  it('shows disclaimer and GPS-only baseline before user enters disbursement', () => {
    render(<EmiRangeCalculator />);

    const baseline = calculateEmiRangePreview({
      upfrontPayment: 0,
      disbursementToDealer: 0,
    });

    expect(screen.getByTestId('emi-range-disclaimer')).toBeInTheDocument();
    expect(screen.getByTestId('emi-range-lowest-emi')).toHaveTextContent(
      `₹${baseline.lowestEmi.toLocaleString('en-IN')}`
    );
    expect(screen.getByTestId('emi-range-highest-emi')).toHaveTextContent(
      `₹${baseline.highestEmi.toLocaleString('en-IN')}`
    );
    expect(screen.getByTestId('emi-range-lowest-processing-fee')).toHaveTextContent(
      `₹${baseline.lowestProcessingFee.toLocaleString('en-IN')}`
    );
    expect(screen.getByTestId('emi-range-highest-processing-fee')).toHaveTextContent(
      `₹${baseline.highestProcessingFee.toLocaleString('en-IN')}`
    );
  });

  it('computes invoice value and EMI/processing fee ranges from inputs', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-downpayment'), '20000');
    await user.type(screen.getByTestId('emi-range-disbursement'), '50000');

    expect(screen.getByTestId('emi-range-invoice')).toHaveValue('70000');

    const expected = calculateEmiRangePreview({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
    });

    const container = within(screen.getByTestId('emi-range-calculator'));
    expect(container.getByTestId('emi-range-lowest-emi')).toHaveTextContent(
      `₹${expected.lowestEmi.toLocaleString('en-IN')}`
    );
    expect(container.getByTestId('emi-range-highest-emi')).toHaveTextContent(
      `₹${expected.highestEmi.toLocaleString('en-IN')}`
    );
    expect(container.getByTestId('emi-range-lowest-processing-fee')).toHaveTextContent(
      `₹${expected.lowestProcessingFee.toLocaleString('en-IN')}`
    );
    expect(container.getByTestId('emi-range-highest-processing-fee')).toHaveTextContent(
      `₹${expected.highestProcessingFee.toLocaleString('en-IN')}`
    );
  });

  it('does not show percentage fields', () => {
    render(<EmiRangeCalculator />);

    expect(screen.queryByText(/Processing Fee %/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Interest Rate/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-calc-freeze')).not.toBeInTheDocument();
  });

  it('shows stage 2 tabs and computes final invoice amount from insurance and registration', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    expect(screen.getByTestId('emi-range-calculator-stage2')).toBeInTheDocument();
    expect(screen.getByTestId('emi-range-tab-insurance')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('emi-range-tab-registration')).toHaveAttribute('aria-selected', 'false');

    await user.type(screen.getByTestId('emi-range-downpayment'), '20000');
    await user.type(screen.getByTestId('emi-range-disbursement'), '50000');
    await user.type(screen.getByTestId('emi-range-insurance-cost'), '5000');

    await user.click(screen.getByTestId('emi-range-tab-registration'));
    expect(screen.getByTestId('emi-range-tab-registration')).toHaveAttribute('aria-selected', 'true');
    await user.type(screen.getByTestId('emi-range-registration-cost'), '2000');

    expect(screen.getByTestId('emi-range-final-invoice')).toHaveValue('77000');
  });
});
