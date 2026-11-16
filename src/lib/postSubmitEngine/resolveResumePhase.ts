import { hasValue, readFormPath } from '../formPath';
import type { PostSubmitPhase, PostSubmitSession } from './types';

export type ResumePhase =
  | 'delivery'
  | 'signing'
  | 'stamps'
  | 'post_offer'
  | 'post_qualify'
  | 'request_do'
  | 'wizard';

const DOC_KEYS = [
  '_meta.docs.sanctionLetter',
  '_meta.docs.loanAgreement',
  '_meta.docs.ckyc',
] as const;

const HINTS: readonly ResumePhase[] = [
  'delivery',
  'signing',
  'stamps',
  'post_offer',
  'post_qualify',
  'request_do',
];

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function httpsUrl(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('https://');
}

function positiveNumber(value: unknown): boolean {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0;
}

function stampsHaveContent(formData: Record<string, unknown>): boolean {
  const hit = readFormPath(formData, '_meta.stamps');
  if (!hit.present || hit.value == null || hit.value === '') return false;
  if (typeof hit.value !== 'object' || Array.isArray(hit.value)) {
    return nonEmptyString(hit.value);
  }
  return Object.values(hit.value as Record<string, unknown>).some((value) => {
    if (value == null || value === '') return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as object).length > 0;
    return false;
  });
}

function deadlineIsComplete(formData: Record<string, unknown>): boolean {
  const hit = readFormPath(formData, '_meta.deadline');
  if (!hit.present || !hit.value || typeof hit.value !== 'object' || Array.isArray(hit.value)) {
    return false;
  }
  const deadline = hit.value as { started_at?: unknown; deadline_at?: unknown };
  return nonEmptyString(deadline.started_at) && nonEmptyString(deadline.deadline_at);
}

function hasPersistedQualifyPass(formData: Record<string, unknown>): boolean {
  const stored = readFormPath(formData, '_meta.qualifyResult');
  if (
    stored.present &&
    stored.value != null &&
    typeof stored.value === 'object' &&
    !Array.isArray(stored.value) &&
    (stored.value as { pass?: unknown }).pass === true
  ) {
    return true;
  }
  const pass = readFormPath(formData, '_meta.qualify.pass');
  return pass.present && pass.value === true;
}

function docPresence(formData: Record<string, unknown>): { all: boolean; any: boolean } {
  const hits = DOC_KEYS.map((key) => hasValue(formData, key, httpsUrl));
  return { all: hits.every(Boolean), any: hits.some(Boolean) };
}

/**
 * Most advanced persisted step wins. Blank strings, nulls, and empty objects do not count.
 * `_meta.postSubmitPhase` is only used when no real step value has been written.
 */
export function resolveResumePhase(formData: Record<string, unknown>): ResumePhase {
  const stage = readFormPath(formData, '_meta.esign.stage');
  if (stage.present && stage.value === 'signed') return 'delivery';
  if (hasValue(formData, '_meta.esign.documentId', nonEmptyString)) return 'signing';
  if (hasValue(formData, '_meta.signing.pack_url', httpsUrl)) return 'signing';
  if (hasValue(formData, '_meta.stamps.accessKey', nonEmptyString)) return 'stamps';
  if (stampsHaveContent(formData)) return 'stamps';

  const docs = docPresence(formData);
  if (docs.all) return 'stamps';
  if (docs.any) return 'post_offer';

  if (hasValue(formData, '_meta.pricing.roi_pct', positiveNumber)) return 'post_offer';
  if (hasPersistedQualifyPass(formData)) return 'post_qualify';
  if (deadlineIsComplete(formData)) return 'request_do';

  const hint = readFormPath(formData, '_meta.postSubmitPhase');
  if (hint.present) {
    const value = String(hint.value ?? '') as ResumePhase;
    if (HINTS.includes(value)) return value;
  }
  return 'wizard';
}

export function postOfferStartsAtEnach(formData: Record<string, unknown>): boolean {
  return !hasValue(formData, 'enach.accountNumber', nonEmptyString);
}

export type PostSubmitFlagKey =
  | 'flowStarted'
  | 'qualifyFired'
  | 'rankStarted'
  | 'docFillStarted'
  | 'signingsentWritten';

const FLAG_KEYS: readonly PostSubmitFlagKey[] = [
  'flowStarted',
  'qualifyFired',
  'rankStarted',
  'docFillStarted',
  'signingsentWritten',
];

