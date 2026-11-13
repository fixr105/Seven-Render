import { useMemo, useEffect, useState } from 'react';
import { enginePost } from '../../services/engineClient';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Checkbox } from '../../components/ui/Checkbox';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { TextArea } from '../../components/ui/TextArea';
import {
  buildFormCategories,
  createFileId,
  extractRecordId,
  extractRecords,
  fieldKey,
  filterVehicles,
  isAadhaarLabel,
  isPanLabel,
  isVehicleLabel,
  readCanonical,
  type CanonicalApplication,
  type DealerFormCategory,
  type DealerFormField,
  type VehicleOption,
} from './formModel';
import { defaultCollectedValues, withCollectedCategories } from './collectedInputs';
import { isValidAadhaar, isValidPan } from './validation';

const BUREAU_CONSENT =
  'I authorise Seven Fincorp and its lending partners to carry out a background check for this application.';

export interface SubmittedApplication {
  recordId: string;
  fileId: string;
  values: Record<string, string | boolean>;
  canonical: CanonicalApplication;
  includeCoApplicant: boolean;
  /** Full qualify payload, kept for a later lender rank. Never render it. */
  qualifyResult?: unknown;
  /** Co-applicant qualify payload (non-blocking). Never render it. */
  coApplicantResult?: unknown;
}

interface ApplicationFormStepProps {
  productId: string;
  clientId: string;
  initialValues: Record<string, string | boolean>;
  initialCoApplicant: boolean;
  existingRecordId: string;
  existingFileId: string;
  preserveStatus: boolean;
  onSubmitted: (application: SubmittedApplication) => void;
}

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function labelText(label: string): string {
  return label.toLowerCase();
}

export function validateFields(
  categories: DealerFormCategory[],
  values: Record<string, string | boolean>,
  includeCoApplicant: boolean
): Record<string, string> {
  const errors: Record<string, string> = {};
  categories.forEach((category) => {
    if (category.isCoApplicant && !includeCoApplicant) return;
    category.fields.forEach((field) => {
      const key = fieldKey(field.label, category.categoryName);
      const raw = values[key];
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (field.isRequired && (typeof raw === 'boolean' ? !raw : text === '')) {
        errors[field.fieldId] = `${field.label} is required.`;
        return;
      }
      if (text && isAadhaarLabel(field.label) && !isValidAadhaar(text)) {
        errors[field.fieldId] = 'Enter a valid 12-digit Aadhaar number.';
      } else if (text && isPanLabel(field.label) && !isValidPan(text.toUpperCase())) {
        errors[field.fieldId] = 'Enter a valid PAN.';
      } else if (text && (labelText(field.label).includes('mobile') || labelText(field.label).includes('phone'))) {
        const digits = text.replace(/\D/g, '');
        if (digits.length !== 10) errors[field.fieldId] = 'Enter a 10-digit mobile number.';
      }
    });
  });
  return errors;
}

export function FieldControl({
  field,
  value,
  error,
  vehicles,
  onChange,
  onVehicle,
}: {
  field: DealerFormField;
  value: string | boolean | undefined;
  error?: string;
  vehicles: VehicleOption[];
  onChange: (value: string | boolean) => void;
  onVehicle: (vehicleId: string) => void;
}) {
  const text = typeof value === 'string' ? value : '';
  if (isVehicleLabel(field.label) && vehicles.length > 0) {
    return (
      <Select
        label={field.label}
        required={field.isRequired}
        error={error}
        value={vehicles.find((vehicle) => vehicle.label === text)?.id ?? ''}
        onChange={(event) => onVehicle(event.target.value)}
        options={[{ value: '', label: 'Select a vehicle' }, ...vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.label }))]}
      />
    );
  }
  if (field.type === 'checkbox') {
    return (
      <div>
        <Checkbox checked={value === true} onChange={onChange} label={field.label} />
        {error ? <p className="mt-1 text-sm text-error">{error}</p> : null}
      </div>
    );
  }
  if (field.type === 'select' || field.options.length > 0) {
    return (
      <Select
        label={field.label}
        required={field.isRequired}
        error={error}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        options={[{ value: '', label: field.placeholder || 'Select' }, ...field.options.map((option) => ({ value: option, label: option }))]}
      />
    );
  }
  if (field.type === 'textarea') {
    return (
      <TextArea
        label={field.label}
        required={field.isRequired}
        error={error}
        placeholder={field.placeholder}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  const inputType = isAadhaarLabel(field.label)
    ? 'tel'
    : field.type === 'date'
      ? 'date'
      : field.type === 'number' || field.type === 'currency'
        ? 'number'
        : labelText(field.label).includes('mobile') || labelText(field.label).includes('phone')
          ? 'tel'
          : 'text';
  return (
    <Input
      label={field.label}
      required={field.isRequired}
      error={error}
      placeholder={field.placeholder}
      type={inputType}
      inputMode={inputType === 'tel' ? 'numeric' : undefined}
      maxLength={isAadhaarLabel(field.label) ? 12 : isPanLabel(field.label) ? 10 : undefined}
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        if (isPanLabel(field.label)) onChange(next.toUpperCase());
        else if (isAadhaarLabel(field.label) || inputType === 'tel') onChange(next.replace(/\D/g, '').slice(0, isAadhaarLabel(field.label) ? 12 : 10));
        else onChange(next);
      }}
    />
  );
}

