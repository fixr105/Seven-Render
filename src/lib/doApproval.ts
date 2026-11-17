export const DO_APPROVAL_CHECKLIST = [
  'Aadhaar OTP done on Fintree',
  'PAN OTP done on Fintree',
  'Credit approval for Fintree',
  'eNACH done',
  'IoT live',
] as const;

export const DO_LENDER_NAME = 'Fintree Finance Pvt Ltd';

export type DoApprovalRecord = {
  checklist: string[];
  approvedBy: string;
  approvedAt: string;
  doUrl?: string;
  doFileName?: string;
  doGeneratedAt?: string;
};

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function complianceStatusDone(formData: Record<string, unknown>, key: string): boolean {
  const raw = formData[key];
  const record =
    typeof raw === 'string'
      ? (() => {
          try {
            return asRecord(JSON.parse(raw));
          } catch {
            return null;
          }
        })()
      : asRecord(raw);
  return readString(record?.status) === 'done';
}

function qualifyPassed(formData: Record<string, unknown>): boolean {
  const raw = formData['_meta.qualifyResult'];
  const record =
    typeof raw === 'string'
      ? (() => {
          try {
            return asRecord(JSON.parse(raw));
          } catch {
            return null;
          }
        })()
      : asRecord(raw);
  return record?.pass === true;
}

/** Suggested ticks when the KAM opens the DO checklist. IoT stays manual. */
export function defaultDoChecklistTicks(formData: Record<string, unknown>): boolean[] {
  const ekycDone = complianceStatusDone(formData, '_meta.compliance.ekyc');
  const enachDone = complianceStatusDone(formData, '_meta.compliance.enach');
  return [ekycDone, ekycDone, qualifyPassed(formData), enachDone, false];
}

export function readDoApproval(formData: Record<string, unknown>): DoApprovalRecord | null {
  const raw = formData['_meta.doApproval'];
  const record =
    typeof raw === 'string'
      ? (() => {
          try {
            return asRecord(JSON.parse(raw));
          } catch {
            return null;
          }
        })()
      : asRecord(raw);
  if (!record) return null;
  const checklist = Array.isArray(record.checklist)
    ? record.checklist.map((item) => readString(item)).filter(Boolean)
    : [];
  const approvedBy = readString(record.approvedBy);
  const approvedAt = readString(record.approvedAt);
  const doUrl = readString(record.doUrl);
  if (checklist.length === 0 && !approvedBy && !approvedAt && !doUrl) return null;
  return {
    checklist,
    approvedBy,
    approvedAt,
    ...(doUrl ? { doUrl } : {}),
    ...(readString(record.doFileName) ? { doFileName: readString(record.doFileName) } : {}),
    ...(readString(record.doGeneratedAt) ? { doGeneratedAt: readString(record.doGeneratedAt) } : {}),
  };
}

export function formatDoApprovedWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function buildDoWebhookPayload(input: {
  formData: Record<string, unknown>;
  fileId: string;
  applicationId: string;
  approvedBy: string;
  approvedAt: string;
}): Record<string, string> {
  const form = input.formData;
  const read = (key: string) => readString(form[key]);
  return {
    file_id: input.fileId,
    application_id: input.applicationId,
    applicant_name: read('borrower.customerName'),
    co_applicant_name: read('coApplicant.name'),
    pan: read('borrower.pan'),
    mobile: read('borrower.mobile'),
    loan_amount: read('loan.amount'),
    tenure_months: read('loan.tenureMonths'),
    interest_rate: read('loan.interestRate'),
    emi: read('loan.emiAmount'),
    processing_fee: read('loan.processingFee'),
    disbursal_amount: read('loan.disbursalAmount'),
    product_id: read('loan.productId') || read('productId'),
    lender: DO_LENDER_NAME,
    enach_account: read('enach.accountNumber'),
    enach_ifsc: read('enach.ifscCode'),
    approved_by: input.approvedBy,
    approved_at: input.approvedAt,
  };
}

const PDF_URL_KEYS = ['url', 'pdf_url', 'document_url', 'link'] as const;

function firstPdfRecord(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return asRecord(data[0]);
  return asRecord(data);
}

export function readDoPdfFromJson(
  data: unknown
): { ok: true; url: string; fileName: string } | { ok: false; error: string } {
  const record = firstPdfRecord(data);
  if (!record) return { ok: false, error: 'Unexpected response' };
  if (record.ok === false) {
    const reason = readString(record.error) || 'Unknown error';
    return { ok: false, error: reason };
  }
  let url = '';
  for (const key of PDF_URL_KEYS) {
    const candidate = readString(record[key]);
    if (candidate) {
      url = candidate;
      break;
    }
  }
  if (!url) {
    const nested = asRecord(record.data);
    url = nested ? readString(nested.url) : '';
  }
  if (!url) return { ok: false, error: 'Response did not include a PDF URL' };
  const fileName =
    readString(record.file_name) || readString(record.fileName) || readString(record.name) || 'DO.pdf';
  return { ok: true, url, fileName };
}

export function readDashboardDoUrl(row: {
  DO?: unknown;
  form_data?: Record<string, unknown> | null;
  formData?: Record<string, unknown> | null;
}): string {
  const top = readString(row.DO);
  if (top) return top;
  const form = row.form_data || row.formData || {};
  return readDoApproval(form)?.doUrl || '';
}

export function doColumnHref(value: string): string | null {
  const url = value.trim();
  return url.startsWith('https://') ? url : null;
}
