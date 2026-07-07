import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../i18n';
import { EmiRangeCalculator } from '../EmiRangeCalculator';
import {
  calculateTenureEmiRangePreviews,
  computeFinalInvoiceBreakdown,
  computeGstComponent,
  FEE_PCT_MAX,
  FEE_PCT_MIN,
  INTEREST_RATE_MAX,
  INTEREST_RATE_MIN,
} from '../../../lib/loanCalculator';

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

describe('EmiRangeCalculator', () => {
  it('shows lowest and highest EMI scenarios for default 12-month tenure', () => {
    render(<EmiRangeCalculator />);

    const { lowPreview, highPreview } = calculateTenureEmiRangePreviews({
      upfrontPayment: 0,
      disbursementToDealer: 0,
      tenureMonths: 12,
    });

    expect(screen.getByTestId('emi-range-disclaimer')).toBeInTheDocument();
    expect(screen.getByTestId('emi-range-low-emi')).toHaveTextContent(formatRupee(lowPreview.emiAmount));
    expect(screen.getByTestId('emi-range-high-emi')).toHaveTextContent(formatRupee(highPreview.emiAmount));
    expect(screen.getByTestId('emi-range-low-loan-scenario')).toHaveTextContent('Lowest EMI');
    expect(screen.getByTestId('emi-range-high-loan-scenario')).toHaveTextContent('Highest EMI');
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('12 months');
    expect(lowPreview.emiAmount).toBeLessThan(highPreview.emiAmount);
    expect(lowPreview.interestRate).toBe(INTEREST_RATE_MIN);
    expect(highPreview.interestRate).toBe(INTEREST_RATE_MAX);
    expect(lowPreview.processingFeePctDisplay).toBe(FEE_PCT_MIN * 100);
    expect(highPreview.processingFeePctDisplay).toBe(FEE_PCT_MAX * 100);
  });

  it('computes invoice value and both EMI scenarios from inputs', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-downpayment'), '20000');
    await user.type(screen.getByTestId('emi-range-disbursement'), '50000');

    expect(screen.getByTestId('emi-range-invoice')).toHaveValue('70000');

    const { lowPreview, highPreview } = calculateTenureEmiRangePreviews({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });
    const container = within(screen.getByTestId('emi-range-calculator'));

    expect(container.getByTestId('emi-range-low-emi')).toHaveTextContent(formatRupee(lowPreview.emiAmount));
    expect(container.getByTestId('emi-range-high-emi')).toHaveTextContent(formatRupee(highPreview.emiAmount));
    expect(container.getByTestId('emi-range-low-loan-amount')).toHaveTextContent(
      formatRupee(lowPreview.loanAmount)
    );
    expect(container.getByTestId('emi-range-high-loan-amount')).toHaveTextContent(
      formatRupee(highPreview.loanAmount)
    );
  });

  it('updates lowest and highest EMI when tenure changes', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-disbursement'), '50000');

    const range12 = calculateTenureEmiRangePreviews({
      upfrontPayment: 0,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });
    const range18 = calculateTenureEmiRangePreviews({
      upfrontPayment: 0,
      disbursementToDealer: 50000,
      tenureMonths: 18,
    });

    expect(screen.getByTestId('emi-range-low-emi')).toHaveTextContent(
      formatRupee(range12.lowPreview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-high-emi')).toHaveTextContent(
      formatRupee(range12.highPreview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('12 months');

    await user.selectOptions(screen.getByTestId('emi-range-tenure'), '18');

    expect(screen.getByTestId('emi-range-low-emi')).toHaveTextContent(
      formatRupee(range18.lowPreview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-high-emi')).toHaveTextContent(
      formatRupee(range18.highPreview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('18 months');
    expect(screen.getByTestId('emi-range-low-iot-cost')).toHaveTextContent(
      formatRupee(computeGstComponent(range18.lowPreview.gpsCharges).inclusiveAmount)
    );
  });

  it('does not show percentage fields', () => {
    render(<EmiRangeCalculator />);

    expect(screen.queryByText(/^Processing Fee %$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Interest Rate/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-calc-freeze')).not.toBeInTheDocument();
  });

  it('shows stage 2 final invoice for selected tenure', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-downpayment'), '20000');
    await user.type(screen.getByTestId('emi-range-disbursement'), '50000');
    await user.type(screen.getByTestId('emi-range-insurance-cost'), '5000');

    await user.click(screen.getByTestId('emi-range-tab-registration'));
    await user.type(screen.getByTestId('emi-range-registration-cost'), '2000');

    const breakdown = computeFinalInvoiceBreakdown(70000, 5000, 2000, 2000);

    expect(screen.getByTestId('emi-range-gst-amount')).toHaveTextContent(
      `₹${breakdown.gstAmount.toLocaleString('en-IN')}`
    );
    expect(screen.getByTestId('emi-range-final-invoice')).toHaveTextContent(
      `₹${breakdown.finalInvoiceAmount.toLocaleString('en-IN')}`
    );
    expect(breakdown.gstAmount).toBe(450);
    expect(breakdown.finalInvoiceAmount).toBe(79450);
    expect(screen.getByTestId('emi-range-final-iot')).toHaveTextContent('₹2,100');
  });

  it('labels IOT, insurance, and registration as including GST', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    expect(screen.getAllByText('IOT/GPS Charges (₹, including GST)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Insurance Cost (₹, including GST)').length).toBeGreaterThan(0);
    await user.click(screen.getByTestId('emi-range-tab-registration'));
    expect(screen.getAllByText('Registration Cost (₹, including GST)').length).toBeGreaterThan(0);
    expect(screen.getByText('GST Amount (5%)')).toBeInTheDocument();
  });
});