export function ApplicationFormStep({
  productId,
  clientId,
  initialValues,
  initialCoApplicant,
  existingRecordId,
  existingFileId,
  preserveStatus,
  onSubmitted,
}: ApplicationFormStepProps) {
  const [categories, setCategories] = useState<DealerFormCategory[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({
    ...defaultCollectedValues(),
    ...initialValues,
  });
  const [includeCoApplicant, setIncludeCoApplicant] = useState(initialCoApplicant);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const clientFilter = `{Client} = '${escapeFormulaValue(clientId)}'`;
        const [mappings, categoryRows, fieldRows, vehicleRows] = await Promise.all([
          enginePost('airtable_get', { table: 'Client Form Mapping', filter: clientFilter }),
          enginePost('airtable_get', { table: 'Form Categories' }),
          enginePost('airtable_get', { table: 'Form Fields' }),
          enginePost('airtable_get', { table: 'Vehicles' }),
        ]);
        if (cancelled) return;
        setCategories(buildFormCategories(extractRecords(mappings), extractRecords(categoryRows), extractRecords(fieldRows)));
        setVehicles(filterVehicles(extractRecords(vehicleRows), productId));
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load the application form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, productId]);

  const shownCategories = useMemo(() => withCollectedCategories(categories), [categories]);

  const setFieldValue = (field: DealerFormField, categoryName: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [fieldKey(field.label, categoryName)]: value }));
  };

  const applyVehicle = (field: DealerFormField, categoryName: string, vehicleId: string) => {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    setValues((current) => {
      const next = { ...current };
      shownCategories.forEach((category) => {
        category.fields.forEach((candidate) => {
          const key = fieldKey(candidate.label, category.categoryName);
          const label = candidate.label.toLowerCase();
          if (candidate.fieldId === field.fieldId && category.categoryName === categoryName) {
            next[key] = vehicle?.label ?? '';
          } else if (vehicle && /funding/.test(label)) {
            next[key] = String(vehicle.fundingAmount || '');
          } else if (vehicle && /ex[-\s]?showroom|\bprice\b/.test(label) && !/on[-\s]?road/.test(label)) {
            next[key] = String(vehicle.price || '');
          }
        });
      });
      return next;
    });
  };

  const submit = async () => {
    const fieldErrors = validateFields(shownCategories, values, includeCoApplicant);
    if (!consent) fieldErrors.consent = 'Bureau consent is required.';
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const canonical = readCanonical(shownCategories, values, includeCoApplicant);
    const fileId = existingFileId || createFileId();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const fields: Record<string, unknown> = {
      'Applicant Name': canonical.fullName,
      'Loan Product': productId,
      'Requested Loan Amount': canonical.requestedLoanAmount,
      'Mobile Number': canonical.mobile,
      'Email Id': canonical.email,
      Select: canonical.selectType,
      'Form Data': JSON.stringify(values),
      'Last Updated': now.toISOString(),
    };
    if (!existingRecordId) {
      fields['File ID'] = fileId;
      fields.Client = clientId;
      fields.Documents = '';
      fields.Status = 'Submitted';
      fields['Creation Date'] = today;
      fields['Submitted Date'] = today;
    } else if (!preserveStatus) {
      fields.Status = 'Submitted';
    }

    setSubmitting(true);
    setLoadError('');
    try {
      const result = await enginePost('airtable_write', {
        table: 'Loan Applications',
        action: existingRecordId ? 'update' : 'create',
        ...(existingRecordId ? { record_id: existingRecordId } : {}),
        fields,
      });
      const recordId = existingRecordId || extractRecordId(result);
      if (!recordId) throw new Error('The application was saved without a record id.');
      onSubmitted({ recordId, fileId, values, canonical, includeCoApplicant });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not save the application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-neutral-600">Loading application form...</p>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {loadError ? <p className="text-sm text-error">{loadError}</p> : null}
      {shownCategories.map((category) => (
        <Card key={category.categoryId}>
          <CardHeader>
            <CardTitle>{category.categoryName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {category.isCoApplicant ? (
              <Checkbox
                checked={includeCoApplicant}
                onChange={setIncludeCoApplicant}
                label="Add a co-applicant"
              />
            ) : null}
            {category.isCoApplicant && !includeCoApplicant ? null : category.fields.map((field) => (
              <FieldControl
                key={field.fieldId}
                field={field}
                value={values[fieldKey(field.label, category.categoryName)]}
                error={errors[field.fieldId]}
                vehicles={vehicles}
                onChange={(value) => setFieldValue(field, category.categoryName, value)}
                onVehicle={(vehicleId) => applyVehicle(field, category.categoryName, vehicleId)}
              />
            ))}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="space-y-3">
          <Checkbox checked={consent} onChange={setConsent} label={BUREAU_CONSENT} />
          {errors.consent ? <p className="text-sm text-error">{errors.consent}</p> : null}
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
            Continue
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
