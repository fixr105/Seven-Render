/**
 * Guards for B2C EV form_data patches — metadata-only updates bypass workflow status gates.
 */

const PROMOTED_FIELD_ALIASES = new Set([
  'applicant_name',
  'loan_product_id',
  'requested_loan_amount',
]);

export function isB2cMetadataOnlyFormPatch(formData: Record<string, unknown>): boolean {
  const keys = Object.keys(formData || {});
  if (keys.length === 0) return false;

  return keys.every((key) => key.startsWith('_meta.') || PROMOTED_FIELD_ALIASES.has(key));
}
