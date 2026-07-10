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
  options?: { notes?: string; fulfilledBy?: string }
): Record<string, unknown> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    '_meta.doRequest.fulfilledAt': now,
    '_meta.doRequest.fulfilledBy': options?.fulfilledBy?.trim() ?? '',
    '_meta.doRequest.status': 'approved',
    '_meta.doRequest.rejectionReason': '',
    '_meta.doRequest.rejectedAt': '',
    '_meta.doRequest.rejectedBy': '',
  };
  if (options?.notes?.trim()) {
    patch['_meta.doRequest.fulfillmentNotes'] = options.notes.trim();
  }
  return mergeFormDataPatch(formData, patch);
}

export function buildDoClearRequestPatch(
  formData: Record<string, unknown>,
  options?: { rejectionReason?: string; rejectedBy?: string }
): Record<string, unknown> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    '_meta.doRequest.requestedAt': '',
    '_meta.doRequest.queryId': '',
    '_meta.doRequest.fulfilledAt': '',
    '_meta.doRequest.fulfilledBy': '',
    '_meta.doRequest.fulfillmentNotes': '',
    '_meta.doRequest.status': 'rejected',
    '_meta.doRequest.rejectionReason': options?.rejectionReason?.trim() ?? '',
    '_meta.doRequest.rejectedAt': now,
    '_meta.doRequest.rejectedBy': options?.rejectedBy?.trim() ?? '',
  };
  return mergeFormDataPatch(formData, patch);
}

export function formatDoAuditMessage(
  action: 'fulfill' | 'clear_request',
  rejectionReason?: string
): string {
  if (action === 'fulfill') {
    return 'KAM approved Disbursement Order (DO) request';
  }
  const reason = rejectionReason?.trim();
  return reason
    ? `KAM rejected Disbursement Order (DO) request: ${reason}`
    : 'KAM rejected Disbursement Order (DO) request';
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
