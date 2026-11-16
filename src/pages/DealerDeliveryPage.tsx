import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { JourneyRail } from '../components/dealer-ui/JourneyRail';
import { PageHeader } from '../components/dealer-ui/PageHeader';
import { StatusBadge } from '../components/dealer-ui/StatusBadge';
import { DealerSkeleton } from '../components/dealer-ui/DealerSkeleton';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import {
  B2C_EV_INSURANCE_STAGE,
  B2C_EV_VEHICLE_STAGE,
  type B2cEvFieldDef,
  type B2cEvStage,
} from '../config/forms/b2cEvFormSchema';
import { B2C_EV_GEO_PHOTO_SLOTS, isGeoPhotoSlotComplete, type B2cEvGeoPhotoSlot } from '../lib/b2cEvGeoPhotos';
import { validateB2cEvStage } from '../lib/b2cEvFormValidation';
import { stampGeoPhoto } from '../lib/geoPhotoStamp';
import { parseMapsLinkOrCoords } from '../lib/mapsLinkParser';
import {
  normalizeChassis,
  normalizeIotDeviceId,
  validateChassisNumber,
  validateIotDeviceId,
} from '../lib/iotTagging';
import { fireEvent, flushCrm } from '../lib/crmEvents';
import { readDeadlineMeta, remainingMs } from '../lib/deadlineCountdown';
import { ensureDeadlineMissFlag } from '../lib/kamFlagsDeadline';
import {
  airtableGet,
  airtableWrite,
  readAirtableField,
  uploadToUrl,
  type AirtableFlatRecord,
} from '../services/engineClient';
import { apiService } from '../services/api';

const LOAN_TABLE = 'Loan Applications';
const DEADLINE_CHECK_MS = 30_000;
const DELIVERY_COMPLETED_KEY = '_meta.delivery.completed_at';
const SIGNING_SENT_KEY = '_meta.signing.sentAt';
const POST_SUBMIT_SIGNING_KEY = '_meta.postSubmit.signingSentAt';
const VEHICLE_CHASSIS_KEY = 'vehicle.chassisNumber';
const IOT_KEYS = {
  deviceId: 'iot.deviceId',
  chassisNumber: 'iot.chassisNumber',
  devicePhoto: 'iot.devicePhoto',
  taggedAt: 'iot.taggedAt',
} as const;

const INPUT_CLASS =
  'min-h-11 w-full rounded-[12px] border border-dealer-border px-3 py-2 text-sm text-dealer-text focus:border-dealer-navy focus:outline-none focus:ring-2 focus:ring-dealer-navy';
const FIELD_LABEL_CLASS = 'mb-1 block text-sm font-medium text-dealer-text';
const FIELD_ERROR_CLASS = 'mt-1 text-xs text-dealer-error';

type FormData = Record<string, unknown>;
type CardId = 'geo' | 'insurance' | 'vehicle' | 'iot';

