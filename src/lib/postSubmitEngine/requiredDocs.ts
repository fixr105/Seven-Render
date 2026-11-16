import { hasCoApplicant } from './canonical';
import type { RequiredDocSlot } from './types';

const FALLBACK_REQUIRED: RequiredDocSlot[] = [
  { fieldId: 'pan_card', label: 'PAN Card', required: true },
  { fieldId: 'aadhaar_front', label: 'Aadhaar Front', required: true },
  { fieldId: 'aadhaar_back', label: 'Aadhaar Back', required: true },
  { fieldId: 'passport_photo', label: 'Passport Photo', required: true },
  { fieldId: 'bank_statement', label: 'Bank Statement 3 months', required: false },
];

const CO_APPLICANT_DOCS: RequiredDocSlot[] = [
  { fieldId: 'co_applicant_pan', label: 'Co-applicant PAN', required: true },
  { fieldId: 'co_applicant_aadhaar', label: 'Co-applicant Aadhaar', required: true },
];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'document';
}

function readField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export function buildRequiredDocsFromAirtable(
  records: Array<Record<string, unknown>> | undefined,
  hasCoApplicant: boolean
): RequiredDocSlot[] {
  const fromTable: RequiredDocSlot[] = [];
  for (const rec of records || []) {
    const nested = rec.fields;
    const fields =
      nested && typeof nested === 'object' && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : rec;
    const label = readField(fields, ['Document Name', 'Name', 'document_name', 'Label', 'label']);
    const explicitFieldId = readField(fields, ['Field ID', 'fieldId', 'Document ID', 'document_id']);
    if (!label && !explicitFieldId) continue;
    const fieldId = explicitFieldId || slugify(label);
    const reqRaw = readField(fields, ['Required', 'Is Required', 'isRequired', 'Mandatory']);
    const required =
      reqRaw === '' ||
      /^(true|yes|1|mandatory|required)$/i.test(reqRaw) ||
      reqRaw.toLowerCase() === 'y';
    fromTable.push({ fieldId, label: label || fieldId, required });
  }

  if (fromTable.length === 0) {
    return [
      ...FALLBACK_REQUIRED,
      ...(hasCoApplicant ? CO_APPLICANT_DOCS : []),
    ];
  }

  if (hasCoApplicant) {
    const existing = new Set(fromTable.map((d) => d.fieldId));
    for (const doc of CO_APPLICANT_DOCS) {
      if (!existing.has(doc.fieldId)) fromTable.push(doc);
    }
  }
  return fromTable;
}

export function readStoredDocumentUploads(
  formData: Record<string, unknown>
): Record<string, { url: string; filename: string }> {
  const out: Record<string, { url: string; filename: string }> = {};
  const sources = [formData['_meta.kycDocuments.uploads'], formData['_meta.postSubmit.uploads']];
  for (const raw of sources) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    for (const [fieldId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const url = String((value as { url?: unknown }).url || '').trim();
      const filename = String((value as { filename?: unknown }).filename || '').trim();
      if (!url) continue;
      out[fieldId] = { url, filename: filename || 'file' };
    }
  }
  return out;
}

function requiredUploadSlots(formData: Record<string, unknown>) {
  return buildRequiredDocsFromAirtable(undefined, hasCoApplicant(formData)).filter(
    (doc) => doc.required
  );
}

/** True when at least one file is stored and a required slot is still empty. */
export function hasPartialRequiredDocuments(formData: Record<string, unknown>): boolean {
  const uploads = readStoredDocumentUploads(formData);
  if (Object.keys(uploads).length === 0) return false;
  return requiredUploadSlots(formData).some((doc) => !uploads[doc.fieldId]?.url);
}

/**
 * Incomplete for both new field ids and older wizard ids.
 * A full set of unrecognized ids counts as finished so a completed file can leave this step.
 */
export function hasIncompleteDocumentUploads(formData: Record<string, unknown>): boolean {
  const uploads = readStoredDocumentUploads(formData);
  const count = Object.keys(uploads).length;
  if (count === 0) return false;
  const required = requiredUploadSlots(formData);
  const knownPresent = required.some((doc) => Boolean(uploads[doc.fieldId]?.url));
  if (knownPresent) return required.some((doc) => !uploads[doc.fieldId]?.url);
  return count < required.length;
}

export function formatDocumentsField(
  uploads: Record<string, { fieldId: string; url: string; filename: string }>
): string {
  return Object.values(uploads)
    .map((u) => `${u.fieldId}:${u.url}|${u.filename}`)
    .join(',');
}
