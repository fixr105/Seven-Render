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
    const label =
      readField(fields, ['Document Name', 'Name', 'document_name', 'Label', 'label']) ||
      'Document';
    const fieldId =
      readField(fields, ['Field ID', 'fieldId', 'Document ID', 'document_id']) || slugify(label);
    const reqRaw = readField(fields, ['Required', 'Is Required', 'isRequired', 'Mandatory']);
    const required =
      reqRaw === '' ||
      /^(true|yes|1|mandatory|required)$/i.test(reqRaw) ||
      reqRaw.toLowerCase() === 'y';
    fromTable.push({ fieldId, label, required });
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

export function formatDocumentsField(
  uploads: Record<string, { fieldId: string; url: string; filename: string }>
): string {
  return Object.values(uploads)
    .map((u) => `${u.fieldId}:${u.url}|${u.filename}`)
    .join(',');
}
