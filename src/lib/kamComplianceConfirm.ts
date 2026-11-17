import { isVkycComplete } from './b2cEvStepStatus';
import { stampBootMode } from './postSubmitEngine/stampFlow';

export type KamComplianceConfirmId = 'ekyc' | 'loanAgreement' | 'enach';

export const KAM_COMPLIANCE_CONFIRM_KEYS: Record<KamComplianceConfirmId, string> = {
  ekyc: '_meta.compliance.ekyc',
  loanAgreement: '_meta.compliance.loanAgreement',
  enach: '_meta.compliance.enach',
};

export const KAM_COMPLIANCE_CONFIRM_IDS: KamComplianceConfirmId[] = [
  'ekyc',
  'loanAgreement',
  'enach',
];

export type KamComplianceConfirmation = {
  status: 'done';
  confirmedBy: string;
  confirmedAt: string;
};

const DOC_KEYS = [
  '_meta.docs.sanctionLetter',
  '_meta.docs.loanAgreement',
  '_meta.docs.ckyc',
] as const;

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readStoredRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

function httpsUrl(value: unknown): boolean {
  return typeof value === 'string' && value.trim().startsWith('https://');
}

export function readKamComplianceConfirmation(
  formData: Record<string, unknown>,
  id: KamComplianceConfirmId
): KamComplianceConfirmation | null {
  const record = readStoredRecord(formData[KAM_COMPLIANCE_CONFIRM_KEYS[id]]);
  if (!record || readString(record.status) !== 'done') return null;
  return {
    status: 'done',
    confirmedBy: readString(record.confirmedBy),
    confirmedAt: readString(record.confirmedAt),
  };
}

export function isKamComplianceConfirmationDone(
  formData: Record<string, unknown>,
  id: KamComplianceConfirmId
): boolean {
  return readKamComplianceConfirmation(formData, id) != null;
}

export function applyKamComplianceConfirmation(
  formData: Record<string, unknown>,
  id: KamComplianceConfirmId,
  input: { confirmedBy: string; confirmedAt: string }
): { formData: Record<string, unknown>; wrote: boolean } {
  if (isKamComplianceConfirmationDone(formData, id)) {
    return { formData, wrote: false };
  }
  const confirmation: KamComplianceConfirmation = {
    status: 'done',
    confirmedBy: input.confirmedBy,
    confirmedAt: input.confirmedAt,
  };
  return {
    wrote: true,
    formData: {
      ...formData,
      [KAM_COMPLIANCE_CONFIRM_KEYS[id]]: confirmation,
    },
  };
}

export function kamComplianceConfirmMessage(id: KamComplianceConfirmId, applicantName: string): string {
  const name = applicantName.trim() || 'the applicant';
  switch (id) {
    case 'ekyc':
      return `Confirm eKYC is complete for ${name} on Fintree?`;
    case 'loanAgreement':
      return `Confirm the loan agreement is ready for ${name}? This will start stamp ordering and e-signing.`;
    case 'enach':
      return `Confirm eNACH mandate is registered for ${name}?`;
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
}

export function kamComplianceActionLabel(id: KamComplianceConfirmId): string {
  switch (id) {
    case 'ekyc':
      return 'Mark eKYC Done';
    case 'loanAgreement':
      return 'Mark Loan Agreement Done';
    case 'enach':
      return 'Mark eNACH Done';
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
}

export function kamComplianceDoneLabel(id: KamComplianceConfirmId): string {
  switch (id) {
    case 'ekyc':
      return 'eKYC Done ✓';
    case 'loanAgreement':
      return 'Loan Agreement Done ✓';
    case 'enach':
      return 'eNACH Done ✓';
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
}

export function kamComplianceRowLabel(id: KamComplianceConfirmId): string {
  switch (id) {
    case 'ekyc':
      return 'eKYC';
    case 'loanAgreement':
      return 'Loan Agreement';
    case 'enach':
      return 'eNACH';
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
}

export function loanDocsReady(formData: Record<string, unknown>): boolean {
  return DOC_KEYS.every((key) => httpsUrl(formData[key]));
}

/** True when validate/quote still has to run and a filled document URL is missing. */
export function shouldFillLoanDocs(formData: Record<string, unknown>): boolean {
  if (stampBootMode(formData) !== 'checks') return false;
  return !loanDocsReady(formData);
}

function readObject(formData: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(formData[key]) || {};
}

function stampOrdersReadyCount(formData: Record<string, unknown>): number {
  const stamps = readObject(formData, '_meta.stamps');
  const orders = Array.isArray(stamps.orders) ? stamps.orders : [];
  return orders.filter((order) => {
    const row = asRecord(order);
    if (!row) return false;
    if (row.canDownload === true) return true;
    const stage = readString(row.stage).toLowerCase();
    return stage === 'completed' || stage === 'downloadable' || stage === 'ready' || stage === 'success';
  }).length;
}

export function kamStampProgressLabel(formData: Record<string, unknown>): string | null {
  if (stampBootMode(formData) === 'pack') return 'Signing pack built';
  if (stampOrdersReadyCount(formData) >= 3 || readObject(formData, '_meta.stamps').allCompleted === true) {
    return '3 of 3 stamps ready';
  }
  if (readString(readObject(formData, '_meta.stamps').accessKey)) return 'Ordering stamp papers…';
  return null;
}

export function kamSigningProgressLabel(formData: Record<string, unknown>): string | null {
  const esign = readObject(formData, '_meta.esign');
  const stage = readString(esign.stage).toLowerCase();
  if (stage === 'signed' || httpsUrl(esign.signed_url)) return 'Both signed ✓';
  const signatories = Array.isArray(esign.signatories) ? esign.signatories : [];
  const signedCount = signatories.filter((row) => {
    const record = asRecord(row);
    return readString(record?.status).toLowerCase() === 'signed';
  }).length;
  if (signedCount >= 2) return 'Both signed ✓';
  if (signedCount === 1 || stage === 'applicant_signed' || stage === 'partial') return 'Applicant signed';
  if (readString(esign.documentId)) return 'Sent for signing';
  return null;
}

export function loanAgreementDoneSuffix(formData: Record<string, unknown>): string {
  if (kamSigningProgressLabel(formData) === 'Both signed ✓') return '';
  if (stampBootMode(formData) !== 'checks' || kamSigningProgressLabel(formData)) {
    return '— Stamps & signing in progress';
  }
  return '— Stamps & signing started';
}

export function isComplianceChecklistComplete(formData: Record<string, unknown>): boolean {
  return (
    isVkycComplete(formData) &&
    KAM_COMPLIANCE_CONFIRM_IDS.every((id) => isKamComplianceConfirmationDone(formData, id))
  );
}

export function canConfirmKamCompliance(userRole: string | null | undefined): boolean {
  return userRole === 'kam' || userRole === 'admin';
}

export function stampFlowAlreadyStarted(formData: Record<string, unknown>): boolean {
  if (stampBootMode(formData) !== 'checks') return true;
  return Boolean(readString(readObject(formData, '_meta.esign').documentId));
}
