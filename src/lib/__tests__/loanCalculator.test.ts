import { describe, it, expect } from 'vitest';
import {
  buildLoanMathBreakdown,
  calculateB2cLoanPreview,
  calculateB2cTenureEmiRangePreviews,
  calculateEmi,
  calculateEmiRangePreview,
  calculateLoanScenarioPreview,
  calculateTenureEmiRangePreviews,
  computeFinalInvoiceAmount,
  computeFinalInvoiceBreakdown,
  computeGstComponent,
  computeInvoiceValue,
  freezeB2cLoanPreview,
  frozenValuesToFormDataPatch,
  INTEREST_RATE,
  INTEREST_RATE_MAX,
  INTEREST_RATE_MIN,
  LOAN_GROSSUP_FACTOR,
  PF_PCT,
  FEE_PCT_MIN,
  FEE_PCT_MAX,
  validateCustomerPaymentForFreeze,
  getMinimumCustomerPayment,
  MIN_CUSTOMER_PAYMENT_OF_TAX_INVOICE_PCT,
} from '../loanCalculator';

describe('validateCustomerPaymentForFreeze', () => {
  it('requires customer payment of at least 10% of tax invoice value', () => {
    const result = validateCustomerPaymentForFreeze(5000, 62700);
    expect(result.valid).toBe(false);
    expect(result.minimumPayment).toBe(getMinimumCustomerPayment(62700));
    expect(result.message).toMatch(/10%/);
    expect(result.message).toMatch(/6,270/);
  });

  it('allows freeze when customer payment equals 10% minimum', () => {
    const taxInvoiceValue = 111500;
    const minimum = getMinimumCustomerPayment(taxInvoiceValue);
    expect(minimum).toBe(Math.round(taxInvoiceValue * MIN_CUSTOMER_PAYMENT_OF_TAX_INVOICE_PCT));
    expect(validateCustomerPaymentForFreeze(minimum, taxInvoiceValue).valid).toBe(true);
  });

  it('allows freeze when customer payment exceeds 10% minimum', () => {
    expect(validateCustomerPaymentForFreeze(20000, 111500).valid).toBe(true);
  });
});

describe('calculateB2cLoanPreview', () => {
  it('matches vehicle-price methodology worked example', () => {
    const preview = calculateB2cLoanPreview({
      vehiclePrice: 100000,
      gstRate: 0.05,
      insurance: 2000,
      registration: 1000,
      accessories: 1000,
      customerPayment: 20000,
      tenureMonths: 18,
    });

    expect(preview.vehiclePriceWithGST).toBe(105000);
    expect(preview.taxInvoiceValue).toBe(111500);
    expect(preview.assumedDisbursement).toBe(91500);
    expect(preview.loanAmount).toBe(99735);
    expect(preview.processingFee).toBe(Math.round(99735 * PF_PCT));
    expect(preview.disbursalAmount).toBe(preview.loanAmount - preview.processingFee);
    expect(preview.gpsCharges).toBe(2500);
    expect(preview.emiAmount).toBe(calculateEmi(99735, 18));
  });

  it('uses tenure-based IOT charge for 12-month tenure', () => {
    const preview = calculateB2cLoanPreview({
      vehiclePrice: 100000,
      gstRate: 0.18,
      insurance: 0,
      registration: 0,
      accessories: 0,
      customerPayment: 0,
      tenureMonths: 12,
    });

    expect(preview.gpsCharges).toBe(2000);
    expect(preview.vehiclePriceWithGST).toBe(118000);
    expect(preview.taxInvoiceValue).toBe(120000);
    expect(preview.loanAmount).toBe(Math.round(120000 * LOAN_GROSSUP_FACTOR));
  });

  it('freezes B2C preview into form data patch keys', () => {
    const preview = calculateB2cLoanPreview({
      vehiclePrice: 100000,
      gstRate: 0.05,
      insurance: 2000,
      registration: 1000,
      accessories: 1000,
      customerPayment: 20000,
      tenureMonths: 18,
    });
    const frozen = freezeB2cLoanPreview(preview);
    const patch = frozenValuesToFormDataPatch(frozen, {
      vehiclePrice: preview.vehiclePrice,
      gstRate: preview.gstRate,
      insurance: preview.insurance,
      registration: preview.registration,
      accessories: preview.accessories,
      customerPayment: preview.customerPayment,
      taxInvoiceValue: preview.taxInvoiceValue,
      emiAmount: preview.emiAmount,
    });

    expect(patch['loan.vehiclePrice']).toBe('100000');
    expect(patch['loan.gstRate']).toBe('0.05');
    expect(patch['loan.taxInvoiceValue']).toBe('111500');
    expect(patch['loan.amount']).toBe('99735');
    expect(patch['loan.calculator.customerPayment']).toBe('20000');
    expect(patch['loan.emiAmount']).toBe(String(preview.emiAmount));
    expect(patch['loan.calculator.disbursementToDealer']).toBeUndefined();
  });

  it('builds math breakdown with net disbursal composition', () => {
    const preview = calculateB2cLoanPreview({
      vehiclePrice: 100000,
      gstRate: 0.05,
      insurance: 2000,
      registration: 1000,
      accessories: 1000,
      customerPayment: 20000,
      tenureMonths: 18,
    });
    const frozen = freezeB2cLoanPreview(preview);
    const breakdown = buildLoanMathBreakdown(frozen);

    expect(breakdown.loanAmount).toBe(breakdown.disbursalAmount + breakdown.processingFee);
    expect(breakdown.taxInvoiceValue).toBe(111500);
  });
});

