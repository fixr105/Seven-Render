import { describe, expect, it } from 'vitest';
import { quoteCalculatorForScore } from '../calculatorScoreQuote';
import { roundRupee, type B2cLoanCalculatorInputs } from '../loanCalculator';
import {
  PRICING_NOT_ELIGIBLE_MESSAGE,
  PRICING_UNAVAILABLE_MESSAGE,
  type LenderBreRow,
} from '../lenderBrePricing';

const INPUTS: B2cLoanCalculatorInputs = {
  vehiclePrice: 100000,
  gstRate: 0.05,
  insurance: 2000,
  registration: 1000,
  accessories: 1000,
  customerPayment: 20000,
  tenureMonths: 12,
};

const FINTREE_BANDS: LenderBreRow[] = [
  {
    ruleId: 2,
    nbfcPartner: 'Fintree',
    minCibil: 650,
    maxCibil: 700,
    eligible: true,
    roi: 32,
    pf: 8,
    active: true,
    loanProduct: '',
  },
  {
    ruleId: 7,
    nbfcPartner: 'Fintree',
    minCibil: 776,
    maxCibil: 900,
    eligible: true,
    roi: 28,
    pf: 6.75,
    active: true,
    loanProduct: '',
  },
];

describe('quoteCalculatorForScore', () => {
  it('prices 807 at 28% and 6.75% PF, and 700 at 32% and 8% PF', () => {
    const high = quoteCalculatorForScore(INPUTS, FINTREE_BANDS, 807, 'Fintree', 'LP012');
    const low = quoteCalculatorForScore(INPUTS, FINTREE_BANDS, 700, 'Fintree', 'LP012');

    expect(high.status).toBe('ok');
    expect(low.status).toBe('ok');
    if (high.status !== 'ok' || low.status !== 'ok') return;

    expect(high.band.ruleId).toBe(7);
    expect(high.preview.interestRate).toBe(28);
    expect(high.preview.processingFee).toBe(roundRupee(high.preview.loanAmount * 0.0675));
    expect(high.preview.loanAmount).toBeGreaterThan(0);
    expect(high.preview.emiAmount).toBeGreaterThan(0);

    expect(low.band.ruleId).toBe(2);
    expect(low.preview.interestRate).toBe(32);
    expect(low.preview.processingFee).toBe(roundRupee(low.preview.loanAmount * 0.08));
    expect(high.preview.emiAmount).toBeLessThan(low.preview.emiAmount);
  });

  it('returns unavailable when no band covers the score', () => {
    const result = quoteCalculatorForScore(INPUTS, FINTREE_BANDS, 300, 'Fintree', 'LP012');
    expect(result).toEqual({
      status: 'unavailable',
      message: PRICING_UNAVAILABLE_MESSAGE,
    });
  });

  it('returns ineligible without an EMI when the matched band is not eligible', () => {
    const rows: LenderBreRow[] = [
      {
        ruleId: 1,
        nbfcPartner: 'Fintree',
        minCibil: 300,
        maxCibil: 649,
        eligible: false,
        roi: 36,
        pf: 9,
        active: true,
        loanProduct: '',
      },
    ];
    const result = quoteCalculatorForScore(INPUTS, rows, 400, 'Fintree', 'LP012');
    expect(result.status).toBe('ineligible');
    if (result.status !== 'ineligible') return;
    expect(result.message).toBe(PRICING_NOT_ELIGIBLE_MESSAGE);
    expect(result.band.ruleId).toBe(1);
    expect(result).not.toHaveProperty('preview');
  });
});
