import React, { useMemo, useState } from 'react';
import {
  COMPLIANCE_ITEMS,
  isComplianceChecked,
  isComplianceItemRequested,
  type ComplianceItemId,
} from '../../../lib/b2cEvCompliance';
import {
  getRequiredDocumentReadiness,
  type FormConfigCategory,
} from '../../../lib/b2cEvDocuments';
import { extractPendingB2cActions } from '../../../lib/b2cEvKamActions';
import { isDoFulfilled, isDoRequested } from '../../../lib/b2cEvDoRequest';
import { apiService } from '../../../services/api';
import { Button } from '../../ui/Button';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export interface B2cEvComplianceReviewProps {
  formData: Record<string, unknown>;
  formConfig?: FormConfigCategory[];
  applicationId?: string;
  userRole?: string | null;
  highlightComplianceItem?: ComplianceItemId;
  onUpdated?: () => void;
}

export const B2cEvComplianceReview: React.FC<B2cEvComplianceReviewProps> = ({
  formData,
  formConfig = [],
  applicationId,
  userRole,
  highlightComplianceItem,
  onUpdated,
}) => {
  const { doRequest } = extractPendingB2cActions(formData);
  const documentReadiness = getRequiredDocumentReadiness(formData, formConfig);
  const doRequested = isDoRequested(formData);
  const doFulfilled = isDoFulfilled(formData);
  const canManageCompliance = userRole === 'kam' && Boolean(applicationId);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const runDoAction = async (action: 'fulfill' | 'clear_request') => {
    if (!applicationId) return;
    setLoadingAction(action);
    try {
      const response = await apiService.kamB2cDoRequestAction(applicationId, { action });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update DO request');
      }
      onUpdated?.();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update DO request');
    } finally {
      setLoadingAction(null);
    }
  };

  const highlightedItemId = useMemo(() => {
    if (highlightComplianceItem) return highlightComplianceItem;
    const pending = COMPLIANCE_ITEMS.find(
      (item) => isComplianceItemRequested(formData, item.id) && !isComplianceChecked(formData, item.checkboxKey)
    );
    return pending?.id;
  }, [formData, highlightComplianceItem]);

  const runComplianceAction = async (
    itemId: ComplianceItemId,
    action: 'fulfill' | 'clear_request'
  ) => {
    if (!applicationId) return;
    const actionKey = `${action}-${itemId}`;
    setLoadingAction(actionKey);
    try {
      const response = await apiService.kamB2cComplianceAction(applicationId, { itemId, action });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update compliance');
      }
      onUpdated?.();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update compliance');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      id="b2c-compliance"
      className="space-y-4 border-t border-neutral-200 pt-4"
      data-testid="b2c-compliance-review"
    >
      <div>
        <h4 className="text-sm font-semibold text-neutral-900">Compliance checklist</h4>
        <p className="mt-1 text-sm text-neutral-600">
          VKYC, loan agreement, and eNACH status. KAM can approve pending client requests here.
        </p>
      </div>

      <div className="space-y-3">
        {COMPLIANCE_ITEMS.map((item) => {
          const checked = isComplianceChecked(formData, item.checkboxKey);
          const requestedAt = readString(formData[item.requestedAtKey]);
          const isRequested = isComplianceItemRequested(formData, item.id);
          const isHighlighted = highlightedItemId === item.id;

          return (
            <div
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                isHighlighted ? 'border-brand-primary bg-brand-primary/5' : 'border-neutral-200'
              }`}
              data-testid={`compliance-review-${item.id}`}
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                <p className="text-xs text-neutral-500">
                  {checked ? 'Approved by KAM' : 'Pending KAM approval'}
                  {isRequested && requestedAt
                    ? ` · Requested ${new Date(requestedAt).toLocaleString()}`
                    : ''}
                </p>
              </div>
              {canManageCompliance && isRequested && !checked && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={loadingAction != null}
                    onClick={() => void runComplianceAction(item.id, 'fulfill')}
                    data-testid={`compliance-approve-${item.id}`}
                  >
                    {loadingAction === `fulfill-${item.id}` ? 'Saving…' : 'Approve'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loadingAction != null}
                    onClick={() => void runComplianceAction(item.id, 'clear_request')}
                    data-testid={`compliance-reject-${item.id}`}
                  >
                    {loadingAction === `clear_request-${item.id}` ? 'Saving…' : 'Reject'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
        data-testid="b2c-document-readiness-review"
      >
        <p className="text-sm font-semibold text-neutral-900">Upload folder readiness</p>
        <p className="mt-1 text-sm text-neutral-600">
          {documentReadiness.requiredCount > 0
            ? `${documentReadiness.addedToFolderCount} of ${documentReadiness.requiredCount} required uploads marked “Yes, Added to Folder”.`
            : 'No required document checklist configured for this product.'}
        </p>
        {documentReadiness.pendingLabels.length > 0 ? (
          <p className="mt-2 text-xs text-neutral-500">
            Pending: {documentReadiness.pendingLabels.join(', ')}
          </p>
        ) : null}
      </div>

      {(doRequest || doRequested) && (
        <div
          className="rounded-xl border border-warning/30 bg-warning/5 p-4"
          data-testid="b2c-do-request-review"
        >
          <p className="text-sm font-semibold text-neutral-900">Disbursement Order (DO) request</p>
          <p className="mt-1 text-sm text-neutral-600">
            {doRequest?.requestedAt || readString(formData['_meta.doRequest.requestedAt'])
              ? `Requested ${new Date(doRequest?.requestedAt || readString(formData['_meta.doRequest.requestedAt'])).toLocaleString()}`
              : 'Not requested'}
            {doFulfilled
              ? ` · Processed ${new Date(readString(formData['_meta.doRequest.fulfilledAt'])).toLocaleString()} — post-DO stages unlocked for client`
              : doRequested
                ? ' · Pending KAM action to unlock Insurance and Vehicle for the client'
                : ''}
          </p>
          {canManageCompliance && doRequested && !doFulfilled && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={loadingAction != null}
                onClick={() => void runDoAction('fulfill')}
                data-testid="do-request-approve"
              >
                {loadingAction === 'fulfill' ? 'Saving…' : 'Mark DO processed'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingAction != null}
                onClick={() => void runDoAction('clear_request')}
                data-testid="do-request-reject"
              >
                {loadingAction === 'clear_request' ? 'Saving…' : 'Reject'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
