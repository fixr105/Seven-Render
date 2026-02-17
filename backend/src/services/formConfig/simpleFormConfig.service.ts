/**
 * Simple Form Config Service
 *
 * Uses Form Link table (Client ID, Form link, Product ID, Mapping ID) and
 * Record Titles table (Mapping ID, Record Title, Display Order) to return
 * a single "Documents" category with file-type fields for the 3-checkbox UI.
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
 * Resolve Mapping ID for a client (and optional product) from Form Link table.
 * Prefers row with matching Product ID; falls back to row with empty Product ID.
 */
function resolveMappingId(
  formLinkRows: Record<string, unknown>[],
  clientId: string,
  productId?: string
): string | null {
  const normalizedClient = String(clientId).trim();
  const normalizedProduct = productId ? String(productId).trim() : '';

  const withProduct = formLinkRows.find((r) => {
    const c = (r['Client ID'] ?? r.clientId ?? r.Client ?? '').toString().trim();
    const p = (r['Product ID'] ?? r.productId ?? r['Product ID'] ?? '').toString().trim();
    return c === normalizedClient && p === normalizedProduct && normalizedProduct !== '';
  });
  if (withProduct) {
    const mid = withProduct['Mapping ID'] ?? withProduct.mappingId ?? withProduct['Mapping ID'];
    return mid != null ? String(mid).trim() : null;
  }

  const anyProduct = formLinkRows.find((r) => {
    const c = (r['Client ID'] ?? r.clientId ?? r.Client ?? '').toString().trim();
    const p = (r['Product ID'] ?? r.productId ?? r['Product ID'] ?? '').toString().trim();
    return c === normalizedClient && (p === '' || p == null);
  });
  if (anyProduct) {
    const mid = anyProduct['Mapping ID'] ?? anyProduct.mappingId ?? anyProduct['Mapping ID'];
    return mid != null ? String(mid).trim() : null;
  }

  return null;
}

/**
 * Get form config for a client (and optional product).
 * Returns one category "Documents" with fields from Record Titles (Mapping ID).
 * If no Form Link row or no Record Titles, returns empty categories array.
 */
export async function getSimpleFormConfig(
  clientId: string,
  productId?: string
): Promise<SimpleFormConfigResult> {
  const [formLinkRecords, recordTitlesRecords] = await Promise.all([
    n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.FORM_LINK, true),
    n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.RECORD_TITLES, true),
  ]);

  const formLinkRows = formLinkRecords as Record<string, unknown>[];
  const mappingId = resolveMappingId(formLinkRows, clientId, productId);

  if (!mappingId) {
    return { categories: [] };
  }

  const normalizedMappingId = mappingId;
  const titleRows = (recordTitlesRecords as Record<string, unknown>[]).filter((r) => {
    const mid = (r['Mapping ID'] ?? r.mappingId ?? r['Mapping ID'] ?? '').toString().trim();
    return mid === normalizedMappingId;
  });

  const sorted = titleRows.slice().sort((a, b) => {
    const orderA = Number(a['Display Order'] ?? a.displayOrder ?? a['Display Order'] ?? 0) || 0;
    const orderB = Number(b['Display Order'] ?? b.displayOrder ?? b['Display Order'] ?? 0) || 0;
    return orderA - orderB;
  });

  const fields: SimpleFormConfigField[] = sorted.map((r, i) => {
    const label = (r['Record Title'] ?? r.recordTitle ?? r['Record Title'] ?? r.label ?? `Document ${i + 1}`).toString().trim();
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
 * Get Form Link rows for a client (match on any accepted client identifier).
 */
export async function getFormLinkRowsForClient(
  acceptedClientIds: Set<string>
): Promise<Record<string, unknown>[]> {
  const formLinkRecords = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.FORM_LINK, true);
  const rows = formLinkRecords as Record<string, unknown>[];
  return rows.filter((r) => {
    const c = (r['Client ID'] ?? r.clientId ?? r.Client ?? '').toString().trim();
    return c && acceptedClientIds.has(c);
  });
}

/**
 * Get unique Product IDs from Form Link rows for a client.
 * Rows with empty Product ID are skipped (no product-specific form).
 */
export async function getConfiguredProductIds(
  acceptedClientIds: Set<string>
): Promise<string[]> {
  const rows = await getFormLinkRowsForClient(acceptedClientIds);
  const productIds = new Set<string>();
  rows.forEach((r) => {
    const p = (r['Product ID'] ?? r.productId ?? '').toString().trim();
    if (p) productIds.add(p);
  });
  return Array.from(productIds);
}

/**
 * Get Record Titles for a Mapping ID.
 * Returns rows sorted by Display Order.
 */
export async function getRecordTitlesByMappingId(
  mappingId: string
): Promise<Record<string, unknown>[]> {
  const recordTitlesRecords = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.RECORD_TITLES, true);
  const rows = recordTitlesRecords as Record<string, unknown>[];
  const normalizedMappingId = String(mappingId).trim();
  const filtered = rows.filter((r) => {
    const mid = (r['Mapping ID'] ?? r.mappingId ?? r['Mapping ID'] ?? '').toString().trim();
    return mid === normalizedMappingId;
  });
  return filtered.sort((a, b) => {
    const orderA = Number(a['Display Order'] ?? a.displayOrder ?? a['Display Order'] ?? 0) || 0;
    const orderB = Number(b['Display Order'] ?? b.displayOrder ?? b['Display Order'] ?? 0) || 0;
    return orderA - orderB;
  });
}
