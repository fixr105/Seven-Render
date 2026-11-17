import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormConfigCategory } from '../../lib/b2cEvDocuments';
import { downscaleImageFile } from '../../lib/downscaleImage';
import { upsertDocumentsFieldEntry } from '../../lib/kycDocumentsString';
import {
  areRequiredKycDocsUploaded,
  buildKycRequiredDocSlots,
  getUploadedDocMap,
  type KycDocSlot,
} from '../../lib/kycRequiredDocs';
import { fireEvent } from '../../lib/crmEvents';
import { formatEngineSetupError } from '../../lib/engineSetupError';
import {
  fetchVkycByFileId,
  isVkycReadyForNext,
  markLoanFileVkycRequested,
  requestVkyc,
  type VkycRow,
} from '../../lib/vkycLinks';
import { openKamComplianceRequest } from '../../lib/b2cEvKamRequest';
import {
  nextVkycPollFailureCount,
  shouldShowVkycStatusCheckError,
  VKYC_STATUS_CHECK_MESSAGE,
} from '../../lib/vkycPollFailures';
import { airtableWrite, uploadToUrl } from '../../services/engineClient';
import { VideoKycCard } from './VideoKycCard';
import { documentOwner, orderDocumentSlots } from '../dealer-ui/documentOwner';
import { PageHeader, saveStatusLabel } from '../dealer-ui/PageHeader';
import { UploadRow } from '../dealer-ui/UploadRow';

const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|pdf)$/i;
const ALLOWED_MIME =
  /^(image\/(jpeg|jpg|png|webp|heic)|application\/pdf)$/i;
const MAX_BYTES = 10 * 1024 * 1024;
const VKYC_POLL_MS = 10_000;

function readString(formData: Record<string, unknown>, key: string): string {
  const v = formData[key];
  if (v == null) return '';
  return String(v).trim();
}

export type KycDocumentsStepProps = {
  formData: Record<string, unknown>;
  formConfig: FormConfigCategory[];
  recordId: string;
  fileId: string;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onFormDataChange: (patch: Record<string, unknown>) => void;
  onDocumentsPersist?: () => Promise<void>;
  onReadyChange?: (ready: boolean) => void;
};

