import { parseDocumentsField } from './kycDocumentsString';
import {
  readAirtableField,
  type AirtableFlatRecord,
} from '../services/engineClient';

function parseFormDataJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function uploadsFromDocumentsString(
  documents: string
): Record<string, { url: string; filename: string }> {
  const out: Record<string, { url: string; filename: string }> = {};
  for (const entry of parseDocumentsField(documents)) {
    out[entry.fieldId] = { url: entry.url, filename: entry.filename || 'file' };
  }
  return out;
}

/**
 * Merge Engine Loan Applications row (Form Data + Documents + File ID)
 * over Express draft form_data. Engine keys win on conflict.
 */
export function mergeEngineLoanRowOverFormData(
  expressFormData: Record<string, unknown>,
  record: AirtableFlatRecord
): Record<string, unknown> {
  const engineForm = parseFormDataJson(readAirtableField(record, 'Form Data')) || {};
  const documents = String(readAirtableField(record, 'Documents') || '').trim();
  const fileId = String(
    readAirtableField(record, 'File ID') || readAirtableField(record, 'fileId') || ''
  ).trim();

  const merged: Record<string, unknown> = {
    ...expressFormData,
    ...engineForm,
  };

  if (documents) {
    merged['_meta.kycDocuments.documentsString'] = documents;
    const existingUploads = merged['_meta.kycDocuments.uploads'];
    const hasUploads =
      existingUploads &&
      typeof existingUploads === 'object' &&
      !Array.isArray(existingUploads) &&
      Object.keys(existingUploads as object).length > 0;
    if (!hasUploads) {
      merged['_meta.kycDocuments.uploads'] = uploadsFromDocumentsString(documents);
    }
  }

  if (fileId) {
    merged['_meta.fileId'] = fileId;
  }

  return merged;
}
