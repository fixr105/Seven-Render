import { COMPLIANCE_ITEMS, type ComplianceItemId } from './b2cEvCompliance';
import { buildDoRequestMessage } from './b2cEvDoRequest';
import { buildComplianceKamRequestMessage } from './b2cEvCompliance';

export type B2cRequestKind = 'b2c_compliance' | 'b2c_do';
export type B2cFulfillmentAction =
  | 'compliance_fulfill'
  | 'compliance_unmark'
  | 'do_fulfill'
  | 'do_clear_request';

export function getComplianceQueryIdKey(itemId: ComplianceItemId): string {
  return `_meta.kamRequests.${itemId}.queryId`;
}

export function getDoQueryIdKey(): string {
  return '_meta.doRequest.queryId';
}

export function buildB2cClientQueryActionEventType(
  requestKind?: B2cRequestKind,
  itemId?: ComplianceItemId
): string {
  if (requestKind === 'b2c_do') {
    return 'client_query_b2c_do';
  }
  if (requestKind === 'b2c_compliance' && itemId) {
    return `client_query_b2c_compliance_${itemId}`;
  }
  return 'client_query';
}

export function isB2cClientQueryActionEventType(actionEventType: string): boolean {
  const normalized = (actionEventType || '').toLowerCase().trim();
  return normalized.startsWith('client_query_b2c_') || normalized === 'client_query';
}

export function isUnresolvedB2cClientQuery(thread: {
  isResolved?: boolean;
  rootQuery?: { actionEventType?: string; targetUserRole?: string };
}): boolean {
  if (thread.isResolved) return false;
  const actionType = thread.rootQuery?.actionEventType || '';
  const target = (thread.rootQuery?.targetUserRole || '').toLowerCase().trim();
  return (
    actionType.toLowerCase().startsWith('client_query_b2c_') ||
    (actionType.toLowerCase() === 'client_query' && target === 'kam')
  );
}

export function isResolvableB2cClientQuery(rootQuery: {
  actionEventType?: string;
  targetUserRole?: string;
}): boolean {
  const actionType = (rootQuery.actionEventType || '').toLowerCase().trim();
  const target = (rootQuery.targetUserRole || '').toLowerCase().trim();
  return (
    actionType.startsWith('client_query_b2c_') ||
    (actionType === 'client_query' && target === 'kam')
  );
}

export type ParsedB2cQuery =
  | { kind: 'compliance'; itemId: ComplianceItemId; label: string }
  | { kind: 'do'; label: string }
  | { kind: 'generic'; label: string };

export function parseB2cQueryFromThread(rootQuery: {
  actionEventType?: string;
  message?: string;
}): ParsedB2cQuery | null {
  const actionType = (rootQuery.actionEventType || '').toLowerCase().trim();
  const message = rootQuery.message || '';

  if (actionType.startsWith('client_query_b2c_compliance_')) {
    const itemId = actionType.replace('client_query_b2c_compliance_', '') as ComplianceItemId;
    const item = COMPLIANCE_ITEMS.find((entry) => entry.id === itemId);
    if (item) {
      return { kind: 'compliance', itemId, label: `${item.requestLabel} request` };
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

  if (/disbursement order \(do\)/i.test(trimmed)) {
    return { kind: 'do', label: 'Disbursement Order (DO) request' };
  }

  for (const item of COMPLIANCE_ITEMS) {
    const sample = buildComplianceKamRequestMessage(item, {});
    const core = sample.replace(/\s*\(application.*\)\.?$/i, '').trim();
    if (trimmed.startsWith(core.slice(0, Math.min(core.length, 20))) || trimmed.includes(item.requestLabel)) {
      return { kind: 'compliance', itemId: item.id, label: `${item.requestLabel} request` };
    }
  }

  const doSample = buildDoRequestMessage({});
  if (trimmed.startsWith(doSample.replace(/\s*\(application.*\)\.?$/i, '').slice(0, 20))) {
    return { kind: 'do', label: 'Disbursement Order (DO) request' };
  }

  return null;
}

export function getB2cQueryThreadTitle(parsed: ParsedB2cQuery): string {
  return parsed.label;
}

export function canKamFulfillB2cQuery(userRole: string | null | undefined): boolean {
  const role = (userRole || '').toLowerCase();
  return role === 'kam' || role === 'credit_team' || role === 'admin';
}
