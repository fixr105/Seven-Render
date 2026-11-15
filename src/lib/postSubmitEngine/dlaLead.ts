import { postDlaLead } from '../../services/toolsClient';
import type { CrmMeta, CrmSentEntry } from '../crmEvents';
import { digits10 } from '../crm/sevenfinCrmLead';

export const DLA_NAME = 'Seven Dealer EV';

function asCrmMeta(formData: Record<string, unknown>): CrmMeta {
  const raw = formData['_meta.crm'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      sent: Array.isArray(obj.sent) ? (obj.sent as CrmSentEntry[]) : [],
      pending: Array.isArray(obj.pending) ? (obj.pending as never[]) : [],
    };
  }
  return { sent: [], pending: [] };
}

export function dlaLeadEventId(fileId: string, ordered: boolean): string {
  return ordered ? `${fileId}-STAMP_ORDERED` : `${fileId}-STAMP_STEP`;
}

export async function fireDlaLead(input: {
  fileId: string;
  formData: Record<string, unknown>;
  applicantName: string;
  applicantMobile: string;
  stampOrdered: boolean;
  writeFormData?: (next: Record<string, unknown>) => Promise<void> | void;
  post?: typeof postDlaLead;
  sleep?: (ms: number) => Promise<void>;
}): Promise<Record<string, unknown>> {
  const id = dlaLeadEventId(input.fileId, input.stampOrdered);
  const crm = asCrmMeta(input.formData);
  if (crm.sent.some((e) => e.id === id)) return input.formData;

  const post = input.post || postDlaLead;
  const payload = {
    applicant_name: String(input.applicantName || '').trim(),
    phone: digits10(input.applicantMobile),
    dla_name: DLA_NAME,
    stamp_ordered: input.stampOrdered,
  };

  const tryOnce = async () => post(payload);
  let status = 0;
  let data: unknown = null;
  try {
    ({ status, data } = await tryOnce());
  } catch {
    return input.formData;
  }

  const body =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  if (status === 400 || body.error_type === 'VALIDATION_ERROR') {
    return input.formData;
  }

  if (status === 502 || body.error_type === 'UPSTREAM_ERROR') {
    const sleep = input.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    await sleep(500);
    try {
      ({ status, data } = await tryOnce());
    } catch {
      return input.formData;
    }
  }

  const retryBody =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  if (retryBody.ok !== true && status !== 201) {
    return input.formData;
  }

  const entry: CrmSentEntry = {
    id,
    at: new Date().toISOString(),
    reference: String(retryBody.request_id || ''),
    lead_id: retryBody.lead_id == null ? undefined : String(retryBody.lead_id),
  };
  const nextCrm: CrmMeta = {
    sent: [...crm.sent, entry],
    pending: crm.pending,
  };
  const next = {
    ...input.formData,
    '_meta.crm': nextCrm,
    '_meta.dla_lead': {
      ...(typeof input.formData['_meta.dla_lead'] === 'object' &&
      input.formData['_meta.dla_lead'] &&
      !Array.isArray(input.formData['_meta.dla_lead'])
        ? (input.formData['_meta.dla_lead'] as Record<string, unknown>)
        : {}),
      [input.stampOrdered ? 'ordered' : 'step']: {
        request_id: retryBody.request_id ?? null,
        lead_id: retryBody.lead_id ?? null,
      },
    },
  };
  if (input.writeFormData) {
    try {
      await input.writeFormData(next);
    } catch {
      // ignore
    }
  }
  return next;
}
