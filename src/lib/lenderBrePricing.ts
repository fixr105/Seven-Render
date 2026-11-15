/**
 * Score-based pricing from Bureau Cache + Lender BRE.
 * The pricing score never leaves this module.
 */

import {
  airtableGet,
  ENGINE_BASE_ID,
  type AirtableFlatRecord,
} from '../services/engineClient';

export const PRICING_UNAVAILABLE_MESSAGE =
  'Pricing is not available for this application. Contact support.';
export const PRICING_NOT_ELIGIBLE_MESSAGE =
  'This application is not eligible with the lender';

export type PricingOk = {
  rule_id: number;
  nbfc_partner: string;
  roi_pct: number;
  pf_pct: number;
  eligible: true;
};

export type PricingNotEligible = {
  rule_id: number;
  nbfc_partner: string;
  roi_pct: number;
  pf_pct: number;
  eligible: false;
};

export type PricingUnavailable = {
  unavailable: true;
  message: string;
};

export type PricingResult = PricingOk | PricingNotEligible | PricingUnavailable;

export type LenderBreRow = {
  ruleId: number;
  nbfcPartner: string;
  minCibil: number;
  maxCibil: number;
  eligible: boolean;
  roi: number | null;
  pf: number | null;
  active: boolean;
  loanProduct: string;
};

export type GetPricingDeps = {
  airtableGet: typeof airtableGet;
  baseId?: string;
};

function isCheckboxTrue(value: unknown): boolean {
  return value === true;
}

function readNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseResultJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

/** Derive NTC / numeric pricing score. Never exported. */
function derivePricingScore(resultJson: Record<string, unknown>): number | null {
  const fields =
    resultJson.fields && typeof resultJson.fields === 'object' && !Array.isArray(resultJson.fields)
      ? (resultJson.fields as Record<string, unknown>)
      : null;
  const isNtc = resultJson.is_ntc === true || fields?.is_ntc === true;
  if (isNtc) return -1;

  for (const candidate of [resultJson.score, fields?.score, fields?.cibil_score]) {
    const n = readNum(candidate);
    if (n != null) return n;
  }
  return null;
}

/** Loan Product empty = all products; otherwise exact match or comma-separated token. */
export function loanProductApplies(loanProductField: string, productId: string): boolean {
  const raw = String(loanProductField || '').trim();
  if (!raw) return true;
  const wanted = String(productId || '').trim().toLowerCase();
  if (!wanted) return false;
  if (raw.toLowerCase() === wanted) return true;
  return raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted);
}

export function parseLenderBreRecord(record: AirtableFlatRecord): LenderBreRow | null {
  const ruleId = readNum(record['Rule ID']);
  const nbfcPartner = String(record['NBFC Partner'] ?? '').trim();
  const minCibil = readNum(record['Min CIBIL']);
  const maxCibil = readNum(record['Max CIBIL']);
  if (ruleId == null || !nbfcPartner || minCibil == null || maxCibil == null) {
    return null;
  }
  return {
    ruleId,
    nbfcPartner,
    minCibil,
    maxCibil,
    eligible: isCheckboxTrue(record.Eligible),
    roi: readNum(record.ROI),
    pf: readNum(record.PF),
    active: isCheckboxTrue(record.Active),
    loanProduct: String(record['Loan Product'] ?? '').trim(),
  };
}

/**
 * Pure band picker (for tests). Score stays a parameter — callers of getPricing never see it.
 */
export function pickLenderBreBand(
  rows: LenderBreRow[],
  pricingScore: number,
  lenderName: string,
  productId: string
): LenderBreRow | null {
  const lender = String(lenderName || '').trim().toLowerCase();
  const candidates = rows.filter((row) => {
    if (!row.active) return false;
    if (row.nbfcPartner.trim().toLowerCase() !== lender) return false;
    if (!loanProductApplies(row.loanProduct, productId)) return false;
    return row.minCibil <= pricingScore && pricingScore <= row.maxCibil;
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aSpecific = a.loanProduct.trim() ? 0 : 1;
    const bSpecific = b.loanProduct.trim() ? 0 : 1;
    if (aSpecific !== bSpecific) return aSpecific - bSpecific;
    return a.ruleId - b.ruleId;
  });
  return candidates[0];
}

function bandToResult(band: LenderBreRow): PricingOk | PricingNotEligible {
  const base = {
    rule_id: band.ruleId,
    nbfc_partner: band.nbfcPartner,
    roi_pct: band.roi ?? 0,
    pf_pct: band.pf ?? 0,
  };
  if (band.eligible) {
    return { ...base, eligible: true };
  }
  return { ...base, eligible: false };
}

/**
 * Fetch Bureau Cache + Lender BRE and return pricing fields only.
 * Score / result_json / cache record never leave this function.
 */
export async function getPricing(
  pan: string,
  lenderName: string,
  productId: string,
  deps: GetPricingDeps = { airtableGet }
): Promise<PricingResult> {
  const baseId = deps.baseId || ENGINE_BASE_ID;
  const panUpper = String(pan || '').trim().toUpperCase();
  if (!panUpper || !String(lenderName || '').trim()) {
    return { unavailable: true, message: PRICING_UNAVAILABLE_MESSAGE };
  }

  let cacheRes;
  try {
    cacheRes = await deps.airtableGet({
      base_id: baseId,
      table: 'Bureau Cache',
      filter_formula: `{pan} = '${panUpper.replace(/'/g, "\\'")}'`,
      max: 1,
    });
  } catch {
    return { unavailable: true, message: PRICING_UNAVAILABLE_MESSAGE };
  }

  const cacheRow = cacheRes.records?.[0];
  if (!cacheRow) {
    return { unavailable: true, message: PRICING_UNAVAILABLE_MESSAGE };
  }

  const parsed = parseResultJson(cacheRow.result_json);
  if (!parsed) {
    return { unavailable: true, message: PRICING_UNAVAILABLE_MESSAGE };
  }

  const pricingScore = derivePricingScore(parsed);
  if (pricingScore == null) {
    return { unavailable: true, message: PRICING_UNAVAILABLE_MESSAGE };
  }

  let breRes;
  try {
    breRes = await deps.airtableGet({
      base_id: baseId,
      table: 'Lender BRE',
      filter_formula: '',
      max: 200,
    });
  } catch {
    return { unavailable: true, message: PRICING_UNAVAILABLE_MESSAGE };
  }

  const rows = (breRes.records || [])
    .map((record) => parseLenderBreRecord(record))
    .filter((row): row is LenderBreRow => Boolean(row));

  const band = pickLenderBreBand(rows, pricingScore, lenderName, productId);
  if (!band) {
    return { unavailable: true, message: PRICING_UNAVAILABLE_MESSAGE };
  }

  return bandToResult(band);
}

export function isPricingUnavailable(result: PricingResult): result is PricingUnavailable {
  return 'unavailable' in result && result.unavailable === true;
}

export function isPricingEligible(result: PricingResult): result is PricingOk {
  return !isPricingUnavailable(result) && result.eligible === true;
}
