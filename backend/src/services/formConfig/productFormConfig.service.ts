/**
 * Product Form Config Service
 *
 * Parses form sections and fields from Loan Products record.
 * Supports formats:
 * - Section 1, Section 2, ... (Y/N); Field 1, Field 2, Field 2.1, ...
 * - SECTION 1A – ..., SECTION 1B – ..., ...; Field 1A.1, Field 1A.2, ...
 */

import {
  CANONICAL_FIELD_KEYS_BY_SECTION,
  CANONICAL_SECTION_KEYS,
} from './loanProductFormConfigConstants.js';

export interface ParsedFormField {
  fieldId: string;
  label: string;
  type: string;
  isRequired: boolean;
}

export interface ParsedSection {
  categoryId: string;
  categoryName: string;
  fields: ParsedFormField[];
}

// Section 1, Section 2 OR SECTION 1A – ..., SECTION 1B – PERSONAL KYC (Co-Applicants)
const SECTION_KEY_REGEX = /^Section\s+(\d+)([A-Za-z])?(?:\s*[–-]|\s|$)/i;
// Field 1, Field 2.1 OR Field 1A.1, Field 2B.3
const FIELD_KEY_REGEX = /^Field\s+(\d+)([A-Za-z])?(?:\.(\d+))?$/i;

const EMPTY_VALUES = ['empty', ''];

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim().toLowerCase();
  return s === '' || EMPTY_VALUES.includes(s);
}

/** Returns sectionId e.g. "1", "1A", "2B" for sorting and matching. */
function parseSectionKey(key: string): { sectionId: string; sortKey: string } | null {
  const m = key.match(SECTION_KEY_REGEX);
  if (!m) return null;
  const num = m[1];
  const letter = m[2] || '';
  const sectionId = num + letter;
  const sortKey = num + letter; // "1", "1A", "1B", "2A" - localeCompare sorts correctly
  return { sectionId, sortKey };
}

/** Returns sectionId (e.g. "1", "1A") and fieldNum for Field 1A.1, Field 2.1, etc. */
function parseFieldKey(key: string): { sectionId: string; sectionNum: number; fieldNum: number } | null {
  const m = key.match(FIELD_KEY_REGEX);
  if (!m) return null;
  const num = m[1];
  const letter = m[2] || '';
  const sectionId = num + letter;
  const sectionNum = parseInt(num, 10);
  const fieldNum = m[3] ? parseInt(m[3], 10) : 0;
  return { sectionId, sectionNum, fieldNum };
}

/**
 * Compute boundary for legacy format: min single-digit Field N that belongs to Section 2+.
 * Section 1 = Field 1, 2, 3. Section 2 = Field 4, 2.1, 2.2, 2.3.
 */
function computeBoundary(product: Record<string, unknown>): number {
  const singleDigitNums: number[] = [];
  for (const key of Object.keys(product)) {
    const p = parseFieldKey(key);
    if (p && p.fieldNum === 0 && p.sectionId === String(p.sectionNum)) singleDigitNums.push(p.sectionNum);
  }
  singleDigitNums.sort((a, b) => a - b);
  const section1Max = singleDigitNums[0] ?? 0;
  let maxConsecutive = section1Max;
  for (const n of singleDigitNums) {
    if (n <= maxConsecutive + 1) maxConsecutive = Math.max(maxConsecutive, n);
    else break;
  }
  return singleDigitNums.find((n) => n > maxConsecutive) ?? maxConsecutive + 1;
}

/**
 * Assign a field to a section.
 * - Field N.M or Field NA.M (e.g. Field 2.1, Field 1A.1) -> match by sectionId
 * - Legacy: Field N (single) -> use boundary logic
 */
function getFieldSectionId(
  fieldKey: string,
  activeSectionIds: string[],
  activeSectionNums: number[],
  boundary: number
): string | number | null {
  const parsed = parseFieldKey(fieldKey);
  if (!parsed) return null;
  const { sectionId, sectionNum, fieldNum } = parsed;
  if (activeSectionIds.includes(sectionId)) return sectionId;
  if (fieldNum > 0) return activeSectionNums.includes(sectionNum) ? sectionNum : null;
  if (activeSectionNums.length === 0) return null;
  if (sectionNum < boundary) return activeSectionNums[0];
  return activeSectionNums[1] ?? activeSectionNums[0];
}

/**
 * Parse form config from a Loan Product record.
 * Structure: Section 1, Section 2, ... OR SECTION 1A – ..., SECTION 1B – ... (Y/N); Field 1, Field 2.1, Field 1A.1, ...
 * - Section N = "Y" to include, "N" to exclude
 * - Field value "Empty" = omit
 * - Sections with no fields after filtering = omit
 */
