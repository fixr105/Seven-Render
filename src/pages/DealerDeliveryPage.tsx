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
import {
  deliveryBanner,
  deliveryLockReason,
  isDoFulfilled,
  isLoanPackSigned,
} from '../lib/b2cEvDoRequest';
import {
  DELIVERY_COMPLETED_AT,
  DELIVERY_FIELD_LABELS,
  DELIVERY_SUBMITTED_AT,
  INSURANCE_SAVED_AT,
  VEHICLE_SAVED_AT,
  deliveryFieldLabel,
  isInsuranceDone,
  isVehicleDone,
  validateInsuranceFields,
  validateVehicleFields,
} from '../lib/deliveryFieldRules';
import { stampGeoPhoto } from '../lib/geoPhotoStamp';
import { indiaLocationError, parseMapsLinkOrCoords } from '../lib/mapsLinkParser';
import { normalizeChassis, normalizeIotDeviceId, validateIotDeviceId } from '../lib/iotTagging';
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
import { repairComplianceFlags } from '../lib/kamComplianceConfirm';
import { getSubmitBlockers } from '../lib/submitReadiness';
import { StampsAndSigningBlock } from '../components/applications/StampsAndSigningBlock';

const LOAN_TABLE = 'Loan Applications';
const DEADLINE_CHECK_MS = 30_000;
const DRAFT_FLUSH_MS = 2_000;
const VEHICLE_CHASSIS_KEY = 'vehicle.chassisNumber';
const LOCATION_UNAVAILABLE =
  'Could not read your location. Paste a Google Maps link or type the coordinates.';
const PHOTO_NOT_SAVED = 'Not saved until you tap Use this photo.';
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
type DraftStatus = 'idle' | 'saving' | 'saved' | 'error';
type GeoSource = '' | 'device' | 'pasted';

