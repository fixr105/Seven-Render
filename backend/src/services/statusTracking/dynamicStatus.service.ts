import { n8nClient } from '../airtable/n8nClient.js';
import { LoanStatus } from '../../config/constants.js';
import {
  normalizeApplicableStatusKey,
  parseApplicableStatusesForApi,
} from '../products/loanProductStatuses.service.js';

const CANONICAL_LOAN_STATUS_SET = new Set<string>(Object.values(LoanStatus));

/** Staff (KAM/Credit): normalized key must be a canonical LoanStatus — ignores Loan Product Applicable Statuses. */
export function isCanonicalLoanStatusKey(targetStatus: unknown): boolean {
  const normalized = normalizeApplicableStatusKey(targetStatus);
  return Boolean(normalized && CANONICAL_LOAN_STATUS_SET.has(normalized));
}

export type ProductStatusEntry = {
  key: string;
  label: string;
  order: number;
};

function normalizeLookup(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

/**
 * Tokens used to match a Loan Application row to a Loan Products row (id, Product ID, name).
 * Handles Airtable linked-record shapes: strings, record ids, `{ id }`, arrays of those.
 */
export function extractLoanProductMatchCandidates(application: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const addRaw = (value: unknown) => {
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number') {
      const s = String(value).trim();
      if (s && !s.startsWith('[object ')) {
        const n = normalizeLookup(s);
        if (n) seen.add(n);
      }
      return;
    }
  };

  function walk(value: unknown): void {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      const o = value as Record<string, unknown>;
      addRaw(o.id);
      addRaw(o.ID);
      addRaw(o['Product ID'] ?? o.productId);
      addRaw(o['Product Name'] ?? o.name ?? o.productName ?? o.code);
      return;
    }
    addRaw(value);
  }

  const sources: unknown[] = [
    application['Loan Product'],
    application.loanProduct,
    application.productId,
    application.product_id,
    application['Product ID'],
    application.product,
    application['Product Name'],
    application.loan_product,
    application['loan_product_id'],
    (application.loan_product as Record<string, unknown> | undefined)?.code,
    (application.loan_product as Record<string, unknown> | undefined)?.productId,
  ];

  sources.forEach(walk);
  return Array.from(seen);
}

/** True when Applicable Statuses is absent, blank string, empty array JSON, or `[]` value — not "malformed with invalid keys". */
function isUnsetApplicableStatusesRaw(raw: unknown): boolean {
  if (raw == null) return true;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t === '') return true;
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p) && p.length === 0) return true;
    } catch {
      return false;
    }
    return false;
  }
  if (Array.isArray(raw) && raw.length === 0) return true;
  return false;
}

/**
 * Locate the Loan Products row for this application (for validation and catalog lookups).
 */
export async function findLoanProductRecordForApplication(
  application: Record<string, any>
): Promise<Record<string, any> | undefined> {
  const productCandidates = extractLoanProductMatchCandidates(application);
  if (productCandidates.length === 0) return undefined;

  const products = await n8nClient.fetchTable('Loan Products', false);
  const product = products.find(
    (p: any) =>
      productCandidates.includes(normalizeLookup(p.id)) ||
      productCandidates.includes(normalizeLookup(p['Product ID'])) ||
      productCandidates.includes(normalizeLookup(p.productId)) ||
      productCandidates.includes(normalizeLookup(p['Product Name'])) ||
      productCandidates.includes(normalizeLookup(p.productName))
  );
  return product ?? undefined;
}

export async function getApplicationProductStatuses(application: Record<string, any>): Promise<ProductStatusEntry[]> {
  const product = await findLoanProductRecordForApplication(application);
  if (!product) return [];

  return parseApplicableStatusesForApi(product['Applicable Statuses'] ?? product.applicableStatuses);
}

export async function isStatusConfiguredForApplication(
  application: Record<string, any>,
  targetStatus: unknown
): Promise<boolean> {
  const normalizedTarget = normalizeApplicableStatusKey(targetStatus);
  if (!normalizedTarget) return false;

  const product = await findLoanProductRecordForApplication(application);
  if (!product) return false;

  const rawApplicable = product['Applicable Statuses'] ?? product.applicableStatuses;
  const productStatuses = parseApplicableStatusesForApi(rawApplicable);

  if (productStatuses.length === 0) {
    if (isUnsetApplicableStatusesRaw(rawApplicable) && CANONICAL_LOAN_STATUS_SET.has(normalizedTarget)) {
      return true;
    }
    return false;
  }

  return productStatuses.some(
    (e) =>
      e.key === normalizedTarget || normalizeApplicableStatusKey(e.label) === normalizedTarget
  );
}

/**
 * Use for POST status updates (KAM / Credit / NBFC / workflow): rejects only when Loan Product has a
 * **non‑empty parsed** Applicable Statuses list that does **not** include the target (by key / label / aliases).
 * If the catalogue is empty (missing product, unset field, or no valid parsed rows), any canonical LoanStatus is allowed —
 * aligns with flows that historically did not enforce when catalog was empty (and fixes KAM's `length === 0` hard‑fail).
 */
export async function mayApplyTargetLoanStatus(
  application: Record<string, any>,
  targetStatus: unknown
): Promise<boolean> {
  const normalizedTarget = normalizeApplicableStatusKey(targetStatus);
  if (!normalizedTarget || !CANONICAL_LOAN_STATUS_SET.has(normalizedTarget)) {
    return false;
  }

  const productStatuses = await getApplicationProductStatuses(application);
  if (productStatuses.length === 0) {
    return true;
  }

  return isStatusConfiguredForApplication(application, targetStatus);
}

export function getAllowedStatusesFromProduct(
  application: Record<string, any>,
  productStatuses: ProductStatusEntry[]
): string[] {
  const current = normalizeApplicableStatusKey(application.Status ?? application.status ?? '');
  if (!current) return productStatuses.map((s) => s.key);
  return productStatuses.map((s) => s.key).filter((key) => key !== current);
}

export function normalizeDynamicStatus(raw: unknown): string {
  return normalizeApplicableStatusKey(raw);
}