export const KycDocumentsStep: React.FC<KycDocumentsStepProps> = ({
  formData,
  formConfig,
  recordId,
  fileId,
  saveStatus = 'idle',
  onFormDataChange,
  onDocumentsPersist,
  onReadyChange,
}) => {
  const slots = useMemo(
    () => buildKycRequiredDocSlots(formData, formConfig),
    [formData, formConfig]
  );
  const uploads = useMemo(() => getUploadedDocMap(formData), [formData]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [vkycRow, setVkycRow] = useState<VkycRow | null>(null);
  const [vkycBusy, setVkycBusy] = useState(false);
  const [vkycError, setVkycError] = useState<string | null>(null);
  const [vkycPollFailures, setVkycPollFailures] = useState(0);
  const fileIdRef = useRef(fileId);
  const vkycFailedFiredRef = useRef(false);
  const formDataRef = useRef(formData);

  useEffect(() => {
    fileIdRef.current = fileId;
  }, [fileId]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    const block = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  useEffect(() => {
    if (!vkycRow || vkycRow.status !== 'Failed' || vkycFailedFiredRef.current) return;
    vkycFailedFiredRef.current = true;
    const remarks = String(vkycRow.remarks || '').trim() || 'no remarks';
    void fireEvent('VKYC_FAILED', {
      summary: `Video KYC failed: ${remarks}`,
      fileKey: fileId || recordId,
      formData: formDataRef.current,
      applicantName: readString(formDataRef.current, 'borrower.customerName'),
      applicantMobile: readString(formDataRef.current, 'borrower.mobile'),
    }).then((next) => {
      onFormDataChange({ '_meta.crm': next['_meta.crm'] });
    });
  }, [vkycRow, fileId, recordId, onFormDataChange]);

  const docsReady = areRequiredKycDocsUploaded(formData, formConfig);
  const vkycReady = isVkycReadyForNext(vkycRow);
  const stepReady = docsReady && vkycReady;

  useEffect(() => {
    onReadyChange?.(stepReady);
  }, [onReadyChange, stepReady]);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    void fetchVkycByFileId(fileId)
      .then((row) => {
        if (cancelled) return;
        setVkycRow(row);
        setVkycPollFailures(0);
      })
      .catch(() => {
        if (cancelled) return;
        setVkycRow(null);
        setVkycPollFailures((n) => nextVkycPollFailureCount(n, false));
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  useEffect(() => {
    if (!fileId || !vkycRow) return;
    if (vkycRow.status === 'Done' || vkycRow.status === 'Failed') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await fetchVkycByFileId(fileId);
        if (cancelled) return;
        setVkycRow(next);
        setVkycPollFailures(0);
      } catch {
        if (cancelled) return;
        setVkycPollFailures((n) => nextVkycPollFailureCount(n, false));
      }
    };
    const id = window.setInterval(() => void poll(), VKYC_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fileId, vkycRow?.status, vkycRow?.id]);

  const persistDocuments = useCallback(
    async (
      nextUploads: Record<string, { url: string; filename: string }>,
      documentsString: string
    ) => {
      const patch = {
        '_meta.kycDocuments.uploads': nextUploads,
        '_meta.kycDocuments.documentsString': documentsString,
      };
      if (recordId.startsWith('rec')) {
        const merged = { ...formDataRef.current, ...patch };
        await airtableWrite({
          table: 'Loan Applications',
          record_id: recordId,
          fields: {
            Documents: documentsString,
            'Form Data': JSON.stringify(merged),
            'Last Updated': new Date().toISOString(),
          },
        });
      }
      formDataRef.current = { ...formDataRef.current, ...patch };
      onFormDataChange(patch);
      if (!onDocumentsPersist) return;
      try {
        await onDocumentsPersist();
      } catch (err) {
        if (!recordId.startsWith('rec')) throw err;
      }
    },
    [onDocumentsPersist, onFormDataChange, recordId]
  );

  const handleUpload = async (slot: KycDocSlot, file: File | null) => {
    if (!file) return;
    setUploadError((prev) => ({ ...prev, [slot.fieldId]: '' }));
    // Validate in-handler; do not rely on input accept filtering.
    if (!ALLOWED_MIME.test(file.type) && !ALLOWED_EXT.test(file.name)) {
      setUploadError((prev) => ({
        ...prev,
        [slot.fieldId]: 'This file type is not allowed',
      }));
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError((prev) => ({
        ...prev,
        [slot.fieldId]: 'File must be 10 MB or smaller.',
      }));
      return;
    }

    setUploadingId(slot.fieldId);
    try {
      const url = await uploadToUrl(file, file.name);
      const nextUploads = {
        ...uploads,
        [slot.fieldId]: { url, filename: file.name },
      };
      let documentsString = String(formData['_meta.kycDocuments.documentsString'] || '');
      documentsString = upsertDocumentsFieldEntry(documentsString, {
        fieldId: slot.fieldId,
        url,
        filename: file.name,
      });
      await persistDocuments(nextUploads, documentsString);
    } catch {
      setUploadError((prev) => ({
        ...prev,
        [slot.fieldId]: 'Upload failed. Try again.',
      }));
    } finally {
      setUploadingId(null);
    }
  };

  const acceptFile = async (slot: KycDocSlot, file: File) => {
    const prepared = await downscaleImageFile(file);
    await handleUpload(slot, prepared);
  };

  const handleRequestVkyc = async (again: boolean) => {
    if (!fileId) {
      setVkycError('Save the application first so a file id exists.');
      return;
    }
    setVkycBusy(true);
    setVkycError(null);
    try {
      const mobile = readString(formData, 'borrower.mobile');
      const name =
        readString(formData, 'borrower.customerName') ||
        [readString(formData, 'borrower.firstName'), readString(formData, 'borrower.lastName')]
          .filter(Boolean)
          .join(' ');
      const row = await requestVkyc({
        fileId,
        mobile,
        borrowerName: name,
        existingRecordId: again ? vkycRow?.id : undefined,
      });
      setVkycRow(row);
      await markLoanFileVkycRequested(fileId, row);
      const kamPatch = await openKamComplianceRequest({
        applicationId: recordId || fileId,
        itemId: 'vkyc',
        applicantName: name,
        formData: formDataRef.current,
      });
      onFormDataChange({
        '_meta.vkyc.recordId': row.id,
        '_meta.vkyc.status': row.status,
        '_meta.vkyc.requestedAt': row.requested_at,
        ...kamPatch,
      });
    } catch (err) {
      setVkycError(formatEngineSetupError(err, 'VKYC Links'));
    } finally {
      setVkycBusy(false);
    }
  };

  const vkycStatusCheckError = shouldShowVkycStatusCheckError(vkycPollFailures)
    ? VKYC_STATUS_CHECK_MESSAGE
    : null;

  const ordered = orderDocumentSlots(slots);
  const requiredSlots = ordered.filter((slot) => slot.required);
  const uploadedRequired = requiredSlots.filter((slot) => uploads[slot.fieldId]).length;
  const applicantName =
    readString(formData, 'borrower.customerName') ||
    [readString(formData, 'borrower.firstName'), readString(formData, 'borrower.lastName')]
      .filter(Boolean)
      .join(' ');
  const amountRaw = readString(formData, 'loan.amount').replace(/[^\d.]/g, '');
  const amountNumber = Number(amountRaw);
  const tenure = readString(formData, 'loan.tenureMonths');
  const meta = [
    applicantName,
    amountRaw && Number.isFinite(amountNumber) && amountNumber > 0
      ? `₹${amountNumber.toLocaleString('en-IN')}`
      : '',
    tenure ? `${tenure} months` : '',
  ].filter(Boolean);
  const docsDone = requiredSlots.length > 0 && uploadedRequired === requiredSlots.length;

  return (
    <div className="w-full space-y-2" data-testid="kyc-documents-step">
      <PageHeader
        phase="Application"
        title="KYC & Documents"
        helper="Upload required documents, then request video KYC."
        titleTestId="kyc-documents-title"
        fileId={fileId || undefined}
        saveLabel={saveStatusLabel(saveStatus)}
        meta={meta}
        formData={formData}
      />

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <ol className="flex gap-3 text-[13px] leading-[18px]" aria-label="KYC sections">
            <li className={docsDone ? 'text-dealer-text-quiet' : 'font-semibold text-dealer-navy'} aria-current={docsDone ? undefined : 'step'}>
              1 Documents
            </li>
            <li className={docsDone ? 'font-semibold text-dealer-navy' : 'text-dealer-text-quiet'} aria-current={docsDone ? 'step' : undefined}>
              2 Video KYC
            </li>
          </ol>
          <p className="text-[13px] leading-[18px] text-dealer-text">
            {uploadedRequired} of {requiredSlots.length} required documents uploaded
          </p>
          <div className="flex gap-1" aria-hidden>
            {requiredSlots.map((slot) => (
              <span
                key={slot.fieldId}
                title={slot.label}
                className={`h-2 w-2 ${uploads[slot.fieldId] ? 'bg-dealer-success' : 'bg-dealer-border'}`}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1 md:grid-cols-2" data-testid="kyc-documents-list">
          {ordered.map((slot) => {
            const uploaded = uploads[slot.fieldId];
            const owner = documentOwner(formData, slot);
            return (
              <UploadRow
                key={slot.fieldId}
                fieldId={slot.fieldId}
                label={slot.label}
                required={slot.required}
                ownerLine={owner.line}
                ownerName={owner.name}
                ownerRole={owner.role}
                initials={owner.initials}
                filename={uploaded?.filename}
                fileUrl={uploaded?.url}
                uploading={uploadingId === slot.fieldId}
                error={uploadError[slot.fieldId]}
                onFile={(file) => void acceptFile(slot, file)}
                rowTestId={`kyc-doc-${slot.fieldId}`}
                inputTestId={`kyc-doc-input-${slot.fieldId}`}
              />
            );
          })}
        </div>
      </div>

      {/* Explicitly no Drive-link inputs in dealer KYC flow */}
      <VideoKycCard
        row={vkycRow}
        busy={vkycBusy}
        disabled={!fileId}
        statusCheckError={vkycStatusCheckError}
        onRequest={() => void handleRequestVkyc(false)}
        onRequestAgain={() => void handleRequestVkyc(true)}
      />
      {vkycError ? (
        <p className="text-sm text-dealer-error" data-testid="vkyc-error">
          {vkycError}
        </p>
      ) : null}
      {!fileId ? (
        <p className="text-xs text-dealer-text-quiet" data-testid="vkyc-needs-file-id">
          Save a draft first to enable Video KYC.
        </p>
      ) : null}
    </div>
  );
};

export function isKycDocumentsStepReady(
  formData: Record<string, unknown>,
  formConfig: FormConfigCategory[],
  vkycRow: VkycRow | null
): boolean {
  return areRequiredKycDocsUploaded(formData, formConfig) && isVkycReadyForNext(vkycRow);
}
