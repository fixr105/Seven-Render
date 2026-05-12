import { n8nClient } from '../airtable/n8nClient.js';

export type ProductStatusEntry = {
  key: string;
  label: string;
  order: number;
};

function normalizeStatusKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}

function normalizeLookup(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

function parseApplicableStatuses(raw: unknown): ProductStatusEntry[] {
  if (raw == null || String(raw).trim() === '') return [];

  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const key = normalizeStatusKey(row.key);
      if (!key) return null;
      const label = String(row.label ?? '').trim() || key;
      const orderVal = Number(row.order);
      const order = Number.isFinite(orderVal) ? orderVal : (index + 1) * 10;
      return { key, label, order };
    })
    .filter((entry): entry is ProductStatusEntry => entry !== null)
    .sort((a, b) => a.order - b.order);
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

  return parseApplicableStatuses(product['Applicable Statuses'] ?? product.applicableStatuses);
}

export async function isStatusConfiguredForApplication(
  application: Record<string, any>,
  targetStatus: unknown
): Promise<boolean> {
  const normalizedTarget = normalizeStatusKey(targetStatus);
  if (!normalizedTarget) return false;

  const productStatuses = await getApplicationProductStatuses(application);
  if (productStatuses.length === 0) return false;

  return productStatuses.some((statusEntry) => statusEntry.key === normalizedTarget);
}

export function getAllowedStatusesFromProduct(
  application: Record<string, any>,
  productStatuses: ProductStatusEntry[]
): string[] {
  const current = normalizeStatusKey(application.Status ?? application.status ?? '');
  if (!current) return productStatuses.map((s) => s.key);
  return productStatuses.map((s) => s.key).filter((key) => key !== current);
}

export function normalizeDynamicStatus(raw: unknown): string {
  return normalizeStatusKey(raw);
}

