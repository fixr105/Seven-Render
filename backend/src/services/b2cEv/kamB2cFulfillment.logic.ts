import { mergeFormDataPatch } from '../../utils/mergeFormDataPatch.js';

export type ComplianceItemId = 'vkyc' | 'loanAgreement' | 'enach';

const COMPLIANCE_ITEM_MAP: Record<
  ComplianceItemId,
  { checkboxKey: string; requestedAtKey: string; label: string }
> = {
  vkyc: {
    checkboxKey: 'compliance.vkycDone',
    requestedAtKey: '_meta.kamRequests.vkyc.requestedAt',
    label: 'VKYC',
  },
  loanAgreement: {
    checkboxKey: 'compliance.loanAgreementSigned',
    requestedAtKey: '_meta.kamRequests.loanAgreement.requestedAt',
    label: 'Loan agreement',
  },
  enach: {
    checkboxKey: 'compliance.enachDone',
    requestedAtKey: '_meta.kamRequests.enach.requestedAt',
    label: 'eNACH',
  },
};

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function buildCompliancePatch(
  formData: Record<string, unknown>,
  itemId: ComplianceItemId,
  action: 'fulfill' | 'unmark' | 'clear_request'
): Record<string, unknown> {
  const item = COMPLIANCE_ITEM_MAP[itemId];
  const patch: Record<string, unknown> = {};

  if (action === 'fulfill') {
    patch[item.checkboxKey] = 'true';
    patch[item.requestedAtKey] = '';
  } else if (action === 'unmark') {
    patch[item.checkboxKey] = 'false';
  } else if (action === 'clear_request') {
    patch[item.requestedAtKey] = '';
  }

  return mergeFormDataPatch(formData, patch);
}

export function buildDoFulfillPatch(
  formData: Record<string, unknown>,
  notes?: string
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    '_meta.doRequest.fulfilledAt': new Date().toISOString(),
  };
  if (notes?.trim()) {
    patch['_meta.doRequest.fulfillmentNotes'] = notes.trim();
  }
  return mergeFormDataPatch(formData, patch);
}

export function buildDoClearRequestPatch(
  formData: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    '_meta.doRequest.requestedAt': '',
    '_meta.doRequest.queryId': '',
    '_meta.doRequest.fulfilledAt': '',
    '_meta.doRequest.fulfillmentNotes': '',
  };
  return mergeFormDataPatch(formData, patch);
}

export function formatDoAuditMessage(action: 'fulfill' | 'clear_request'): string {
  if (action === 'fulfill') {
    return 'KAM marked Disbursement Order (DO) as processed';
  }
  return 'KAM rejected Disbursement Order (DO) request';
}

export function formatComplianceAuditMessage(
  itemId: ComplianceItemId,
  action: 'fulfill' | 'unmark' | 'clear_request'
): string {
  const item = COMPLIANCE_ITEM_MAP[itemId];
  if (action === 'fulfill') return `KAM marked ${item.label} as complete`;
  if (action === 'unmark') return `KAM unmarked ${item.label}`;
  return `KAM cleared ${item.label} request flag`;
}

export function hasOpenDoRequest(formData: Record<string, unknown>): boolean {
  const requestedAt = readString(formData['_meta.doRequest.requestedAt']);
  const fulfilledAt = readString(formData['_meta.doRequest.fulfilledAt']);
  return Boolean(requestedAt && !fulfilledAt);
}
