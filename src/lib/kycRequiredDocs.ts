import type { FormConfigCategory } from './b2cEvDocuments';
import { getDocumentCategories, isFileFieldRequired } from './b2cEvDocuments';

export type KycDocSlot = {
  fieldId: string;
  label: string;
  required: boolean;
};

const FALLBACK_DOCS: KycDocSlot[] = [
  { fieldId: 'pan_card', label: 'PAN Card', required: true },
  { fieldId: 'aadhaar_front', label: 'Aadhaar Front', required: true },
  { fieldId: 'aadhaar_back', label: 'Aadhaar Back', required: true },
  { fieldId: 'passport_photo', label: 'Passport Photo', required: true },
  { fieldId: 'bank_statement', label: 'Bank Statement', required: false },
];

const CO_APP_DOCS: KycDocSlot[] = [
  { fieldId: 'co_applicant_pan', label: 'Co-applicant PAN', required: true },
  { fieldId: 'co_applicant_aadhaar', label: 'Co-applicant Aadhaar', required: true },
];

function hasCoApplicant(formData: Record<string, unknown>): boolean {
  const type = String(formData['_meta.supportPersonType'] || '').trim();
  if (type === 'co_applicant') return true;
  return Boolean(String(formData['coApplicant.pan'] || '').trim());
}

export function buildKycRequiredDocSlots(
  formData: Record<string, unknown>,
  formConfig: FormConfigCategory[] = []
): KycDocSlot[] {
  const fromConfig: KycDocSlot[] = [];
  for (const category of getDocumentCategories(formConfig)) {
    for (const field of category.fields || []) {
      const fieldType = field.type || field.fieldType || field['Field Type'] || '';
      if (fieldType !== 'file') continue;
      const fieldId = String(field.fieldId || field.id || field['Field ID'] || '').trim();
      if (!fieldId) continue;
      const label = String(field.label || field.fieldLabel || field['Field Label'] || fieldId).trim();
      fromConfig.push({
        fieldId,
        label,
        required: isFileFieldRequired(field),
      });
    }
  }

  if (fromConfig.length > 0) return fromConfig;

  const slots = [...FALLBACK_DOCS];
  if (hasCoApplicant(formData)) {
    slots.push(...CO_APP_DOCS);
  }
  return slots;
}

export function getUploadedDocMap(
  formData: Record<string, unknown>
): Record<string, { url: string; filename: string }> {
  const raw = formData['_meta.kycDocuments.uploads'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, { url: string; filename: string }> = {};
    for (const [fieldId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const url = String((value as { url?: unknown }).url || '').trim();
      const filename = String((value as { filename?: unknown }).filename || '').trim();
      if (url) out[fieldId] = { url, filename: filename || 'file' };
    }
    return out;
  }
  return {};
}

export function areRequiredKycDocsUploaded(
  formData: Record<string, unknown>,
  formConfig: FormConfigCategory[] = []
): boolean {
  const slots = buildKycRequiredDocSlots(formData, formConfig);
  const uploads = getUploadedDocMap(formData);
  return slots.filter((s) => s.required).every((s) => Boolean(uploads[s.fieldId]?.url));
}

/**
 * Wizard KYC uses formConfig field ids (e.g. field-1a.1). Post-submit's empty-config
 * fallback uses pan_card/… — so areRequiredKycDocsUploaded alone misses completed wizard KYC.
 */
export function hasCompletedWizardKycDocuments(formData: Record<string, unknown>): boolean {
  const documentsString = String(formData['_meta.kycDocuments.documentsString'] || '').trim();
  if (!documentsString) return false;
  return Object.keys(getUploadedDocMap(formData)).length > 0;
}
