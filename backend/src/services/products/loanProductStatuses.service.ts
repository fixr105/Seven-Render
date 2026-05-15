/**
 * Parses Airtable "Applicable Statuses" JSON on Loan Products into API-friendly catalog entries.
 * Single source of truth for GET /loan-products and status transition validation.
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

const CANONICAL_STATUS_SET = new Set<string>(Object.values(LoanStatus));

/** Default pipeline order when a full canonical list is needed (e.g. tooling). */
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

/**
 * Normalizes a status string to match keys in GET /loan-products applicableStatuses,
 * including legacy alias mapping.
 */
export function normalizeApplicableStatusKey(raw: unknown): string {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');

  const aliasMap: Record<string, string> = {
    pending_kam_review: LoanStatus.UNDER_KAM_REVIEW,
    kam_query_raised: LoanStatus.QUERY_WITH_CLIENT,
    forwarded_to_credit: LoanStatus.PENDING_CREDIT_REVIEW,
    credit_query_raised: LoanStatus.CREDIT_QUERY_WITH_KAM,
    // Business labels / common Airtable keys (see src/lib/statusUtils.ts BUSINESS_STATUS_LABELS)
    qualified: LoanStatus.IN_NEGOTIATION,
    submitted: LoanStatus.UNDER_KAM_REVIEW,
    dealer_unresponsive: LoanStatus.QUERY_WITH_CLIENT,
    under_finance_review: LoanStatus.PENDING_CREDIT_REVIEW,
  };
  return aliasMap[normalized] ?? normalized;
}

/**
 * Parses `Applicable Statuses` raw value — same rules as GET /loan-products.
 * Empty, invalid JSON, or non-array → []. Only canonical LoanStatus keys kept.
 */
export function parseApplicableStatusesForApi(raw: unknown): ApplicableStatusEntry[] {
  if (raw == null || String(raw).trim() === '') {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const mapped = parsed
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const key = normalizeApplicableStatusKey(row.key);
      if (!key || !CANONICAL_STATUS_SET.has(key)) return null;
      const label = String(row.label ?? '').trim() || key;
      const maybeOrder = Number(row.order);
      const order = Number.isFinite(maybeOrder) ? maybeOrder : (index + 1) * 10;
      return { key, label, order };
    })
    .filter((entry): entry is ApplicableStatusEntry => entry !== null);

  if (mapped.length === 0) {
    return [];
  }

  return mapped.sort((a, b) => a.order - b.order);
}
