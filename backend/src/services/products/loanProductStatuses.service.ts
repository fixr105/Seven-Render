/**
 * Parses Airtable "Applicable Statuses" JSON on Loan Products into API-friendly catalog entries.
 */

import { LoanStatus } from '../../config/constants.js';
import { getStatusDisplayName } from '../statusTracking/statusStateMachine.js';

export interface ApplicableStatusEntry {
  key: string;
  label: string;
  order: number;
}

/** Airtable Long text column name (must match base + n8n payload). */
export const APPLICABLE_STATUSES_AIRTABLE_FIELD = 'Applicable Statuses';

const ALLOWED_KEYS = new Set<string>(Object.values(LoanStatus));

/** Default pipeline order for fallback when Airtable field is empty. */
export const CANONICAL_STATUS_ORDER: string[] = [
  LoanStatus.DRAFT,
  LoanStatus.UNDER_KAM_REVIEW,
  LoanStatus.QUERY_WITH_CLIENT,
  LoanStatus.PENDING_CREDIT_REVIEW,
  LoanStatus.CREDIT_QUERY_WITH_KAM,
  LoanStatus.IN_NEGOTIATION,
  LoanStatus.SENT_TO_NBFC,
  LoanStatus.APPROVED,
  LoanStatus.REJECTED,
  LoanStatus.DISBURSED,
  LoanStatus.WITHDRAWN,
  LoanStatus.CLOSED,
];

export function getDefaultApplicableStatuses(): ApplicableStatusEntry[] {
  return CANONICAL_STATUS_ORDER.map((key, idx) => ({
    key,
    label: getStatusDisplayName(key as LoanStatus),
    order: (idx + 1) * 10,
  }));
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Parse `Applicable Statuses` from a raw Loan Products row (Airtable / n8n).
 * Invalid keys are dropped. Malformed JSON yields full default catalog.
 */
export function parseApplicableStatusesFromProduct(
  product: Record<string, unknown>,
  productIdForLog?: string
): ApplicableStatusEntry[] {
  const raw =
    product[APPLICABLE_STATUSES_AIRTABLE_FIELD] ??
    product['ApplicableStatuses'] ??
    product['applicableStatuses'];

  if (raw == null || (typeof raw === 'string' && String(raw).trim() === '')) {
    return getDefaultApplicableStatuses();
  }

  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      console.warn(
        `[loanProductStatuses] Invalid JSON in Applicable Statuses for product ${productIdForLog ?? '?'}`
      );
      return getDefaultApplicableStatuses();
    }
  } else {
    parsed = raw;
  }

  if (!Array.isArray(parsed)) {
    console.warn(
      `[loanProductStatuses] Applicable Statuses must be a JSON array for product ${productIdForLog ?? '?'}`
    );
    return getDefaultApplicableStatuses();
  }

  const out: ApplicableStatusEntry[] = [];
  parsed.forEach((item, idx) => {
    if (!isRecord(item)) return;
    const keyRaw = item.key;
    const key = typeof keyRaw === 'string' ? keyRaw.trim().toLowerCase() : '';
    if (!key || !ALLOWED_KEYS.has(key)) {
      console.warn(
        `[loanProductStatuses] Dropping unknown status key "${String(keyRaw)}" for product ${productIdForLog ?? '?'}`
      );
      return;
    }
    const labelRaw = item.label;
    const label =
      typeof labelRaw === 'string' && labelRaw.trim() !== ''
        ? labelRaw.trim()
        : getStatusDisplayName(key as LoanStatus);
    let order: number;
    if (typeof item.order === 'number' && Number.isFinite(item.order)) {
      order = item.order;
    } else {
      order = (idx + 1) * 10;
    }
    out.push({ key, label, order });
  });

  if (out.length === 0) {
    return getDefaultApplicableStatuses();
  }

  out.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  return out;
}