type BarcodeDetectorLike = {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const CHASSIS_FIELD: B2cEvFieldDef = {
  key: VEHICLE_CHASSIS_KEY,
  label: 'Chassis Number (17 characters)',
  type: 'text',
  required: true,
};

const CARD_LABELS: Record<CardId, string> = {
  geo: 'Geo-tagged photos',
  insurance: 'Insurance',
  vehicle: 'Vehicle details',
  iot: 'IoT tagging',
};

function readText(formData: FormData, key: string): string {
  const value = formData[key];
  return value == null ? '' : String(value).trim();
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

function computeDone(formData: FormData): Record<CardId, boolean> {
  return {
    geo: B2C_EV_GEO_PHOTO_SLOTS.every((slot) => isGeoPhotoSlotComplete(formData, slot)),
    insurance: isInsuranceDone(formData),
    vehicle: isVehicleDone(formData),
    iot:
      Boolean(readText(formData, IOT_KEYS.deviceId)) &&
      Boolean(readText(formData, IOT_KEYS.chassisNumber)) &&
      Boolean(readText(formData, IOT_KEYS.taggedAt)),
  };
}

function saveStatusLabel(status: DraftStatus): string {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Saved';
  return 'Not saved';
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

function explainSubmitFailure(result: {
  error?: string;
  data?: {
    missingFields?: Array<{ fieldId: string; label?: string }>;
    formatErrors?: Array<{ message?: string }>;
  };
}): string {
  const missing = (result.data?.missingFields || [])
    .map((field) => deliveryFieldLabel(field.fieldId, field.label || field.fieldId))
    .filter(Boolean)
    .join(', ');
  const formats = (result.data?.formatErrors || [])
    .map((field) => field.message || '')
    .filter(Boolean)
    .join('; ');
  const detail = [result.error, missing ? `Missing: ${missing}` : '', formats].filter(Boolean).join(' ');
  return `Could not submit the delivery. ${detail || 'Please try again.'}`;
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
  lockedReason,
  onOpenStamps,
  children,
}: {
  title: string;
  done: boolean;
  testId: string;
  lockedReason?: string | null;
  onOpenStamps?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[12px] border border-dealer-border bg-dealer-surface p-5 ${
        lockedReason ? 'opacity-60' : ''
      }`}
      data-testid={testId}
      data-done={done ? 'true' : 'false'}
      data-locked={lockedReason ? 'true' : 'false'}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold leading-snug text-dealer-navy">{title}</h2>
        <StatusChip done={done} />
      </div>
      {lockedReason ? (
        <div className="space-y-2">
          <p className="text-sm text-dealer-text">{lockedReason}</p>
          {onOpenStamps ? (
            <button
              type="button"
              className="text-sm font-semibold text-dealer-navy underline"
              data-testid={`${testId}-open-stamps`}
              onClick={onOpenStamps}
            >
              Open stamps and signing
            </button>
          ) : null}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
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
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
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
  source: GeoSource;
  locationNote: string;
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
  source: '',
  locationNote: '',
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

  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      patchDraft({ error: LOCATION_UNAVAILABLE, source: '', locationNote: '' });
      return;
    }
    patchDraft({ busy: true, error: '' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const outside = indiaLocationError(lat, lng);
        if (outside) {
          patchDraft({ busy: false, error: outside, source: '', locationNote: '' });
          return;
        }
        const accuracy = Math.round(position.coords.accuracy || 0);
        patchDraft({
          busy: false,
          error: '',
          source: 'device',
          lat,
          lng,
          mapsLink: '',
          locationNote: `Location captured (±${accuracy} m)`,
        });
      },
      () => {
        patchDraft({ busy: false, error: LOCATION_UNAVAILABLE, source: '', locationNote: '' });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  };

  const buildPreview = async () => {
    if (!draft.file) {
      patchDraft({ error: 'Take or choose a photo first.' });
      return;
    }
    let lat = draft.lat;
    let lng = draft.lng;
    let source: GeoSource = draft.source;
    if (source !== 'device') {
      const parsed = parseMapsLinkOrCoords(draft.mapsLink);
      if (parsed.ok === false) {
        patchDraft({ error: parsed.error });
        return;
      }
      lat = parsed.lat;
      lng = parsed.lng;
      source = 'pasted';
    } else {
      const outside = indiaLocationError(lat, lng);
      if (outside) {
        patchDraft({ error: outside });
        return;
      }
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
        lat,
        lng,
        fileId,
        slotLabel: slot.label,
        capturedAt,
      });
      revokePreview();
      previewRef.current = URL.createObjectURL(blob);
      patchDraft({
        blob,
        previewUrl: previewRef.current,
        lat,
        lng,
        source,
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
    if (!draft.blob || !draft.source) return;
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
          source: draft.source,
        },
      });
      reset();
      setReplacing(false);
    } catch (err) {
      patchDraft({ busy: false, error: errorMessage(err, 'Could not save the photo.') });
    }
  };

  const showEditor = !disabled && (!complete || replacing);

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
          {disabled ? null : (
            <OutlineButton onClick={() => setReplacing(true)} disabled={disabled}>
              Replace
            </OutlineButton>
          )}
        </div>
      ) : null}

      {showEditor && !draft.previewUrl ? (
        <div className="space-y-3">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled || draft.busy}
            onChange={(event) => {
              patchDraft({ file: event.target.files?.[0] || null, error: '' });
              event.target.value = '';
            }}
            className="block w-full text-sm"
            data-testid={`geo-file-${slot.id}`}
          />
          {draft.file ? <p className="truncate text-xs text-dealer-text-quiet">{draft.file.name}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={draft.mapsLink}
              onChange={(event) =>
                patchDraft({
                  mapsLink: event.target.value,
                  error: '',
                  source: 'pasted',
                  locationNote: '',
                })
              }
              placeholder="Paste Google Maps link or coordinates"
              disabled={disabled || draft.busy}
              className={INPUT_CLASS}
              data-testid={`geo-maps-${slot.id}`}
            />
            <OutlineButton
              onClick={useCurrentLocation}
              disabled={disabled || draft.busy}
              testId={`geo-locate-${slot.id}`}
            >
              Use my current location
            </OutlineButton>
          </div>
          {draft.locationNote ? (
            <p className="text-xs text-dealer-success" data-testid={`geo-location-note-${slot.id}`}>
              {draft.locationNote}
            </p>
          ) : null}
          <PrimaryButton onClick={() => void buildPreview()} disabled={disabled || draft.busy}>
            {draft.busy ? 'Stamping…' : 'Preview stamped photo'}
          </PrimaryButton>
          <p className="text-xs text-dealer-text-quiet">{PHOTO_NOT_SAVED}</p>
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
            <PrimaryButton
              onClick={() => void uploadStampedPhoto()}
              disabled={draft.busy}
              testId={`geo-use-${slot.id}`}
            >
              {draft.busy ? 'Uploading…' : 'Use this photo'}
            </PrimaryButton>
          </div>
          <p className="text-xs text-dealer-text-quiet">{PHOTO_NOT_SAVED}</p>
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
  onBlur,
}: {
  field: B2cEvFieldDef;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
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
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={INPUT_CLASS}
      />
      {error ? <p className={FIELD_ERROR_CLASS}>{error}</p> : null}
    </div>
  );
}

function readDraft(formData: FormData, fields: B2cEvFieldDef[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, readText(formData, field.key)]));
}

function StageCard({
  stage,
  formData,
  done,
  readOnly,
  testId,
  extraFields,
  savedAtKey,
  onSave,
  onDraftStatus,
}: {
  stage: B2cEvStage;
  formData: FormData;
  done: boolean;
  readOnly: boolean;
  testId: string;
  extraFields?: B2cEvFieldDef[];
  savedAtKey: string;
  onSave: (patch: FormData | (() => FormData)) => Promise<void>;
  onDraftStatus: (status: DraftStatus) => void;
}) {
  const fields = useMemo(() => [...stage.fields, ...(extraFields || [])], [stage.fields, extraFields]);
  const [draft, setDraft] = useState<Record<string, string>>(() => readDraft(formData, fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const draftRef = useRef(draft);
  const dirtyRef = useRef(new Set<string>());
  const persistedRef = useRef(readDraft(formData, fields));
  const timerRef = useRef<number | null>(null);
  const onSaveRef = useRef(onSave);
  const onStatusRef = useRef(onDraftStatus);
  onSaveRef.current = onSave;
  onStatusRef.current = onDraftStatus;

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const flushDraft = useCallback(async () => {
    clearTimer();
    if (dirtyRef.current.size === 0) return;
    onStatusRef.current('saving');
    const claimed: FormData = {};
    try {
      await onSaveRef.current(() => {
        for (const key of [...dirtyRef.current]) {
          claimed[key] = draftRef.current[key] ?? '';
          dirtyRef.current.delete(key);
        }
        return claimed;
      });
      for (const key of Object.keys(claimed)) {
        persistedRef.current[key] = String(claimed[key] ?? '');
        if ((draftRef.current[key] ?? '') !== persistedRef.current[key]) dirtyRef.current.add(key);
      }
      onStatusRef.current(dirtyRef.current.size > 0 ? 'saving' : 'saved');
      if (dirtyRef.current.size > 0) scheduleFlush();
    } catch {
      for (const key of Object.keys(claimed)) dirtyRef.current.add(key);
      onStatusRef.current('error');
    }
  }, []);

  const scheduleFlush = () => {
    if (timerRef.current != null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushDraft();
    }, DRAFT_FLUSH_MS);
  };

  useEffect(() => clearTimer, []);

  const changeField = (key: string, value: string) => {
    draftRef.current = { ...draftRef.current, [key]: value };
    setDraft(draftRef.current);
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if ((persistedRef.current[key] ?? '') === value) dirtyRef.current.delete(key);
    else dirtyRef.current.add(key);
    if (dirtyRef.current.size > 0) scheduleFlush();
  };

  const save = async () => {
    clearTimer();
    const trimmed: FormData = {};
    for (const field of fields) {
      const raw = (draftRef.current[field.key] ?? '').trim();
      trimmed[field.key] =
        field.key === VEHICLE_CHASSIS_KEY ? normalizeChassis(raw) : raw;
    }
    const found =
      stage.id === 'vehicle'
        ? validateVehicleFields(trimmed)
        : validateInsuranceFields(trimmed);
    setErrors(found);
    setSaveError('');
    if (Object.keys(found).length > 0) {
      const first = fields.find((field) => found[field.key]);
      if (first) document.getElementById(`delivery-${first.key}`)?.focus();
      return;
    }
    dirtyRef.current.clear();
    const stored = Object.fromEntries(
      fields.map((field) => [field.key, String(trimmed[field.key] ?? '')])
    );
    draftRef.current = stored;
    setDraft(stored);
    persistedRef.current = stored;
    setSaving(true);
    onDraftStatus('saving');
    try {
      await onSave({
        ...trimmed,
        [savedAtKey]: new Date().toISOString(),
      });
      onDraftStatus('saved');
    } catch (err) {
      onDraftStatus('error');
      setSaveError(errorMessage(err, 'Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DeliveryCard title={stage.title} done={done} testId={testId}>
      {readOnly ? (
        <dl className="space-y-2">
          {fields.map((field) => (
            <div key={field.key}>
              <dt className="text-xs text-dealer-text-quiet">{field.label}</dt>
              <dd className="text-sm text-dealer-text">{readText(formData, field.key) || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <div className="space-y-3">
            {fields.map((field) => (
              <StageFieldInput
                key={field.key}
                field={field}
                value={draft[field.key] ?? ''}
                error={errors[field.key]}
                disabled={saving}
                onChange={(value) => changeField(field.key, value)}
                onBlur={() => {
                  if (dirtyRef.current.size > 0) void flushDraft();
                }}
              />
            ))}
          </div>
          {saveError ? <p className="mt-3 text-sm text-dealer-error">{saveError}</p> : null}
          <div className="mt-4">
            <PrimaryButton onClick={() => void save()} disabled={saving} testId={`${testId}-save`}>
              {saving ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        </>
      )}
    </DeliveryCard>
  );
}

function IotCard({
  fileId,
  formData,
  done,
  readOnly,
  onSave,
}: {
  fileId: string;
  formData: FormData;
  done: boolean;
  readOnly: boolean;
  onSave: (patch: FormData) => Promise<void>;
}) {
  const vehicleChassis = readText(formData, VEHICLE_CHASSIS_KEY);
  const [deviceId, setDeviceId] = useState(readText(formData, IOT_KEYS.deviceId));
  const [photoUrl, setPhotoUrl] = useState(readText(formData, IOT_KEYS.devicePhoto));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const detectorCtor = getBarcodeDetectorCtor();

  const scan = async (file: File | null) => {
    if (!file || !detectorCtor) return;
    setBusy(true);
    setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const found = await new detectorCtor().detect(bitmap);
      const value = found.find((barcode) => barcode.rawValue)?.rawValue;
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
      const url = await uploadToUrl(file, `iot_${fileId}.${ext}`);
      setPhotoUrl(url);
      await onSave({ [IOT_KEYS.devicePhoto]: url });
    } catch (err) {
      setError(errorMessage(err, 'Could not upload the device photo.'));
    } finally {
      setBusy(false);
    }
  };

  const link = async () => {
    const idError = validateIotDeviceId(deviceId);
    const chassis = normalizeChassis(vehicleChassis);
    if (idError || chassis.length !== 17) {
      setError(idError || 'Enter the 17-character chassis number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        [IOT_KEYS.deviceId]: normalizeIotDeviceId(deviceId),
        [IOT_KEYS.chassisNumber]: chassis,
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
      {readOnly ? (
        <dl className="space-y-2">
          <div>
            <dt className="text-xs text-dealer-text-quiet">IoT device ID / IMEI</dt>
            <dd className="text-sm text-dealer-text">{readText(formData, IOT_KEYS.deviceId) || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-dealer-text-quiet">Chassis number</dt>
            <dd className="text-sm text-dealer-text">{readText(formData, IOT_KEYS.chassisNumber) || '—'}</dd>
          </div>
        </dl>
      ) : (
        <>
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
                  disabled={busy}
                  onChange={(event) => setDeviceId(event.target.value.toUpperCase())}
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
                      disabled={busy}
                      onChange={(event) => {
                        void scan(event.target.files?.[0] || null);
                        event.target.value = '';
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
                value={vehicleChassis}
                readOnly
                className={INPUT_CLASS}
                data-testid="iot-chassis"
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
                disabled={busy}
                onChange={(event) => {
                  void uploadPhoto(event.target.files?.[0] || null);
                  event.target.value = '';
                }}
                className="block w-full text-sm"
                data-testid="iot-photo-input"
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
            <PrimaryButton onClick={() => void link()} disabled={busy} testId="iot-link">
              {busy ? 'Working…' : 'Link device'}
            </PrimaryButton>
          </div>
        </>
      )}
    </DeliveryCard>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[220px_1fr] sm:gap-3">
      <dt className="text-xs text-dealer-text-quiet">{label}</dt>
      <dd className="text-sm text-dealer-text">{value || '—'}</dd>
    </div>
  );
}

function CompleteDelivery({
  formData,
  blockers,
  confirming,
  error,
  busy,
  onAsk,
  onConfirm,
}: {
  formData: FormData;
  blockers: string[];
  confirming: boolean;
  error: string;
  busy: boolean;
  onAsk: () => void;
  onConfirm: () => void;
}) {
  const name = readText(formData, 'borrower.customerName');
  const insuranceKeys = B2C_EV_INSURANCE_STAGE.fields.map((field) => field.key);
  const vehicleKeys = [...B2C_EV_VEHICLE_STAGE.fields.map((field) => field.key), VEHICLE_CHASSIS_KEY];
  return (
    <section
      className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5"
      data-testid="delivery-complete-block"
    >
      <h2 className="mb-4 text-sm font-semibold text-dealer-navy">Complete delivery</h2>
      <dl className="space-y-3">
        {insuranceKeys.map((key) => (
          <ReviewRow key={key} label={DELIVERY_FIELD_LABELS[key]} value={readText(formData, key)} />
        ))}
        {vehicleKeys.map((key) => (
          <ReviewRow key={key} label={DELIVERY_FIELD_LABELS[key]} value={readText(formData, key)} />
        ))}
      </dl>
      <div className="mt-4 space-y-3">
        {B2C_EV_GEO_PHOTO_SLOTS.map((slot) => (
          <div key={slot.id} className="flex items-center gap-3">
            <img
              src={readText(formData, slot.urlKey)}
              alt={slot.label}
              className="h-16 w-16 rounded-[8px] border border-dealer-border object-cover"
            />
            <p className="text-xs text-dealer-text">
              {slot.label}
              <br />
              {readText(formData, slot.latitudeKey)}, {readText(formData, slot.longitudeKey)}
            </p>
          </div>
        ))}
      </div>
      <dl className="mt-4 space-y-3">
        <ReviewRow label="IoT device ID / IMEI" value={readText(formData, IOT_KEYS.deviceId)} />
        <ReviewRow label="Chassis number" value={readText(formData, IOT_KEYS.chassisNumber)} />
      </dl>
      {blockers.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-dealer-text" data-testid="delivery-submit-blockers">
          {blockers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-dealer-error" role="alert" data-testid="delivery-submit-error">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {confirming ? (
          <>
            <p className="w-full text-sm text-dealer-text" data-testid="delivery-submit-confirm">
              Submit this delivery for {name}? You will not be able to edit it afterwards.
            </p>
            <PrimaryButton
              onClick={onConfirm}
              disabled={busy || blockers.length > 0}
              testId="delivery-submit-confirm-button"
            >
              {busy ? 'Submitting…' : 'Confirm'}
            </PrimaryButton>
          </>
        ) : error ? (
          <PrimaryButton onClick={onAsk} disabled={busy || blockers.length > 0} testId="delivery-submit-retry">
            Try again
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={onAsk} disabled={busy || blockers.length > 0} testId="delivery-submit-button">
            Complete delivery
          </PrimaryButton>
        )}
      </div>
    </section>
  );
}

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
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stampsOpen, setStampsOpen] = useState(false);

  const formDataRef = useRef<FormData>({});
  const recordIdRef = useRef('');
  const deadlineInFlight = useRef(false);
  const writeChain = useRef(Promise.resolve());
  const submitLock = useRef(false);

  const userName =
    user?.name ||
    (user?.email
      ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : '');

  const applyFormData = useCallback((next: FormData) => {
    formDataRef.current = next;
    setFormData(next);
  }, []);

  const saveFormData = useCallback(
    (patchOrRead: FormData | (() => FormData)) => {
      const run = writeChain.current.then(async () => {
        if (!recordIdRef.current) throw new Error('Application is not loaded yet.');
        const patch = typeof patchOrRead === 'function' ? patchOrRead() : patchOrRead;
        if (Object.keys(patch).length === 0) return;
        const next: FormData = { ...formDataRef.current, ...patch };
        await airtableWrite({
          table: LOAN_TABLE,
          record_id: recordIdRef.current,
          fields: {
            'Form Data': JSON.stringify(next),
            'Last Updated': new Date().toISOString(),
          },
        });
        applyFormData(next);
      });
      writeChain.current = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
    [applyFormData]
  );

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
        const repaired = repairComplianceFlags(loaded);
        if (repaired.changed) {
          await airtableWrite({
            table: LOAN_TABLE,
            record_id: String(record.id),
            fields: {
              'Form Data': JSON.stringify(repaired.formData),
              'Last Updated': new Date().toISOString(),
            },
          });
        }
        applyFormData(repaired.formData);
        const flushed = await flushCrm(repaired.formData, {
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
  const submittedAt = readText(formData, DELIVERY_SUBMITTED_AT);
  const completedAt = readText(formData, DELIVERY_COMPLETED_AT);
  const deliveryComplete = Boolean(submittedAt) || (Boolean(completedAt) && allDone);
  const vehicleDone = done.vehicle;
  const banner = deliveryBanner(formData);
  const insuranceReason = deliveryLockReason(formData, 'insurance', vehicleDone);
  const vehicleReason = deliveryLockReason(formData, 'vehicle', vehicleDone);
  const photoReason = deliveryLockReason(formData, 'geo', vehicleDone);
  const iotReason = deliveryLockReason(formData, 'iot', vehicleDone);

  const writeCompletion = useCallback(async () => {
    const now = new Date().toISOString();
    const deadline = readDeadlineMeta(formDataRef.current);
    await saveFormData({
      [DELIVERY_COMPLETED_AT]: now,
      [DELIVERY_SUBMITTED_AT]: now,
      ...(deadline ? { '_meta.deadline': { ...deadline, completed_at: now } } : {}),
    });
  }, [saveFormData]);

  const confirmSubmit = useCallback(async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      if (readText(formDataRef.current, DELIVERY_SUBMITTED_AT)) {
        setConfirming(false);
        return;
      }
      if (getSubmitBlockers(formDataRef.current).length > 0) {
        setConfirming(false);
        return;
      }
      const current = await apiService.getApplication(recordIdRef.current);
      if (!current.success || !current.data) {
        setSubmitError(
          `Could not submit the delivery. ${current.error || 'Could not read the application.'}`
        );
        setConfirming(false);
        return;
      }
      const status = String(current.data.status || current.data.Status || '')
        .trim()
        .toLowerCase();
      if (status && status !== 'draft' && status !== 'query_with_client') {
        await writeCompletion();
        setConfirming(false);
        return;
      }
      const next = formDataRef.current;
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
        setSubmitError(explainSubmitFailure(submitRes));
        setConfirming(false);
        return;
      }
      await writeCompletion();
      setConfirming(false);
    } catch (err) {
      setSubmitError(`Could not submit the delivery. ${errorMessage(err, 'Please try again.')}`);
      setConfirming(false);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [writeCompletion]);

  const checkDeadline = useCallback(async () => {
    const current = formDataRef.current;
    const deadline = readDeadlineMeta(current);
    if (!deadline || deadline.completed_at) return;
    if (readText(current, DELIVERY_COMPLETED_AT)) return;
    const now = Date.now();
    const expired = now > Date.parse(deadline.deadline_at);
    const pendingFlag = Boolean(deadline.flag_pending);
    const msLeft = remainingMs(deadline.deadline_at, new Date(now));
    const pending = (Object.keys(CARD_LABELS) as CardId[])
      .filter((id) => !computeDone(current)[id])
      .map((id) => CARD_LABELS[id])
      .join(', ');

    if (!expired && msLeft > 0 && msLeft < 2 * 60 * 60 * 1000) {
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

    const showComplete = isDoFulfilled(formData) && !deliveryComplete;
    const blockers = getSubmitBlockers(formData);
    const openStamps = () => {
      setStampsOpen(true);
      document.getElementById('stamps-and-signing')?.scrollIntoView({ block: 'start' });
    };

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

        <div
          className="rounded-[12px] border border-dealer-border bg-dealer-surface-soft p-4 text-sm text-dealer-text"
          data-testid="delivery-banner"
        >
          {banner}
        </div>

        {!isLoanPackSigned(formData) ? (
          <StampsAndSigningBlock
            fileId={fileId}
            formData={formData}
            open={stampsOpen}
            onOpen={() => setStampsOpen(true)}
            onPersist={async (next) => {
              const patch: FormData = {};
              for (const [key, value] of Object.entries(next)) {
                if (formDataRef.current[key] !== value) patch[key] = value;
              }
              await saveFormData(patch);
            }}
          />
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
              <PrimaryButton onClick={() => navigate('/applications/new')}>New Application</PrimaryButton>
              <Link
                to="/applications"
                className="inline-flex items-center justify-center rounded-[12px] border border-dealer-border bg-dealer-surface px-4 py-2.5 text-sm font-semibold text-dealer-navy"
              >
                My Applications
              </Link>
            </div>
          </div>
        ) : null}

        {insuranceReason ? (
          <DeliveryCard
            title="Insurance"
            done={done.insurance}
            testId="delivery-card-insurance"
            lockedReason={insuranceReason}
          />
        ) : (
          <StageCard
            stage={B2C_EV_INSURANCE_STAGE}
            formData={formData}
            done={done.insurance}
            readOnly={deliveryComplete}
            testId="delivery-card-insurance"
            savedAtKey={INSURANCE_SAVED_AT}
            onSave={saveFormData}
            onDraftStatus={setDraftStatus}
          />
        )}

        {vehicleReason ? (
          <DeliveryCard
            title="Vehicle details"
            done={done.vehicle}
            testId="delivery-card-vehicle"
            lockedReason={vehicleReason}
          />
        ) : (
          <StageCard
            stage={{ ...B2C_EV_VEHICLE_STAGE, title: 'Vehicle details' }}
            formData={formData}
            done={done.vehicle}
            readOnly={deliveryComplete}
            testId="delivery-card-vehicle"
            extraFields={[CHASSIS_FIELD]}
            savedAtKey={VEHICLE_SAVED_AT}
            onSave={saveFormData}
            onDraftStatus={setDraftStatus}
          />
        )}

        {photoReason ? (
          <DeliveryCard
            title="Geo-tagged photos"
            done={done.geo}
            testId="delivery-card-geo"
            lockedReason={photoReason}
            onOpenStamps={!isLoanPackSigned(formData) && isDoFulfilled(formData) ? openStamps : undefined}
          />
        ) : (
          <DeliveryCard title="Geo-tagged photos" done={done.geo} testId="delivery-card-geo">
            <div className="space-y-3">
              {B2C_EV_GEO_PHOTO_SLOTS.map((slot) => (
                <GeoSlotEditor
                  key={slot.id}
                  slot={slot}
                  fileId={fileId}
                  formData={formData}
                  disabled={deliveryComplete}
                  onCommit={saveFormData}
                />
              ))}
            </div>
          </DeliveryCard>
        )}

        {iotReason ? (
          <DeliveryCard
            title="IoT tagging"
            done={done.iot}
            testId="delivery-card-iot"
            lockedReason={iotReason}
            onOpenStamps={!isLoanPackSigned(formData) && isDoFulfilled(formData) ? openStamps : undefined}
          />
        ) : (
          <IotCard
            fileId={fileId}
            formData={formData}
            done={done.iot}
            readOnly={deliveryComplete}
            onSave={saveFormData}
          />
        )}

        {showComplete ? (
          <CompleteDelivery
            formData={formData}
            blockers={blockers}
            confirming={confirming}
            error={submitError}
            busy={submitting}
            onAsk={() => setConfirming(true)}
            onConfirm={() => void confirmSubmit()}
          />
        ) : null}
      </div>
    );
  };

  const currentStepId = deliveryComplete
    ? 'iot'
    : !done.insurance
      ? 'insurance'
      : !done.vehicle
        ? 'vehicle'
        : !done.geo
          ? 'photos'
          : 'iot';

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
          <JourneyRail currentStepId={currentStepId} />
          <PageHeader
            phase="Delivery"
            title="Delivery"
            helper=""
            fileId={fileId || undefined}
            saveLabel={loading || loadError ? '' : saveStatusLabel(draftStatus)}
            formData={formData}
          />
          <div className="pt-4">{renderBody()}</div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DealerDeliveryPage;
