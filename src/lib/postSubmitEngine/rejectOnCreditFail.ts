import { airtableGet, airtableWrite } from '../../services/engineClient';

export function buildCreditFailRejectFields(
  formData: Record<string, unknown>,
  reason: string
): Record<string, unknown> {
  const nextFormData: Record<string, unknown> = {
    ...formData,
    '_meta.creditCheck.status': 'failed',
    '_meta.creditCheck.reason': reason,
    '_meta.creditCheck.failedAt': new Date().toISOString(),
  };

  return {
    Status: 'Rejected',
    'Lender Decision Status': 'Rejected',
    'Lender Decision Date': new Date().toISOString().split('T')[0],
    'Lender Decision Remarks': reason.slice(0, 500),
    'Last Updated': new Date().toISOString(),
    'Form Data': JSON.stringify(nextFormData),
  };
}

/**
 * Resolve an Airtable record id (rec…) from a draft/application id or File ID.
 */
export async function resolveLoanApplicationRecordId(input: {
  recordIdHint: string;
  fileIdHint?: string;
}): Promise<string> {
  const hint = String(input.recordIdHint || '').trim();
  if (hint.startsWith('rec')) return hint;

  const fileId = String(input.fileIdHint || hint || '').trim();
  if (!fileId) {
    throw new Error('Cannot update application status: missing record id');
  }

  const filter = `{File ID} = '${fileId.replace(/'/g, "\\'")}'`;
  const res = await airtableGet({
    table: 'Loan Applications',
    filter,
    filter_formula: filter,
  });
  const id = res.records?.[0]?.id || (typeof res.id === 'string' ? res.id : '');
  if (!id || !String(id).startsWith('rec')) {
    throw new Error(`Cannot resolve Airtable record for File ID ${fileId}`);
  }
  return String(id);
}

/** Persist Rejected status after Experian / credit-check hard fail. */
export async function writeApplicationRejectedOnCreditFail(input: {
  recordIdHint: string;
  fileIdHint?: string;
  formData: Record<string, unknown>;
  reason: string;
}): Promise<string> {
  const recordId = await resolveLoanApplicationRecordId({
    recordIdHint: input.recordIdHint,
    fileIdHint: input.fileIdHint,
  });
  await airtableWrite({
    table: 'Loan Applications',
    record_id: recordId,
    fields: buildCreditFailRejectFields(input.formData, input.reason),
  });
  return recordId;
}
