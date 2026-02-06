/**
 * Indian PAN format validation: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).
 * Used for form fields identified as PAN by type or label.
 */

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export function isValidPan(value: string | null | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  const trimmed = value.trim().toUpperCase();
  return trimmed === '' || PAN_REGEX.test(trimmed);
}

/** Returns a validation error message or null if valid/empty. */
export function getPanValidationError(value: string | null | undefined): string | null {
  if (value == null || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return PAN_REGEX.test(trimmed.toUpperCase())
    ? null
    : 'PAN must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F)';
}

/** Detect if a form field is a PAN field by type, id, or label. */
export function isPanField(field: {
  fieldId?: string;
  id?: string;
  label?: string;
  type?: string;
  fieldType?: string;
}): boolean {
  const t = ((field.type ?? field.fieldType) ?? '').toLowerCase();
  const id = (field.fieldId ?? field.id ?? '').toLowerCase();
  const label = (field.label ?? '').toLowerCase();
  return t === 'pan' || id.includes('pan') || label.includes('pan');
}
