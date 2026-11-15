import { airtableGet, airtableWrite } from '../services/engineClient';
import { fireEvent } from './crmEvents';
import {
  buildKamFlagId,
  mergeDeadlineIntoFormData,
  readDeadlineMeta,
  resetDeadlineAfterMiss,
  type DeadlineMeta,
} from './deadlineCountdown';
import { KAM_FLAGS_TABLE } from './vkycLinks';

export { KAM_FLAGS_TABLE };

async function writeLoanFormData(
  recordId: string,
  formData: Record<string, unknown>,
  now: Date
): Promise<void> {
  if (!recordId.startsWith('rec')) return;
  await airtableWrite({
    table: 'Loan Applications',
    record_id: recordId,
    fields: {
      'Form Data': JSON.stringify(formData),
      'Last Updated': now.toISOString(),
    },
  });
}

async function ensureKamFlagRow(input: {
  flagId: string;
  fileId: string;
  pendingDetails: string;
  priorDeadlineAt: string;
  now: Date;
}): Promise<void> {
  const filter = `{flag_id} = '${input.flagId.replace(/'/g, "\\'")}'`;
  const existing = await airtableGet({
    table: KAM_FLAGS_TABLE,
    filter_formula: filter,
  });
  const count =
    typeof existing.count === 'number' ? existing.count : existing.records?.length || 0;
  if (count > 0) return;

  await airtableWrite({
    table: KAM_FLAGS_TABLE,
    fields: {
      flag_id: input.flagId,
      file_id: input.fileId,
      reason: '24h deadline missed',
      details: `Pending: ${input.pendingDetails}. Deadline was ${input.priorDeadlineAt}.`,
      flagged_at: input.now.toISOString(),
    },
  });
}

/**
 * On expiry: always reset deadline + Form Data first, then attempt KAM Flags create.
 * Flag create failure sets `flag_pending` for later ticks — never blocks the reset/banner.
 */
export async function ensureDeadlineMissFlag(input: {
  fileId: string;
  formData: Record<string, unknown>;
  recordId: string;
  pendingDetails: string;
  now?: Date;
}): Promise<{ formData: Record<string, unknown>; deadline: DeadlineMeta; flagged: boolean }> {
  const now = input.now || new Date();
  const current = readDeadlineMeta(input.formData);

  if (!current || current.completed_at) {
    const fallback: DeadlineMeta = current || {
      started_at: now.toISOString(),
      deadline_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      missed_count: 0,
    };
    return { formData: input.formData, deadline: fallback, flagged: false };
  }

  const expired = Date.parse(current.deadline_at) <= now.getTime();
  const pendingFlagId = String(current.flag_pending || '').trim();

  if (!expired && !pendingFlagId) {
    return { formData: input.formData, deadline: current, flagged: false };
  }

  const priorDeadlineAt = current.deadline_at;
  let deadline: DeadlineMeta = { ...current };
  let formData = input.formData;

  if (expired) {
    deadline = resetDeadlineAfterMiss(current, now);
    formData = mergeDeadlineIntoFormData(input.formData, deadline);
    try {
      // CRM hand-off (stub until Frappe contract) — never blocks KAM Flags / reset.
      formData = await fireEvent('DEADLINE_MISSED', {
        summary: `24h deadline missed (#${deadline.missed_count}). Pending: ${input.pendingDetails}`,
        fileKey: input.fileId,
        n: deadline.missed_count,
        formData,
        withJson: true,
      });
    } catch {
      // ignore CRM failures
    }
    try {
      await writeLoanFormData(input.recordId, formData, now);
    } catch {
      // Still return reset formData so the dealer banner can show.
    }
  }

  const flagId = expired
    ? buildKamFlagId(input.fileId, deadline.missed_count)
    : pendingFlagId;

  try {
    await ensureKamFlagRow({
      flagId,
      fileId: input.fileId,
      pendingDetails: input.pendingDetails,
      priorDeadlineAt,
      now,
    });
    if (deadline.flag_pending) {
      const cleared: DeadlineMeta = {
        started_at: deadline.started_at,
        deadline_at: deadline.deadline_at,
        missed_count: deadline.missed_count,
        completed_at: deadline.completed_at,
      };
      deadline = cleared;
      formData = mergeDeadlineIntoFormData(formData, deadline);
      await writeLoanFormData(input.recordId, formData, now);
    }
    return { formData, deadline, flagged: true };
  } catch {
    deadline = { ...deadline, flag_pending: flagId };
    formData = mergeDeadlineIntoFormData(formData, deadline);
    try {
      await writeLoanFormData(input.recordId, formData, now);
    } catch {
      // Keep in-memory flag_pending even if the second Form Data write fails.
    }
    return { formData, deadline, flagged: false };
  }
}
