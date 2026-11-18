import type { QualifyResponse } from '../services/engineClient';
import { isOnlyNtcBankStatementRequired } from './postSubmitEngine/ntcBankStatementGate';
import { normalizeQualifyPayload } from './postSubmitEngine/qualifyResult';

/** Plain-English map for qualify kill / rejection codes. */
export const QUALIFY_KILL_CODE_MESSAGES: Record<string, string> = {
  CC_OVERDUE_GT_5000: 'Credit card overdue amount exceeds limit',
  DPD_FOUND_IN_LAST_3M: 'Recent payment delays found in last 3 months',
  DPD_FOUND_IN_LAST_6M: 'Payment delays found in last 6 months',
  DPD_FOUND_IN_LAST_6_MONTHS: 'Payment delays found in last 6 months',
  OVERDUE_FOUND_IN_LAST_12M: 'Overdue payments found in last 12 months',
  OVERDUE_FOUND_IN_LAST_12_MONTHS: 'Overdue payments found in last 12 months',
  CIBIL_BELOW_680: 'Does not meet current lending criteria',
  CIBIL_BELOW_650: 'Does not meet current lending criteria',
  NTC_BANK_STATEMENT_REQUIRED: 'New to credit — bank statement required',
  WRITTEN_OFF_LAST_3Y: 'Written-off accounts found in last 3 years',
  LOAN_AMOUNT_BELOW_50K: 'Requested loan amount is below the minimum',
  LOAN_AMOUNT_BELOW_50000: 'Requested loan amount is below the minimum',
  KILLED: 'Does not meet current lending criteria',
};

export const SCORE_UNVERIFIED_MESSAGE =
  'Credit score could not be verified from bureau';

const DEFAULT_REASON = 'Does not meet current lending criteria';

/** Minimum bureau score to treat a score-only Engine null-kill as cleared. */
export const MIN_BUREAU_SCORE_FOR_RECONCILE = 680;

export type DecideSection1Options = {
  /** Score from Bureau Cache / form `_meta.panLookup.cibilScore` when available. */
  knownBureauScore?: number | null;
};

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

function readNumericScore(raw: QualifyResponse): number | null {
  const value = raw.score ?? (raw as { cibil_score?: unknown }).cibil_score;
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export function humanizeQualifyCode(code: string): string {
  const key = code.trim();
  if (!key) return DEFAULT_REASON;
  return QUALIFY_KILL_CODE_MESSAGES[key] || DEFAULT_REASON;
}

function reasonFromFailedItem(item: unknown, rawScore: number | null): string {
  const code = readRejectionCode(item);
  if (code) return humanizeQualifyCode(code);
  const param = readParameter(item).toLowerCase();
  if (isScoreParameter(param)) {
    if (rawScore == null) return SCORE_UNVERIFIED_MESSAGE;
    if (rawScore < MIN_BUREAU_SCORE_FOR_RECONCILE) {
      return QUALIFY_KILL_CODE_MESSAGES.CIBIL_BELOW_680;
    }
    return SCORE_UNVERIFIED_MESSAGE;
  }
  if (param === 'requested_amount') {
    return QUALIFY_KILL_CODE_MESSAGES.LOAN_AMOUNT_BELOW_50K;
  }
  return DEFAULT_REASON;
}

const BELOW_MINIMUM_MESSAGE = QUALIFY_KILL_CODE_MESSAGES.CIBIL_BELOW_680;

function failedHasExplicitCibilBelow(failed: unknown[]): boolean {
  return failed.some((item) => {
    const code = readRejectionCode(item);
    return code === 'CIBIL_BELOW_680' || code === 'CIBIL_BELOW_650';
  });
}

/**
 * Never tell the dealer both "score could not be verified" and "score below
 * minimum" — those contradict each other. Prefer the Engine's explicit
 * CIBIL_BELOW_* when present; otherwise keep the unverified line.
 */
export function reconcileScoreReasonMessages(
  reasons: string[],
  options?: { preferBelowMinimum?: boolean }
): string[] {
  const hasUnverified = reasons.includes(SCORE_UNVERIFIED_MESSAGE);
  const hasBelow = reasons.includes(BELOW_MINIMUM_MESSAGE);
  if (!hasUnverified || !hasBelow) return reasons;

  const drop = options?.preferBelowMinimum
    ? SCORE_UNVERIFIED_MESSAGE
    : BELOW_MINIMUM_MESSAGE;
  return reasons.filter((r) => r !== drop);
}

/** Unique plain-English reasons from kill_code + failed[]. */
export function collectHumanQualifyReasons(payload: unknown): string[] {
  const raw = normalizeQualifyPayload(payload) as QualifyResponse;
  const reasons: string[] = [];
  const seen = new Set<string>();
  const rawScore = readNumericScore(raw);
  const failed = Array.isArray(raw.failed) ? raw.failed : [];

  const push = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    reasons.push(trimmed);
  };

  for (const item of failed) {
    push(reasonFromFailedItem(item, rawScore));
  }

  if (typeof raw.kill_code === 'string' && raw.kill_code.trim()) {
    const code = raw.kill_code.trim();
    // Do not stack generic KILLED when failed[] already produced reasons.
    if (!(code === 'KILLED' && reasons.length > 0)) {
      push(humanizeQualifyCode(code));
    }
  }

  if (reasons.length === 0) {
    push(DEFAULT_REASON);
  }

  // Explicit CIBIL_BELOW_* (or a known numeric score under the floor) means
  // Engine evaluated a score — do not also say it could not be verified.
  const preferBelow =
    failedHasExplicitCibilBelow(failed) ||
    (rawScore != null && rawScore < MIN_BUREAU_SCORE_FOR_RECONCILE);
  return reconcileScoreReasonMessages(reasons, { preferBelowMinimum: preferBelow });
}

