import React from 'react';
import {
  COMPLIANCE_ITEMS,
  isComplianceChecked,
  isComplianceItemRequested,
} from '../../../lib/b2cEvCompliance';
import {
  getRequiredDocumentReadiness,
  type FormConfigCategory,
} from '../../../lib/b2cEvDocuments';
import { extractPendingB2cActions } from '../../../lib/b2cEvKamActions';
import { isDoFulfilled, isDoRequested } from '../../../lib/b2cEvDoRequest';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export interface B2cEvComplianceReviewProps {
  formData: Record<string, unknown>;
  formConfig?: FormConfigCategory[];
}

export const B2cEvComplianceReview: React.FC<B2cEvComplianceReviewProps> = ({
  formData,
  formConfig = [],
}) => {
  const { doRequest } = extractPendingB2cActions(formData);
  const documentReadiness = getRequiredDocumentReadiness(formData, formConfig);
  const doRequested = isDoRequested(formData);
  const doFulfilled = isDoFulfilled(formData);

  return (
    <div
      id="b2c-compliance"
      className="space-y-4 border-t border-neutral-200 pt-4"
      data-testid="b2c-compliance-review"
    >
      <div>
        <h4 className="text-sm font-semibold text-neutral-900">Compliance checklist</h4>
        <p className="mt-1 text-sm text-neutral-600">
          VKYC, loan agreement, and eNACH status. Use the Queries section below to mark items
          complete or process the DO request.
        </p>
      </div>

      <div className="space-y-3">
        {COMPLIANCE_ITEMS.map((item) => {
          const checked = isComplianceChecked(formData, item.checkboxKey);
          const requestedAt = readString(formData[item.requestedAtKey]);
          const isRequested = isComplianceItemRequested(formData, item.id);

          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4"
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
                ? ' · Mark DO processed in Queries to unlock Insurance and Vehicle for the client'
                : ''}
          </p>
        </div>
      )}
    </div>
  );
};
