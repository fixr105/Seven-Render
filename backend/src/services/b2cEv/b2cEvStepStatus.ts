type ComplianceItemId = 'vkyc' | 'loanAgreement' | 'enach';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function isChecked(formData: Record<string, unknown>, key: string): boolean {
  const value = formData[key];
  return value === true || value === 'true';
}

function esignStage(formData: Record<string, unknown>): string {
  const esign = formData['_meta.esign'];
  if (!esign || typeof esign !== 'object' || Array.isArray(esign)) return '';
  return readString((esign as { stage?: unknown }).stage);
}

function dismissed(formData: Record<string, unknown>, itemId: ComplianceItemId): boolean {
  return Boolean(readString(formData[`_meta.kamRequests.${itemId}.dismissedAt`]));
}

export function isVkycComplete(formData: Record<string, unknown>): boolean {
  if (isChecked(formData, 'compliance.vkycDone')) return true;
  return readString(formData['_meta.vkyc.status']).toLowerCase() === 'done';
}

export function isEnachComplete(formData: Record<string, unknown>): boolean {
  return isChecked(formData, 'compliance.enachDone');
}

export function isAgreementComplete(formData: Record<string, unknown>): boolean {
  if (isChecked(formData, 'compliance.loanAgreementSigned')) return true;
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
  if (dismissed(formData, itemId)) return false;

  const requestedAtKey = `_meta.kamRequests.${itemId}.requestedAt`;
  if (readString(formData[requestedAtKey])) return true;

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

export function kamComplianceRequestedAt(
  formData: Record<string, unknown>,
  itemId: ComplianceItemId
): string {
  const stored = readString(formData[`_meta.kamRequests.${itemId}.requestedAt`]);
  if (stored) return stored;
  if (itemId === 'vkyc') return readString(formData['_meta.vkyc.requestedAt']);
  return '';
}