describe('calculateB2cTenureEmiRangePreviews', () => {
  it('returns lowest EMI at min rate/PF and highest EMI at max rate/PF', () => {
    const inputs = {
      vehiclePrice: 100000,
      gstRate: 0.05 as const,
      insurance: 2000,
      registration: 1000,
      accessories: 1000,
      customerPayment: 20000,
      tenureMonths: 18 as const,
    };
    const { lowPreview, highPreview } = calculateB2cTenureEmiRangePreviews(inputs);

    expect(lowPreview.interestRate).toBe(INTEREST_RATE_MIN);
    expect(highPreview.interestRate).toBe(INTEREST_RATE_MAX);
    expect(lowPreview.processingFee).toBe(Math.round(lowPreview.loanAmount * FEE_PCT_MIN));
    expect(highPreview.processingFee).toBe(Math.round(highPreview.loanAmount * FEE_PCT_MAX));
    expect(lowPreview.emiAmount).toBeLessThan(highPreview.emiAmount);
    expect(lowPreview.loanAmount).toBeLessThan(highPreview.loanAmount);
    expect(lowPreview.taxInvoiceValue).toBe(highPreview.taxInvoiceValue);
    expect(lowPreview.taxInvoiceValue).toBe(111500);
  });
});

describe('loanCalculator legacy EMI range', () => {
  it('calculates loan amount, fees and disbursal from disbursement and tenure', () => {
    const preview = calculateLoanScenarioPreview(
      {
        upfrontPayment: 20000,
        disbursementToDealer: 50000,
        tenureMonths: 12,
      },
      INTEREST_RATE,
      PF_PCT
    );

    expect(preview.loanAmount).toBe(56522);
    expect(preview.gpsCharges).toBe(2000);
    expect(preview.processingFee).toBe(Math.round(56522 * 0.08));
    expect(preview.disbursalAmount).toBe(
      preview.loanAmount - preview.processingFee - preview.gpsCharges
    );
    expect(preview.emiAmount).toBe(calculateEmi(preview.loanAmount, 12));
  });

  it('derives invoice value from downpayment plus disbursement', () => {
    const preview = calculateLoanScenarioPreview(
      {
        upfrontPayment: 15000,
        disbursementToDealer: 50000,
        tenureMonths: 18,
      },
      INTEREST_RATE,
      PF_PCT
    );

    expect(computeInvoiceValue(15000, 50000)).toBe(65000);
    expect(preview.invoiceValue).toBe(65000);
    expect(preview.loanAmount).toBe(57065);
    expect(preview.gpsCharges).toBe(2500);
  });

  it('calculates EMI and processing fee ranges for a fixed tenure using rate and PF bounds', () => {
    const range = calculateEmiRangePreview({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });

    const { lowPreview, highPreview } = calculateTenureEmiRangePreviews({
      upfrontPayment: 20000,
      disbursementToDealer: 50000,
      tenureMonths: 12,
    });

    expect(range.invoiceValue).toBe(70000);
    expect(range.lowestEmi).toBe(lowPreview.emiAmount);
    expect(range.highestEmi).toBe(highPreview.emiAmount);
    expect(range.lowestIotInclusive).toBe(2100);
    expect(lowPreview.emiAmount).toBeLessThan(highPreview.emiAmount);
  });

  it('computes final invoice amount with 5% GST on IOT, insurance, and registration only', () => {
    expect(computeFinalInvoiceAmount(70000, 5000, 2000, 2000)).toBe(79450);
    expect(computeFinalInvoiceAmount(0, 0, 0, 2000)).toBe(2100);
    expect(computeFinalInvoiceAmount(65000, -100, 3000, 0)).toBe(68150);
  });

  it('returns GST breakdown with inclusive IOT, insurance, and registration amounts', () => {
    const breakdown = computeFinalInvoiceBreakdown(70000, 5000, 2000, 2000);

    expect(breakdown.iot.inclusiveAmount).toBe(2100);
    expect(breakdown.finalInvoiceAmount).toBe(79450);
  });

  it('computes GST-inclusive amounts from base values', () => {
    expect(computeGstComponent(2000)).toEqual({
      baseAmount: 2000,
      gstAmount: 100,
      inclusiveAmount: 2100,
    });
  });
});
