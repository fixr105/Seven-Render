export interface RankedOffer {
  lenderId: string;
  roi: number;
  pf: number;
  amount: number;
  tenure: number;
  apr: number;
  downPayment: number;
}

export interface DisplayOffer {
  label: string;
  roi: number;
  pf: number;
  amount: number;
  tenure: number;
  emi: number;
  downPayment: number;
  realLenderId: string;
}

const OPTION_LABELS = [
  'Seven Fincorp — Option A',
  'Seven Fincorp — Option B',
  'Seven Fincorp — Option C',
] as const;

export function calculateReducingEmi(
  amount: number,
  annualRoiPercent: number,
  tenureMonths: number
): number {
  if (amount <= 0 || tenureMonths <= 0) return 0;
  const monthlyRate = annualRoiPercent / 100 / 12;
  if (monthlyRate === 0) return Math.round(amount / tenureMonths);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  return Math.round((amount * monthlyRate * factor) / (factor - 1));
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function toDisplay(offer: RankedOffer, label: string, roi = offer.roi, pf = offer.pf): DisplayOffer {
  return {
    label,
    roi,
    pf,
    amount: offer.amount,
    tenure: offer.tenure,
    emi: calculateReducingEmi(offer.amount, roi, offer.tenure),
    downPayment: offer.downPayment,
    realLenderId: offer.lenderId,
  };
}

export function buildDisplayOffers(offers: RankedOffer[]): DisplayOffer[] {
  if (offers.length === 0) return [];
  if (offers.length === 1) {
    const offer = offers[0];
    const standardRoi = offer.roi + 2;
    const standardPf = Math.round(offer.pf + offer.amount * 0.01);
    return [
      toDisplay(offer, 'Seven Fincorp — Value'),
      toDisplay(offer, 'Seven Fincorp — Standard', standardRoi, standardPf),
    ];
  }
  return [...offers]
    .sort((left, right) => left.apr - right.apr)
    .slice(0, 3)
    .map((offer, index) => toDisplay(offer, OPTION_LABELS[index] ?? OPTION_LABELS[2]));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function flattenRow(value: unknown): Record<string, unknown> {
  const row = asRecord(value);
  if (!row) return {};
  const fields = asRecord(row.fields) ?? {};
  return { ...fields, ...row };
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function offerList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = asRecord(payload);
  if (!row) return [];
  for (const key of ['offers', 'ranked', 'ranked_offers', 'lenders', 'results']) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  const data = asRecord(row.data);
  if (data) return offerList(data);
  return [];
}

export function normalizeRankedOffers(
  payload: unknown,
  fallback: { amount: number; tenure: number }
): RankedOffer[] {
  return offerList(payload).flatMap((item) => {
    const row = flattenRow(item);
    const roi = asNumber(row.roi ?? row.interest_rate ?? row.roi_pct ?? row.ROI);
    if (roi == null) return [];
    const amount = asNumber(row.amount ?? row.loan_amount ?? row.loanAmount) ?? fallback.amount;
    const tenure = asNumber(row.tenure ?? row.tenure_months ?? row.tenureMonths) ?? fallback.tenure;
    const explicitPf = asNumber(row.pf_amount ?? row.processing_fee_amount);
    const rawPf = asNumber(row.pf ?? row.pf_pct ?? row.processing_fee ?? row.PF);
    const pf = explicitPf ?? (rawPf == null ? 0 : rawPf <= 100 ? Math.round((amount * rawPf) / 100) : rawPf);
    const apr = asNumber(row.apr ?? row.APR) ?? roi;
    const downPayment = asNumber(row.down_payment ?? row.downPayment) ?? 0;
    const lenderId = String(
      row.lender_id ?? row.real_lender_id ?? row.lenderId ?? row.nbfc_id ?? row['Lender ID'] ?? ''
    );
    return [{ lenderId, roi, pf, amount, tenure, apr, downPayment }];
  });
}
