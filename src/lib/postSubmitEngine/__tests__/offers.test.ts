import { describe, expect, it, vi } from 'vitest';
import { calculateEmi, roundRupee } from '../../loanCalculator';
import {
  applyAcceptedOfferToFormData,
  buildOffers,
  formatTicketRangeReason,
  formatTenureReason,
  OFFERS_UNAVAILABLE_MESSAGE,
  pickActiveLender,
  step3CalculateEmi,
  type LenderRow,
} from '../offers';

const FINTREE: LenderRow = {
  name: 'Fintree',
  status: 'active',
  min_ticket: 50000,
  max_ticket: 150000,
  tenure_months: '12,18,24',
};

const FROZEN = { amount: 111725, tenureMonths: 18 };
const PRICING = { roi_pct: 28, pf_pct: 6.75 };

describe('pickActiveLender', () => {
  it('returns the sole active lender', () => {
    expect(pickActiveLender([FINTREE], 'Fintree')).toEqual({ ok: true, lender: FINTREE });
  });

  it('returns unavailable when empty or default missing among many', () => {
    expect(pickActiveLender([], 'Fintree')).toEqual({
      ok: false,
      reason: OFFERS_UNAVAILABLE_MESSAGE,
    });
    expect(
      pickActiveLender(
        [
          { ...FINTREE, name: 'OtherA' },
          { ...FINTREE, name: 'OtherB' },
        ],
        'Fintree'
      )
    ).toEqual({
      ok: false,
      reason: OFFERS_UNAVAILABLE_MESSAGE,
    });
  });
});

describe('buildOffers', () => {
  it('one active lender + BRE pricing gives two offers; offer 1 equals band rate/fee', () => {
    const emiSpy = vi.fn(calculateEmi);
    const result = buildOffers(FROZEN, FINTREE, PRICING, emiSpy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offers).toHaveLength(2);
    const valueFee = roundRupee(111725 * (6.75 / 100));
    expect(result.offers[0]).toMatchObject({
      label: 'Seven Fincorp — Value',
      amount: 111725,
      roi: 28,
      tenure: 18,
      pf: valueFee,
      real_lender_id: 'Fintree',
    });
    expect(result.offers[0].emi).toBe(calculateEmi(111725, 18, 28));
    expect(emiSpy).toHaveBeenCalled();
    expect(step3CalculateEmi).toBe(calculateEmi);
  });

  it('offer 2 is +2 points and +1% fee with reused step-3 EMI', () => {
    const emiSpy = vi.fn(calculateEmi);
    const result = buildOffers(FROZEN, FINTREE, PRICING, emiSpy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.offers[0];
    const standard = result.offers[1];
    expect(standard.amount).toBe(value.amount);
    expect(standard.tenure).toBe(value.tenure);
    expect(standard.roi).toBe(value.roi + 2);
    expect(standard.pf).toBe(roundRupee(value.pf + value.amount * 0.01));
    expect(standard.emi).toBe(emiSpy.mock.results[1]?.value);
    expect(standard.emi).toBe(calculateEmi(value.amount, 18, standard.roi));
  });

  it('stops with plain reason when amount is outside ticket range', () => {
    const result = buildOffers({ ...FROZEN, amount: 40000 }, FINTREE, PRICING);
    expect(result).toEqual({
      ok: false,
      reason: formatTicketRangeReason(50000, 150000),
    });
    expect(result.ok === false && result.reason).toBe(
      'Loan amount must be between ₹50,000 and ₹1,50,000'
    );
  });

  it('stops with plain reason when tenure is not in the list', () => {
    const result = buildOffers({ ...FROZEN, tenureMonths: 36 }, FINTREE, PRICING);
    expect(result).toEqual({
      ok: false,
      reason: formatTenureReason('12,18,24'),
    });
  });

  it('never uses lender roi_pct/pf_pct even if present', () => {
    const lender = { ...FINTREE, roi_pct: 99, pf_pct: 99 };
    const result = buildOffers(FROZEN, lender, PRICING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offers[0].roi).toBe(28);
    expect(result.offers[0].pf).toBe(roundRupee(111725 * 0.0675));
  });

  it('applyAcceptedOfferToFormData updates loan.* keys', () => {
    const result = buildOffers(FROZEN, FINTREE, PRICING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = applyAcceptedOfferToFormData({ 'borrower.pan': 'X' }, result.offers[1]);
    expect(next['loan.interestRate']).toBe(String(result.offers[1].roi));
    expect(next['loan.processingFee']).toBe(String(result.offers[1].pf));
    expect(next['loan.emiAmount']).toBe(String(result.offers[1].emi));
    expect(next['loan.amount']).toBe('111725');
    expect(Number(next['loan.disbursalAmount'])).toBe(
      roundRupee(111725 - result.offers[1].pf)
    );
    // Stale flat 8% must be overwritten with accepted fee percent
    const feePct = Number(next['loan.processingFeePct']);
    expect(feePct).toBeCloseTo((result.offers[1].pf / 111725) * 100, 2);
    expect(next['loan.processingFeePercent']).toBe(String(feePct));
  });
});
