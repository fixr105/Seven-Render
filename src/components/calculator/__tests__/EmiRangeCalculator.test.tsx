import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../i18n';
import { EmiRangeCalculator } from '../EmiRangeCalculator';
import { calculateLoanPreview, computeFinalInvoiceBreakdown } from '../../../lib/loanCalculator';

describe('EmiRangeCalculator', () => {
  it('shows disclaimer and GPS-only baseline before user enters disbursement', () => {
    render(<EmiRangeCalculator />);

    const baseline = calculateLoanPreview({
      upfrontPayment: 0,
      disbursementToDealer: 0,
      tenureMonths: 12,
    });

    expect(screen.getByTestId('emi-range-disclaimer')).toBeInTheDocument();
    expect(screen.getByTestId('emi-range-emi')).toHaveTextContent(
      `₹${baseline.emiAmount.toLocaleString('en-IN')}`
    );
    expect(screen.getByTestId('emi-range-processing-fee')).toHaveTextContent(
      `₹${baseline.processingFee.toLocaleString('en-IN')}`
    );
    expect(screen.getByTestId('emi-range-iot-cost')).toHaveTextContent(
      `₹${baseline.gpsCharges.toLocaleString('en-IN')}`
    );
  });

  it('computes invoice value and loan preview from inputs', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-downpayment'), '20000');
    await user.type(screen.getByTestId('emi-range-disbursement'), '50000');

    expect(screen.getByTestId('emi-range-invoice')).toHaveValue('70000');

    const expected = calculateLoanPreview({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });

    const container = within(screen.getByTestId('emi-range-calculator'));
    expect(container.getByTestId('emi-range-emi')).toHaveTextContent(
      `₹${expected.emiAmount.toLocaleString('en-IN')}`
    );
    expect(container.getByTestId('emi-range-processing-fee')).toHaveTextContent(
      `₹${expected.processingFee.toLocaleString('en-IN')}`
    );
    expect(container.getByTestId('emi-range-iot-cost')).toHaveTextContent(
      `₹${expected.gpsCharges.toLocaleString('en-IN')}`
    );
  });

  it('updates values dynamically when tenure changes', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-disbursement'), '50000');

    const preview12 = calculateLoanPreview({
      upfrontPayment: 0,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });
    const preview18 = calculateLoanPreview({
      upfrontPayment: 0,
      disbursementToDealer: 50000,
      tenureMonths: 18,
    });

    expect(screen.getByTestId('emi-range-iot-cost')).toHaveTextContent('₹2,000');
    expect(screen.getByTestId('emi-range-emi')).toHaveTextContent(
      `₹${preview12.emiAmount.toLocaleString('en-IN')}`
    );

    await user.selectOptions(screen.getByTestId('emi-range-tenure'), '18');

    expect(screen.getByTestId('emi-range-iot-cost')).toHaveTextContent('₹2,500');
    expect(screen.getByTestId('emi-range-emi')).toHaveTextContent(
      `₹${preview18.emiAmount.toLocaleString('en-IN')}`
    );
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('18 months');
  });

  it('does not show percentage fields', () => {
    render(<EmiRangeCalculator />);

    expect(screen.queryByText(/Processing Fee %/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Interest Rate/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-calc-freeze')).not.toBeInTheDocument();
  });

  it('shows stage 2 tabs and computes final invoice with 5% GST', async () => {
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

    const breakdown = computeFinalInvoiceBreakdown(70000, 5000, 2000, 2000);

    expect(screen.getByTestId('emi-range-gst-amount')).toHaveTextContent(
      `₹${breakdown.gstAmount.toLocaleString('en-IN')}`
    );
    expect(screen.getByTestId('emi-range-final-invoice')).toHaveTextContent(
      `₹${breakdown.finalInvoiceAmount.toLocaleString('en-IN')}`
    );
    expect(breakdown.gstAmount).toBe(3950);
    expect(breakdown.finalInvoiceAmount).toBe(82950);
  });

  it('labels IOT, insurance, and registration as including GST', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    expect(screen.getByText('IOT/GPS Charges (₹, including GST)')).toBeInTheDocument();
    expect(screen.getByText('Insurance Cost (₹, including GST)')).toBeInTheDocument();
    await user.click(screen.getByTestId('emi-range-tab-registration'));
    expect(screen.getByText('Registration Cost (₹, including GST)')).toBeInTheDocument();
    expect(screen.getByText('GST Amount (5%)')).toBeInTheDocument();
  });
});
