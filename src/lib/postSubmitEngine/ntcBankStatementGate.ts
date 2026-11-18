import type { QualifyResponse } from '../../services/engineClient';
import { normalizeQualifyPayload } from './qualifyResult';

export const NTC_BANK_STATEMENT_REQUIRED = 'NTC_BANK_STATEMENT_REQUIRED';

export type QualifyFailRoute = 'ntc_upload' | 'rejected';

const SCORE_FLOOR_CODES = new Set(['CIBIL_BELOW_680', 'CIBIL_BELOW_650']);

function readRejectionCode(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const code = (item as { rejection_code?: unknown }).rejection_code;
  return typeof code === 'string' ? code.trim() : '';
}

function readParameter(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const param = (item as { parameter?: unknown }).parameter;
  return param != null ? String(param).trim() : '';
}

function isScoreParameter(param: string): boolean {
  const key = param.toLowerCase();
  return key === 'score' || key === 'cibil' || key === 'cibil_score';
}

/** Score-floor rows that new-to-credit bureau results always include. */
function isScoreFloorFailure(item: unknown): boolean {
  const code = readRejectionCode(item);
  if (SCORE_FLOOR_CODES.has(code)) return true;
  return !code && isScoreParameter(readParameter(item));
}

/**
 * True when failed is non-empty, at least one row is NTC_BANK_STATEMENT_REQUIRED,
 * and every other row is a score-floor failure. Empty `.every()` must not count.
 * Overdue, DPD, written-off, and other non-score codes stay failed.
 */
export function isOnlyNtcBankStatementRequired(
  result: QualifyResponse | Record<string, unknown> | null | undefined
): boolean {
  if (!result || typeof result !== 'object') return false;
  const failed = Array.isArray(result.failed) ? result.failed : null;
  if (!failed || failed.length === 0) return false;

  let hasNtc = false;
  for (const item of failed) {
    if (readRejectionCode(item) === NTC_BANK_STATEMENT_REQUIRED) {
      hasNtc = true;
      continue;
    }
    if (isScoreFloorFailure(item)) continue;
    return false;
  }
  return hasNtc;
}

/**
 * When qualify pass !== true, choose ntc_upload vs rejected.
 * Bank statement helps when the only failed rows are NTC and score-floor codes.
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
