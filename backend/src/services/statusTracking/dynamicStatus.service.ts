import { n8nClient } from '../airtable/n8nClient.js';
import {
  normalizeApplicableStatusKey,
  parseApplicableStatusesForApi,
} from '../products/loanProductStatuses.service.js';

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
    application['Product ID'],
    application.product,
    application['Product Name'],
    application.loan_product,
    application['loan_product_id'],
  ];

  sources.forEach(walk);
  return Array.from(seen);
}

export async function getApplicationProductStatuses(application: Record<string, any>): Promise<ProductStatusEntry[]> {
  const productCandidates = extractLoanProductMatchCandidates(application);
  if (productCandidates.length === 0) return [];

  const products = await n8nClient.fetchTable('Loan Products', false);
  const product = products.find(
    (p: any) =>
      productCandidates.includes(normalizeLookup(p.id)) ||
      productCandidates.includes(normalizeLookup(p['Product ID'])) ||
      productCandidates.includes(normalizeLookup(p.productId)) ||
      productCandidates.includes(normalizeLookup(p['Product Name'])) ||
      productCandidates.includes(normalizeLookup(p.productName))
  );
  if (!product) return [];

  return parseApplicableStatusesForApi(product['Applicable Statuses'] ?? product.applicableStatuses);
}

export async function isStatusConfiguredForApplication(
  application: Record<string, any>,
  targetStatus: unknown
): Promise<boolean> {
  const normalizedTarget = normalizeApplicableStatusKey(targetStatus);
  if (!normalizedTarget) return false;

  const productStatuses = await getApplicationProductStatuses(application);
  if (productStatuses.length === 0) return false;

  return productStatuses.some((statusEntry) => statusEntry.key === normalizedTarget);
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
