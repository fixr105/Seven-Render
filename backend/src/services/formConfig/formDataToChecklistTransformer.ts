/**
 * Form Data to Checklist Transformer
 *
 * Converts raw frontend form data (fieldId keys, raw values) into the storage format:
 * document names from Loan Product as keys, normalized status values ("yes" | "no" | "to be shared soon").
 */

import { getFormConfigForProduct } from './productFormConfig.service.js';

/** Normalize a form value to checklist status. Case-insensitive, trimmed. */
function normalizeChecklistValue(value: unknown): string {
  const s = (value != null ? String(value) : '').trim().toLowerCase();
  const yes = [
    'yes',
    'yes, added to folder',
    'yes_added_to_folder',
    'added_to_link',
    'added to link',
  ];
  const no = ['no', 'not available', 'not_available'];
  const toBeShared = [
    'to be shared soon',
    'to be shared',
    'awaiting, will update folder',
    'awaiting_will_update',
    'to_be_shared',
    'to_be_shared_soon',
    'awaiting',
  ];
  if (yes.some((v) => s === v || s.replace(/\s+/g, '_') === v)) return 'yes';
  if (toBeShared.some((v) => s === v || s.replace(/\s+/g, '_') === v)) return 'to be shared soon';
  if (no.some((v) => s === v || s.replace(/\s+/g, '_') === v)) return 'no';
  return 'no';
}

/** Normalize key for matching (frontend may send field-1a.1 or field-1A.1). */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Transform raw form data to checklist format for storage.
 * Keys become document names from the product config; values become "yes" | "no" | "to be shared soon".
 * Only includes fields that exist in the product's form config (file/checklist type or all if untyped).
 */
export async function transformFormDataToChecklistFormat(
  productId: string,
  formData: Record<string, unknown>
): Promise<Record<string, string>> {
  if (!productId || typeof productId !== 'string' || !productId.trim()) {
    return {};
  }
  let config: { categories: Array<{ fields: Array<{ fieldId: string; label: string; type: string }> }> };
  try {
    config = await getFormConfigForProduct(productId.trim());
  } catch {
    return {};
  }
  const fieldIdToLabel = new Map<string, string>();
  for (const cat of config.categories || []) {
    for (const f of cat.fields || []) {
      const id = (f.fieldId || '').trim();
      const label = (f.label || '').trim();
      if (!label) continue;
      const isFile = (f.type || '').toLowerCase() === 'file';
      if (isFile) {
        fieldIdToLabel.set(normalizeKey(id), label);
        fieldIdToLabel.set(id, label);
      }
    }
  }
  if (fieldIdToLabel.size === 0) {
    for (const cat of config.categories || []) {
      for (const f of cat.fields || []) {
        const id = (f.fieldId || '').trim();
        const label = (f.label || '').trim();
        if (!label) continue;
        fieldIdToLabel.set(normalizeKey(id), label);
        fieldIdToLabel.set(id, label);
      }
    }
  }
  const labelsSet = new Set<string>(fieldIdToLabel.values());
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(formData)) {
    const normalizedKey = normalizeKey(key);
    const labelFromId = fieldIdToLabel.get(key) ?? fieldIdToLabel.get(normalizedKey);
    if (labelFromId) {
      result[labelFromId] = normalizeChecklistValue(value);
    } else if (labelsSet.has(key) || Array.from(labelsSet).some((l) => normalizeKey(l) === normalizedKey)) {
      const existingLabel = Array.from(labelsSet).find((l) => l === key || normalizeKey(l) === normalizedKey) || key;
      result[existingLabel] = normalizeChecklistValue(value);
    }
  }
  return result;
}
