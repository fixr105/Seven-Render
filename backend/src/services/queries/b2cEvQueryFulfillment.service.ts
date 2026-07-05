/**
 * B2C EV client→KAM query typing, reply routing, and form_data fulfillment patches.
 */

export type ComplianceItemId = 'vkyc' | 'loanAgreement' | 'enach';
export type B2cRequestKind = 'b2c_compliance' | 'b2c_do';
export type B2cFulfillmentAction = 'compliance_fulfill' | 'compliance_unmark' | 'do_fulfill';

const COMPLIANCE_ITEM_IDS: ComplianceItemId[] = ['vkyc', 'loanAgreement', 'enach'];

const COMPLIANCE_CONFIG: Record<
  ComplianceItemId,
  { checkboxKey: string; requestedAtKey: string; queryIdKey: string; label: string }
> = {
  vkyc: {
    checkboxKey: 'compliance.vkycDone',
    requestedAtKey: '_meta.kamRequests.vkyc.requestedAt',
    queryIdKey: '_meta.kamRequests.vkyc.queryId',
    label: 'VKYC',
  },
  loanAgreement: {
    checkboxKey: 'compliance.loanAgreementSigned',
    requestedAtKey: '_meta.kamRequests.loanAgreement.requestedAt',
    queryIdKey: '_meta.kamRequests.loanAgreement.queryId',
    label: 'Loan agreement signing',
  },
  enach: {
    checkboxKey: 'compliance.enachDone',
    requestedAtKey: '_meta.kamRequests.enach.requestedAt',
    queryIdKey: '_meta.kamRequests.enach.queryId',
    label: 'eNACH setup',
  },
};

export function buildB2cClientQueryActionEventType(
  requestKind?: string,
  itemId?: string
): string {
  if (requestKind === 'b2c_do') {
    return 'client_query_b2c_do';
  }
  if (requestKind === 'b2c_compliance' && itemId && isComplianceItemId(itemId)) {
    return `client_query_b2c_compliance_${itemId}`;
  }
  return 'client_query';
}

export function isComplianceItemId(value: string): value is ComplianceItemId {
  return COMPLIANCE_ITEM_IDS.includes(value as ComplianceItemId);
}

export function isB2cClientQueryActionEventType(actionEventType: string): boolean {
  const normalized = (actionEventType || '').toLowerCase().trim();
  return (
    normalized.startsWith('client_query_b2c_') ||
    normalized === 'client_query'
  );
}

export function isResolvableB2cClientQuery(
  actionEventType: string,
  targetUserRole: string
): boolean {
  const normalized = (actionEventType || '').toLowerCase().trim();
  const target = (targetUserRole || '').toLowerCase().trim();
  return normalized.startsWith('client_query_b2c_') || (normalized === 'client_query' && target === 'kam');
}

export type ParsedB2cQuery =
  | { kind: 'compliance'; itemId: ComplianceItemId; label: string }
  | { kind: 'do'; label: string }
  | { kind: 'generic'; label: string };

export function parseB2cQueryFromAuditEntry(entry: {
  actionEventType?: string;
  message?: string;
}): ParsedB2cQuery | null {
  const actionType = (entry.actionEventType || '').toLowerCase().trim();
  const message = entry.message || '';

  if (actionType.startsWith('client_query_b2c_compliance_')) {
    const itemId = actionType.replace('client_query_b2c_compliance_', '') as ComplianceItemId;
    if (isComplianceItemId(itemId)) {
      return { kind: 'compliance', itemId, label: `${COMPLIANCE_CONFIG[itemId].label} request` };
    }
  }
  if (actionType === 'client_query_b2c_do') {
    return { kind: 'do', label: 'Disbursement Order (DO) request' };
  }

  if (actionType === 'client_query' || actionType.startsWith('client_query_b2c_')) {
    const fromMessage = inferB2cQueryFromMessage(message);
    if (fromMessage) return fromMessage;
    return { kind: 'generic', label: 'Client request' };
  }

  return null;
}

