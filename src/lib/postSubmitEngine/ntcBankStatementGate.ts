import type { QualifyResponse } from '../../services/engineClient';
import { normalizeQualifyPayload } from './qualifyResult';

export const NTC_BANK_STATEMENT_REQUIRED = 'NTC_BANK_STATEMENT_REQUIRED';

export type QualifyFailRoute = 'ntc_upload' | 'rejected';

function readRejectionCode(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const code = (item as { rejection_code?: unknown }).rejection_code;
  return typeof code === 'string' ? code.trim() : '';
}

/**
 * True only when failed is a non-empty list and every entry is
 * NTC_BANK_STATEMENT_REQUIRED. Empty `.every()` must not count as NTC-only.
 */
export function isOnlyNtcBankStatementRequired(
  result: QualifyResponse | Record<string, unknown> | null | undefined
): boolean {
  if (!result || typeof result !== 'object') return false;
  const failed = Array.isArray(result.failed) ? result.failed : null;
  if (!failed || failed.length === 0) return false;
  return failed.every((item) => readRejectionCode(item) === NTC_BANK_STATEMENT_REQUIRED);
}

/**
 * When qualify pass !== true, choose ntc_upload vs rejected.
 * Bank statement only helps when NTC is the sole failed rule.
 */
export function routeAfterQualifyFail(payload: unknown): QualifyFailRoute {
  const raw = normalizeQualifyPayload(payload);
  if (raw.pass === true) return 'rejected';
  if (isOnlyNtcBankStatementRequired(raw)) return 'ntc_upload';
  return 'rejected';
}

/** Plain list of all failed rejection codes (unique, non-empty). */
export function listFailedRejectionCodes(
  result: QualifyResponse | Record<string, unknown> | null | undefined
): string[] {
  if (!result || typeof result !== 'object') return [];
  const failed = Array.isArray(result.failed) ? result.failed : [];
  const codes = failed.map(readRejectionCode).filter(Boolean);
  return [...new Set(codes)];
}

export function formatAllFailedReasons(
  result: QualifyResponse | Record<string, unknown> | null | undefined
): string {
  const codes = listFailedRejectionCodes(result);
  if (codes.length > 0) return codes.join('\n');
  const msg =
    result && typeof result === 'object' && typeof result.borrower_message === 'string'
      ? result.borrower_message.trim()
      : '';
  if (msg) return msg;
  const kill =
    result && typeof result === 'object' && typeof result.kill_code === 'string'
      ? result.kill_code.trim()
      : '';
  if (kill) return kill;
  return 'Credit check did not pass. The application cannot proceed.';
}
