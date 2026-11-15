import type { QualifyResponse } from '../../services/engineClient';

export type QualifyOutcome = 'pass' | 'fail';

export type InterpretedQualifyResult = {
  outcome: QualifyOutcome;
  /** Exact user-facing reason when outcome is fail; null on pass. */
  reason: string | null;
  raw: QualifyResponse;
};

const NO_CREDIT_CHECK_REASON =
  'No Experian / credit check result was returned. The application cannot proceed.';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Normalize n8n array / nested `{ data }` envelopes into a flat qualify object. */
export function normalizeQualifyPayload(payload: unknown): QualifyResponse {
  if (Array.isArray(payload)) {
    return normalizeQualifyPayload(payload[0] ?? null);
  }
  const record = asRecord(payload);
  if (!record) return {};

  const nested = asRecord(record.data);
  if (nested && ('ok' in nested || 'pass' in nested || 'bureau_ref' in nested)) {
    return nested as QualifyResponse;
  }
  return record as QualifyResponse;
}

function readBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'True') return true;
  if (value === 'false' || value === 'False') return false;
  return null;
}

function hasCreditCheckSignal(raw: QualifyResponse): boolean {
  if (raw.bureau_ref != null && String(raw.bureau_ref).trim()) return true;
  if (raw.score != null && Number.isFinite(Number(raw.score))) return true;
  if (typeof raw.kill_code === 'string' && raw.kill_code.trim()) return true;
  if (Array.isArray(raw.failed) && raw.failed.length > 0) return true;
  if (Array.isArray(raw.missing) && raw.missing.length > 0) return true;
  if (raw.is_ntc === true || raw.is_ntc === false) return true;
  return false;
}

function reasonFromFailedParams(raw: QualifyResponse): string | null {
  const failed = Array.isArray(raw.failed) ? raw.failed : [];
  const params = failed
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const param = (item as { parameter?: unknown }).parameter;
      return param != null ? String(param).trim() : '';
    })
    .filter(Boolean);
  if (params.length === 0) return null;
  return `Credit check failed (${params.join(', ')}). The application cannot proceed.`;
}

function buildFailReason(raw: QualifyResponse, fallback: string): string {
  const borrowerMessage =
    typeof raw.borrower_message === 'string' ? raw.borrower_message.trim() : '';
  if (borrowerMessage) return borrowerMessage;

  const fromFailed = reasonFromFailedParams(raw);
  if (fromFailed) return fromFailed;

  const killCode = typeof raw.kill_code === 'string' ? raw.kill_code.trim() : '';
  if (killCode) {
    return `Credit check failed (${killCode}). The application cannot proceed.`;
  }

  const errorMsg = typeof raw.error === 'string' ? raw.error.trim() : '';
  if (errorMsg) return errorMsg;

  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  if (message) return message;

  return fallback;
}

/**
 * Decide whether applicant qualify may continue.
 * Any missing Experian / credit-check signal, or pass:false, is a hard fail.
 */
export function interpretQualifyResult(payload: unknown): InterpretedQualifyResult {
  const raw = normalizeQualifyPayload(payload);
  const ok = readBool(raw.ok);
  const pass = readBool(raw.pass);

  if (ok === true && pass === true) {
    if (!hasCreditCheckSignal(raw)) {
      return {
        outcome: 'fail',
        reason: NO_CREDIT_CHECK_REASON,
        raw,
      };
    }
    return { outcome: 'pass', reason: null, raw };
  }

  if (ok === true && pass === false) {
    return {
      outcome: 'fail',
      reason: buildFailReason(
        raw,
        'Credit check did not pass. The application cannot proceed.'
      ),
      raw,
    };
  }

  if (ok === false) {
    return {
      outcome: 'fail',
      reason: buildFailReason(raw, NO_CREDIT_CHECK_REASON),
      raw,
    };
  }

  // Missing / malformed qualify payload — treat as no credit check.
  return {
    outcome: 'fail',
    reason: buildFailReason(raw, NO_CREDIT_CHECK_REASON),
    raw,
  };
}
