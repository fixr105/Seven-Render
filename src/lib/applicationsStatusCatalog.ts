/**
 * Build status filter catalog for Applications from loan products (Airtable-driven applicableStatuses).
 */

import { getStatusDisplayName } from './statusUtils';

export interface ApplicableStatusEntry {
  key: string;
  label: string;
  order: number;
}

/** Fallback pipeline when no loan products loaded yet (matches backend CANONICAL_STATUS_ORDER). */
const DEFAULT_STATUS_KEYS: string[] = [
  'draft',
  'under_kam_review',
  'query_with_client',
  'pending_credit_review',
  'credit_query_with_kam',
  'in_negotiation',
  'sent_to_nbfc',
  'approved',
  'rejected',
  'disbursed',
  'withdrawn',
  'closed',
];

function defaultCatalogEntries(): ApplicableStatusEntry[] {
  return DEFAULT_STATUS_KEYS.map((key, idx) => ({
    key,
    label: getStatusDisplayName(key),
    order: (idx + 1) * 10,
  }));
}

export interface LoanProductWithStatuses {
  id?: string;
  productId?: string;
  /** Display name from API (camelCase or legacy Product Name). */
  productName?: string;
  'Product Name'?: string;
  name?: string;
  applicableStatuses?: ApplicableStatusEntry[];
}

/** NBFC-focused roles: limit visible workflow keys to lender-facing stages. */
const NBFC_VISIBLE_KEYS = new Set([
  'sent_to_nbfc',
  'approved',
  'rejected',
  'disbursed',
  'closed',
  'credit_query_with_kam',
  'query_with_client',
  'pending_credit_review',
]);

export function filterCatalogByRole(
  entries: ApplicableStatusEntry[],
  role: string | null
): ApplicableStatusEntry[] {
  if (role === 'nbfc') {
    return entries.filter((e) => NBFC_VISIBLE_KEYS.has(e.key));
  }
  return entries;
}

function mergeUnion(products: LoanProductWithStatuses[]): ApplicableStatusEntry[] {
  const byKey = new Map<string, ApplicableStatusEntry>();
  for (const p of products) {
    const list = p.applicableStatuses;
    if (!list?.length) continue;
    for (const e of list) {
      const cur = byKey.get(e.key);
      if (!cur) {
        byKey.set(e.key, { ...e });
      } else {
        byKey.set(e.key, {
          key: e.key,
          label: cur.label,
          order: Math.min(cur.order, e.order),
        });
      }
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.order - b.order || a.key.localeCompare(b.key)
  );
}

/**
 * When `selectedProductId` is set, use that product's catalog only.
 * Otherwise union catalogs across all products (dedupe by key).
 */
export function buildStatusCatalogForApplications(
  products: LoanProductWithStatuses[],
  selectedProductId: string | null,
  role: string | null
): ApplicableStatusEntry[] {
  if (!products.length) {
    return filterCatalogByRole(defaultCatalogEntries(), role);
  }

  let raw: ApplicableStatusEntry[];
  if (selectedProductId) {
    const sel = selectedProductId.trim().toLowerCase();
    const p = products.find(
      (x) =>
        String(x.productId ?? '')
          .trim()
          .toLowerCase() === sel ||
        String(x.id ?? '')
          .trim()
          .toLowerCase() === sel
    );
    raw = p?.applicableStatuses?.length ? [...p.applicableStatuses] : mergeUnion(products);
  } else {
    raw = mergeUnion(products);
  }

  raw.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  return filterCatalogByRole(raw, role);
}

export function statusOrderMapFromCatalog(entries: ApplicableStatusEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  entries.forEach((e, i) => m.set(e.key, e.order ?? i * 10));
  return m;
}
