/**
 * Maps loan application inputs to the live Airtable "Loan Applications" table (tbl85RSGR1op38O3G).
 * No columns beyond this list are POSTed to n8n/Airtable.
 */

export const LOAN_APPLICATION_AIRTABLE_COLUMNS = [
  'File ID',
  'Client',
  'KAM ID',
  'Applicant Name',
  'Loan Product',
  'Requested Loan Amount',
  'Mobile Number',
  'Email Id',
  'Remarks',
  'Select',
  'Documents',
  'Status',
  'Assigned Credit Analyst',
  'Assigned NBFC',
  'Lender Decision Status',
  'Lender Decision Date',
  'Lender Decision Remarks',
  'Approved Loan Amount',
  'AI File Summary',
  'Form Data',
  'Creation Date',
  'Submitted Date',
  'Last Updated',
  'MD',
] as const;

export type LoanApplicationAirtableColumn = (typeof LOAN_APPLICATION_AIRTABLE_COLUMNS)[number];

/** Stored inside Form Data JSON — not Airtable columns. */
export const LOAN_APPLICATION_FORM_DATA_META_KEYS = {
  formConfigVersion: '_meta.formConfigVersion',
  clientSubmissionId: '_meta.clientSubmissionId',
  needsAttention: '_meta.needsAttention',
  validationWarnings: '_meta.validationWarnings',
  asanaTaskId: '_meta.asanaTaskId',
  asanaTaskLink: '_meta.asanaTaskLink',
  typeOfPurchase: '_typeOfPurchase',
} as const;

const SELECT_OPTIONS = new Set(['Rental', 'EMI']);

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str !== '') return str;
  }
  return '';
}

export function parseLoanApplicationFormData(
  record: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!record) return {};
  const raw = record['Form Data'] ?? record.formData ?? record['form_data'];
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function normalizeSelectValue(value: unknown): string {
  const normalized = firstNonEmpty(value);
  if (!normalized) return '';
  if (SELECT_OPTIONS.has(normalized)) return normalized;
  const lower = normalized.toLowerCase();
  if (lower === 'rental') return 'Rental';
  if (lower === 'emi') return 'EMI';
  return normalized;
}

export interface LoanApplicationFormDataMetadata {
  formConfigVersion?: string | null;
  clientSubmissionId?: string | null;
  needsAttention?: boolean;
  validationWarnings?: string[];
  asanaTaskId?: string | null;
  asanaTaskLink?: string | null;
  typeOfPurchase?: string | null;
}

/** Merge metadata and legacy top-level keys into Form Data before persistence. */
export function packLoanApplicationFormData(
  formData: Record<string, unknown>,
  metadata: LoanApplicationFormDataMetadata = {},
  legacyTopLevel: Record<string, unknown> = {}
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...formData };

  const formConfigVersion = firstNonEmpty(
    metadata.formConfigVersion,
    legacyTopLevel['Form Config Version'],
    legacyTopLevel.formConfigVersion,
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.formConfigVersion]
  );
  if (formConfigVersion) {
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.formConfigVersion] = formConfigVersion;
  }

  const clientSubmissionId = firstNonEmpty(
    metadata.clientSubmissionId,
    legacyTopLevel['Client Submission ID'],
    legacyTopLevel.clientSubmissionId,
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.clientSubmissionId]
  );
  if (clientSubmissionId) {
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.clientSubmissionId] = clientSubmissionId;
  }

  const needsAttentionRaw =
    metadata.needsAttention ??
    legacyTopLevel['Needs Attention'] ??
    legacyTopLevel.needsAttention ??
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.needsAttention];
  if (needsAttentionRaw !== undefined && needsAttentionRaw !== null && needsAttentionRaw !== '') {
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.needsAttention] =
      needsAttentionRaw === true || needsAttentionRaw === 'True' || needsAttentionRaw === 'true';
  }

  const validationWarnings =
    metadata.validationWarnings ??
    (Array.isArray(legacyTopLevel['Validation Warnings'])
      ? (legacyTopLevel['Validation Warnings'] as string[])
      : undefined);
  const validationWarningsRaw =
    validationWarnings ??
    legacyTopLevel['Validation Warnings'] ??
    legacyTopLevel.validationWarnings ??
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.validationWarnings];
  if (validationWarningsRaw != null && validationWarningsRaw !== '') {
    if (Array.isArray(validationWarningsRaw)) {
      next[LOAN_APPLICATION_FORM_DATA_META_KEYS.validationWarnings] = validationWarningsRaw;
    } else if (typeof validationWarningsRaw === 'string') {
      try {
        const parsed = JSON.parse(validationWarningsRaw);
        next[LOAN_APPLICATION_FORM_DATA_META_KEYS.validationWarnings] = Array.isArray(parsed)
          ? parsed
          : validationWarningsRaw;
      } catch {
        next[LOAN_APPLICATION_FORM_DATA_META_KEYS.validationWarnings] = validationWarningsRaw;
      }
    }
  }

  const asanaTaskId = firstNonEmpty(
    metadata.asanaTaskId,
    legacyTopLevel['Asana Task ID'],
    legacyTopLevel.asanaTaskId,
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.asanaTaskId]
  );
  if (asanaTaskId) {
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.asanaTaskId] = asanaTaskId;
  }

  const asanaTaskLink = firstNonEmpty(
    metadata.asanaTaskLink,
    legacyTopLevel['Asana Task Link'],
    legacyTopLevel.asanaTaskLink,
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.asanaTaskLink]
  );
  if (asanaTaskLink) {
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.asanaTaskLink] = asanaTaskLink;
  }

  const typeOfPurchase = normalizeSelectValue(
    firstNonEmpty(
      metadata.typeOfPurchase,
      legacyTopLevel['Type of Purchase'],
      legacyTopLevel.typeOfPurchase,
      next[LOAN_APPLICATION_FORM_DATA_META_KEYS.typeOfPurchase],
      next._typeOfPurchase
    )
  );
  if (typeOfPurchase) {
    next[LOAN_APPLICATION_FORM_DATA_META_KEYS.typeOfPurchase] = typeOfPurchase;
    next._typeOfPurchase = typeOfPurchase;
  }

  return next;
}

export function readClientSubmissionId(record: Record<string, unknown>): string {
  const parsed = parseLoanApplicationFormData(record);
  return firstNonEmpty(
    record['Client Submission ID'],
    record.clientSubmissionId,
    parsed[LOAN_APPLICATION_FORM_DATA_META_KEYS.clientSubmissionId]
  );
}

export function readFormConfigVersion(record: Record<string, unknown>): string {
  const parsed = parseLoanApplicationFormData(record);
  return firstNonEmpty(
    record['Form Config Version'],
    record.formConfigVersion,
    parsed[LOAN_APPLICATION_FORM_DATA_META_KEYS.formConfigVersion]
  );
}

export function resolveSelectFromFormData(formData: Record<string, unknown>): string {
  return normalizeSelectValue(
    firstNonEmpty(
      formData[LOAN_APPLICATION_FORM_DATA_META_KEYS.typeOfPurchase],
      formData._typeOfPurchase
    )
  );
}
