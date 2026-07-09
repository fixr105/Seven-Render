import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../i18n';
import { EmiRangeCalculator } from '../EmiRangeCalculator';
import {
  calculateB2cTenureEmiRangePreviews,
  computeGstComponent,
  FEE_PCT_MAX,
  FEE_PCT_MIN,
  INTEREST_RATE_MAX,
  INTEREST_RATE_MIN,
} from '../../../lib/loanCalculator';

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

const SAMPLE_INPUTS = {
  vehiclePrice: 100000,
  gstRate: 0.05 as const,
  insurance: 2000,
  registration: 1000,
  accessories: 1000,
  customerPayment: 20000,
  tenureMonths: 12 as const,
};

describe('EmiRangeCalculator', () => {
  it('shows lowest EMI on the left and highest EMI on the right for default 12-month tenure', () => {
    render(<EmiRangeCalculator />);

    const { lowPreview, highPreview } = calculateB2cTenureEmiRangePreviews({
      vehiclePrice: 0,
      gstRate: 0.05,
      insurance: 0,
      registration: 0,
      accessories: 0,
      customerPayment: 0,
      tenureMonths: 12,
    });

    const scenarios = screen.getAllByTestId(/emi-range-(low|high)-loan-scenario$/);
    expect(scenarios[0]).toHaveAttribute('data-testid', 'emi-range-low-loan-scenario');
    expect(scenarios[1]).toHaveAttribute('data-testid', 'emi-range-high-loan-scenario');
    expect(screen.getByTestId('emi-range-low-scenario-emi')).toHaveTextContent(formatRupee(lowPreview.emiAmount));
    expect(screen.getByTestId('emi-range-high-scenario-emi')).toHaveTextContent(formatRupee(highPreview.emiAmount));
    expect(screen.getByTestId('emi-range-low-loan-scenario')).toHaveTextContent('Lowest EMI');
    expect(screen.getByTestId('emi-range-high-loan-scenario')).toHaveTextContent('Highest EMI');
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('12 months');
    expect(lowPreview.emiAmount).toBeLessThan(highPreview.emiAmount);
    expect(lowPreview.interestRate).toBe(INTEREST_RATE_MIN);
    expect(highPreview.interestRate).toBe(INTEREST_RATE_MAX);
    expect(lowPreview.processingFee).toBe(Math.round(lowPreview.loanAmount * FEE_PCT_MIN));
    expect(highPreview.processingFee).toBe(Math.round(highPreview.loanAmount * FEE_PCT_MAX));
    expect(lowPreview.loanAmount).toBeLessThan(highPreview.loanAmount);
  });

  it('computes tax invoice and both EMI scenarios from vehicle-price inputs', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-insurance'), '2000');
    await user.type(screen.getByTestId('emi-range-registration'), '1000');
    await user.type(screen.getByTestId('emi-range-accessories'), '1000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '20000');

    expect(screen.getByTestId('emi-range-tax-invoice')).toHaveValue('111000');

    const { lowPreview, highPreview } = calculateB2cTenureEmiRangePreviews({
      ...SAMPLE_INPUTS,
      tenureMonths: 12,
    });
    const container = within(screen.getByTestId('emi-range-calculator'));

    expect(container.getByTestId('emi-range-low-scenario-emi')).toHaveTextContent(formatRupee(lowPreview.emiAmount));
    expect(container.getByTestId('emi-range-high-scenario-emi')).toHaveTextContent(formatRupee(highPreview.emiAmount));
    expect(container.getByTestId('emi-range-low-scenario-loan-amount')).toHaveTextContent(
      formatRupee(lowPreview.loanAmount)
    );
    expect(container.getByTestId('emi-range-high-scenario-loan-amount')).toHaveTextContent(
      formatRupee(highPreview.loanAmount)
    );
  });

  it('updates lowest and highest EMI when tenure changes between 12 and 18 months', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '20000');

    const range12 = calculateB2cTenureEmiRangePreviews({
      vehiclePrice: 100000,
      gstRate: 0.05,
      insurance: 0,
      registration: 0,
      accessories: 0,
      customerPayment: 20000,
      tenureMonths: 12,
    });
    const range18 = calculateB2cTenureEmiRangePreviews({
      vehiclePrice: 100000,
      gstRate: 0.05,
      insurance: 0,
      registration: 0,
      accessories: 0,
      customerPayment: 20000,
      tenureMonths: 18,
    });

    expect(screen.getByTestId('emi-range-low-scenario-emi')).toHaveTextContent(
      formatRupee(range12.lowPreview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-high-scenario-emi')).toHaveTextContent(
      formatRupee(range12.highPreview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('12 months');

    await user.selectOptions(screen.getByTestId('emi-range-tenure'), '18');

    expect(screen.getByTestId('emi-range-low-scenario-emi')).toHaveTextContent(
      formatRupee(range18.lowPreview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-high-scenario-emi')).toHaveTextContent(
      formatRupee(range18.highPreview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('18 months');
    expect(screen.getByTestId('emi-range-low-scenario-iot-cost')).toHaveTextContent(
      formatRupee(computeGstComponent(range18.lowPreview.gpsCharges).inclusiveAmount)
    );
  });

  it('does not show percentage fields or freeze controls', () => {
    render(<EmiRangeCalculator />);

    expect(screen.queryByText(/^Processing Fee %$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Interest Rate/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-calc-freeze')).not.toBeInTheDocument();
  });

  it('shows draft tax invoice breakdowns when customer payment meets 10% minimum', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-insurance'), '2000');
    await user.type(screen.getByTestId('emi-range-registration'), '1000');
    await user.type(screen.getByTestId('emi-range-accessories'), '1000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '20000');

    expect(screen.getByTestId('emi-range-calculator-stage2')).toBeInTheDocument();
    expect(screen.getByTestId('emi-range-low-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('emi-range-high-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('emi-range-low-tax-invoice')).toHaveTextContent('₹1,11,000');
    expect(screen.getByTestId('emi-range-high-tax-invoice')).toHaveTextContent('₹1,11,000');
  });

  it('does not show customer payment warning before user enters a payment amount', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');

    expect(screen.queryByTestId('emi-range-customer-payment-error')).not.toBeInTheDocument();
  });

  it('warns when customer payment is below 10% of tax invoice value', async () => {
    const user = userEvent.setup();
    render(<EmiRangeCalculator />);

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '5000');

    expect(screen.getByTestId('emi-range-customer-payment-error')).toBeInTheDocument();
    expect(screen.queryByTestId('emi-range-calculator-stage2')).not.toBeInTheDocument();
  });

  it('offers 12 and 18 month tenure options only', () => {
    render(<EmiRangeCalculator />);

    const tenureSelect = screen.getByTestId('emi-range-tenure') as HTMLSelectElement;
    const optionValues = Array.from(tenureSelect.options).map((option) => option.value);
    expect(optionValues).toEqual(['12', '18']);
  });
});
