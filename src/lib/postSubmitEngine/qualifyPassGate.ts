import type { QualifyResponse } from '../../services/engineClient';
import {
  isScoreOnlyNullKill,
  MIN_BUREAU_SCORE_FOR_RECONCILE,
  QUALIFY_KILL_CODE_MESSAGES,
} from '../qualifyKillCodes';
import { normalizeQualifyPayload } from './qualifyResult';

/**
 * Hard gate for post-submit advance past applicant qualify.
 * ONLY `pass === true` (strict) may continue — except score-only null kills
 * reconciled via knownBureauScore (Engine score-normalization gap).
 */
export function hasStrictQualifyPass(
  result: QualifyResponse | null | undefined
): result is QualifyResponse & { pass: true } {
  if (!result || typeof result !== 'object') return false;
  return result.pass === true;
}

export type QualifyAdvanceDecision =
  | { advance: true; raw: QualifyResponse }
  | { advance: false; raw: QualifyResponse; reason: string };

export type DecideQualifyAdvanceOptions = {
  knownBureauScore?: number | null;
};

/**
 * Local stamp so post-submit `pass === true` guards accept a score-only null-kill
 * reconcile. Does not invent Engine BRE success for other fail shapes.
 */
export function stampReconciledQualifyPass(raw: QualifyResponse): QualifyResponse {
  return {
    ...raw,
    pass: true,
    score_reconciled: true,
  };
}

/**
 * Local stamp after the dealer uploaded the NTC bank statement.
 * The engine may still return NTC_BANK_STATEMENT_REQUIRED. Other failed rules stay failed.
 */
export function stampNtcStatementUploaded(raw: QualifyResponse): QualifyResponse {
  return {
    ...raw,
    pass: true,
    ntc_statement_uploaded: true,
  };
}

/**
 * Decide whether the state machine may leave the qualify step.
 * Always reads normalized payload; never hardcodes PAN outcomes.
 */
export function decideQualifyAdvance(
  payload: unknown,
  options?: DecideQualifyAdvanceOptions
): QualifyAdvanceDecision {
  const raw = normalizeQualifyPayload(payload);
  if (raw.pass === true) {
    return { advance: true, raw };
  }

  if (isScoreOnlyNullKill(raw)) {
    const known = options?.knownBureauScore;
    if (
      known != null &&
      Number.isFinite(known) &&
      known < MIN_BUREAU_SCORE_FOR_RECONCILE
    ) {
      return {
        advance: false,
        raw,
        reason: QUALIFY_KILL_CODE_MESSAGES.CIBIL_BELOW_680,
      };
    }
    // known ≥ 680 or unknown — allow continue (Engine did not prove sub-threshold).
    return { advance: true, raw: stampReconciledQualifyPass(raw) };
  }

  const reason =
    (typeof raw.borrower_message === 'string' && raw.borrower_message.trim()) ||
    (typeof raw.kill_code === 'string' && raw.kill_code.trim()
      ? `Credit check failed (${raw.kill_code.trim()}). The application cannot proceed.`
      : null) ||
    (typeof raw.message === 'string' && raw.message.trim()) ||
    'Credit check did not pass. The application cannot proceed.';
  return { advance: false, raw, reason };
}

/** Phases that must never run unless applicant qualify pass === true. */
export const POST_QUALIFY_LOCKED_PHASES = [
  'co_qualify',
  'write_qualified',
  'documents',
  'vkyc_gate',
  'lender_rank',
  'rank_error',
  'offer',
  'write_approval',
  'enach',
  'doc_fill',
  'stamp_step',
  'esign_step',
  'signing_sent',
  'done',
] as const;

export function isPostQualifyLockedPhase(phase: string): boolean {
  return (POST_QUALIFY_LOCKED_PHASES as readonly string[]).includes(phase);
}