type BarcodeDetectorLike = {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function readText(formData: FormData, key: string): string {
  const v = formData[key];
  return v == null ? '' : String(v).trim();
}

function parseFormDataField(raw: unknown): FormData {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as FormData;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as FormData;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true) return true;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

/** Signing is initiated by PostSubmitEngineFlow, which stamps `_meta.signing.sentAt`. */
function isSigningSent(formData: FormData): boolean {
  return (
    Boolean(readText(formData, SIGNING_SENT_KEY)) ||
    Boolean(readText(formData, POST_SUBMIT_SIGNING_KEY)) ||
    isTruthyFlag(formData['compliance.loanAgreementSigned'])
  );
}

function stageErrors(stage: B2cEvStage, formData: FormData): Record<string, string> {
  return validateB2cEvStage(stage, formData);
}

function computeDone(formData: FormData): Record<CardId, boolean> {
  return {
    geo: B2C_EV_GEO_PHOTO_SLOTS.every((slot) => isGeoPhotoSlotComplete(formData, slot)),
    insurance: Object.keys(stageErrors(B2C_EV_INSURANCE_STAGE, formData)).length === 0,
    vehicle: Object.keys(stageErrors(B2C_EV_VEHICLE_STAGE, formData)).length === 0,
    iot:
      Boolean(readText(formData, IOT_KEYS.deviceId)) &&
      Boolean(readText(formData, IOT_KEYS.chassisNumber)) &&
      Boolean(readText(formData, IOT_KEYS.taggedAt)),
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that photo. Try another one.'));
    img.src = src;
  });
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  return (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function StatusChip({ done }: { done: boolean }) {
  return (
    <span data-testid="delivery-card-status">
      <StatusBadge status={done ? 'done' : 'pending'} variant="filled" />
    </span>
  );
}

function DeliveryCard({
  title,
  done,
  testId,
  children,
}: {
  title: string;
  done: boolean;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5"
      data-testid={testId}
      data-done={done ? 'true' : 'false'}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold leading-snug text-dealer-navy">
          {title}
        </h2>
        <StatusChip done={done} />
      </div>
      {children}
    </section>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-[12px] bg-dealer-navy px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function OutlineButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-[12px] border border-dealer-border bg-dealer-surface px-4 py-2.5 text-sm font-semibold text-dealer-navy disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

type GeoDraft = {
  file: File | null;
  mapsLink: string;
  previewUrl: string;
  blob: Blob | null;
  lat: number;
  lng: number;
  capturedAt: string;
  error: string;
  busy: boolean;
};

const EMPTY_GEO_DRAFT: GeoDraft = {
  file: null,
  mapsLink: '',
  previewUrl: '',
  blob: null,
  lat: 0,
  lng: 0,
  capturedAt: '',
  error: '',
  busy: false,
};

function GeoSlotEditor({
  slot,
  fileId,
  formData,
  disabled,
  onCommit,
}: {
  slot: B2cEvGeoPhotoSlot;
  fileId: string;
  formData: FormData;
  disabled: boolean;
  onCommit: (patch: FormData) => Promise<void>;
}) {
  const [draft, setDraft] = useState<GeoDraft>(EMPTY_GEO_DRAFT);
  const [replacing, setReplacing] = useState(false);
  const previewRef = useRef('');
  const complete = isGeoPhotoSlotComplete(formData, slot);
  const savedUrl = readText(formData, slot.urlKey);

  const patchDraft = (patch: Partial<GeoDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const revokePreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = '';
  };

  useEffect(() => revokePreview, []);

  const reset = () => {
    revokePreview();
    setDraft(EMPTY_GEO_DRAFT);
  };

  const buildPreview = async () => {
    if (!draft.file) {
      patchDraft({ error: 'Take or choose a photo first.' });
      return;
    }
    const parsed = parseMapsLinkOrCoords(draft.mapsLink);
    if (parsed.ok === false) {
      patchDraft({ error: parsed.error });
      return;
    }
    patchDraft({ busy: true, error: '' });
    const sourceUrl = URL.createObjectURL(draft.file);
    try {
      const image = await loadImageElement(sourceUrl);
      const capturedAt = new Date();
      const { blob } = await stampGeoPhoto({
        image,
        sourceWidth: image.naturalWidth,
        sourceHeight: image.naturalHeight,
        lat: parsed.lat,
        lng: parsed.lng,
        fileId,
        slotLabel: slot.label,
        capturedAt,
      });
      revokePreview();
      previewRef.current = URL.createObjectURL(blob);
      patchDraft({
        blob,
        previewUrl: previewRef.current,
        lat: parsed.lat,
        lng: parsed.lng,
        capturedAt: capturedAt.toISOString(),
        busy: false,
      });
    } catch (err) {
      patchDraft({ busy: false, error: errorMessage(err, 'Could not stamp the photo.') });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const uploadStampedPhoto = async () => {
    if (!draft.blob) return;
    patchDraft({ busy: true, error: '' });
    try {
      const url = await uploadToUrl(draft.blob, `${slot.id}_${fileId}.jpg`);
      await onCommit({
        [slot.urlKey]: url,
        [slot.fileNameKey]: `${slot.id}_${fileId}.jpg`,
        [slot.latitudeKey]: String(draft.lat),
        [slot.longitudeKey]: String(draft.lng),
        [slot.capturedAtKey]: draft.capturedAt,
        [`_meta.geo.${slot.id}`]: {
          lat: draft.lat,
          lng: draft.lng,
          maps_link: draft.mapsLink.trim(),
          captured_at: draft.capturedAt,
          url,
        },
      });
      reset();
      setReplacing(false);
    } catch (err) {
      patchDraft({ busy: false, error: errorMessage(err, 'Could not save the photo.') });
    }
  };

  const showEditor = !complete || replacing;

  return (
    <div
      className={`rounded-[12px] p-3 ${
        complete ? 'border border-solid border-dealer-border' : 'border border-dashed border-dealer-border'
      }`}
      data-testid={`geo-slot-${slot.id}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-dealer-text">{slot.label}</p>
        {complete ? <span className="text-xs font-medium text-dealer-success">✓ Saved</span> : null}
      </div>

      {complete && !replacing ? (
        <div className="flex items-center gap-3">
          {savedUrl ? (
            <img
              src={savedUrl}
              alt={slot.label}
              className="h-16 w-16 rounded-[8px] border border-dealer-border object-cover"
            />
          ) : null}
          <p className="text-xs text-dealer-text-quiet">
            {readText(formData, slot.latitudeKey)}, {readText(formData, slot.longitudeKey)}
          </p>
          <OutlineButton onClick={() => setReplacing(true)} disabled={disabled}>
            Replace
          </OutlineButton>
        </div>
      ) : null}

      {showEditor && !draft.previewUrl ? (
        <div className="space-y-3">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled || draft.busy}
            onChange={(e) => {
              patchDraft({ file: e.target.files?.[0] || null, error: '' });
              e.target.value = '';
            }}
            className="block w-full text-sm"
            data-testid={`geo-file-${slot.id}`}
          />
          {draft.file ? (
            <p className="truncate text-xs text-dealer-text-quiet">{draft.file.name}</p>
          ) : null}
          <input
            type="text"
            value={draft.mapsLink}
            onChange={(e) => patchDraft({ mapsLink: e.target.value, error: '' })}
            placeholder="Paste Google Maps link or coordinates"
            disabled={disabled || draft.busy}
            className={INPUT_CLASS}
            data-testid={`geo-maps-${slot.id}`}
          />
          <PrimaryButton onClick={() => void buildPreview()} disabled={disabled || draft.busy}>
            {draft.busy ? 'Stamping…' : 'Preview stamped photo'}
          </PrimaryButton>
        </div>
      ) : null}

      {showEditor && draft.previewUrl ? (
        <div className="space-y-3" data-testid={`geo-preview-${slot.id}`}>
          <img
            src={draft.previewUrl}
            alt={`${slot.label} preview`}
            className="w-full rounded-[8px] border border-dealer-border"
          />
          <div className="flex flex-wrap gap-3">
            <OutlineButton onClick={reset} disabled={draft.busy}>
              Retake
            </OutlineButton>
            <PrimaryButton onClick={() => void uploadStampedPhoto()} disabled={draft.busy}>
              {draft.busy ? 'Uploading…' : 'Use this photo'}
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {draft.error ? (
        <p className="mt-2 text-sm text-dealer-error" role="alert">
          {draft.error}
        </p>
      ) : null}
    </div>
  );
}

function StageFieldInput({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: B2cEvFieldDef;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const numeric = field.type === 'number' || field.type === 'currency' || field.type === 'percent';
  return (
    <div>
      <label className={FIELD_LABEL_CLASS} htmlFor={`delivery-${field.key}`}>
        {field.label}
        {field.required ? <span className="text-dealer-error"> *</span> : ''}
      </label>
      <input
        id={`delivery-${field.key}`}
        type={field.type === 'date' ? 'date' : 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      {error ? <p className={FIELD_ERROR_CLASS}>{error}</p> : null}
    </div>
  );
}

function StageCard({
  stage,
  formData,
  done,
  disabled,
  testId,
  extraFields,
  extraValidate,
  onSave,
}: {
  stage: B2cEvStage;
  formData: FormData;
  done: boolean;
  disabled: boolean;
  testId: string;
  extraFields?: B2cEvFieldDef[];
  extraValidate?: (draft: FormData) => Record<string, string>;
  onSave: (patch: FormData) => Promise<void>;
}) {
  const fields = useMemo(() => [...stage.fields, ...(extraFields || [])], [stage.fields, extraFields]);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, readText(formData, f.key)]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const save = async () => {
    const merged: FormData = { ...formData, ...draft };
    const found = {
      ...validateB2cEvStage(stage, merged),
      ...(extraValidate ? extraValidate(merged) : {}),
    };
    setErrors(found);
    setSaveError('');
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSave(draft);
    } catch (err) {
      setSaveError(errorMessage(err, 'Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DeliveryCard title={stage.title} done={done} testId={testId}>
      <div className="space-y-3">
        {fields.map((field) => (
          <StageFieldInput
            key={field.key}
            field={field}
            value={draft[field.key] ?? ''}
            error={errors[field.key]}
            disabled={disabled || saving}
            onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
          />
        ))}
      </div>
      {saveError ? <p className="mt-3 text-sm text-dealer-error">{saveError}</p> : null}
      <div className="mt-4">
        <PrimaryButton onClick={() => void save()} disabled={disabled || saving}>
          {saving ? 'Saving…' : 'Save'}
        </PrimaryButton>
      </div>
    </DeliveryCard>
  );
}

function IotCard({
  fileId,
  formData,
  done,
  disabled,
  onSave,
}: {
  fileId: string;
  formData: FormData;
  done: boolean;
  disabled: boolean;
  onSave: (patch: FormData) => Promise<void>;
}) {
  const vehicleChassis = readText(formData, VEHICLE_CHASSIS_KEY);
  const [deviceId, setDeviceId] = useState(readText(formData, IOT_KEYS.deviceId));
  const [chassis, setChassis] = useState(
    readText(formData, IOT_KEYS.chassisNumber) || vehicleChassis
  );
  const [photoUrl, setPhotoUrl] = useState(readText(formData, IOT_KEYS.devicePhoto));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const detectorCtor = getBarcodeDetectorCtor();

  useEffect(() => {
    if (!chassis && vehicleChassis) setChassis(vehicleChassis);
  }, [vehicleChassis, chassis]);

  const scan = async (file: File | null) => {
    if (!file || !detectorCtor) return;
    setBusy(true);
    setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const found = await new detectorCtor().detect(bitmap);
      const value = found.find((b) => b.rawValue)?.rawValue;
      if (!value) {
        setError('No barcode found. Try again or type the device ID.');
      } else {
        setDeviceId(normalizeIotDeviceId(value));
      }
    } catch (err) {
      setError(errorMessage(err, 'Scan failed. Type the device ID instead.'));
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      setPhotoUrl(await uploadToUrl(file, `iot_${fileId}.${ext}`));
    } catch (err) {
      setError(errorMessage(err, 'Could not upload the device photo.'));
    } finally {
      setBusy(false);
    }
  };

  const link = async () => {
    const idError = validateIotDeviceId(deviceId);
    const chassisError = validateChassisNumber(chassis, vehicleChassis);
    if (idError || chassisError) {
      setError(idError || chassisError || '');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        [IOT_KEYS.deviceId]: normalizeIotDeviceId(deviceId),
        [IOT_KEYS.chassisNumber]: normalizeChassis(chassis),
        [IOT_KEYS.devicePhoto]: photoUrl,
        [IOT_KEYS.taggedAt]: new Date().toISOString(),
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not link the device.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeliveryCard title="IoT tagging" done={done} testId="delivery-card-iot">
      <div className="space-y-3">
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor="iot-device-id">
            IoT device ID / IMEI <span className="text-dealer-error">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="iot-device-id"
              type="text"
              value={deviceId}
              disabled={disabled || busy}
              onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
              className={INPUT_CLASS}
              autoComplete="off"
            />
            {detectorCtor ? (
              <label className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[12px] border border-dealer-border px-4 py-2.5 text-sm font-semibold text-dealer-navy">
                Scan
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={disabled || busy}
                  onChange={(e) => {
                    void scan(e.target.files?.[0] || null);
                    e.target.value = '';
                  }}
                  data-testid="iot-scan-input"
                />
              </label>
            ) : null}
          </div>
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor="iot-chassis">
            Chassis number <span className="text-dealer-error">*</span>
          </label>
          <input
            id="iot-chassis"
            type="text"
            value={chassis}
            disabled={disabled || busy}
            onChange={(e) => setChassis(e.target.value.toUpperCase())}
            className={INPUT_CLASS}
            autoComplete="off"
          />
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor="iot-photo">
            Device photo (optional)
          </label>
          <input
            id="iot-photo"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled || busy}
            onChange={(e) => {
              void uploadPhoto(e.target.files?.[0] || null);
              e.target.value = '';
            }}
            className="block w-full text-sm"
          />
          {photoUrl ? <p className="mt-1 text-xs text-dealer-success">✓ Photo uploaded</p> : null}
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-dealer-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4">
        <PrimaryButton onClick={() => void link()} disabled={disabled || busy}>
          {busy ? 'Working…' : 'Link device'}
        </PrimaryButton>
      </div>
    </DeliveryCard>
  );
}

const CHASSIS_FIELD: B2cEvFieldDef = {
  key: VEHICLE_CHASSIS_KEY,
  label: 'Chassis Number (17 characters)',
  type: 'text',
};

function validateOptionalChassis(draft: FormData): Record<string, string> {
  const value = readText(draft, VEHICLE_CHASSIS_KEY);
  if (!value) return {};
  const err = validateChassisNumber(value);
  return err ? { [VEHICLE_CHASSIS_KEY]: err } : {};
}

const VEHICLE_EXTRA_FIELDS = [CHASSIS_FIELD];

const CARD_LABELS: Record<CardId, string> = {
  geo: 'Geo-tagged photos',
  insurance: 'Insurance',
  vehicle: 'Vehicle',
  iot: 'IoT tagging',
};

export const DealerDeliveryPage: React.FC = () => {
  const { fileId = '' } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recordId, setRecordId] = useState('');
  const [formData, setFormData] = useState<FormData>({});
  const [missedBanner, setMissedBanner] = useState(false);
  const [expressSubmitError, setExpressSubmitError] = useState('');
  const [expressSubmitStop, setExpressSubmitStop] = useState(false);

  const formDataRef = useRef<FormData>({});
  const recordIdRef = useRef('');
  const deadlineInFlight = useRef(false);

  const userName =
    user?.name ||
    (user?.email
      ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      : '');

  const applyFormData = useCallback((next: FormData) => {
    formDataRef.current = next;
    setFormData(next);
  }, []);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const formula = `{File ID} = '${fileId.replace(/'/g, "\\'")}'`;
        const res = await airtableGet({ table: LOAN_TABLE, filter_formula: formula });
        const record: AirtableFlatRecord | undefined = res.records?.[0];
        if (!record || !record.id) throw new Error('Application not found.');
        if (cancelled) return;
        recordIdRef.current = String(record.id);
        setRecordId(String(record.id));
        const loaded = parseFormDataField(readAirtableField(record, 'Form Data'));
        applyFormData(loaded);
        const flushed = await flushCrm(loaded, {
          fileKey: fileId,
          applicantName: readText(loaded, 'borrower.customerName'),
          applicantMobile: readText(loaded, 'borrower.mobile'),
          writeFormData: async (next) => {
            await airtableWrite({
              table: LOAN_TABLE,
              record_id: String(record.id),
              fields: {
                'Form Data': JSON.stringify(next),
                'Last Updated': new Date().toISOString(),
              },
            });
          },
        });
        if (!cancelled) applyFormData(flushed);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Could not load this application.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [fileId, applyFormData]);

  const done = useMemo(() => computeDone(formData), [formData]);
  const allDone = done.geo && done.insurance && done.vehicle && done.iot;
  const completedAt = readText(formData, DELIVERY_COMPLETED_KEY);
  const deliveryComplete = Boolean(completedAt) && allDone;
  const unlocked = isSigningSent(formData);
  const interactionDisabled = !unlocked || deliveryComplete;

  const commit = useCallback(
    async (patch: FormData) => {
      if (!recordIdRef.current) throw new Error('Application is not loaded yet.');
      let next: FormData = { ...formDataRef.current, ...patch };
      const nextDone = computeDone(next);
      const becomingComplete =
        nextDone.geo &&
        nextDone.insurance &&
        nextDone.vehicle &&
        nextDone.iot &&
        !readText(next, DELIVERY_COMPLETED_KEY);

      if (becomingComplete) {
        const now = new Date().toISOString();
        const deadline = readDeadlineMeta(next);
        next = {
          ...next,
          [DELIVERY_COMPLETED_KEY]: now,
          ...(deadline ? { '_meta.deadline': { ...deadline, completed_at: now } } : {}),
        };

        // Express submit once when Delivery is complete (insurance/vehicle/geo present).
        const submitRes = await apiService.submitApplication(recordIdRef.current, {
          formData: next,
          applicantName: String(next['borrower.customerName'] || '').trim() || undefined,
          productId: String(next.loan_product_id || next.loanProductId || '').trim() || undefined,
          requestedLoanAmount:
            typeof next['loan.amount'] === 'number' || typeof next['loan.amount'] === 'string'
              ? next['loan.amount']
              : undefined,
        });
        if (!submitRes.success) {
          const missing = Array.isArray(submitRes.data?.missingFields)
            ? submitRes.data!.missingFields!
                .map((f) => f.label || f.fieldId)
                .join(', ')
            : '';
          const formats = Array.isArray(submitRes.data?.formatErrors)
            ? submitRes.data!.formatErrors!.map((f) => f.message).join('; ')
            : '';
          const detail = [submitRes.error, missing && `Missing: ${missing}`, formats]
            .filter(Boolean)
            .join(' | ');
          setExpressSubmitError(detail || 'Express submit rejected');
          setExpressSubmitStop(true);
          throw new Error(detail || 'Express submit rejected');
        }
        setExpressSubmitError('');
        setExpressSubmitStop(false);
      }

      await airtableWrite({
        table: LOAN_TABLE,
        record_id: recordIdRef.current,
        fields: {
          'Form Data': JSON.stringify(next),
          'Last Updated': new Date().toISOString(),
        },
      });
      applyFormData(next);
    },
    [applyFormData]
  );

  const checkDeadline = useCallback(async () => {
    const current = formDataRef.current;
    const deadline = readDeadlineMeta(current);
    if (!deadline || deadline.completed_at) return;
    if (readText(current, DELIVERY_COMPLETED_KEY)) return;
    const now = Date.now();
    const expired = now > Date.parse(deadline.deadline_at);
    const pendingFlag = Boolean(deadline.flag_pending);
    const msLeft = remainingMs(deadline.deadline_at, new Date(now));
    const pending = (Object.keys(CARD_LABELS) as CardId[])
      .filter((id) => !computeDone(current)[id])
      .map((id) => CARD_LABELS[id])
      .join(', ');

    if (!expired && msLeft > 0 && msLeft < 2 * 60 * 60 * 1000) {
      // Once per deadline window (keyed by missed_count).
      const reminded = await fireEvent('DEADLINE_REMINDER', {
        summary: `Under 2 hours left. Pending: ${pending || 'none'}`,
        fileKey: fileId,
        n: (deadline.missed_count || 0) + 1,
        formData: current,
        applicantName: readText(current, 'borrower.customerName'),
        applicantMobile: readText(current, 'borrower.mobile'),
        writeFormData: async (next) => {
          if (!recordIdRef.current) return;
          await airtableWrite({
            table: LOAN_TABLE,
            record_id: recordIdRef.current,
            fields: {
              'Form Data': JSON.stringify(next),
              'Last Updated': new Date().toISOString(),
            },
          });
        },
      });
      applyFormData(reminded);
    }

    if (!expired && !pendingFlag) return;
    if (deadlineInFlight.current || !recordIdRef.current) return;
    deadlineInFlight.current = true;
    try {
      const result = await ensureDeadlineMissFlag({
        fileId,
        formData: formDataRef.current,
        recordId: recordIdRef.current,
        pendingDetails: `delivery — ${pending || 'none'}`,
      });
      applyFormData(result.formData);
      setMissedBanner(true);
    } finally {
      deadlineInFlight.current = false;
    }
  }, [applyFormData, fileId]);

  useEffect(() => {
    if (loading || loadError || !recordId) return;
    void checkDeadline();
    const id = window.setInterval(() => void checkDeadline(), DEADLINE_CHECK_MS);
    return () => window.clearInterval(id);
  }, [loading, loadError, recordId, checkDeadline]);

  const renderBody = () => {
    if (loading) {
      return (
        <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5">
          <div className="mb-3 flex items-center gap-3 text-sm text-dealer-text">
            <Loader2 className="h-5 w-5 animate-spin text-dealer-navy" aria-hidden />
            Loading application…
          </div>
          <DealerSkeleton />
        </div>
      );
    }
    if (loadError) {
      return (
        <div
          className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5 text-sm text-dealer-error"
          role="alert"
        >
          {loadError}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {missedBanner ? (
          <div
            className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
            data-testid="delivery-deadline-banner"
          >
            The 24-hour delivery deadline was missed. Your KAM has been flagged and a new 24-hour
            window has started. Please finish the pending items below.
          </div>
        ) : null}
        {expressSubmitStop ? (
          <div
            className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
            data-testid="delivery-express-submit-stop"
          >
            STOP: Express submit rejected after Delivery completion.
            {expressSubmitError ? ` ${expressSubmitError}` : ''}
          </div>
        ) : null}

        {!unlocked ? (
          <div
            className="rounded-[12px] border border-dealer-border bg-dealer-surface-soft p-4 text-sm text-dealer-text"
            data-testid="delivery-locked"
          >
            Delivery is locked until the loan documents have been sent for e-signing. Finish the
            post-submit steps first, then return here.
          </div>
        ) : null}

        {deliveryComplete ? (
          <div
            className="rounded-[12px] border border-dealer-success/30 bg-dealer-success/10 p-5"
            data-testid="delivery-success"
          >
            <div className="mb-3 flex items-center gap-2 text-dealer-success">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
              <span className="font-semibold">Delivery complete</span>
            </div>
            <p className="mb-4 text-sm text-dealer-text">
              All delivery steps for {fileId} are done. Thank you!
            </p>
            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={() => navigate('/applications/new')}>
                New Application
              </PrimaryButton>
              <Link
                to="/applications"
                className="inline-flex items-center justify-center rounded-[12px] border border-dealer-border bg-dealer-surface px-4 py-2.5 text-sm font-semibold text-dealer-navy"
              >
                My Applications
              </Link>
            </div>
          </div>
        ) : null}

        <DeliveryCard title="Geo-tagged photos" done={done.geo} testId="delivery-card-geo">
          <div className="space-y-3">
            {B2C_EV_GEO_PHOTO_SLOTS.map((slot) => (
              <GeoSlotEditor
                key={slot.id}
                slot={slot}
                fileId={fileId}
                formData={formData}
                disabled={interactionDisabled}
                onCommit={commit}
              />
            ))}
          </div>
        </DeliveryCard>

        <StageCard
          stage={B2C_EV_INSURANCE_STAGE}
          formData={formData}
          done={done.insurance}
          disabled={interactionDisabled}
          testId="delivery-card-insurance"
          onSave={commit}
        />

        <StageCard
          stage={B2C_EV_VEHICLE_STAGE}
          formData={formData}
          done={done.vehicle}
          disabled={interactionDisabled}
          testId="delivery-card-vehicle"
          extraFields={VEHICLE_EXTRA_FIELDS}
          extraValidate={validateOptionalChassis}
          onSave={commit}
        />

        <IotCard
          fileId={fileId}
          formData={formData}
          done={done.iot}
          disabled={interactionDisabled}
          onSave={commit}
        />
      </div>
    );
  };

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Delivery"
      userRole={user?.role?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={userName}
    >
      <div className="post-submit-engine min-h-[60vh] bg-dealer-surface">
        <div className="w-full">
          <JourneyRail
            currentStepId={
              deliveryComplete
                ? 'iot'
                : !done.geo
                  ? 'photos'
                  : !done.insurance
                    ? 'insurance'
                    : !done.vehicle
                      ? 'vehicle'
                      : 'iot'
            }
          />
          <PageHeader
            phase="Delivery"
            title="Delivery"
            helper=""
            fileId={fileId || undefined}
            saveLabel=""
            formData={formData}
          />
          <div className="pt-4">{renderBody()}</div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DealerDeliveryPage;
