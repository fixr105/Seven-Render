import { describe, it, expect } from 'vitest';
import {
  buildLoanMathBreakdown,
  calculateEmi,
  calculateEmiRangePreview,
  calculateLoanPreview,
  computeFinalInvoiceAmount,
  computeFinalInvoiceBreakdown,
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

  it('calculates EMI and processing fee ranges across 12- and 18-month tenures', () => {
    const preview12 = calculateLoanPreview({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });
    const preview18 = calculateLoanPreview({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
      tenureMonths: 18,
    });

    const range = calculateEmiRangePreview({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
    });

    expect(range.invoiceValue).toBe(70000);
    expect(range.lowestEmi).toBe(Math.min(preview12.emiAmount, preview18.emiAmount));
    expect(range.highestEmi).toBe(Math.max(preview12.emiAmount, preview18.emiAmount));
    expect(range.lowestProcessingFee).toBe(
      Math.min(preview12.processingFee, preview18.processingFee)
    );
    expect(range.highestProcessingFee).toBe(
      Math.max(preview12.processingFee, preview18.processingFee)
    );
  });

  it('computes final invoice amount with 5% GST on subtotal including IOT', () => {
    expect(computeFinalInvoiceAmount(70000, 5000, 2000, 2000)).toBe(82950);
    expect(computeFinalInvoiceAmount(0, 0, 0, 0)).toBe(0);
    expect(computeFinalInvoiceAmount(65000, -100, 3000, 0)).toBe(71400);
  });

  it('returns GST breakdown for final invoice composition', () => {
    const breakdown = computeFinalInvoiceBreakdown(70000, 5000, 2000, 2000);

    expect(breakdown.subtotal).toBe(79000);
    expect(breakdown.gstAmount).toBe(3950);
    expect(breakdown.finalInvoiceAmount).toBe(82950);
  });

  it('returns GPS-only baseline ranges when disbursement is zero', () => {
    const preview12 = calculateLoanPreview({
      upfrontPayment: 0,
      disbursementToDealer: 0,
      tenureMonths: 12,
    });
    const preview18 = calculateLoanPreview({
      upfrontPayment: 0,
      disbursementToDealer: 0,
      tenureMonths: 18,
    });

    const range = calculateEmiRangePreview({
      upfrontPayment: 0,
      disbursementToDealer: 0,
    });

    expect(range.invoiceValue).toBe(0);
    expect(range.lowestEmi).toBe(Math.min(preview12.emiAmount, preview18.emiAmount));
    expect(range.highestEmi).toBe(Math.max(preview12.emiAmount, preview18.emiAmount));
    expect(range.lowestProcessingFee).toBe(
      Math.min(preview12.processingFee, preview18.processingFee)
    );
    expect(range.highestProcessingFee).toBe(
      Math.max(preview12.processingFee, preview18.processingFee)
    );
  });

  it('builds a math breakdown from frozen values including IOT', () => {
    const preview = calculateLoanPreview({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });
    const frozen = freezeLoanPreview(preview);
    const breakdown = buildLoanMathBreakdown(frozen);

    expect(breakdown.gpsCharges).toBe(2000);
    expect(breakdown.loanAmount).toBe(
      breakdown.disbursalAmount + breakdown.processingFee + breakdown.gpsCharges
    );
    expect(breakdown.emiAmount).toBe(calculateEmi(frozen.loanAmount, 12));
  });

  it('includes calculator snapshot keys when snapshot is provided', () => {
    const preview = calculateLoanPreview({
      upfrontPayment: 10000,
      disbursementToDealer: 40000,
      tenureMonths: 12,
    });
    const frozen = freezeLoanPreview(preview);
    const patch = frozenValuesToFormDataPatch(frozen, {
      downpayment: 10000,
      disbursementToDealer: 40000,
      invoiceValue: preview.invoiceValue,
      emiAmount: preview.emiAmount,
    });

    expect(patch['loan.calculator.downpayment']).toBe('10000');
    expect(patch['loan.calculator.disbursementToDealer']).toBe('40000');
    expect(patch['loan.calculator.invoiceValue']).toBe(String(preview.invoiceValue));
    expect(patch['loan.emiAmount']).toBe(String(preview.emiAmount));
  });
});
