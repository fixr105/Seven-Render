import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoanCalculator } from '../LoanCalculator';
import type { LoanFrozenValues } from '../../../lib/loanCalculator';

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

    await user.type(screen.getByTestId('loan-calc-invoice'), '100000');
    await user.type(screen.getByTestId('loan-calc-upfront'), '20000');
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
    expect(screen.getByTestId('loan-form-interest')).toHaveValue('35');
    expect(screen.getByTestId('loan-form-amount')).toBeDisabled();
    expect(screen.getByTestId('loan-calc-invoice')).toBeDisabled();
  });

  it('shows over-budget warning without blocking freeze', async () => {
    const user = userEvent.setup();
    render(<LoanCalculator frozenValues={null} onFrozenValuesChange={vi.fn()} />);

    await user.type(screen.getByTestId('loan-calc-invoice'), '100000');
    await user.type(screen.getByTestId('loan-calc-upfront'), '20000');
    await user.type(screen.getByTestId('loan-calc-disbursement'), '90000');

    expect(screen.getByTestId('loan-calc-over-budget')).toBeInTheDocument();
    expect(screen.getByTestId('loan-calc-freeze')).not.toBeDisabled();
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
