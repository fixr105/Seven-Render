import { describe, it, expect } from 'vitest';
import {
  calculateEmi,
  calculateLoanPreview,
  computeInvoiceValue,
  freezeLoanPreview,
  frozenValuesToFormDataPatch,
  INTEREST_RATE,
} from '../loanCalculator';

describe('loanCalculator', () => {
  it('calculates loan amount, fees and disbursal from disbursement and tenure', () => {
    const preview = calculateLoanPreview({
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
    expect(preview.emiAmount).toBe(calculateEmi(preview.loanAmount, 12));
  });

  it('derives invoice value from downpayment plus disbursement', () => {
    const preview = calculateLoanPreview({
      upfrontPayment: 15000,
      disbursementToDealer: 50000,
      tenureMonths: 18,
    });

    expect(computeInvoiceValue(15000, 50000)).toBe(65000);
    expect(preview.invoiceValue).toBe(65000);
    expect(preview.loanAmount).toBe(57065);
    expect(preview.gpsCharges).toBe(2500);
    expect(preview.tenureMonths).toBe(18);
    expect(preview.emiAmount).toBe(calculateEmi(57065, 18));
  });

  it('uses GPS 2500 for 18 month tenure', () => {
    const preview = calculateLoanPreview({
      upfrontPayment: 0,
      disbursementToDealer: 46000,
      tenureMonths: 18,
    });
    expect(preview.gpsCharges).toBe(2500);
    expect(preview.tenureMonths).toBe(18);
  });

  it('calculates EMI using reducing-balance formula at 35% annual rate', () => {
    const emi = calculateEmi(57065, 18);
    expect(emi).toBeGreaterThan(0);
    expect(emi).toBeLessThan(57065);
  });

  it('freezes a snapshot that stage 1 cannot mutate', () => {
    const preview = calculateLoanPreview({
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
});
