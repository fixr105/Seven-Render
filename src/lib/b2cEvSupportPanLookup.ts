import type { SupportPersonType } from '../config/forms/b2cEvFormSchema';
import { hasMeaningfulSupportPersonAutofill, type PanLookupFieldPrefix } from './b2cEvPanLookup';

export const SUPPORT_PAN_LOOKUP_TIMEOUT_SECONDS = 120;

export const SUPPORT_PAN_LOOKUP_FIELD_KEYS = [
  '_meta.supportPanLookup.mobileNumber',
  '_meta.supportPanLookup.panNumber',
  '_meta.supportPanLookup.fullName',
  '_meta.supportPanLookup.email',
] as const;

export type SupportPanLookupPhase = 'input' | 'loading' | 'profile';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function supportPersonTypeToPanTarget(
  type: SupportPersonType
): PanLookupFieldPrefix | null {
  if (type === 'co_applicant') return 'coApplicant';
  if (type === 'guarantor') return 'guarantor';
  return null;
}

export function getSupportPersonFieldPrefix(type: SupportPersonType): 'coApplicant' | 'guarantor' | null {
  if (type === 'co_applicant') return 'coApplicant';
  if (type === 'guarantor') return 'guarantor';
  return null;
}

export function buildSupportPanLookupInputHash(formData: Record<string, unknown>): string {
  const type = readString(formData['_meta.supportPersonType']);
  return [type, ...SUPPORT_PAN_LOOKUP_FIELD_KEYS.map((key) => readString(formData[key]))].join('|');
}

export function clearSupportPersonProfileFields(
  formData: Record<string, unknown>,
  prefix: 'coApplicant' | 'guarantor'
): Record<string, unknown> {
  const next = { ...formData };
  for (const key of Object.keys(next)) {
    if (key.startsWith(`${prefix}.`)) {
      delete next[key];
    }
  }
  return next;
}

export function resetSupportPanLookupMeta(formData: Record<string, unknown>): Record<string, unknown> {
  return {
    ...formData,
    '_meta.supportPanLookup.status': 'pending',
    '_meta.supportPanLookup.inputHash': '',
    '_meta.supportPanLookup.completedAt': '',
    '_meta.supportPanLookup.phase': 'input',
  };
}

export type SupportPanLookupStatus = 'pending' | 'success' | 'failed' | 'manual';

export function isSupportPanLookupSuccessful(formData: Record<string, unknown>): boolean {
  return readString(formData['_meta.supportPanLookup.status']) === 'success';
}

export function isSupportPanLookupManual(formData: Record<string, unknown>): boolean {
  return readString(formData['_meta.supportPanLookup.status']) === 'manual';
}

export function isSupportPanLookupProfileReady(formData: Record<string, unknown>): boolean {
  const status = readString(formData['_meta.supportPanLookup.status']);
  return status === 'success' || status === 'manual';
}

export function applySupportPersonManualProfilePhase(
  formData: Record<string, unknown>,
  prefix: 'coApplicant' | 'guarantor',
  inputHash: string
): Record<string, unknown> {
  const cleared = clearSupportPersonProfileFields(formData, prefix);
  return {
    ...cleared,
    '_meta.supportPanLookup.status': 'manual',
    '_meta.supportPanLookup.inputHash': inputHash,
    '_meta.supportPanLookup.completedAt': new Date().toISOString(),
    '_meta.supportPanLookup.phase': 'profile',
  };
}

export { hasMeaningfulSupportPersonAutofill };

export function getSupportPanLookupPhase(formData: Record<string, unknown>): SupportPanLookupPhase {
  const phase = readString(formData['_meta.supportPanLookup.phase']);
  if (phase === 'loading' || phase === 'profile') return phase;
  return 'input';
}

export function getSupportPanLookupPayload(formData: Record<string, unknown>): {
  mobileNumber: string;
  panNumber: string;
  fullName: string;
  borrowerEmail?: string;
  target: PanLookupFieldPrefix;
} | null {
  const type = readString(formData['_meta.supportPersonType']);
  const target = supportPersonTypeToPanTarget(type as SupportPersonType);
  if (!target) return null;

  const email = readString(formData['_meta.supportPanLookup.email']);
  return {
    mobileNumber: readString(formData['_meta.supportPanLookup.mobileNumber']),
    panNumber: readString(formData['_meta.supportPanLookup.panNumber']),
    fullName: readString(formData['_meta.supportPanLookup.fullName']),
    ...(email ? { borrowerEmail: email } : {}),
    target,
  };
}

export function shouldRefetchSupportPanLookup(formData: Record<string, unknown>): boolean {
  if (!isSupportPanLookupProfileReady(formData)) return true;

  const cachedHash = readString(formData['_meta.supportPanLookup.inputHash']);
  return buildSupportPanLookupInputHash(formData) !== cachedHash;
}
