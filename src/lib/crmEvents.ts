/**
 * Dealer-app → DLA event hand-off via /tools/sevenfin-dla-event.
 * ELIGIBILITY_PASS also creates a CRM lead via sevenfin-crm-lead (separate).
 */

import { digits10, sendSevenfinCrmLeadWithRetry } from './crm/sevenfinCrmLead';
import { stripSensitiveFormData } from './crm/stripSensitiveFormData';
import { postSevenfinDlaEvent } from '../services/toolsClient';

export type CrmEventName =
  | 'ELIGIBILITY_PASS'
  | 'ELIGIBILITY_FAIL'
  | 'CO_APPLICANT_CHECK'
  | 'PRICING_UNAVAILABLE'
  | 'PRICING_NOT_ELIGIBLE'
  | 'DEADLINE_REMINDER'
  | 'DEADLINE_MISSED'
  | 'VKYC_FAILED';

export type CrmSentEntry = {
  id: string;
  at: string;
  reference?: string;
  lead_id?: string;
  duplicate?: boolean;
};

export type CrmPendingEntry = {
  id: string;
  event: CrmEventName;
  summary: string;
  withJson: boolean;
  error_message?: string;
};

export type CrmMeta = {
  sent: CrmSentEntry[];
  pending: CrmPendingEntry[];
};

export type SendToCrmResult =
  | { sent: true; reference?: string; lead_id?: string; duplicate?: boolean }
  | { sent: false; reason: string; error_message?: string };

export type SendToCrmContext = {
  applicantName?: string;
  applicantMobile?: string;
  fileId?: string;
  seq?: number;
  formData?: Record<string, unknown>;
  withJson?: boolean;
};

export type FireEventInput = {
  summary: string;
  withJson?: boolean;
  fileKey: string;
  n?: number;
  formData: Record<string, unknown>;
  applicantName?: string;
  applicantMobile?: string;
  writeFormData?: (nextFormData: Record<string, unknown>) => Promise<void> | void;
};

const OWNER_NAME = 'Ajay';
const DLA_NAME = 'Seven Dealer EV';

function asCrmMeta(formData: Record<string, unknown>): CrmMeta {
  const raw = formData['_meta.crm'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      sent: Array.isArray(obj.sent) ? (obj.sent as CrmSentEntry[]) : [],
      pending: Array.isArray(obj.pending) ? (obj.pending as CrmPendingEntry[]) : [],
    };
  }
  return { sent: [], pending: [] };
}

