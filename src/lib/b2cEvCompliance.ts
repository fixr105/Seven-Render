export type ComplianceItemId = 'vkyc' | 'loanAgreement' | 'enach';

export interface ComplianceItem {
  id: ComplianceItemId;
  label: string;
  checkboxKey: string;
  requestedAtKey: string;
  queryIdKey: string;
  requestLabel: string;
}

export const COMPLIANCE_ITEMS: ComplianceItem[] = [
  {
    id: 'vkyc',
    label: 'VKYC done',
    checkboxKey: 'compliance.vkycDone',
    requestedAtKey: '_meta.kamRequests.vkyc.requestedAt',
    queryIdKey: '_meta.kamRequests.vkyc.queryId',
    requestLabel: 'VKYC',
  },
  {
    id: 'loanAgreement',
    label: 'Loan agreement signed',
    checkboxKey: 'compliance.loanAgreementSigned',
    requestedAtKey: '_meta.kamRequests.loanAgreement.requestedAt',
    queryIdKey: '_meta.kamRequests.loanAgreement.queryId',
    requestLabel: 'loan agreement signing',
  },
  {
    id: 'enach',
    label: 'eNACH done',
    checkboxKey: 'compliance.enachDone',
    requestedAtKey: '_meta.kamRequests.enach.requestedAt',
    queryIdKey: '_meta.kamRequests.enach.queryId',
    requestLabel: 'eNACH setup',
  },
];

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function isComplianceChecked(formData: Record<string, unknown>, checkboxKey: string): boolean {
  const value = formData[checkboxKey];
  return value === true || value === 'true';
}

export function isComplianceItemRequested(
  formData: Record<string, unknown>,
  itemId: ComplianceItemId
): boolean {
  const item = COMPLIANCE_ITEMS.find((entry) => entry.id === itemId);
  if (!item) return false;
  return Boolean(readString(formData[item.requestedAtKey]));
}

export function buildComplianceKamRequestMessage(
  item: ComplianceItem,
  context: { applicantName?: string; applicationId?: string }
): string {
  const applicant = context.applicantName?.trim() || 'the borrower';
  const applicationRef = context.applicationId ? ` (application ${context.applicationId})` : '';
  return `Please complete ${item.requestLabel} for ${applicant}${applicationRef}.`;
}

export function areAllComplianceItemsApproved(formData: Record<string, unknown>): boolean {
  return COMPLIANCE_ITEMS.every((item) => isComplianceChecked(formData, item.checkboxKey));
}

export function getApprovedComplianceCount(formData: Record<string, unknown>): number {
  return COMPLIANCE_ITEMS.filter((item) => isComplianceChecked(formData, item.checkboxKey)).length;
}

export function getPendingComplianceLabels(formData: Record<string, unknown>): string[] {
  return COMPLIANCE_ITEMS.filter((item) => !isComplianceChecked(formData, item.checkboxKey)).map(
    (item) => item.label
  );
}

export function validateComplianceForSubmit(
  formData: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const item of COMPLIANCE_ITEMS) {
    if (!isComplianceChecked(formData, item.checkboxKey)) {
      errors[item.checkboxKey] = `${item.label} must be confirmed before submitting`;
    }
  }
  return errors;
}