export function parseProductFormConfig(product: Record<string, unknown>): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const sectionKeys: { key: string; sectionId: string; sortKey: string }[] = [];

  for (const key of Object.keys(product)) {
    const parsed = parseSectionKey(key);
    if (parsed) {
      sectionKeys.push({ key, sectionId: parsed.sectionId, sortKey: parsed.sortKey });
    }
  }

  sectionKeys.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));
  const activeSectionIds = sectionKeys
    .filter((s) => {
      const v = product[s.key];
      return v != null && String(v).trim().toUpperCase() === 'Y';
    })
    .map((s) => s.sectionId);
  const activeSectionNums = sectionKeys
    .filter((s) => activeSectionIds.includes(s.sectionId))
    .map((s) => (/^\d+$/.test(s.sectionId) ? parseInt(s.sectionId, 10) : 0));

  if (activeSectionIds.length === 0) return [];

  const boundary = computeBoundary(product);
  const fieldEntries: { key: string; value: string; sectionId: string | number }[] = [];

  for (const key of Object.keys(product)) {
    const parsed = parseFieldKey(key);
    if (!parsed) continue;
    const value = product[key];
    if (isEmpty(value)) continue;
    const label = String(value).trim();
    if (!label) continue;

    const sectionId = getFieldSectionId(
      key,
      activeSectionIds,
      activeSectionNums,
      boundary
    );
    if (sectionId == null) continue;
    const match =
      typeof sectionId === 'string'
        ? activeSectionIds.includes(sectionId)
        : activeSectionNums.includes(sectionId);
    if (!match) continue;

    fieldEntries.push({ key, value: label, sectionId });
  }

  fieldEntries.sort((a, b) => {
    const aIdx = activeSectionIds.indexOf(String(a.sectionId));
    const bIdx = activeSectionIds.indexOf(String(b.sectionId));
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.key.localeCompare(b.key, undefined, { numeric: true });
  });

  for (const sec of sectionKeys.filter((s) => activeSectionIds.includes(s.sectionId))) {
    const fieldsForSection = fieldEntries.filter((e) => String(e.sectionId) === sec.sectionId);
    if (fieldsForSection.length === 0) continue;

    const sectionNameKey = `Section ${sec.sectionId} Name`;
    let categoryName =
      (product[sectionNameKey] && String(product[sectionNameKey]).trim()) || '';
    if (!categoryName && sec.key.includes('–')) {
      const afterDash = sec.key.split(/[–-]/).slice(1).join('–').trim();
      categoryName = afterDash || `Section ${sec.sectionId}`;
    }
    if (!categoryName) categoryName = `Section ${sec.sectionId}`;

    const fields: ParsedFormField[] = fieldsForSection.map((e) => ({
      fieldId: e.key.replace(/\s+/g, '-').toLowerCase(),
      label: e.value,
      type: 'file',
      isRequired: false,
    }));

    sections.push({
      categoryId: `section-${sec.sectionId}`,
      categoryName: categoryName,
      fields,
    });
  }

  return sections;
}

export interface EditorField {
  key: string;
  label: string;
  enabled: boolean;
}

export interface EditorSection {
  sectionNum: number | string;
  enabled: boolean;
  name: string;
  fields: EditorField[];
}

/**
 * Build a global master list of section and field keys: canonical list merged with keys from products.
 * Canonical list ensures fields set to Empty in one product remain available when configuring others.
 * Product-derived keys add any legacy or extra columns that exist in Airtable but not in the doc.
 */
function getMasterSectionAndFieldKeys(products: Record<string, unknown>[]): {
  sectionKeys: { key: string; sectionId: string; sortKey: string }[];
  fieldKeysBySectionId: Map<string, string[]>;
} {
  const sectionKeySet = new Map<string, { key: string; sectionId: string; sortKey: string }>();
  const fieldKeysBySectionId = new Map<string, string[]>();

  // Start with canonical keys so the master list is never empty for known sections/fields
  for (const s of CANONICAL_SECTION_KEYS) {
    if (!sectionKeySet.has(s.sectionId)) {
      sectionKeySet.set(s.sectionId, { key: s.key, sectionId: s.sectionId, sortKey: s.sortKey });
    }
  }
  for (const [sectionId, keys] of Object.entries(CANONICAL_FIELD_KEYS_BY_SECTION)) {
    const existing = fieldKeysBySectionId.get(sectionId) ?? [];
    const merged = [...new Set([...existing, ...keys])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    fieldKeysBySectionId.set(sectionId, merged);
  }

  // Merge in any keys from products (e.g. different section key format, or extra fields)
  for (const product of products) {
    for (const key of Object.keys(product)) {
      const sectionParsed = parseSectionKey(key);
      if (sectionParsed) {
        if (!sectionKeySet.has(sectionParsed.sectionId)) {
          sectionKeySet.set(sectionParsed.sectionId, {
            key,
            sectionId: sectionParsed.sectionId,
            sortKey: sectionParsed.sortKey,
          });
        }
        continue;
      }
      const fieldParsed = parseFieldKey(key);
      if (fieldParsed) {
        const list = fieldKeysBySectionId.get(fieldParsed.sectionId) ?? [];
        if (!list.includes(key)) list.push(key);
        list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        fieldKeysBySectionId.set(fieldParsed.sectionId, list);
      }
    }
  }

  const sectionKeys = Array.from(sectionKeySet.values()).sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true })
  );
  return { sectionKeys, fieldKeysBySectionId };
}

