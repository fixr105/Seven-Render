/**
 * Record Normalizer Service
 *
 * Normalizes parsed records from n8n GET webhooks to canonical field names
 * and consistent boolean values. Runs after N8nResponseParser in fetchTable().
 *
 * Centralizes field variant resolution (e.g. clientId -> Client ID) so
 * consumers receive consistent data without scattered fallback logic.
 */

/** Compatible with ParsedRecord from n8nClient */
export type NormalizableRecord = { id: string; createdTime?: string; [key: string]: any };

/** Canonical field -> possible variant keys (first match wins) */
const FIELD_VARIANTS: Record<string, string[]> = {
  'Client ID': ['clientId', 'Client ID'],
  'Product ID': ['productId', 'Product ID'],
  'Record Title': ['recordTitle', 'label', 'Record Title'],
  'Display Order': ['displayOrder', 'Display Order'],
  'Is Required': ['isRequired', 'Is Mandatory', 'isMandatory', 'Is Required'],
  'Form Data': ['form_data', 'form data', 'Form Data'],
  'Form link': ['formLink', 'Form link'],
  'Mapping ID': ['mappingId', 'Mapping ID'],
  'Assigned KAM': ['assignedKAM', 'Assigned KAM'],
  'Assigned Products': ['assignedProducts', 'Assigned Products'],
  'Contact Email / Phone': ['contactEmailPhone', 'Contact Email / Phone'],
  'Client Name': ['clientName', 'Client Name'],
  'Details/Message': ['detailsMessage', 'Details/Message'],
  'Action/Event Type': ['actionEventType', 'Action/Event Type'],
};

/** Fields that should be normalized to 'True' or 'False' */
const BOOLEAN_FIELDS = ['Resolved', 'Is Required', 'Is Mandatory'];

const LOG_ANOMALIES = process.env.LOG_NORMALIZATION_ANOMALIES === 'true';

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function normalizeBoolean(value: unknown): 'True' | 'False' {
  if (value === true || value === 'true' || value === 'True' || value === 'TRUE' || value === '1') {
    return 'True';
  }
  return 'False';
}

function isBooleanLike(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value !== 'string') return false;
  const s = value.trim().toLowerCase();
  return s === 'true' || s === 'false' || s === '1' || s === '0';
}

/**
 * Normalize records: resolve field name variants to canonical keys and
 * normalize boolean fields to 'True'/'False'.
 *
 * @param records - Parsed records from N8nResponseParser
 * @param tableName - Table name (for table-specific rules; currently unused)
 * @returns Normalized records with canonical field names
 */
export function normalizeRecords(records: NormalizableRecord[], tableName: string): NormalizableRecord[] {
  if (!Array.isArray(records) || records.length === 0) {
    return records;
  }

  return records.map((record) => normalizeRecord(record, tableName));
}

function normalizeRecord(record: NormalizableRecord, tableName: string): NormalizableRecord {
  const result = { ...record };

  // Resolve field variants: if canonical key is missing, try variants
  for (const [canonicalKey, variants] of Object.entries(FIELD_VARIANTS)) {
    const existing = result[canonicalKey];
    if (!isEmpty(existing)) continue;

    for (const variant of variants) {
      if (variant === canonicalKey) continue;
      const value = result[variant];
      if (!isEmpty(value)) {
        result[canonicalKey] = value;
        if (LOG_ANOMALIES) {
          console.log(`[RecordNormalizer] Filled ${canonicalKey} from variant "${variant}" (table: ${tableName})`);
        }
        break;
      }
    }
  }

  // Normalize boolean fields to 'True'/'False'
  for (const field of BOOLEAN_FIELDS) {
    const value = result[field];
    if (value === undefined || value === null) continue;

    if (isBooleanLike(value)) {
      const normalized = normalizeBoolean(value);
      if (String(value).trim() !== normalized && LOG_ANOMALIES) {
        console.log(`[RecordNormalizer] Normalized ${field}: "${value}" -> "${normalized}" (table: ${tableName})`);
      }
      result[field] = normalized;
    }
  }

  return result;
}
