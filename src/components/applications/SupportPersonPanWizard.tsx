import React from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import {
  getSupportPersonProfileFields,
  SUPPORT_PAN_LOOKUP_INPUT_FIELDS,
  type B2cEvFieldDef,
  type SupportPersonType,
} from '../../config/forms/b2cEvFormSchema';
import {
  getSupportPanLookupPhase,
  isSupportPanLookupManual,
  SUPPORT_PAN_LOOKUP_FIELD_KEYS,
} from '../../lib/b2cEvSupportPanLookup';

function readFieldValue(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value);
}

function renderField(
  field: B2cEvFieldDef,
  value: string,
  error: string | undefined,
  onChange: (key: string, value: string) => void
): React.ReactNode {
  const common = {
    id: field.key,
    label: field.label,
    required: field.required,
    value,
    error,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(field.key, e.target.value),
  };

  if (field.type === 'textarea') {
    return <TextArea key={field.key} {...common} rows={3} />;
  }
  if (field.type === 'select' && field.options) {
    return (
      <Select
        key={field.key}
        label={field.label}
        required={field.required}
        error={error}
        value={value}
        options={[{ value: '', label: `Select ${field.label}` }, ...field.options]}
        onChange={(e) => onChange(field.key, e.target.value)}
        data-testid={`b2c-field-${field.key.replace(/\./g, '-')}`}
      />
    );
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'tel'
        ? 'tel'
        : field.type === 'date'
          ? 'date'
          : 'text';

  return (
    <Input
      key={field.key}
      {...common}
      type={inputType}
      placeholder={field.placeholder}
      data-testid={`b2c-field-${field.key.replace(/\./g, '-')}`}
    />
  );
}

export interface SupportPersonPanWizardProps {
  formData: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  loading: boolean;
  loadingMessage: string;
  lookupError: string | null;
  onFieldChange: (key: string, value: string) => void;
  onSupportTypeChange: (type: SupportPersonType) => void;
  onVerify: () => void;
}

export const SupportPersonPanWizard: React.FC<SupportPersonPanWizardProps> = ({
  formData,
  fieldErrors,
  loading,
  loadingMessage,
  lookupError,
  onFieldChange,
  onSupportTypeChange,
  onVerify,
}) => {
  const phase = getSupportPanLookupPhase(formData);
  const selected = readFieldValue(formData, '_meta.supportPersonType') as SupportPersonType;
  const profileFields = getSupportPersonProfileFields(selected);

  const choices: Array<{ type: SupportPersonType; title: string; subtitle: string }> = [
    { type: 'co_applicant', title: 'Co-applicant', subtitle: 'Family / blood relation' },
    { type: 'guarantor', title: 'Guarantor', subtitle: 'Non-family relation' },
  ];

  if (phase === 'loading') {
    return (
      <div className="space-y-4" data-testid="support-pan-phase-loading">
        <p className="text-sm text-neutral-600">{loadingMessage}</p>
      </div>
    );
  }

  if (phase === 'profile') {
    const manualEntry = isSupportPanLookupManual(formData);
    return (
      <div className="space-y-6" data-testid="support-pan-phase-profile">
        <p className="text-sm text-neutral-600" data-testid="support-pan-profile-message">
          {manualEntry
            ? 'PAN verification returned no results. Enter address and other details manually, then continue.'
            : 'Details loaded from PAN verification. Review and complete any missing fields before continuing.'}
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profileFields.map((field) => (
            <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
              {renderField(
                field,
                readFieldValue(formData, field.key),
                fieldErrors[field.key],
                onFieldChange
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="support-pan-phase-input">
      <p className="text-sm text-neutral-600">
        Choose one supporting person for this loan. Co-applicant and guarantor are mutually exclusive.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {choices.map((choice) => {
          const active = selected === choice.type;
          return (
            <button
              key={choice.type}
              type="button"
              data-testid={`support-person-${choice.type}`}
              onClick={() => onSupportTypeChange(choice.type)}
              disabled={loading}
              className={`rounded-xl border p-4 text-left transition-all ${
                active
                  ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <p className="font-semibold text-neutral-900">{choice.title}</p>
              <p className="mt-1 text-sm text-neutral-600">{choice.subtitle}</p>
            </button>
          );
        })}
      </div>
      {fieldErrors['_meta.supportPersonType'] && (
        <p className="text-sm text-error">{fieldErrors['_meta.supportPersonType']}</p>
      )}

      {selected !== 'none' && (
        <div className="border-t border-neutral-200 pt-6">
          <h3 className="mb-4 text-sm font-medium text-neutral-800">PAN verification</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {SUPPORT_PAN_LOOKUP_INPUT_FIELDS.map((field) => (
              <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
                {renderField(
                  field,
                  readFieldValue(formData, field.key),
                  fieldErrors[field.key],
                  onFieldChange
                )}
              </div>
            ))}
          </div>
          {lookupError && (
            <p className="mt-3 text-sm text-error" data-testid="b2c-support-pan-lookup-error">
              {lookupError}
            </p>
          )}
          <div className="mt-4">
            <Button
              type="button"
              onClick={onVerify}
              disabled={loading}
              data-testid="b2c-support-pan-verify"
            >
              {loading ? 'Verifying…' : 'Verify PAN'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export { SUPPORT_PAN_LOOKUP_FIELD_KEYS };
