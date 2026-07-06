import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoanCalculator } from '../LoanCalculator';
import type { LoanFrozenValues } from '../../../lib/loanCalculator';

describe('LoanCalculator', () => {
  it('shows empty stage 2 placeholders until values are frozen', () => {
    render(<LoanCalculator frozenValues={null} onFrozenValuesChange={vi.fn()} />);

    expect(screen.getByTestId('loan-extra-costs-disclaimer')).toHaveTextContent(
      /Insurance and vehicle registration costs are extra/
    );
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

    await user.type(screen.getByTestId('loan-calc-downpayment'), '20000');
    await user.type(screen.getByTestId('loan-calc-disbursement'), '50000');
    await user.click(screen.getByTestId('loan-calc-freeze'));

    expect(onChange).toHaveBeenCalled();
    const snapshot = onChange.mock.calls.at(-1)?.[0] as LoanFrozenValues;
    expect(snapshot.interestRate).toBe(35);
    expect(snapshot.processingFeePct).toBe(8);
    expect(snapshot.tenureMonths).toBe(12);
    expect(snapshot.loanAmount).toBeGreaterThan(0);

    rerender(<LoanCalculator frozenValues={snapshot} onFrozenValuesChange={onChange} />);

    expect(screen.getByTestId('loan-form-amount')).toHaveValue(String(snapshot.loanAmount));
    expect(screen.getByTestId('loan-form-tenure')).toHaveValue(String(snapshot.tenureMonths));
    expect(screen.getByTestId('loan-form-math-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('loan-form-math-iot')).toHaveTextContent('₹2,100');
    expect(screen.getByTestId('loan-form-math-equation')).toHaveTextContent(
      `₹${snapshot.loanAmount.toLocaleString('en-IN')}`
    );
    expect(screen.queryByTestId('loan-form-interest')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-form-processing-fee-pct')).not.toBeInTheDocument();
    expect(screen.getByTestId('loan-form-amount')).toBeDisabled();
    expect(screen.getByTestId('loan-calc-downpayment')).toBeDisabled();
    expect(screen.getByTestId('loan-calc-invoice')).toBeDisabled();
  });

  it('computes invoice value from downpayment and disbursement', async () => {
    const user = userEvent.setup();
    render(<LoanCalculator frozenValues={null} onFrozenValuesChange={vi.fn()} />);

    await user.type(screen.getByTestId('loan-calc-downpayment'), '15000');
    await user.type(screen.getByTestId('loan-calc-disbursement'), '50000');

    expect(screen.getByTestId('loan-calc-invoice')).toHaveValue('65000');
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

    await user.type(screen.getByTestId('loan-calc-disbursement'), '50000');
    await user.selectOptions(screen.getByTestId('loan-calc-tenure'), '18');

    expect(screen.getByTestId('loan-calc-preview-gps')).toHaveTextContent('₹2,625');
    expect(screen.getByTestId('loan-calc-preview-tenure')).toHaveTextContent('18 months');
  });

  it('unfreezes on Edit so stage 1 is editable again', async () => {
    const user = userEvent.setup();
    const frozen: LoanFrozenValues = {
      loanAmount: 56522,
      interestRate: 35,
      tenureMonths: 12,
      processingFee: 4522,
      gpsCharges: 2000,
      processingFeePct: 8,
      disbursalAmount: 50000,
    };
    const onChange = vi.fn();

    render(<LoanCalculator frozenValues={frozen} onFrozenValuesChange={onChange} />);

    await user.click(screen.getByTestId('loan-calc-edit'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
