import React from 'react';
import { Button } from '../ui/Button';
import {
  COMPLIANCE_ITEMS,
  isComplianceChecked,
  isComplianceItemRequested,
  type ComplianceItemId,
} from '../../lib/b2cEvCompliance';

function readFieldValue(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value);
}

export interface ComplianceChecklistProps {
  formData: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  requestingItemId: ComplianceItemId | null;
  onCheckboxChange: (key: string, checked: boolean) => void;
  onRequestFromKam: (itemId: ComplianceItemId) => void;
}

export const ComplianceChecklist: React.FC<ComplianceChecklistProps> = ({
  formData,
  fieldErrors,
  requestingItemId,
  onCheckboxChange,
  onRequestFromKam,
}) => {
  return (
    <div className="space-y-4 border-t border-neutral-200 pt-6" data-testid="compliance-checklist">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Compliance checklist</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Confirm each item when complete, or request assistance from your KAM.
        </p>
      </div>

      <div className="space-y-3">
        {COMPLIANCE_ITEMS.map((item) => {
          const checked = isComplianceChecked(formData, item.checkboxKey);
          const requestedAt = readFieldValue(formData, item.requestedAtKey);
          const isRequested = isComplianceItemRequested(formData, item.id);
          const isRequesting = requestingItemId === item.id;
          const error = fieldErrors[item.checkboxKey];

          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4"
              data-testid={`compliance-item-${item.id}`}
            >
              <label className="flex min-w-[12rem] flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onCheckboxChange(item.checkboxKey, event.target.checked)}
                  data-testid={`compliance-checkbox-${item.id}`}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm font-medium text-neutral-900">{item.label}</span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                {isRequested && requestedAt && (
                  <span
                    className="text-xs text-neutral-500"
                    data-testid={`compliance-requested-${item.id}`}
                  >
                    Requested — {new Date(requestedAt).toLocaleString()}
                  </span>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isRequesting || isRequested}
                  data-testid={`compliance-request-kam-${item.id}`}
                  onClick={() => onRequestFromKam(item.id)}
                >
                  {isRequesting ? 'Sending…' : 'Request from KAM'}
                </Button>
              </div>

              {error && (
                <p className="w-full text-sm text-error" data-testid={`compliance-error-${item.id}`}>
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