export function readPostSubmitFlags(
  formData: Record<string, unknown>
): Partial<Record<PostSubmitFlagKey, boolean>> {
  const raw = formData['_meta.postSubmitFlags'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const flags: Partial<Record<PostSubmitFlagKey, boolean>> = {};
  for (const key of FLAG_KEYS) {
    if ((raw as Record<string, unknown>)[key] === true) flags[key] = true;
  }
  return flags;
}

/** Append-only. Never clears a flag that is already true. */
export function withPostSubmitFlag(
  formData: Record<string, unknown>,
  key: PostSubmitFlagKey
): Record<string, unknown> {
  const flags = readPostSubmitFlags(formData);
  if (flags[key] === true) return formData;
  return {
    ...formData,
    '_meta.postSubmitFlags': { ...flags, [key]: true },
  };
}

function httpsDoc(formData: Record<string, unknown>, path: string): boolean {
  const hit = readFormPath(formData, path);
  return typeof hit.value === 'string' && hit.value.startsWith('https://');
}

export const NTC_BANK_STATEMENT_PENDING_KEY = '_meta.ntcBankStatement.pending';

/** True while the NTC applicant still owes a bank statement. */
export function isNtcBankStatementPending(formData: Record<string, unknown>): boolean {
  const hit = readFormPath(formData, NTC_BANK_STATEMENT_PENDING_KEY);
  return hit.present && (hit.value === true || hit.value === 'true');
}

function roiGreaterThanZero(formData: Record<string, unknown>): boolean {
  const hit = readFormPath(formData, '_meta.pricing.roi_pct');
  if (!hit.present || hit.value == null || hit.value === '') return false;
  const roi = typeof hit.value === 'number' ? hit.value : Number(hit.value);
  return Number.isFinite(roi) && roi > 0;
}

function qualifyResultObject(formData: Record<string, unknown>): boolean {
  const stored = readFormPath(formData, '_meta.qualifyResult');
  return (
    stored.present &&
    stored.value != null &&
    typeof stored.value === 'object' &&
    !Array.isArray(stored.value)
  );
}

/**
 * Persisted one-shot flags. Later real steps (signed, signing, stamps) still win.
 * Rank + pricing opens the offer screen instead of jumping into eNACH.
 */
export function flaggedResumePhase(formData: Record<string, unknown>): PostSubmitPhase | null {
  const flags = readPostSubmitFlags(formData);
  const resume = resolveResumePhase(formData);
  if (resume === 'delivery' || resume === 'signing' || resume === 'stamps') return null;

  if (
    flags.docFillStarted &&
    httpsDoc(formData, '_meta.docs.sanctionLetter') &&
    httpsDoc(formData, '_meta.docs.loanAgreement') &&
    httpsDoc(formData, '_meta.docs.ckyc')
  ) {
    return 'stamp_step';
  }
  if (flags.rankStarted && roiGreaterThanZero(formData)) return 'offer';
  if (flags.qualifyFired && qualifyResultObject(formData)) {
    return hasPersistedQualifyPass(formData) ? 'offer' : 'rejected';
  }
  return null;
}

export function enginePhaseForResume(formData: Record<string, unknown>): PostSubmitPhase | null {
  const resume = resolveResumePhase(formData);
  if (
    isNtcBankStatementPending(formData) &&
    resume !== 'delivery' &&
    resume !== 'signing' &&
    resume !== 'stamps'
  ) {
    return 'ntc_upload';
  }
  const flagged = flaggedResumePhase(formData);
  if (flagged) return flagged;
  switch (resume) {
    case 'wizard':
      return null;
    case 'delivery':
      return 'done';
    case 'signing':
      return 'esign_step';
    case 'stamps':
      return 'stamp_step';
    case 'post_offer':
      return postOfferStartsAtEnach(formData) ? 'enach' : 'doc_fill';
    case 'post_qualify':
      return 'offer';
    case 'request_do':
      return 'qualify';
    default: {
      const _exhaustive: never = resume;
      return _exhaustive;
    }
  }
}

export function postSubmitPhaseHint(phase: PostSubmitPhase): ResumePhase | null {
  switch (phase) {
    case 'done':
      return 'delivery';
    case 'esign_step':
    case 'signing_sent':
      return 'signing';
    case 'stamp_step':
      return 'stamps';
    case 'enach':
    case 'doc_fill':
      return 'post_offer';
    case 'offer':
      return 'post_qualify';
    case 'resolving':
    case 'qualify':
    case 'qualify_error':
    case 'not_eligible':
    case 'rejected':
    case 'ntc_upload':
    case 'co_qualify':
    case 'write_qualified':
    case 'documents':
    case 'vkyc_gate':
    case 'lender_rank':
    case 'rank_error':
    case 'write_approval':
    case 'error':
      return null;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

/** URL stage/step may move the wizard only while the file is still in the wizard. */
export function wizardUrlMayApply(formData: Record<string, unknown>): boolean {
  return resolveResumePhase(formData) === 'wizard';
}

export function buildResumeSession(
  formData: Record<string, unknown>,
  recordId: string
): PostSubmitSession | null {
  const resumePhase = enginePhaseForResume(formData);
  if (!resumePhase) return null;
  return {
    fileId: String(formData['_meta.fileId'] || '').trim(),
    recordId,
    formData,
    resumePhase,
  };
}
