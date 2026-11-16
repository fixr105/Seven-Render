import {
  airtableGet,
  airtableWrite,
  readAirtableField,
  type AirtableFlatRecord,
} from '../services/engineClient';

export const VKYC_LINKS_TABLE = 'VKYC Links';
export const KAM_FLAGS_TABLE = 'KAM Flags';

export type VkycStatus = 'Requested' | 'Link Sent' | 'Done' | 'Failed' | '';

export type VkycRow = {
  id: string;
  file_id: string;
  mobile: string;
  borrower_name: string;
  status: VkycStatus;
  link: string;
  requested_at: string;
  link_at: string;
  done_at: string;
  done_by: string;
  remarks: string;
};

function asStatus(value: unknown): VkycStatus {
  const s = String(value || '').trim();
  if (s === 'Requested' || s === 'Link Sent' || s === 'Done' || s === 'Failed') return s;
  return '';
}

export function mapVkycRecord(record: AirtableFlatRecord): VkycRow {
  return {
    id: String(record.id || ''),
    file_id: String(readAirtableField(record, 'file_id') || ''),
    mobile: String(readAirtableField(record, 'mobile') || ''),
    borrower_name: String(readAirtableField(record, 'borrower_name') || ''),
    status: asStatus(readAirtableField(record, 'status')),
    link: String(readAirtableField(record, 'link') || ''),
    requested_at: String(readAirtableField(record, 'requested_at') || ''),
    link_at: String(readAirtableField(record, 'link_at') || ''),
    done_at: String(readAirtableField(record, 'done_at') || ''),
    done_by: String(readAirtableField(record, 'done_by') || ''),
    remarks: String(readAirtableField(record, 'remarks') || ''),
  };
}

export async function fetchVkycByFileId(fileId: string): Promise<VkycRow | null> {
  const safe = fileId.replace(/'/g, "\\'");
  const res = await airtableGet({
    table: VKYC_LINKS_TABLE,
    filter_formula: `{file_id} = '${safe}'`,
  });
  const record = res.records?.[0];
  if (!record) return null;
  return mapVkycRecord(record);
}

export async function requestVkyc(input: {
  fileId: string;
  mobile: string;
  borrowerName: string;
  existingRecordId?: string;
}): Promise<VkycRow> {
  const now = new Date().toISOString();
  const baseFields: Record<string, unknown> = {
    file_id: input.fileId,
    mobile: input.mobile,
    borrower_name: input.borrowerName,
    status: 'Requested',
    requested_at: now,
  };

  if (input.existingRecordId) {
    // Request again: clear prior meeting link on the same row.
    const res = await airtableWrite({
      table: VKYC_LINKS_TABLE,
      record_id: input.existingRecordId,
      fields: { ...baseFields, link: '' },
    });
    return {
      id: String(res.id || input.existingRecordId),
      file_id: input.fileId,
      mobile: input.mobile,
      borrower_name: input.borrowerName,
      status: 'Requested',
      link: '',
      requested_at: now,
      link_at: '',
      done_at: '',
      done_by: '',
      remarks: '',
    };
  }

  // Create: do not send link (omit empty string).
  const res = await airtableWrite({
    table: VKYC_LINKS_TABLE,
    fields: baseFields,
  });
  return {
    id: String(res.id || ''),
    file_id: input.fileId,
    mobile: input.mobile,
    borrower_name: input.borrowerName,
    status: 'Requested',
    link: '',
    requested_at: now,
    link_at: '',
    done_at: '',
    done_by: '',
    remarks: '',
  };
}

/** Next enabled when VKYC requested and not Failed / no-row. */
export function isVkycReadyForNext(row: VkycRow | null): boolean {
  if (!row) return false;
  if (!row.status || row.status === 'Failed') return false;
  return true;
}

export function isVkycDone(row: VkycRow | null): boolean {
  return row?.status === 'Done';
}

export async function completeVkycLink(fileId: string, doneBy = 'KAM'): Promise<void> {
  if (!fileId) return;
  const row = await fetchVkycByFileId(fileId);
  if (!row?.id || row.status === 'Done') return;
  await airtableWrite({
    table: VKYC_LINKS_TABLE,
    record_id: row.id,
    fields: {
      status: 'Done',
      done_at: new Date().toISOString(),
      done_by: doneBy,
    },
  });
}

export async function markLoanFileVkycDone(fileId: string): Promise<void> {
  if (!fileId) return;
  const safe = fileId.replace(/'/g, "\\'");
  const res = await airtableGet({
    table: 'Loan Applications',
    filter_formula: `{File ID} = '${safe}'`,
  });
  const record = res.records?.[0];
  const recordId = String(record?.id || '');
  if (!recordId) return;
  const raw = readAirtableField(record, 'Form Data');
  let formData: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      formData = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      formData = {};
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    formData = raw as Record<string, unknown>;
  }
  const next = {
    ...formData,
    'compliance.vkycDone': 'true',
    '_meta.vkyc.status': 'Done',
    '_meta.kamRequests.vkyc.requestedAt': '',
    '_meta.kamRequests.vkyc.dismissedAt': '',
  };
  await airtableWrite({
    table: 'Loan Applications',
    record_id: recordId,
    fields: {
      'Form Data': JSON.stringify(next),
      'Last Updated': new Date().toISOString(),
    },
  });
}

export function maskMobile(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length < 4) return 'XXXXXX';
  return `XXXXXX${digits.slice(-4)}`;
}
