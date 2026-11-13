import { enginePost } from '../../services/engineClient';
import { extractRecordId, extractRecords } from './formModel';

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Engine airtable_write needs the Airtable record id (`rec…`).
 * Wizard submit may hand us a File ID (`SF…`) — resolve when needed.
 */
export async function resolveLoanRecordId(
  recordIdOrFileId: string,
  preferredFileId?: string
): Promise<{ recordId: string; fileId: string }> {
  const id = recordIdOrFileId.trim();
  const fileHint = (preferredFileId || '').trim();
  if (id.startsWith('rec')) {
    return { recordId: id, fileId: fileHint || id };
  }

  const fileId = fileHint || id;
  if (!fileId) {
    throw new Error('Missing application record id');
  }

  const payload = await enginePost('airtable_get', {
    table: 'Loan Applications',
    filter: `{File ID} = '${escapeFormulaValue(fileId)}'`,
  });
  const recordId = extractRecordId(payload) || extractRecords(payload)[0]?.id;
  if (!recordId) {
    throw new Error('Could not resolve the Loan Applications record');
  }
  return { recordId: String(recordId), fileId };
}
