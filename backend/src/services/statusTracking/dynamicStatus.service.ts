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

export async function getApplicationProductStatuses(application: Record<string, any>): Promise<ProductStatusEntry[]> {
  const productCandidates = [
    application['Loan Product'],
    application.loanProduct,
    application.productId,
    application['Product ID'],
    application.product,
    application['Product Name'],
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => normalizeLookup(value))
    .filter(Boolean);
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
