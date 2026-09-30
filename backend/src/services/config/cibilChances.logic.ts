/**
 * Pure CIBIL chances calculation (no n8n / logger imports).
 */

export interface NbfcBreRow {
  userId: string;
  lenderName: string;
  minCibil: number;
  maxCibil: number;
  eligible: boolean;
  roi: number;
  pf: number;
  active: boolean;
  /** Ids and names extracted from the Loan Product field. */
  loanProductKeys: string[];
}

export interface CibilChancesResult {
  score: number;
  label: string;
}

export interface LenderCandidate {
  userId: string;
  lenderName: string;
  roi: number;
}

export interface RecommendedLenderResult {
  recommendedLender: string | null;
  recommendedLenderROI: number | null;
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

function collectLookupKeys(value: unknown, into: string[]): void {
  if (value == null) return;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    if (text) into.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLookupKeys(item, into);
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['id', 'name', 'Product ID', 'productId', 'Loan Product']) {
      if (obj[key] != null) collectLookupKeys(obj[key], into);
    }
  }
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
  const loanProductKeys: string[] = [];
  collectLookupKeys(readField(fields, 'Loan Product', 'loan_product', 'loanProduct'), loanProductKeys);

  return {
    userId: String(readField(fields, 'UserID', 'User ID', 'userId') ?? '').trim(),
    lenderName,
    minCibil,
    maxCibil,
    eligible: coerceBoolean(readField(fields, 'Eligible', 'eligible')),
    roi,
    pf,
    active: coerceBoolean(readField(fields, 'Active', 'active')),
    loanProductKeys,
  };
}

/** Case-insensitive match of a product id against any extracted Loan Product key. */
export function loanProductMatches(row: NbfcBreRow, loanProductId: string): boolean {
  const target = loanProductId.trim().toLowerCase();
  if (!target) return false;
  return row.loanProductKeys.some((key) => key.trim().toLowerCase() === target);
}

export function mapScoreToLabel(score: number): string {
  if (score <= 0) return 'Almost No Chance';
  if (score <= 33) return 'Chances with Co-applicant';
  if (score <= 66) return 'Chances';
  return 'High Chance';
}

/**
 * Lenders need an eligible product band and a BRE APPROVED checkpoint result.
 * Missing checkpoint status is not approval.
 */
export function selectRecommendedLender(
  rows: NbfcBreRow[],
  cibil: number,
  loanProductId: string,
  checkpointStatusByUserId: ReadonlyMap<string, string>
): RecommendedLenderResult {
  const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
  const candidates: LenderCandidate[] = [];
  for (const userId of userIds) {
    if (checkpointStatusByUserId.get(userId) !== 'BRE APPROVED') continue;
    const band = eligibleBandForLender(rows, userId, cibil, loanProductId);
    if (!band) continue;
    candidates.push({ userId, lenderName: band.lenderName, roi: band.roi });
  }
  return pickRecommendedLender(candidates);
}

/** Lowest ROI, then lender name. Callers must already drop lenders that failed checkpoints. */
export function pickRecommendedLender(candidates: LenderCandidate[]): RecommendedLenderResult {
  if (candidates.length === 0) {
    return { recommendedLender: null, recommendedLenderROI: null };
  }
  const sorted = [...candidates].sort((a, b) => {
    if (a.roi !== b.roi) return a.roi - b.roi;
    return a.lenderName.localeCompare(b.lenderName);
  });
  const best = sorted[0];
  if (!best) return { recommendedLender: null, recommendedLenderROI: null };
  return {
    recommendedLender: best.lenderName,
    recommendedLenderROI: Number.isFinite(best.roi) ? best.roi : null,
  };
}

/** Eligible product band for one lender with the lowest ROI, or null. */
export function eligibleBandForLender(
  rows: NbfcBreRow[],
  userId: string,
  cibil: number,
  loanProductId: string
): NbfcBreRow | null {
  const matches = rows.filter(
    (row) =>
      row.active &&
      row.eligible &&
      row.userId === userId &&
      loanProductMatches(row, loanProductId) &&
      row.minCibil <= cibil &&
      cibil <= row.maxCibil
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => a.roi - b.roi)[0] ?? null;
}

/** Row ratio for one product and CIBIL band. No lender fields. */
export function calculateChancesFromRows(
  cibil: number,
  rows: NbfcBreRow[],
  loanProductId: string
): CibilChancesResult {
  const matching = rows.filter(
    (row) =>
      row.active &&
      loanProductMatches(row, loanProductId) &&
      row.minCibil <= cibil &&
      cibil <= row.maxCibil
  );
  const total = matching.length;
  const eligible = matching.filter((row) => row.eligible).length;
  const score = total === 0 ? 0 : Math.round((eligible / total) * 100);
  return { score, label: mapScoreToLabel(score) };
}
