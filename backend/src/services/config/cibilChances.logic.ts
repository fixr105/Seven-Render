/**
 * Pure CIBIL chances calculation (no n8n / logger imports).
 */

export interface NbfcBreRow {
  lenderName: string;
  minCibil: number;
  maxCibil: number;
  eligible: boolean;
  roi: number;
  pf: number;
  active: boolean;
  loanProduct?: string;
}

export interface CibilChancesResult {
  score: number;
  label: string;
}

export interface CibilChancesStaffResult extends CibilChancesResult {
  recommendedLender: string | null;
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === 'yes' || v === '1' || v === 'checked';
  }
  return false;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function partnerNameFromValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          return String(obj.name ?? obj['Lender Name'] ?? obj['NBFC Partner'] ?? obj.id ?? '').trim();
        }
        return '';
      })
      .filter(Boolean);
    return parts[0] ?? '';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return String(obj.name ?? obj['Lender Name'] ?? obj['NBFC Partner'] ?? '').trim();
  }
  return '';
}

function readField(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }
  return undefined;
}

/** Normalize one Airtable/n8n record into a BRE row; returns null if unusable. */
export function normalizeBreRecord(raw: unknown): NbfcBreRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const fields =
    record.fields && typeof record.fields === 'object'
      ? (record.fields as Record<string, unknown>)
      : record;

  const lenderName = partnerNameFromValue(
    readField(fields, 'NBFC Partner', 'nbfc_partner', 'Lender Name', 'lenderName')
  );
  const minCibil = coerceNumber(readField(fields, 'Min CIBIL', 'min_cibil', 'MinCibil', 'minCibil'));
  const maxCibil = coerceNumber(readField(fields, 'Max CIBIL', 'max_cibil', 'MaxCibil', 'maxCibil'));
  if (!lenderName || minCibil == null || maxCibil == null) return null;

  const roi = coerceNumber(readField(fields, 'ROI', 'roi', 'roi_pct')) ?? Number.POSITIVE_INFINITY;
  const pf = coerceNumber(readField(fields, 'PF', 'pf', 'pf_pct')) ?? Number.POSITIVE_INFINITY;
  const loanProductRaw = readField(fields, 'Loan Product', 'loan_product', 'loanProduct');
  const loanProduct =
    loanProductRaw == null
      ? undefined
      : Array.isArray(loanProductRaw)
        ? partnerNameFromValue(loanProductRaw) || undefined
        : String(loanProductRaw).trim() || undefined;

  return {
    lenderName,
    minCibil,
    maxCibil,
    eligible: coerceBoolean(readField(fields, 'Eligible', 'eligible')),
    roi,
    pf,
    active: coerceBoolean(readField(fields, 'Active', 'active')),
    loanProduct,
  };
}

export function mapScoreToLabel(score: number): string {
  if (score <= 0) return 'Almost No Chance';
  if (score <= 33) return 'Chances with Co-applicant';
  if (score <= 66) return 'Chances';
  return 'High Chance';
}

export function pickRecommendedLender(matchingEligible: NbfcBreRow[]): string | null {
  if (matchingEligible.length === 0) return null;
  const sorted = [...matchingEligible].sort((a, b) => {
    if (a.roi !== b.roi) return a.roi - b.roi;
    if (a.pf !== b.pf) return a.pf - b.pf;
    return a.lenderName.localeCompare(b.lenderName);
  });
  return sorted[0]?.lenderName ?? null;
}

/** Pure calculator — used by service and unit tests. */
export function calculateChancesFromRows(cibil: number, rows: NbfcBreRow[]): CibilChancesStaffResult {
  const active = rows.filter((r) => r.active);
  const matching = active.filter((r) => r.minCibil <= cibil && cibil <= r.maxCibil);

  const totalLenders = new Set(matching.map((r) => r.lenderName));
  const eligibleRows = matching.filter((r) => r.eligible);
  const eligibleLenders = new Set(eligibleRows.map((r) => r.lenderName));

  const total = totalLenders.size;
  const eligible = eligibleLenders.size;
  const score = total === 0 ? 0 : Math.round((eligible / total) * 100);
  const label = mapScoreToLabel(score);

  const bestEligibleByLender = new Map<string, NbfcBreRow>();
  for (const row of eligibleRows) {
    const existing = bestEligibleByLender.get(row.lenderName);
    if (
      !existing ||
      row.roi < existing.roi ||
      (row.roi === existing.roi && row.pf < existing.pf)
    ) {
      bestEligibleByLender.set(row.lenderName, row);
    }
  }

  return {
    score,
    label,
    recommendedLender: pickRecommendedLender([...bestEligibleByLender.values()]),
  };
}
