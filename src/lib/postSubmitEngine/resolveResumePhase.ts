import { readFormPath } from '../formPath';
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

function hasKey(formData: Record<string, unknown>, path: string): boolean {
  return readFormPath(formData, path).present;
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
  const hits = DOC_KEYS.map((key) => hasKey(formData, key));
  return { all: hits.every(Boolean), any: hits.some(Boolean) };
}

/**
 * Most advanced persisted step wins. A present key counts even when the value is "".
 * `_meta.postSubmitPhase` is only used when no step key has been written.
 */
export function resolveResumePhase(formData: Record<string, unknown>): ResumePhase {
  const stage = readFormPath(formData, '_meta.esign.stage');
  if (stage.present && stage.value === 'signed') return 'delivery';
  if (hasKey(formData, '_meta.esign.documentId')) return 'signing';
  if (hasKey(formData, '_meta.signing.pack_url')) return 'signing';
  if (hasKey(formData, '_meta.stamps.accessKey')) return 'stamps';
  if (hasKey(formData, '_meta.stamps')) return 'stamps';

  const docs = docPresence(formData);
  if (docs.all) return 'stamps';
  if (docs.any) return 'post_offer';

  if (hasKey(formData, '_meta.pricing.roi_pct')) return 'post_offer';
  if (hasPersistedQualifyPass(formData)) return 'post_qualify';
  if (hasKey(formData, '_meta.deadline')) return 'request_do';

  const hint = readFormPath(formData, '_meta.postSubmitPhase');
  if (hint.present) {
    const value = String(hint.value ?? '') as ResumePhase;
    if (HINTS.includes(value)) return value;
  }
  return 'wizard';
}

export function postOfferStartsAtEnach(formData: Record<string, unknown>): boolean {
  const account = readFormPath(formData, 'enach.accountNumber');
  if (!account.present) return true;
  return String(account.value ?? '').trim() === '';
}

export function enginePhaseForResume(formData: Record<string, unknown>): PostSubmitPhase | null {
  const resume = resolveResumePhase(formData);
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
