import {
  pickLenderBreBand,
  PRICING_NOT_ELIGIBLE_MESSAGE,
  PRICING_UNAVAILABLE_MESSAGE,
  type LenderBreRow,
} from './lenderBrePricing';
import {
  calculateB2cLoanScenarioPreview,
  type B2cLoanCalculatorInputs,
  type B2cLoanLivePreview,
} from './loanCalculator';

export type ScoreQuoteOk = {
  status: 'ok';
  band: LenderBreRow;
  preview: B2cLoanLivePreview;
};

export type ScoreQuoteIneligible = {
  status: 'ineligible';
  band: LenderBreRow;
  message: string;
};

export type ScoreQuoteUnavailable = {
  status: 'unavailable';
  message: string;
};

export type ScoreQuote = ScoreQuoteOk | ScoreQuoteIneligible | ScoreQuoteUnavailable;

/**
 * Hypothetical calculator quote. Does not read a bureau score.
 * PF on Lender BRE is a whole percent (6.75). feeInverse needs a fraction.
 */
export function quoteCalculatorForScore(
  inputs: B2cLoanCalculatorInputs,
  rows: LenderBreRow[],
  score: number,
  lenderName: string,
  productId: string
): ScoreQuote {
  const band = pickLenderBreBand(rows, score, lenderName, productId);
  if (!band) {
    return { status: 'unavailable', message: PRICING_UNAVAILABLE_MESSAGE };
  }
  if (!band.eligible) {
    return { status: 'ineligible', band, message: PRICING_NOT_ELIGIBLE_MESSAGE };
  }
  if (band.roi == null || band.pf == null || band.pf <= 0 || band.pf >= 100) {
    return { status: 'unavailable', message: PRICING_UNAVAILABLE_MESSAGE };
  }

  const preview = calculateB2cLoanScenarioPreview(inputs, band.roi, band.pf / 100, 'feeInverse');
  return { status: 'ok', band, preview };
}
