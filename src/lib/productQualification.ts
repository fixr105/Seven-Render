export type QualificationOutcome = 'pending' | 'ineligible' | 'approved' | 'pan_mobile_mismatch';

export const PAN_MOBILE_MISMATCH_MESSAGE = 'PAN and mobile mismatch.';

export function isPanMobileMismatchScore(score: unknown): boolean {
  const numeric = typeof score === 'number' ? score : Number(String(score ?? '').trim());
  return Number.isFinite(numeric) && numeric >= 300 && numeric <= 679;
}

export function isNewToCreditScore(score: unknown): boolean {
  const numeric = typeof score === 'number' ? score : Number(String(score ?? '').trim());
  return numeric === -1;
}

/** What the Loan Product step may render. The assigned lender id is not part of this view. */
export interface ProductQualificationView {
  outcome: QualificationOutcome;
  chanceLabel: string;
  roi: number | null;
  pf: number | null;
  lenderName: string | null;
}

export interface ProductQualificationDraft extends ProductQualificationView {
  assignedUserId?: string | null;
}

const BUREAU_PREFIX = '_meta.panLookup.bureau.';
const QUALIFICATION_PREFIX = '_meta.qualification.';

function readText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function parseStoredParameter(value: unknown): number | boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = readText(value);
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower === 'true' || lower === 'yes') return true;
  if (lower === 'false' || lower === 'no') return false;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric;
  return undefined;
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = readText(value);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

export function qualificationInputHash(loanProductId: string, panInputHash: string): string {
  return `${loanProductId.trim()}|${panInputHash}`;
}

/** Bureau flags copied from the Experian patch. Does not include the assigned lender id. */
export function bureauParametersFromFormData(
  formData: Record<string, unknown>
): Record<string, number | boolean> {
  const parameters: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(formData)) {
    if (!key.startsWith(BUREAU_PREFIX)) continue;
    const name = key.slice(BUREAU_PREFIX.length);
    if (!/^[a-z][a-z0-9_]*$/.test(name)) continue;
    const parsed = parseStoredParameter(value);
    if (parsed !== undefined) parameters[name] = parsed;
  }
  return parameters;
}

export function bureauRequestFromFormData(formData: Record<string, unknown>): {
  cibilScore: string;
  parameters: Record<string, number | boolean>;
} {
  return {
    cibilScore: readText(formData['_meta.panLookup.cibilScore']),
    parameters: bureauParametersFromFormData(formData),
  };
}

export function readProductQualification(
  formData: Record<string, unknown>,
  inputHash: string
): ProductQualificationView | null {
  if (readText(formData[`${QUALIFICATION_PREFIX}inputHash`]) !== inputHash) return null;
  const outcome = readText(formData[`${QUALIFICATION_PREFIX}outcome`]);
  if (
    outcome !== 'pending' &&
    outcome !== 'ineligible' &&
    outcome !== 'approved' &&
    outcome !== 'pan_mobile_mismatch'
  ) {
    return null;
  }
  const lenderName = readText(formData[`${QUALIFICATION_PREFIX}lenderName`]);
  return {
    outcome,
    chanceLabel: readText(formData[`${QUALIFICATION_PREFIX}chanceLabel`]),
    roi: parseOptionalNumber(formData[`${QUALIFICATION_PREFIX}roi`]),
    pf: parseOptionalNumber(formData[`${QUALIFICATION_PREFIX}pf`]),
    lenderName: lenderName || null,
  };
}

export function writeProductQualification(
  formData: Record<string, unknown>,
  inputHash: string,
  result: ProductQualificationDraft
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...formData };
  next[`${QUALIFICATION_PREFIX}outcome`] = result.outcome;
  next[`${QUALIFICATION_PREFIX}chanceLabel`] = result.chanceLabel;
  next[`${QUALIFICATION_PREFIX}inputHash`] = inputHash;
  next[`${QUALIFICATION_PREFIX}roi`] =
    result.outcome === 'approved' && result.roi != null ? String(result.roi) : '';
  next[`${QUALIFICATION_PREFIX}pf`] =
    result.outcome === 'approved' && result.pf != null ? String(result.pf) : '';
  next[`${QUALIFICATION_PREFIX}lenderName`] =
    result.outcome === 'approved' && result.lenderName ? result.lenderName : '';
  if (result.outcome === 'approved' && result.assignedUserId) {
    next[`${QUALIFICATION_PREFIX}assignedUserId`] = result.assignedUserId;
  } else {
    delete next[`${QUALIFICATION_PREFIX}assignedUserId`];
  }
  return next;
}

export function clearProductQualification(formData: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...formData };
  for (const key of Object.keys(next)) {
    if (key.startsWith(QUALIFICATION_PREFIX)) delete next[key];
  }
  return next;
}

export function hasProductQualificationMeta(formData: Record<string, unknown>): boolean {
  return Object.keys(formData).some((key) => key.startsWith(QUALIFICATION_PREFIX));
}

export function qualificationMessage(view: ProductQualificationView): string {
  switch (view.outcome) {
    case 'pending':
      return 'Qualification is waiting on bureau data.';
    case 'ineligible':
      return `Not eligible for this product. ${view.chanceLabel}`.trim();
    case 'pan_mobile_mismatch':
      return PAN_MOBILE_MISMATCH_MESSAGE;
    case 'approved':
      return 'Congratulations, we matched you with a lender';
    default: {
      const _exhaustive: never = view.outcome;
      return _exhaustive;
    }
  }
}
