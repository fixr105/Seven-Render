/**
 * Simple Form Config Service
 *
 * Uses Product Documents table (Product ID, Record Title, Display Order, Is Required)
 * to return a single "Documents" category with file-type fields for the 3-checkbox UI.
 *
 * Product-centric: no client-specific config, no Mapping ID.
 */

import { n8nClient } from '../airtable/n8nClient.js';
import { AIRTABLE_TABLE_NAMES } from '../airtable/n8nEndpoints.js';

export interface SimpleFormConfigField {
  fieldId: string;
  label: string;
  type: 'file';
  isRequired: boolean;
}

export interface SimpleFormConfigCategory {
  categoryId: string;
  categoryName: string;
  fields: SimpleFormConfigField[];
}

export interface SimpleFormConfigResult {
  categories: SimpleFormConfigCategory[];
}

/**
 * Get form config for a product.
 * Returns one category "Documents" with fields from Product Documents.
 * productId is required; clientId is ignored (kept for backward-compatible signature).
 * If no Product Documents for the product, returns empty categories array.
 */
export async function getSimpleFormConfig(
  _clientId: string,
  productId?: string
): Promise<SimpleFormConfigResult> {
  const pid = productId ? String(productId).trim() : '';
  if (!pid) {
    return { categories: [] };
  }

  const records = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.PRODUCT_DOCUMENTS, true);
  const rows = records as Record<string, unknown>[];

  const normalizedProductId = pid;
  const docRows = rows.filter((r) => {
    const p = (r['Product ID'] ?? r.productId ?? '').toString().trim();
    return p === normalizedProductId;
  });

  const sorted = docRows.slice().sort((a, b) => {
    const orderA = Number(a['Display Order'] ?? a.displayOrder ?? 0) || 0;
    const orderB = Number(b['Display Order'] ?? b.displayOrder ?? 0) || 0;
    return orderA - orderB;
  });

  const fields: SimpleFormConfigField[] = sorted.map((r, i) => {
    const label = (r['Record Title'] ?? r.recordTitle ?? r.label ?? `Document ${i + 1}`).toString().trim();
    const id = (r.id ?? r['Field ID'] ?? r.fieldId ?? `doc-${i}`).toString();
    const isRequired = r['Is Required'] === 'True' || r.isRequired === true || r['Is Mandatory'] === 'True' || r.isMandatory === true;
    return {
      fieldId: id,
      label: label || `Document ${i + 1}`,
      type: 'file',
      isRequired: Boolean(isRequired),
    };
  });

  if (fields.length === 0) {
    return { categories: [] };
  }

  return {
    categories: [
      {
        categoryId: 'documents',
        categoryName: 'Documents',
        fields,
      },
    ],
  };
}

/**
 * Get Product IDs that have at least one Product Document.
 * Used for product dropdown (e.g. configured products for client).
 */
export async function getProductIdsWithDocuments(): Promise<string[]> {
  const records = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.PRODUCT_DOCUMENTS, true);
  const rows = records as Record<string, unknown>[];
  const productIds = new Set<string>();
  rows.forEach((r) => {
    const p = (r['Product ID'] ?? r.productId ?? '').toString().trim();
    if (p) productIds.add(p);
  });
  return Array.from(productIds);
}

/**
 * Get Product Documents for a product.
 * Returns rows sorted by Display Order.
 */
export async function getProductDocumentsByProductId(
  productId: string
): Promise<Record<string, unknown>[]> {
  const records = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.PRODUCT_DOCUMENTS, true);
  const rows = records as Record<string, unknown>[];
  const normalizedProductId = String(productId).trim();
  const filtered = rows.filter((r) => {
    const p = (r['Product ID'] ?? r.productId ?? '').toString().trim();
    return p === normalizedProductId;
  });
  return filtered.sort((a, b) => {
    const orderA = Number(a['Display Order'] ?? a.displayOrder ?? 0) || 0;
    const orderB = Number(b['Display Order'] ?? b.displayOrder ?? 0) || 0;
    return orderA - orderB;
  });
}
