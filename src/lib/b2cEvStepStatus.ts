import {
  COMPLIANCE_ITEMS,
  isComplianceDone,
  type ComplianceItemId,
} from './b2cEvCompliance';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function dismissedAtKey(itemId: ComplianceItemId): string {
  return `_meta.kamRequests.${itemId}.dismissedAt`;
}

export function isStepDismissed(formData: Record<string, unknown>, itemId: ComplianceItemId): boolean {
  return Boolean(readString(formData[dismissedAtKey(itemId)]));
}

function esignStage(formData: Record<string, unknown>): string {
  const esign = formData['_meta.esign'];
  if (!esign || typeof esign !== 'object' || Array.isArray(esign)) return '';
  return readString((esign as { stage?: unknown }).stage);
}

function confirmationDone(formData: Record<string, unknown>, key: string): boolean {
  const raw = formData[key];
  let record: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        record = parsed as Record<string, unknown>;
      }
    } catch {
      record = null;
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    record = raw as Record<string, unknown>;
  }
  return readString(record?.status) === 'done';
}

export function isVkycComplete(formData: Record<string, unknown>): boolean {
  if (isComplianceDone(formData, 'compliance.vkycDone')) return true;
  return readString(formData['_meta.vkyc.status']).toLowerCase() === 'done';
}

export function isEnachComplete(formData: Record<string, unknown>): boolean {
  return isComplianceDone(formData, 'compliance.enachDone');
}

export function isAgreementComplete(formData: Record<string, unknown>): boolean {
  if (isComplianceDone(formData, 'compliance.loanAgreementSigned')) return true;
  return esignStage(formData).toLowerCase() === 'signed';
}

export function isComplianceStepComplete(
  formData: Record<string, unknown>,
  itemId: ComplianceItemId
): boolean {
  if (itemId === 'vkyc') return isVkycComplete(formData);
  if (itemId === 'enach') return isEnachComplete(formData);
  return isAgreementComplete(formData);
}

export function isKamComplianceOpen(
  formData: Record<string, unknown>,
  itemId: ComplianceItemId
): boolean {
  if (isComplianceStepComplete(formData, itemId)) return false;
  if (isStepDismissed(formData, itemId)) return false;

  const item = COMPLIANCE_ITEMS.find((entry) => entry.id === itemId);
  if (item && readString(formData[item.requestedAtKey])) return true;

  if (itemId === 'vkyc') {
    const status = readString(formData['_meta.vkyc.status']).toLowerCase();
    return status === 'requested' || status === 'link sent';
  }
  if (itemId === 'enach') {
    return Boolean(readString(formData['enach.accountNumber']));
  }
  const stage = esignStage(formData).toLowerCase();
  return Boolean(stage) && stage !== 'signed';
}

export function kamComplianceStatusLabel(
  formData: Record<string, unknown>,
  itemId: ComplianceItemId
): string {
  if (itemId === 'vkyc') {
    if (isVkycComplete(formData)) return 'Done';
    const status = readString(formData['_meta.vkyc.status']);
    if (status) return status;
    if (isKamComplianceOpen(formData, itemId)) return 'Requested';
    return 'Not requested';
  }
  if (itemId === 'enach') {
    if (isEnachComplete(formData) || confirmationDone(formData, '_meta.compliance.enach')) return 'Done';
    if (readString(formData['enach.accountNumber'])) return 'Needs confirmation';
    if (isKamComplianceOpen(formData, itemId)) return 'Requested';
    return 'Not requested';
  }
  if (isAgreementComplete(formData)) {
    return esignStage(formData).toLowerCase() === 'signed' ? 'signed' : 'Done';
  }
  if (confirmationDone(formData, '_meta.compliance.loanAgreement')) return 'Done';
  const stage = esignStage(formData);
  if (stage) return stage;
  if (isKamComplianceOpen(formData, itemId)) return 'Requested';
  return 'Not requested';
}

export function kamComplianceRequestedAt(
  formData: Record<string, unknown>,
  itemId: ComplianceItemId
): string {
  const item = COMPLIANCE_ITEMS.find((entry) => entry.id === itemId);
  const stored = item ? readString(formData[item.requestedAtKey]) : '';
  if (stored) return stored;
  if (itemId === 'vkyc') return readString(formData['_meta.vkyc.requestedAt']);
  return '';
}

export function doStatusLabel(formData: Record<string, unknown>): string {
  const status = readString(formData['_meta.doRequest.status']).toLowerCase();
  if (status === 'approved' || readString(formData['_meta.doRequest.fulfilledAt'])) return 'approved';
  if (status === 'rejected' || readString(formData['_meta.doRequest.rejectedAt'])) return 'rejected';
  if (readString(formData['_meta.doRequest.requestedAt'])) return 'Requested';
  return 'Not requested';
}