/**
 * Extract editor state from a Loan Product for the Form Configuration UI.
 * Returns sections with nested fields. Fields marked with non-empty label (not "Empty") are enabled.
 */
export function extractProductFormConfigForEdit(product: Record<string, unknown>): {
  sections: EditorSection[];
} {
  return extractProductFormConfigForEditWithMaster(product, [product]);
}

/**
 * Extract editor state using a global master list of section/field keys, with values from the selected product.
 * Ensures unselecting a document field in Product A does not remove it from the list when configuring Product B;
 * each product keeps its own mapping and the UI always shows all document fields.
 */
export function extractProductFormConfigForEditWithMaster(
  selectedProduct: Record<string, unknown>,
  allProducts: Record<string, unknown>[]
): { sections: EditorSection[] } {
  const { sectionKeys, fieldKeysBySectionId } = getMasterSectionAndFieldKeys(allProducts);

  const sections: EditorSection[] = sectionKeys.map((s) => {
    const v = selectedProduct[s.key];
    const sectionEnabled = v != null && String(v).trim().toUpperCase() === 'Y';
    const nameKey = `Section ${s.sectionId} Name`;
    let name = (selectedProduct[nameKey] && String(selectedProduct[nameKey]).trim()) || '';
    if (!name && s.key.includes('–')) {
      name = s.key.split(/[–-]/).slice(1).join('–').trim();
    }
    const sectionNum = /^\d+$/.test(s.sectionId) ? parseInt(s.sectionId, 10) : s.sectionId;
    const fieldKeys = fieldKeysBySectionId.get(s.sectionId) ?? [];
    const fields: EditorField[] = fieldKeys.map((key) => {
      const value = selectedProduct[key];
      const label = value != null ? String(value).trim() : '';
      const enabled = !isEmpty(value) && label.toLowerCase() !== 'empty';
      return { key, label: label || '', enabled };
    });
    return { sectionNum, enabled: sectionEnabled, name, fields };
  });

  return { sections };
}

/**
 * Build payload for PATCH Loan Product from editor state.
 * Accepts sections with nested fields. Produces { "Section 1": "Y", "Field 1": "Applicant Name", ... }.
 */
export function buildProductFormConfigPayload(sections: EditorSection[]): Record<string, string> {
  const payload: Record<string, string> = {};

  for (const s of sections) {
    payload[`Section ${s.sectionNum}`] = s.enabled ? 'Y' : 'N';
    if (s.name) {
      payload[`Section ${s.sectionNum} Name`] = s.name;
    }
    for (const f of s.fields || []) {
      const useLabel = f.enabled && (f.label || '').trim() && (f.label || '').trim().toLowerCase() !== 'empty';
      payload[f.key] = useLabel ? (f.label || '').trim() : 'Empty';
    }
  }

  return payload;
}

/** Returns true if the key is a Section or Field form-config key (not id, Product ID, etc.). */
export function isFormConfigKey(key: string): boolean {
  return SECTION_KEY_REGEX.test(key) || FIELD_KEY_REGEX.test(key) || /^Section\s+\d+[A-Za-z]?\s+Name$/i.test(key);
}

/**
 * Build PATCH payload scoped to a single product record so updates never affect other products.
 * Only includes form-config keys that exist on this product; uses edited values where provided,
 * otherwise keeps existing product values. Payload always includes record id so the n8n webhook
 * must update only the Airtable record with that id (never apply to all records).
 */
export function buildProductFormConfigPayloadForRecord(
  product: Record<string, unknown>,
  sections: EditorSection[]
): Record<string, unknown> {
  const edited = buildProductFormConfigPayload(sections);
  const recordId = product.id;
  if (!recordId) throw new Error('Product record id is required for PATCH');
  const payload: Record<string, unknown> = { id: recordId };

  for (const key of Object.keys(product)) {
    if (key === 'id') continue;
    if (!isFormConfigKey(key)) continue;
    // Only include keys that exist on this product; use edited value or keep current
    const value = edited[key] !== undefined ? edited[key] : product[key];
    payload[key] = value;
  }

  return payload;
}

/**
 * Get form config for a product from Loan Products (product-embedded Section N / Field N).
 * Only sections with Y are included. Returns empty categories when product not found or has no section keys.
 */
export async function getFormConfigForProduct(productId: string): Promise<{
  categories: Array<{
    categoryId: string;
    categoryName: string;
    fields: Array<{ fieldId: string; label: string; type: string; isRequired: boolean }>;
  }>;
}> {
  const { n8nClient } = await import('../airtable/n8nClient.js');
  const products = await n8nClient.fetchTable('Loan Products', true);
  const product = (products as any[]).find(
    (p) => (p['Product ID'] || p.productId || p.id || '').toString().trim() === productId.trim()
  );
  if (product && Object.keys(product).some((k) => parseSectionKey(k) != null)) {
    const parsed = parseProductFormConfig(product as Record<string, unknown>);
    return {
      categories: parsed.map((s) => ({
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        fields: s.fields.map((f) => ({
          fieldId: f.fieldId,
          label: f.label,
          type: f.type,
          isRequired: f.isRequired,
        })),
      })),
    };
  }
  return { categories: [] };
}
