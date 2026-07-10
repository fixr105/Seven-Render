import { COMPLIANCE_ITEMS, isComplianceChecked, isComplianceItemRequested } from './b2cEvCompliance';
import { isDoRequested } from './b2cEvDoRequest';
import type { ComplianceItemId } from './b2cEvCompliance';

export interface PendingComplianceRequest {
  itemId: ComplianceItemId;
  label: string;
  requestedAt: string;
}

export interface PendingB2cAction {
  applicationId: string;
  fileId?: string;
  applicantName?: string;
  type: 'compliance' | 'do';
  itemId?: ComplianceItemId;
  label: string;
  requestedAt: string;
  queryId?: string;
}

export interface ExtractedB2cActions {
  complianceRequests: PendingComplianceRequest[];
  doRequest: { requestedAt: string; fulfilledAt?: string } | null;
  incompleteCompliance: Array<{ itemId: ComplianceItemId; label: string }>;
  pendingActions: PendingB2cAction[];
}

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function extractPendingB2cActions(
  formData: Record<string, unknown>,
  context?: { applicationId?: string; fileId?: string; applicantName?: string }
): ExtractedB2cActions {
  const complianceRequests: PendingComplianceRequest[] = [];
  const incompleteCompliance: Array<{ itemId: ComplianceItemId; label: string }> = [];

  for (const item of COMPLIANCE_ITEMS) {
    if (!isComplianceChecked(formData, item.checkboxKey)) {
      incompleteCompliance.push({ itemId: item.id, label: item.label });
    }
    if (isComplianceItemRequested(formData, item.id)) {
      complianceRequests.push({
        itemId: item.id,
        label: item.requestLabel,
        requestedAt: readString(formData[item.requestedAtKey]),
      });
    }
  }

  const doRequestedAt = readString(formData['_meta.doRequest.requestedAt']);
  const doFulfilledAt = readString(formData['_meta.doRequest.fulfilledAt']);
  const doRequest =
    doRequestedAt
      ? { requestedAt: doRequestedAt, fulfilledAt: doFulfilledAt || undefined }
      : null;

  const pendingActions: PendingB2cAction[] = [];
  const base = {
    applicationId: context?.applicationId ?? '',
    fileId: context?.fileId,
    applicantName: context?.applicantName,
  };

  for (const req of complianceRequests) {
    pendingActions.push({
      ...base,
      type: 'compliance',
      itemId: req.itemId,
      label: req.label,
      requestedAt: req.requestedAt,
    });
  }

  if (doRequest && !doRequest.fulfilledAt && isDoRequested(formData)) {
    pendingActions.push({
      ...base,
      type: 'do',
      label: 'Disbursement Order (DO)',
      requestedAt: doRequest.requestedAt,
      queryId: readString(formData['_meta.doRequest.queryId']) || undefined,
    });
  }

  return {
    complianceRequests,
    doRequest,
    incompleteCompliance,
    pendingActions,
  };
}
