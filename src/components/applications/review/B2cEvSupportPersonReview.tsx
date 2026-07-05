import React from 'react';
import {
  getSupportPersonProfileFields,
  type SupportPersonType,
} from '../../../config/forms/b2cEvFormSchema';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export interface B2cEvSupportPersonReviewProps {
  formData: Record<string, unknown>;
}

export const B2cEvSupportPersonReview: React.FC<B2cEvSupportPersonReviewProps> = ({ formData }) => {
  const supportType = readString(formData['_meta.supportPersonType']) as SupportPersonType;
  if (!supportType || supportType === 'none') {
    return (
      <p className="text-sm text-neutral-500" data-testid="b2c-support-person-none">
        No co-applicant or guarantor selected.
      </p>
    );
  }

  const label = supportType === 'co_applicant' ? 'Co-applicant' : 'Guarantor';
  const fields = getSupportPersonProfileFields(supportType);

  return (
    <div data-testid="b2c-support-person-review">
      <p className="mb-3 text-sm font-semibold text-neutral-800">{label}</p>
      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.key} className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-2">
            <p className="text-sm text-neutral-500">{field.label}</p>
            <p className="text-sm text-neutral-900 sm:col-span-2">
              {formatValue(formData[field.key])}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
