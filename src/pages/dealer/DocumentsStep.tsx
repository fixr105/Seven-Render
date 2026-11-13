import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { enginePost, engineUpload } from '../../services/engineClient';
import { Button } from '../../components/ui/Button';
import {
  buildDocumentsString,
  documentRejection,
  type UploadedDocument,
} from './documents';
import { fallbackDocuments } from './collectedInputs';
import { extractRecords, productDocuments, type ProductDocumentRequirement } from './formModel';

interface DocumentsStepProps {
  productId: string;
  recordId: string;
  includeCoApplicant?: boolean;
  formFields?: Record<string, unknown>;
  onComplete: () => void;
}

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function DocumentsStep({
  productId,
  recordId,
  includeCoApplicant = false,
  formFields,
  onComplete,
}: DocumentsStepProps) {
  const [requirements, setRequirements] = useState<ProductDocumentRequirement[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadedDocument>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const ids = Array.from(new Set([productId, 'ev_dealer'].filter(Boolean)));
        let loaded: ProductDocumentRequirement[] = [];
        for (const id of ids) {
          const payload = await enginePost('airtable_get', {
            table: 'Product Document',
            filter: `{Product ID} = '${escapeFormulaValue(id)}'`,
          });
          if (cancelled) return;
          loaded = productDocuments(extractRecords(payload), id);
          if (loaded.length > 0) break;
        }
        setRequirements(loaded.length > 0 ? loaded : fallbackDocuments(includeCoApplicant));
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load required documents.');
          setRequirements(fallbackDocuments(includeCoApplicant));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [productId, includeCoApplicant]);

  const uploadFile = async (requirement: ProductDocumentRequirement, file: File) => {
    const rejection = documentRejection(file);
    if (rejection) {
      setErrors((current) => ({ ...current, [requirement.id]: rejection }));
      return;
    }
    setErrors((current) => {
      const next = { ...current };
      delete next[requirement.id];
      return next;
    });
    setProgress((current) => ({ ...current, [requirement.id]: 0 }));
    try {
      const uploaded = await engineUpload(file, (percent) => {
        setProgress((current) => ({ ...current, [requirement.id]: percent }));
      });
      setUploads((current) => ({
        ...current,
        [requirement.id]: { fieldId: requirement.fieldId, url: uploaded.url, filename: file.name },
      }));
      setProgress((current) => {
        const next = { ...current };
        delete next[requirement.id];
        return next;
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [requirement.id]: error instanceof Error ? error.message : 'Upload failed.',
      }));
    }
  };

  const missingRequired = requirements.some((requirement) => requirement.isRequired && !uploads[requirement.id]);

  const save = async () => {
    if (missingRequired) return;
    setSaving(true);
    setLoadError('');
    try {
      const ordered = requirements.flatMap((requirement) => {
        const uploaded = uploads[requirement.id];
        return uploaded ? [uploaded] : [];
      });
      const fields: Record<string, unknown> = {
        Documents: buildDocumentsString(ordered),
        'Last Updated': new Date().toISOString(),
      };
      if (formFields) {
        fields['Form Data'] = JSON.stringify(formFields);
      }
      await enginePost('airtable_write', {
        table: 'Loan Applications',
        action: 'update',
        record_id: recordId,
        fields,
      });
      onComplete();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not save documents.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="font-inter text-sm text-neutral-600">Loading documents...</p>;

  return (
    <div className="space-y-4">
      <h2 className="font-michroma text-xl text-brand-primary">Upload documents</h2>
      {loadError ? <p className="font-inter text-sm text-error">{loadError}</p> : null}
      {requirements.map((requirement) => {
        const uploaded = uploads[requirement.id];
        return (
          <div
            key={requirement.id}
            className="rounded-xl border border-[#E5E7EB] bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-inter text-sm font-medium text-neutral-900">
                {requirement.title}
                {requirement.isRequired ? <span className="ml-1 text-error">*</span> : null}
              </p>
              {uploaded ? <Check className="h-5 w-5 text-green-600" aria-hidden /> : null}
            </div>
            <label
              className="flex min-h-[96px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center font-inter text-sm text-neutral-600"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void uploadFile(requirement, file);
              }}
            >
              <span>
                {uploaded
                  ? uploaded.filename
                  : 'Drop file here or click to browse'}
              </span>
              <span className="mt-1 text-xs text-neutral-500">JPG, PNG, or PDF · max 10MB</span>
              <input
                className="sr-only"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadFile(requirement, file);
                  event.target.value = '';
                }}
              />
            </label>
            {progress[requirement.id] != null && !uploaded ? (
              <div className="mt-3 h-2 overflow-hidden rounded bg-neutral-200">
                <div className="h-full bg-brand-primary" style={{ width: `${progress[requirement.id]}%` }} />
              </div>
            ) : null}
            {uploaded ? (
              <button
                type="button"
                className="mt-2 font-inter text-sm text-brand-primary underline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (file) void uploadFile(requirement, file);
                  };
                  input.click();
                }}
              >
                Replace
              </button>
            ) : null}
            {errors[requirement.id] ? (
              <p className="mt-2 font-inter text-sm text-error">{errors[requirement.id]}</p>
            ) : null}
          </div>
        );
      })}
      <Button
        type="button"
        variant="primary"
        loading={saving}
        disabled={saving || missingRequired}
        onClick={() => void save()}
      >
        Continue
      </Button>
    </div>
  );
}
