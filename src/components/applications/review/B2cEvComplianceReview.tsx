import React from 'react';
import {
  COMPLIANCE_ITEMS,
  isComplianceChecked,
  isComplianceItemRequested,
} from '../../../lib/b2cEvCompliance';
import { extractPendingB2cActions } from '../../../lib/b2cEvKamActions';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export interface B2cEvComplianceReviewProps {
  formData: Record<string, unknown>;
}

export const B2cEvComplianceReview: React.FC<B2cEvComplianceReviewProps> = ({ formData }) => {
  const { doRequest } = extractPendingB2cActions(formData);

  return (
    <div
      id="b2c-compliance"
      className="space-y-4 border-t border-neutral-200 pt-4"
      data-testid="b2c-compliance-review"
    >
      <div>
        <h4 className="text-sm font-semibold text-neutral-900">Compliance checklist</h4>
        <p className="mt-1 text-sm text-neutral-600">
          VKYC, loan agreement, and eNACH status. Use the Queries section below to respond to client requests.
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
                  {checked ? 'Confirmed' : 'Not confirmed'}
                  {isRequested && requestedAt
                    ? ` · Requested ${new Date(requestedAt).toLocaleString()}`
                    : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {doRequest && (
        <div
          className="rounded-xl border border-warning/30 bg-warning/5 p-4"
          data-testid="b2c-do-request-review"
        >
          <p className="text-sm font-semibold text-neutral-900">Disbursement Order (DO) request</p>
          <p className="mt-1 text-sm text-neutral-600">
            Requested {new Date(doRequest.requestedAt).toLocaleString()}
            {doRequest.fulfilledAt
              ? ` · Processed ${new Date(doRequest.fulfilledAt).toLocaleString()}`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
};
