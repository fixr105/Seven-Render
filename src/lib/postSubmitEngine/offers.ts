import { calculateEmi, roundRupee, type LoanTenureMonths } from '../loanCalculator';
import { formatInr } from './canonical';
import type { DisplayOffer } from './types';

export const OFFERS_UNAVAILABLE_MESSAGE = 'Offers unavailable. Contact support.';

export type LenderRow = {
  name: string;
  status?: string;
  min_ticket: number;
  max_ticket: number;
  /** @deprecated Not used for pricing — Lender BRE only. Kept for parse compatibility. */
  roi_pct?: number;
  /** @deprecated Not used for pricing — Lender BRE only. Kept for parse compatibility. */
  pf_pct?: number;
  tenure_months: string;
};

export type FrozenLoanValues = {
  amount: number;
  tenureMonths: number;
};

export type OfferPricing = {
  roi_pct: number;
  pf_pct: number;
};

export type BuildOffersResult =
  | { ok: true; offers: DisplayOffer[] }
  | { ok: false; reason: string };

export type PickLenderResult =
  | { ok: true; lender: LenderRow }
  | { ok: false; reason: string };

function readNum(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseTenureList(raw: string): number[] {
  return String(raw || '')
    .split(',')
    .map((part) => Number(String(part).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function formatTicketRangeReason(minTicket: number, maxTicket: number): string {
  return `Loan amount must be between ${formatInr(minTicket)} and ${formatInr(maxTicket)}`;
}

export function formatTenureReason(tenureMonthsCsv: string): string {
  const list = parseTenureList(tenureMonthsCsv);
  const readable = list.join(', ');
  return `Tenure must be one of ${readable} months`;
}

/** Prefer the sole active lender; otherwise match Config default_lender by name. */
export function pickActiveLender(
  lenders: LenderRow[],
  defaultLenderName: string | null | undefined
): PickLenderResult {
  if (!lenders.length) {
    return { ok: false, reason: OFFERS_UNAVAILABLE_MESSAGE };
  }
  if (lenders.length === 1) {
    return { ok: true, lender: lenders[0] };
  }
  const wanted = String(defaultLenderName || '').trim();
  const match = wanted
    ? lenders.find((row) => String(row.name || '').trim() === wanted)
    : undefined;
  if (!match) {
    return { ok: false, reason: OFFERS_UNAVAILABLE_MESSAGE };
  }
  return { ok: true, lender: match };
}

export function parseLenderRecord(record: Record<string, unknown>): LenderRow | null {
  const name = String(record.name ?? '').trim();
  if (!name) return null;
  return {
    name,
    status: String(record.status ?? '').trim() || undefined,
    min_ticket: readNum(record.min_ticket),
    max_ticket: readNum(record.max_ticket),
    roi_pct: readNum(record.roi_pct),
    pf_pct: readNum(record.pf_pct),
    tenure_months: String(record.tenure_months ?? '').trim(),
  };
}

function toOffer(partial: Omit<DisplayOffer, 'source' | 'apr'> & { apr?: number }): DisplayOffer {
  return {
    ...partial,
    apr: partial.apr ?? partial.roi,
    source: {
      amount: partial.amount,
      roi: partial.roi,
      pf: partial.pf,
      emi: partial.emi,
      tenure: partial.tenure,
      apr: partial.apr ?? partial.roi,
      real_lender_id: partial.real_lender_id,
    },
  };
}

/**
 * Local offers from frozen amount/tenure + Lender BRE pricing.
 * Lenders row is ticket/tenure/real_lender_id only — never roi_pct/pf_pct.
 */
export function buildOffers(
  frozen: FrozenLoanValues,
  lender: LenderRow,
  pricing: OfferPricing,
  emiFn: typeof calculateEmi = calculateEmi
): BuildOffersResult {
  const amount = readNum(frozen.amount);
  const tenure = readNum(frozen.tenureMonths);
  const minTicket = readNum(lender.min_ticket);
  const maxTicket = readNum(lender.max_ticket);

  if (amount < minTicket || amount > maxTicket) {
    return { ok: false, reason: formatTicketRangeReason(minTicket, maxTicket) };
  }

  const allowedTenures = parseTenureList(lender.tenure_months);
  if (!allowedTenures.includes(tenure)) {
    return { ok: false, reason: formatTenureReason(lender.tenure_months) };
  }

  const rate = readNum(pricing.roi_pct);
  const feePct = readNum(pricing.pf_pct);
  const fee = roundRupee(amount * (feePct / 100));
  const emi = emiFn(amount, tenure as LoanTenureMonths, rate);

  const realLenderId = lender.name;
  const value = toOffer({
    id: 'sf-value',
    label: 'Seven Fincorp — Value',
    amount,
    roi: rate,
    pf: fee,
    emi,
    tenure,
    real_lender_id: realLenderId,
  });

  const standardRoi = value.roi + 2;
  const standardPf = roundRupee(value.pf + value.amount * 0.01);
  const standard = toOffer({
    id: 'sf-standard',
    label: 'Seven Fincorp — Standard',
    amount: value.amount,
    roi: standardRoi,
    pf: standardPf,
    emi: emiFn(value.amount, value.tenure as LoanTenureMonths, standardRoi),
    tenure: value.tenure,
    real_lender_id: realLenderId,
  });

  return { ok: true, offers: [value, standard] };
}

export function readFrozenLoanFromFormData(formData: Record<string, unknown>): FrozenLoanValues {
  return {
    amount: readNum(formData['loan.amount']),
    tenureMonths: readNum(formData['loan.tenureMonths']),
  };
}

/** Apply accepted offer figures back onto loan.* keys for documents. */
export function applyAcceptedOfferToFormData(
  formData: Record<string, unknown>,
  offer: DisplayOffer
): Record<string, unknown> {
  const amount = offer.amount;
  const fee = offer.pf;
  const disbursal = roundRupee(Math.max(0, amount - fee));
  const feePct = amount > 0 ? roundRupee((fee / amount) * 10000) / 100 : 0;
  return {
    ...formData,
    'loan.amount': String(amount),
    'loan.interestRate': String(offer.roi),
    'loan.tenureMonths': String(offer.tenure),
    'loan.emiAmount': String(offer.emi),
    'loan.processingFee': String(fee),
    'loan.processingFeePct': String(feePct),
    'loan.processingFeePercent': String(feePct),
    'loan.disbursalAmount': String(disbursal),
  };
}

/** Same EMI function step 3 uses — exported for offer tests to assert reuse. */
export { calculateEmi as step3CalculateEmi };
