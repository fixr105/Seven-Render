/**
 * Maps internal LoanStatus slugs to Airtable Loan Applications Status single-select labels.
 * Airtable options: Qualified, Submitted, Dealer Unresponsive, Under Finance Review,
 * DO Issued, Disbursed, Rejected (no "draft" — omit Status on draft saves).
 */

import { LoanStatus } from '../config/constants.js';
import { normalizeApplicableStatusKey } from '../services/products/loanProductStatuses.service.js';
import { normalizeDynamicStatus } from '../services/statusTracking/dynamicStatus.service.js';
import { normalizeToCanonicalStatus } from '../services/statusTracking/statusStateMachine.js';

const CANONICAL_STATUS_SET = new Set<string>(Object.values(LoanStatus));

/** Valid Airtable Loan Applications Status column values (Seven Dashboard base). */
export const LOAN_APPLICATION_AIRTABLE_STATUS_LABELS = [
  'Qualified',
  'Submitted',
  'Dealer Unresponsive',
  'Under Finance Review',
  'DO Issued',
  'Disbursed',
  'Rejected',
] as const;

export type LoanApplicationAirtableStatusLabel =
  (typeof LOAN_APPLICATION_AIRTABLE_STATUS_LABELS)[number];

const AIRTABLE_LABEL_SET = new Set<string>(LOAN_APPLICATION_AIRTABLE_STATUS_LABELS);

const CANONICAL_TO_AIRTABLE_LABEL: Record<LoanStatus, LoanApplicationAirtableStatusLabel | null> =
  {
    [LoanStatus.DRAFT]: null,
    [LoanStatus.UNDER_KAM_REVIEW]: 'Submitted',
    [LoanStatus.QUERY_WITH_CLIENT]: 'Dealer Unresponsive',
    [LoanStatus.PENDING_CREDIT_REVIEW]: 'Under Finance Review',
    [LoanStatus.CREDIT_QUERY_WITH_KAM]: 'Under Finance Review',
    [LoanStatus.IN_NEGOTIATION]: 'Qualified',
    [LoanStatus.SENT_TO_NBFC]: 'DO Issued',
    [LoanStatus.APPROVED]: 'DO Issued',
    [LoanStatus.REJECTED]: 'Rejected',
    [LoanStatus.DISBURSED]: 'Disbursed',
    [LoanStatus.WITHDRAWN]: 'Rejected',
    [LoanStatus.CLOSED]: 'Disbursed',
  };

/** Primary canonical status for each Airtable label (workflow path, not every alias). */
const AIRTABLE_LABEL_TO_CANONICAL: Record<
  LoanApplicationAirtableStatusLabel,
  LoanStatus
> = {
  Qualified: LoanStatus.IN_NEGOTIATION,
  Submitted: LoanStatus.UNDER_KAM_REVIEW,
  'Dealer Unresponsive': LoanStatus.QUERY_WITH_CLIENT,
  'Under Finance Review': LoanStatus.PENDING_CREDIT_REVIEW,
  'DO Issued': LoanStatus.SENT_TO_NBFC,
  Disbursed: LoanStatus.DISBURSED,
  Rejected: LoanStatus.REJECTED,
};

function normalizeAirtableLabel(raw: string): string {
  return raw.trim().replace(/^\s+DO Issued$/i, 'DO Issued');
}

/**
 * Returns an Airtable Status label for POST /webhook/loanapplications1, or undefined to omit
 * the field (draft and unknown values that cannot be mapped).
 */
export function mapLoanStatusForAirtablePost(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  if (trimmed === '') return undefined;

  const normalizedLabel = normalizeAirtableLabel(trimmed);
  if (AIRTABLE_LABEL_SET.has(normalizedLabel)) {
    return normalizedLabel;
  }

  try {
    const normalizedKey = normalizeApplicableStatusKey(trimmed);
    if (!normalizedKey || normalizedKey === LoanStatus.DRAFT) {
      return undefined;
    }
    const canonical = normalizedKey as LoanStatus;
    if (!(canonical in CANONICAL_TO_AIRTABLE_LABEL)) {
      return undefined;
    }
    const mapped = CANONICAL_TO_AIRTABLE_LABEL[canonical];
    return mapped ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve Status read from n8n/Airtable into canonical LoanStatus.
 * Empty/missing Status means draft (Airtable omits Status on draft saves).
 */
export function resolveStoredApplicationStatus(raw: unknown): LoanStatus {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return LoanStatus.DRAFT;

  const normalizedLabel = normalizeAirtableLabel(trimmed);
  if (AIRTABLE_LABEL_SET.has(normalizedLabel)) {
    return AIRTABLE_LABEL_TO_CANONICAL[normalizedLabel as LoanApplicationAirtableStatusLabel];
  }

  const dynamic = normalizeDynamicStatus(trimmed);
  if (!dynamic) return LoanStatus.DRAFT;

  try {
    return normalizeToCanonicalStatus(dynamic);
  } catch {
    if (CANONICAL_STATUS_SET.has(dynamic)) {
      return dynamic as LoanStatus;
    }
    return LoanStatus.DRAFT;
  }
}

export function resolveApplicationRecordStatus(
  application: Record<string, unknown>
): LoanStatus {
  return resolveStoredApplicationStatus(application.Status ?? application.status);
}
