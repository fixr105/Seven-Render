import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoanCalculator } from '../LoanCalculator';
import {
  calculateB2cLoanPreview,
  type LoanFrozenValues,
} from '../../../lib/loanCalculator';

describe('LoanCalculator', () => {
  it('shows empty stage 2 placeholders until values are frozen', () => {
    render(<LoanCalculator frozenValues={null} onFrozenValuesChange={vi.fn()} />);

    expect(screen.getByTestId('loan-form-amount')).toHaveAttribute(
      'placeholder',
      'Freeze values in calculator first.'
    );
    expect(screen.getByTestId('loan-form-amount')).toBeDisabled();
    expect(screen.getByTestId('loan-form-amount')).toHaveAttribute('readonly');
  });

  it('freezes live calculation into parent state and fills stage 2', async () => {
    const user = userEvent.setup();
    let frozen: LoanFrozenValues | null = null;
    const onChange = vi.fn((values: LoanFrozenValues | null) => {
      frozen = values;
    });

    const { rerender } = render(
      <LoanCalculator frozenValues={frozen} onFrozenValuesChange={onChange} />
    );

    await user.type(screen.getByTestId('loan-calc-vehicle-price'), '100000');
    await user.selectOptions(screen.getByTestId('loan-calc-gst-rate'), '0.05');
    await user.type(screen.getByTestId('loan-calc-insurance'), '2000');
    await user.type(screen.getByTestId('loan-calc-registration'), '1000');
    await user.type(screen.getByTestId('loan-calc-accessories'), '1000');
    await user.type(screen.getByTestId('loan-calc-customer-payment'), '20000');
    await user.selectOptions(screen.getByTestId('loan-calc-tenure'), '18');
    await user.click(screen.getByTestId('loan-calc-freeze'));

    expect(onChange).toHaveBeenCalled();
    const snapshot = onChange.mock.calls.at(-1)?.[0] as LoanFrozenValues;
    expect(snapshot.tenureMonths).toBe(18);
    expect(snapshot.loanAmount).toBe(99735);
    expect(snapshot.taxInvoiceValue).toBe(111500);

    rerender(<LoanCalculator frozenValues={snapshot} onFrozenValuesChange={onChange} />);

    expect(screen.getByTestId('loan-form-amount')).toHaveValue(String(snapshot.loanAmount));
    expect(screen.getByTestId('loan-form-tenure')).toHaveValue(String(snapshot.tenureMonths));
    expect(screen.getByTestId('loan-form-math-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('loan-form-math-iot')).toHaveTextContent('₹2,625');
    expect(screen.getByTestId('loan-form-math-equation')).toHaveTextContent('₹99,735');
    expect(screen.queryByTestId('loan-form-interest')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-form-processing-fee-pct')).not.toBeInTheDocument();
    expect(screen.getByTestId('loan-form-amount')).toBeDisabled();
    expect(screen.getByTestId('loan-calc-vehicle-price')).toBeDisabled();
    expect(screen.getByTestId('loan-calc-tax-invoice')).toBeDisabled();
  });

  it('computes tax invoice value from vehicle price, GST, and add-ons', async () => {
    const user = userEvent.setup();
    render(<LoanCalculator frozenValues={null} onFrozenValuesChange={vi.fn()} />);

    await user.type(screen.getByTestId('loan-calc-vehicle-price'), '100000');
    await user.selectOptions(screen.getByTestId('loan-calc-gst-rate'), '0.05');
    await user.type(screen.getByTestId('loan-calc-insurance'), '2000');
    await user.type(screen.getByTestId('loan-calc-registration'), '1000');
    await user.type(screen.getByTestId('loan-calc-accessories'), '1000');
    await user.selectOptions(screen.getByTestId('loan-calc-tenure'), '18');

    expect(screen.getByTestId('loan-calc-tax-invoice')).toHaveValue('111500');
  });

  it('shows simplified live preview with EMI and without ROI or PF%', () => {
    render(<LoanCalculator frozenValues={null} onFrozenValuesChange={vi.fn()} />);

    const stage1 = within(screen.getByTestId('loan-calculator-stage1'));

    expect(stage1.getByTestId('loan-calc-preview-amount')).toBeInTheDocument();
    expect(stage1.getByTestId('loan-calc-preview-tenure')).toBeInTheDocument();
    expect(stage1.getByTestId('loan-calc-preview-gps')).toBeInTheDocument();
    expect(stage1.getByTestId('loan-calc-preview-emi')).toBeInTheDocument();
    expect(stage1.queryByText('Interest Rate')).not.toBeInTheDocument();
    expect(stage1.queryByText('Processing Fee %')).not.toBeInTheDocument();
    expect(stage1.queryByText('Processing Fee ₹')).not.toBeInTheDocument();
    expect(stage1.queryByText('Disbursal Amount')).not.toBeInTheDocument();
  });

  it('updates live preview when tenure changes to 18 months', async () => {
    const user = userEvent.setup();
    render(<LoanCalculator frozenValues={null} onFrozenValuesChange={vi.fn()} />);

    await user.type(screen.getByTestId('loan-calc-vehicle-price'), '100000');
    await user.selectOptions(screen.getByTestId('loan-calc-tenure'), '18');

    expect(screen.getByTestId('loan-calc-preview-gps')).toHaveTextContent('₹2,625');
    expect(screen.getByTestId('loan-calc-preview-tenure')).toHaveTextContent('18 months');
  });

  it('blocks freeze when customer payment is below 10% of tax invoice value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<LoanCalculator frozenValues={null} onFrozenValuesChange={onChange} />);

    await user.type(screen.getByTestId('loan-calc-vehicle-price'), '60000');
    await user.selectOptions(screen.getByTestId('loan-calc-gst-rate'), '0.05');
    await user.type(screen.getByTestId('loan-calc-insurance'), '0');
    await user.type(screen.getByTestId('loan-calc-registration'), '0');
    await user.type(screen.getByTestId('loan-calc-accessories'), '0');
    await user.type(screen.getByTestId('loan-calc-customer-payment'), '1000');

    expect(screen.getByTestId('loan-calc-freeze')).toBeDisabled();
    expect(screen.getByTestId('loan-calc-customer-payment-error')).toBeInTheDocument();
    expect(screen.getByTestId('loan-calc-customer-payment-error')).toHaveTextContent(/10%/);

    await user.click(screen.getByTestId('loan-calc-freeze'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('unfreezes on Edit so stage 1 is editable again', async () => {
    const user = userEvent.setup();
    const preview = calculateB2cLoanPreview({
      vehiclePrice: 100000,
      gstRate: 0.05,
      insurance: 2000,
      registration: 1000,
      accessories: 1000,
      customerPayment: 20000,
      tenureMonths: 18,
    });
    const frozen: LoanFrozenValues = {
      vehiclePrice: preview.vehiclePrice,
      gstRate: preview.gstRate,
      insurance: preview.insurance,
      registration: preview.registration,
      accessories: preview.accessories,
      customerPayment: preview.customerPayment,
      taxInvoiceValue: preview.taxInvoiceValue,
      loanAmount: preview.loanAmount,
      interestRate: 35,
      tenureMonths: 18,
      processingFee: preview.processingFee,
      gpsCharges: preview.gpsCharges,
      disbursalAmount: preview.disbursalAmount,
    };
    const onChange = vi.fn();

    render(<LoanCalculator frozenValues={frozen} onFrozenValuesChange={onChange} />);

    await user.click(screen.getByTestId('loan-calc-edit'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
