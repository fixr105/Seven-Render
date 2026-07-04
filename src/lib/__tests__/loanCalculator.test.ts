import { describe, it, expect } from 'vitest';
import {
  calculateLoanPreview,
  freezeLoanPreview,
  frozenValuesToFormDataPatch,
  isDisbursementOverBudget,
  INTEREST_RATE,
} from '../loanCalculator';

describe('loanCalculator', () => {
  it('calculates loan amount, fees and disbursal from disbursement and tenure', () => {
    const preview = calculateLoanPreview({
      invoiceValue: 100000,
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });

    // loanAmount = (50000 + 2000) / 0.92 = 56521.739… → 56522
    expect(preview.loanAmount).toBe(56522);
    expect(preview.gpsCharges).toBe(2000);
    expect(preview.processingFee).toBe(Math.round(56522 * 0.08));
    expect(preview.interestRate).toBe(INTEREST_RATE);
    expect(preview.tenureMonths).toBe(12);
    expect(preview.processingFeePctDisplay).toBe(8);
    expect(preview.disbursalAmount).toBe(
      preview.loanAmount - preview.processingFee - preview.gpsCharges
    );
  });

  it('uses GPS 2500 for 18 month tenure', () => {
    const preview = calculateLoanPreview({
      invoiceValue: 100000,
      upfrontPayment: 0,
      disbursementToDealer: 46000,
      tenureMonths: 18,
    });
    expect(preview.gpsCharges).toBe(2500);
    expect(preview.tenureMonths).toBe(18);
  });

  it('freezes a snapshot that stage 1 cannot mutate', () => {
    const preview = calculateLoanPreview({
      invoiceValue: 100000,
      upfrontPayment: 10000,
      disbursementToDealer: 40000,
      tenureMonths: 12,
    });
    const frozen = freezeLoanPreview(preview);
    expect(frozen).toEqual({
      loanAmount: preview.loanAmount,
      interestRate: 35,
      tenureMonths: 12,
      processingFee: preview.processingFee,
      gpsCharges: 2000,
      processingFeePct: 8,
      disbursalAmount: preview.disbursalAmount,
    });
    expect(frozenValuesToFormDataPatch(frozen)['loan.amount']).toBe(String(frozen.loanAmount));
  });

  it('flags disbursement over invoice minus upfront (non-blocking sanity check)', () => {
    expect(
      isDisbursementOverBudget({
        invoiceValue: 100000,
        upfrontPayment: 20000,
        disbursementToDealer: 90000,
        tenureMonths: 12,
      })
    ).toBe(true);
    expect(
      isDisbursementOverBudget({
        invoiceValue: 100000,
        upfrontPayment: 20000,
        disbursementToDealer: 50000,
        tenureMonths: 12,
      })
    ).toBe(false);
  });
});