export function maskMobileForCrm(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length < 4) return 'XXXXXXXXXX';
  return `${'X'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function buildCrmEventId(fileKey: string, event: CrmEventName, n = 1): string {
  return `${fileKey}-${event}-${n}`;
}

/** Local/debug message shape only — not the tools POST body. */
export function buildCrmMessageBody(input: {
  event: CrmEventName;
  summary: string;
  fileId: string;
  applicantName: string;
  applicantMobile: string;
  formData?: Record<string, unknown>;
  withJson?: boolean;
}): string {
  const lines = [
    `${input.event} · ${input.summary}`,
    `File: ${input.fileId}`,
    `Applicant: ${input.applicantName} · ${maskMobileForCrm(input.applicantMobile)}`,
    `Owner: ${OWNER_NAME}`,
  ];
  if (input.withJson && input.formData) {
    lines.push('');
    lines.push(JSON.stringify(stripSensitiveFormData(input.formData), null, 2));
  }
  return lines.join('\n');
}

function asObj(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

/**
 * All CRM events → POST /tools/sevenfin-dla-event.
 * ELIGIBILITY_PASS also best-effort posts sevenfin-crm-lead.
 * Pending/sent status follows the dla-event result.
 */
export async function sendToCrm(
  event: CrmEventName,
  summary: string,
  _body: string,
  context?: SendToCrmContext
): Promise<SendToCrmResult> {
  const fileId = String(context?.fileId || '').trim();
  const applicantName = String(context?.applicantName || '')
    .trim()
    .toUpperCase();
  const phone = digits10(context?.applicantMobile || '');
  const seq = context?.seq ?? 1;
  const withJson = Boolean(context?.withJson);
  const payload =
    withJson && context?.formData
      ? stripSensitiveFormData(context.formData)
      : null;

  const requestBody: Record<string, unknown> = {
    event,
    file_id: fileId,
    dla_name: DLA_NAME,
    applicant_name: applicantName,
    phone,
    summary,
    owner: OWNER_NAME,
    timestamp: new Date().toISOString(),
    seq,
    payload,
  };

  let status = 0;
  let data: unknown = null;
  try {
    ({ status, data } = await postSevenfinDlaEvent(requestBody));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { sent: false, reason: msg, error_message: msg };
  }

  const body = asObj(data);
  let result: SendToCrmResult;
  if (body.ok === true || status === 201 || (status === 200 && body.duplicate === true)) {
    result = {
      sent: true,
      reference: String(body.event_id || ''),
      duplicate: Boolean(body.duplicate),
    };
  } else {
    const errorMessage = String(
      body.error_message || body.error || 'DLA event failed'
    );
    result = {
      sent: false,
      reason: errorMessage,
      error_message: errorMessage,
    };
  }

  // Separate CRM lead creation — does not control pending/sent for the event.
  if (event === 'ELIGIBILITY_PASS') {
    try {
      const lead = await sendSevenfinCrmLeadWithRetry({
        applicantName: context?.applicantName || '',
        applicantMobile: context?.applicantMobile || '',
      });
      if (result.sent && lead.sent) {
        result = { ...result, lead_id: lead.lead_id };
      }
    } catch {
      // ignore — lead is best-effort
    }
  }

  return result;
}

export async function fireEvent(
  event: CrmEventName,
  input: FireEventInput,
  deps: { sendToCrm?: typeof sendToCrm } = {}
): Promise<Record<string, unknown>> {
  const send = deps.sendToCrm || sendToCrm;
  const n = input.n ?? 1;
  const id = buildCrmEventId(input.fileKey, event, n);
  const crm = asCrmMeta(input.formData);
  if (crm.sent.some((entry) => entry.id === id) || crm.pending.some((entry) => entry.id === id)) {
    return input.formData;
  }

  const withJson = Boolean(input.withJson);
  const body = buildCrmMessageBody({
    event,
    summary: input.summary,
    fileId: input.fileKey,
    applicantName: input.applicantName || '',
    applicantMobile: input.applicantMobile || '',
    formData: withJson ? input.formData : undefined,
    withJson,
  });

  let result: SendToCrmResult;
  try {
    result = await send(event, input.summary, body, {
      applicantName: input.applicantName,
      applicantMobile: input.applicantMobile,
      fileId: input.fileKey,
      seq: n,
      formData: withJson ? input.formData : undefined,
      withJson,
    });
  } catch {
    result = { sent: false, reason: 'send_failed' };
  }

  const nextCrm: CrmMeta = {
    sent: [...crm.sent],
    pending: [...crm.pending],
  };
  if (result.sent) {
    nextCrm.sent.push({
      id,
      at: new Date().toISOString(),
      reference: result.reference,
      lead_id: result.lead_id,
      duplicate: result.duplicate,
    });
  } else {
    nextCrm.pending.push({
      id,
      event,
      summary: input.summary,
      withJson,
      error_message: result.error_message || result.reason,
    });
  }

  const nextFormData = { ...input.formData, '_meta.crm': nextCrm };
  if (input.writeFormData) {
    try {
      await input.writeFormData(nextFormData);
    } catch {
      // Never block the dealer flow.
    }
  }

  return flushCrm(
    nextFormData,
    {
      fileKey: input.fileKey,
      applicantName: input.applicantName,
      applicantMobile: input.applicantMobile,
      writeFormData: input.writeFormData,
    },
    deps
  );
}

function seqFromPendingId(id: string, event: CrmEventName): number {
  const suffix = `-${event}-`;
  const idx = id.lastIndexOf(suffix);
  if (idx < 0) return 1;
  const n = Number(id.slice(idx + suffix.length));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function flushCrm(
  formData: Record<string, unknown>,
  context: {
    fileKey: string;
    applicantName?: string;
    applicantMobile?: string;
    writeFormData?: (nextFormData: Record<string, unknown>) => Promise<void> | void;
  },
  deps: { sendToCrm?: typeof sendToCrm } = {}
): Promise<Record<string, unknown>> {
  const send = deps.sendToCrm || sendToCrm;
  const crm = asCrmMeta(formData);
  if (crm.pending.length === 0) return formData;

  const remaining: CrmPendingEntry[] = [];
  const sent = [...crm.sent];
  let working = { ...formData };

  for (const item of crm.pending) {
    const withJson = Boolean(item.withJson);
    const body = buildCrmMessageBody({
      event: item.event,
      summary: item.summary,
      fileId: context.fileKey,
      applicantName: context.applicantName || '',
      applicantMobile: context.applicantMobile || '',
      formData: withJson ? working : undefined,
      withJson,
    });
    let result: SendToCrmResult;
    try {
      result = await send(item.event, item.summary, body, {
        applicantName: context.applicantName,
        applicantMobile: context.applicantMobile,
        fileId: context.fileKey,
        seq: seqFromPendingId(item.id, item.event),
        formData: withJson ? working : undefined,
        withJson,
      });
    } catch {
      result = { sent: false, reason: 'send_failed' };
    }
    if (result.sent) {
      sent.push({
        id: item.id,
        at: new Date().toISOString(),
        reference: result.reference,
        lead_id: result.lead_id,
        duplicate: result.duplicate,
      });
    } else {
      remaining.push({
        ...item,
        error_message: result.error_message || result.reason,
      });
    }
  }

  working = { ...working, '_meta.crm': { sent, pending: remaining } };
  if (context.writeFormData) {
    try {
      await context.writeFormData(working);
    } catch {
      // ignore
    }
  }
  return working;
}

export { stripSensitiveFormData };
