import { postSevenfinCrmLead } from '../../services/toolsClient';

export const SEVENFIN_LEAD_SOURCE = 'Seven Dealer EV DLA';
export const SEVENFIN_FINANCE_NEED = 'Looking for finance';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function truncate140(value: string): string {
  return String(value || '').slice(0, 140);
}

export function formatLenderFoundTimeline(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];
  const yyyy = date.getFullYear();
  return truncate140(`Lender found ${dd} ${mon} ${yyyy}`);
}

export function digits10(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function buildSevenfinCrmLeadPayload(input: {
  applicantName: string;
  applicantMobile: string;
  now?: Date;
}): Record<string, string> {
  return {
    name: truncate140(String(input.applicantName || '').trim().toUpperCase()),
    phone: digits10(input.applicantMobile),
    city: '',
    finance_need: SEVENFIN_FINANCE_NEED,
    start_timeline: formatLenderFoundTimeline(input.now || new Date()),
    investment_range: '',
    profession: '',
    lead_source: SEVENFIN_LEAD_SOURCE,
  };
}

export type SevenfinLeadSendResult =
  | {
      sent: true;
      reference?: string;
      lead_id: string;
      duplicate: boolean;
    }
  | {
      sent: false;
      reason: string;
      error_type?: string;
      error_message?: string;
      retryable: boolean;
      conflict?: boolean;
    };

function asObj(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

export async function sendSevenfinCrmLead(input: {
  applicantName: string;
  applicantMobile: string;
  now?: Date;
  postLead?: typeof postSevenfinCrmLead;
}): Promise<SevenfinLeadSendResult> {
  const post = input.postLead || postSevenfinCrmLead;
  const payload = buildSevenfinCrmLeadPayload(input);
  let status: number;
  let data: unknown;
  try {
    ({ status, data } = await post(payload));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'network_error';
    return { sent: false, reason: msg, retryable: true };
  }

  const body = asObj(data);
  if (body.ok === true) {
    return {
      sent: true,
      lead_id: String(body.lead_id || ''),
      duplicate: Boolean(body.duplicate),
      reference: String(body.lead_id || ''),
    };
  }

  const errorType = String(body.error_type || '');
  const errorMessage = String(body.error_message || body.error || 'CRM lead failed');
  if (errorType === 'VALIDATION_ERROR' || status === 400) {
    return {
      sent: false,
      reason: errorMessage,
      error_type: 'VALIDATION_ERROR',
      error_message: errorMessage,
      retryable: false,
    };
  }
  if (errorType === 'FRAPPE_CONFLICT') {
    return {
      sent: false,
      reason: errorMessage,
      error_type: 'FRAPPE_CONFLICT',
      error_message: errorMessage,
      retryable: true,
      conflict: true,
    };
  }
  return {
    sent: false,
    reason: errorMessage,
    error_type: errorType || 'FRAPPE_ERROR',
    error_message: errorMessage,
    retryable: true,
  };
}

export async function sendSevenfinCrmLeadWithRetry(input: {
  applicantName: string;
  applicantMobile: string;
  now?: Date;
  postLead?: typeof postSevenfinCrmLead;
  sleep?: (ms: number) => Promise<void>;
}): Promise<SevenfinLeadSendResult> {
  const sleep = input.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const first = await sendSevenfinCrmLead(input);
  if (first.sent) return first;
  if (!first.retryable) return first;
  if (first.conflict) {
    await sleep(2000);
    return sendSevenfinCrmLead(input);
  }
  // One generic retry for other errors / timeout
  return sendSevenfinCrmLead(input);
}
