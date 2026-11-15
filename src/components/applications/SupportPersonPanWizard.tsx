import React from 'react';
import { CheckCircle2 } from 'lucide-react';
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
import { SUPPORT_PAN_LOOKUP_FIELD_KEYS } from '../../lib/b2cEvSupportPanLookup';
import type { BureauOutcome, QualifyApplicantAddress } from '../../lib/runBureauAndFill';
import {
  isValidBureauMobile,
  isValidBureauPan,
  normalizePan,
} from '../../lib/runBureauAndFill';

function readFieldValue(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value);
}

function renderField(
  field: B2cEvFieldDef,
  value: string,
  error: string | undefined,
  onChange: (key: string, value: string) => void,
  options?: { fromBureau?: boolean; disabled?: boolean }
): React.ReactNode {
  const forceChars =
    field.key === '_meta.supportPanLookup.panNumber' ||
    field.key === '_meta.supportPanLookup.fullName';
  const common = {
    id: field.key,
    label: field.label,
    required: field.required,
    value,
    error,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(field.key, e.target.value),
    ...(forceChars ? { autoCapitalize: 'characters' as const } : {}),
  };

  const tag = options?.fromBureau ? (
    <span
      className="ml-2 rounded bg-dealer-surface-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-dealer-text-quiet"
      data-testid={`bureau-tag-${field.key.replace(/\./g, '-')}`}
    >
      From bureau
    </span>
  ) : null;

  if (field.type === 'textarea') {
    return (
      <div key={field.key}>
        <div className="mb-1 flex items-center">
          <span className="text-sm font-medium text-dealer-text">{field.label}</span>
          {tag}
        </div>
        <TextArea {...common} label="" rows={3} disabled={options?.disabled} />
      </div>
    );
  }
  if (field.type === 'select' && field.options) {
    return (
      <div key={field.key}>
        <div className="mb-1 flex items-center">
          <span className="text-sm font-medium text-dealer-text">{field.label}</span>
          {tag}
        </div>
        <Select
          label=""
          required={field.required}
          error={error}
          value={value}
          disabled={options?.disabled}
          options={[{ value: '', label: `Select ${field.label}` }, ...field.options]}
          onChange={(e) => onChange(field.key, e.target.value)}
          data-testid={`b2c-field-${field.key.replace(/\./g, '-')}`}
        />
      </div>
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
    <div key={field.key}>
      <div className="mb-1 flex items-center">
        <span className="text-sm font-medium text-dealer-text">
          {field.label}
          {field.required ? <span className="text-dealer-error"> *</span> : ''}
        </span>
        {tag}
      </div>
      <Input
        {...common}
        label=""
        type={inputType}
        placeholder={field.placeholder}
        disabled={options?.disabled}
        tone="dealer"
        data-testid={`b2c-field-${field.key.replace(/\./g, '-')}`}
      />
    </div>
  );
}

export type SupportBureauUiPhase = 'input' | 'loading' | 'profile';

export interface SupportPersonPanWizardProps {
  formData: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  loading: boolean;
  loadingMessage: string;
  lookupError: string | null;
  bureauOutcome: BureauOutcome | null;
  manualMode: boolean;
  autofilledKeys: string[];
  consentChecked: boolean;
  addresses: QualifyApplicantAddress[];
  addressIndex: number;
  onFieldChange: (key: string, value: string) => void;
  onSupportTypeChange: (type: SupportPersonType) => void;
  onConsentChange: (checked: boolean) => void;
  onVerify: () => void;
  onUseDifferent: () => void;
  onEnterManual: () => void;
  onAddressIndexChange: (index: number) => void;
}

function canEnableVerify(formData: Record<string, unknown>, consentChecked: boolean): boolean {
  const name = readFieldValue(formData, '_meta.supportPanLookup.fullName');
  const mobile = readFieldValue(formData, '_meta.supportPanLookup.mobileNumber');
  const pan = normalizePan(readFieldValue(formData, '_meta.supportPanLookup.panNumber'));
  return name.length >= 3 && isValidBureauMobile(mobile) && isValidBureauPan(pan) && consentChecked;
}

export const SupportPersonPanWizard: React.FC<SupportPersonPanWizardProps> = ({
  formData,
  fieldErrors,
  loading,
  loadingMessage,
  lookupError,
  bureauOutcome,
  manualMode,
  autofilledKeys,
  consentChecked,
  addresses,
  addressIndex,
  onFieldChange,
  onSupportTypeChange,
  onConsentChange,
  onVerify,
  onUseDifferent,
  onEnterManual,
  onAddressIndexChange,
}) => {
  const selected = readFieldValue(formData, '_meta.supportPersonType') as SupportPersonType;
  const profileFields = getSupportPersonProfileFields(selected);
  const roleLabel = selected === 'guarantor' ? 'guarantor' : 'co-applicant';
  const showProfile =
    Boolean(bureauOutcome && bureauOutcome.status !== 'error') ||
    manualMode ||
    (bureauOutcome?.status === 'error' && manualMode);

  const choices: Array<{ type: SupportPersonType; title: string; subtitle: string }> = [
    { type: 'co_applicant', title: 'Co-applicant', subtitle: 'Family / blood relation' },
    { type: 'guarantor', title: 'Guarantor', subtitle: 'Non-family relation' },
  ];

  const handleInputChange = (key: string, value: string) => {
    let next = value;
    if (
      key === '_meta.supportPanLookup.panNumber' ||
      key === '_meta.supportPanLookup.fullName'
    ) {
      next = value.toUpperCase();
    }
    onFieldChange(key, next);
  };

  if (loading) {
    return (
      <div className="space-y-4" data-testid="support-pan-phase-loading">
        <p className="post-submit-body text-center text-sm font-medium text-dealer-navy">
          {loadingMessage}
        </p>
        <div className="lender-pendulum mx-auto" aria-hidden>
          <div className="lender-pendulum-track">
            <div className="lender-pendulum-bob" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="support-pan-phase-input">
      <p className="text-sm text-dealer-text-quiet">
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
                  : 'border-dealer-border bg-dealer-surface hover:border-dealer-border'
              }`}
            >
              <p className="font-semibold text-dealer-text">{choice.title}</p>
              <p className="mt-1 text-sm text-dealer-text-quiet">{choice.subtitle}</p>
            </button>
          );
        })}
      </div>
      {fieldErrors['_meta.supportPersonType'] && (
        <p className="text-sm text-dealer-error">{fieldErrors['_meta.supportPersonType']}</p>
      )}

      {selected !== 'none' && !showProfile && (
        <div className="border-t border-dealer-border pt-6">
          <h3 className="mb-4 text-sm font-medium text-dealer-text">
            {selected === 'guarantor' ? 'Guarantor verification' : 'Co-applicant verification'}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {SUPPORT_PAN_LOOKUP_INPUT_FIELDS.filter(
              (f) => f.key !== '_meta.supportPanLookup.email'
            ).map((field) => (
              <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
                {renderField(
                  field,
                  readFieldValue(formData, field.key),
                  fieldErrors[field.key],
                  handleInputChange
                )}
              </div>
            ))}
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm text-dealer-text">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={consentChecked}
              onChange={(e) => onConsentChange(e.target.checked)}
              data-testid="b2c-support-bureau-consent"
            />
            <span>
              The {roleLabel} has given consent for a credit bureau check.
            </span>
          </label>

          {lookupError && (
            <p className="mt-3 text-sm text-dealer-error" data-testid="b2c-support-pan-lookup-error">
              {lookupError}
            </p>
          )}

          {bureauOutcome?.status === 'error' && !manualMode && (
            <div
              className="mt-4 rounded-[12px] border border-dealer-warning/40 bg-dealer-warning/5 px-4 py-3"
              data-testid="support-bureau-error"
              role="alert"
            >
              <p className="text-sm font-semibold text-dealer-text">Could not verify right now.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" onClick={onVerify} data-testid="support-bureau-retry">
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onEnterManual}
                  data-testid="support-bureau-enter-manual"
                >
                  Enter details manually
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4">
            <Button
              type="button"
              onClick={onVerify}
              disabled={loading || !canEnableVerify(formData, consentChecked)}
              data-testid="b2c-support-pan-verify"
            >
              {selected === 'guarantor' ? 'Verify guarantor' : 'Verify co-applicant'}
            </Button>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="space-y-4 border-t border-dealer-border pt-6" data-testid="support-pan-phase-profile">
          {bureauOutcome?.status === 'pass' && (
            <div
              className="flex items-center gap-2 rounded-[12px] border border-dealer-success/30 bg-dealer-success/5 px-4 py-3"
              data-testid="support-bureau-pass"
            >
              <CheckCircle2 className="h-5 w-5 text-dealer-success" />
              <p className="text-sm font-semibold text-dealer-navy">
                {selected === 'guarantor' ? 'Guarantor verified' : 'Co-applicant verified'}
              </p>
            </div>
          )}
          {bureauOutcome?.status === 'ntc' && (
            <div
              className="flex items-center gap-2 rounded-[12px] border border-dealer-success/30 bg-dealer-success/5 px-4 py-3"
              data-testid="support-bureau-ntc"
            >
              <CheckCircle2 className="h-5 w-5 text-dealer-success" />
              <p className="text-sm font-semibold text-dealer-navy">
                {selected === 'guarantor'
                  ? 'Guarantor verified (new to credit)'
                  : 'Co-applicant verified (new to credit)'}
              </p>
            </div>
          )}
          {bureauOutcome?.status === 'fail' && (
            <div
              className="rounded-[12px] border border-dealer-border bg-dealer-surface-soft px-4 py-3"
              data-testid="support-bureau-fail"
            >
              <p className="text-sm font-semibold text-dealer-navy">
                Check complete — review the notes below
              </p>
              <p className="mt-1 text-sm text-dealer-text-quiet">
                This does not reject the application. You can continue, or use a different{' '}
                {roleLabel}.
              </p>
              {bureauOutcome.reasons.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {bureauOutcome.reasons.map((reason) => (
                    <li key={reason} className="text-sm text-dealer-text-quiet">
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onUseDifferent}
                  data-testid="support-bureau-use-different"
                >
                  Use a different {roleLabel}
                </Button>
              </div>
            </div>
          )}
          {(manualMode || bureauOutcome?.emptyApplicant) && (
            <p className="text-sm text-dealer-text-quiet" data-testid="support-pan-profile-message">
              No details found, please enter manually
            </p>
          )}

          {addresses.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-dealer-text">
                Use a different address
              </label>
              <Select
                label=""
                value={String(addressIndex)}
                options={addresses.map((addr, idx) => ({
                  value: String(idx),
                  label: [addr.line1, addr.line2, addr.pin].filter(Boolean).join(', ') || `Address ${idx + 1}`,
                }))}
                onChange={(e) => onAddressIndexChange(Number(e.target.value))}
                data-testid="support-bureau-address-select"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {profileFields.map((field) => (
              <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
                {renderField(
                  field,
                  readFieldValue(formData, field.key),
                  fieldErrors[field.key],
                  onFieldChange,
                  { fromBureau: autofilledKeys.includes(field.key) }
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { SUPPORT_PAN_LOOKUP_FIELD_KEYS, canEnableVerify };