/**
 * Engine score-normalization gap: pass false, only bare `parameter: "score"`
 * fails (no rejection_code), and no numeric score on the payload.
 */
export function isScoreOnlyNullKill(payload: unknown): boolean {
  const raw = normalizeQualifyPayload(payload) as QualifyResponse;
  if (raw.pass === true) return false;
  if (readNumericScore(raw) != null) return false;

  const failed = Array.isArray(raw.failed) ? raw.failed : [];
  if (failed.length === 0) return false;

  return failed.every((item) => {
    if (readRejectionCode(item)) return false;
    return isScoreParameter(readParameter(item));
  });
}

export type Section1LenderOutcome =
  | { kind: 'found'; raw: QualifyResponse }
  | { kind: 'ntc'; raw: QualifyResponse; reasons: string[] }
  | { kind: 'soft_block'; raw: QualifyResponse; reasons: string[] }
  | { kind: 'hard_reject'; raw: QualifyResponse; reasons: string[]; preview: string[]; overflow: string[] };

/**
 * Section-1 lender find decision from a fresh /engine/qualify response.
 * - pass === true → found
 * - score-only null kill + knownBureauScore ≥ 680 (or unknown) → found
 * - score-only null kill + knownBureauScore < 680 → soft_block
 * - NTC, including a score-floor row → ntc (soft continue)
 * - failed criteria ≤ 2 → soft_block
 * - failed criteria > 2 → hard_reject
 */
export function decideSection1LenderOutcome(
  payload: unknown,
  options?: DecideSection1Options
): Section1LenderOutcome {
  const raw = normalizeQualifyPayload(payload) as QualifyResponse;
  if (raw.pass === true) {
    return { kind: 'found', raw };
  }

  if (isScoreOnlyNullKill(raw)) {
    const known = options?.knownBureauScore;
    if (
      known != null &&
      Number.isFinite(known) &&
      known < MIN_BUREAU_SCORE_FOR_RECONCILE
    ) {
      return {
        kind: 'soft_block',
        raw,
        reasons: [QUALIFY_KILL_CODE_MESSAGES.CIBIL_BELOW_680],
      };
    }
    // known ≥ 680 or score unknown — Engine did not prove sub-threshold.
    return { kind: 'found', raw };
  }

  if (isOnlyNtcBankStatementRequired(raw)) {
    return {
      kind: 'ntc',
      raw,
      reasons: [QUALIFY_KILL_CODE_MESSAGES.NTC_BANK_STATEMENT_REQUIRED],
    };
  }

  const failed = Array.isArray(raw.failed) ? raw.failed : [];
  const reasons = collectHumanQualifyReasons(raw);

  const criteriaCount = failed.length > 0 ? failed.length : reasons.length;
  if (criteriaCount <= 2) {
    return { kind: 'soft_block', raw, reasons };
  }

  const preview = reasons.slice(0, 2);
  const overflow = reasons.slice(2);
  return { kind: 'hard_reject', raw, reasons, preview, overflow };
}