function inferB2cQueryFromMessage(message: string): ParsedB2cQuery | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (/disbursement order \(do\)/i.test(trimmed) || /process disbursement order/i.test(trimmed)) {
    return { kind: 'do', label: 'Disbursement Order (DO) request' };
  }

  for (const itemId of COMPLIANCE_ITEM_IDS) {
    const config = COMPLIANCE_CONFIG[itemId];
    const pattern = new RegExp(`please complete ${config.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (pattern.test(trimmed)) {
      return { kind: 'compliance', itemId, label: `${config.label} request` };
    }
  }

  if (/please complete (vkyc|loan agreement|enach|eNACH)/i.test(trimmed)) {
    if (/vkyc/i.test(trimmed)) {
      return { kind: 'compliance', itemId: 'vkyc', label: 'VKYC request' };
    }
    if (/loan agreement/i.test(trimmed)) {
      return { kind: 'compliance', itemId: 'loanAgreement', label: 'Loan agreement signing request' };
    }
    if (/enach/i.test(trimmed)) {
      return { kind: 'compliance', itemId: 'enach', label: 'eNACH setup request' };
    }
  }

  return null;
}

export function getQueryReplyTarget(
  rootQuery: {
    actionEventType?: string;
    targetUserRole?: string;
    actor?: string;
  },
  replierRole: string
): string {
  const targetRole = (rootQuery.targetUserRole || '').toLowerCase().trim();
  const actionType = (rootQuery.actionEventType || '').toLowerCase().trim();
  const role = replierRole.toLowerCase().trim();

  if (role === 'client') {
    return targetRole === 'client' ? 'kam' : (rootQuery.targetUserRole || 'kam');
  }

  if (role === 'kam') {
    if (targetRole === 'client') {
      return 'client';
    }
    if (actionType === 'credit_query' || (rootQuery.actor || '').toLowerCase().includes('credit')) {
      return 'credit_team';
    }
    if (
      actionType.startsWith('client_query_b2c_') ||
      actionType === 'client_query'
    ) {
      return 'client';
    }
    if (targetRole === 'kam') {
      return 'client';
    }
    return 'credit_team';
  }

  if (targetRole === 'client') {
    return 'client';
  }
  return rootQuery.targetUserRole || 'kam';
}

export function buildB2cFulfillmentPatch(
  action: B2cFulfillmentAction,
  itemId?: ComplianceItemId
): Record<string, unknown> {
  const now = new Date().toISOString();

  if (action === 'do_fulfill') {
    return { '_meta.doRequest.fulfilledAt': now };
  }

  if (!itemId || !isComplianceItemId(itemId)) {
    throw new Error('itemId is required for compliance fulfillment actions');
  }

  const config = COMPLIANCE_CONFIG[itemId];

  if (action === 'compliance_fulfill') {
    return { [config.checkboxKey]: 'true' };
  }

  if (action === 'compliance_unmark') {
    return { [config.checkboxKey]: 'false' };
  }

  const _exhaustive: never = action;
  throw new Error(`Unsupported fulfillment action: ${_exhaustive}`);
}

export function buildB2cFulfillmentReplyMessage(
  action: B2cFulfillmentAction,
  itemId?: ComplianceItemId
): string {
  if (action === 'do_fulfill') {
    return 'Disbursement Order (DO) marked as processed by KAM.';
  }
  if (!itemId || !isComplianceItemId(itemId)) {
    throw new Error('itemId is required for compliance fulfillment actions');
  }
  const label = COMPLIANCE_CONFIG[itemId].label;
  if (action === 'compliance_fulfill') {
    return `${label} marked complete by KAM.`;
  }
  if (action === 'compliance_unmark') {
    return `${label} unmarked by KAM.`;
  }
  const _exhaustive: never = action;
  throw new Error(`Unsupported fulfillment action: ${_exhaustive}`);
}

export function getComplianceQueryIdKey(itemId: ComplianceItemId): string {
  return COMPLIANCE_CONFIG[itemId].queryIdKey;
}

export function getDoQueryIdKey(): string {
  return '_meta.doRequest.queryId';
}

export function canPerformB2cFulfillment(role: string): boolean {
  const normalized = role.toLowerCase().trim();
  return normalized === 'kam' || normalized === 'credit_team' || normalized === 'admin';
}

export function isB2cFulfillmentAction(value: string): value is B2cFulfillmentAction {
  return value === 'compliance_fulfill' || value === 'compliance_unmark' || value === 'do_fulfill';
}
