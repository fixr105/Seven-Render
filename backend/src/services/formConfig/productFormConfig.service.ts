/**
 * Product Form Config Service
 *
 * Parses form sections and fields from Loan Products record.
 * Supports formats:
 * - Section 1, Section 2, ... (Y/N); Field 1, Field 2, Field 2.1, ...
 * - SECTION 1A – ..., SECTION 1B – ..., ...; Field 1A.1, Field 1A.2, ...
 */

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
 * Extract editor state from a Loan Product for the Form Configuration UI.
 * Returns sections with nested fields. Fields marked with non-empty label (not "Empty") are enabled.
 */
export function extractProductFormConfigForEdit(product: Record<string, unknown>): {
  sections: EditorSection[];
} {
  const sectionKeys: { key: string; sectionId: string; sortKey: string }[] = [];
  const fieldEntries: { key: string; label: string; enabled: boolean; sectionId: string }[] = [];

  for (const key of Object.keys(product)) {
    const parsed = parseSectionKey(key);
    if (parsed) {
      sectionKeys.push({ key, sectionId: parsed.sectionId, sortKey: parsed.sortKey });
    }
  }
  sectionKeys.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));

  for (const key of Object.keys(product)) {
    if (!FIELD_KEY_REGEX.test(key)) continue;
    const parsed = parseFieldKey(key);
    if (!parsed) continue;
    const value = product[key];
    const label = value != null ? String(value).trim() : '';
    const enabled = !isEmpty(value) && label.toLowerCase() !== 'empty';
    fieldEntries.push({ key, label: label || '', enabled, sectionId: parsed.sectionId });
  }
  fieldEntries.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

  const sections: EditorSection[] = sectionKeys.map((s) => {
    const v = product[s.key];
    const sectionEnabled = v != null && String(v).trim().toUpperCase() === 'Y';
    const nameKey = `Section ${s.sectionId} Name`;
    let name = (product[nameKey] && String(product[nameKey]).trim()) || '';
    if (!name && s.key.includes('–')) {
      name = s.key.split(/[–-]/).slice(1).join('–').trim();
    }
    const sectionNum = /^\d+$/.test(s.sectionId) ? parseInt(s.sectionId, 10) : s.sectionId;
    const fields = fieldEntries
      .filter((f) => f.sectionId === s.sectionId)
      .map((f) => ({ key: f.key, label: f.label, enabled: f.enabled }));
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

/**
 * Get form config for a product from Loan Products (product-embedded) or Product Documents.
 * Returns categories in the same shape as getSimpleFormConfig.
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
  const { getSimpleFormConfig } = await import('./simpleFormConfig.service.js');
  return getSimpleFormConfig('_', productId);
}
