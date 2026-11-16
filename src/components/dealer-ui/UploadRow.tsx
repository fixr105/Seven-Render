import React, { useId, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dealer-navy';

export type UploadRowProps = {
  fieldId: string;
  label: string;
  required?: boolean;
  ownerLine: string;
  ownerName: string;
  ownerRole: string;
  initials: string;
  filename?: string;
  fileUrl?: string;
  uploading?: boolean;
  error?: string;
  onFile: (file: File) => void;
  rowTestId: string;
  inputTestId: string;
};

function isImageName(name: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

function isPdfName(name: string): boolean {
  return /\.pdf$/i.test(name);
}

export const UploadRow: React.FC<UploadRowProps> = ({
  label,
  required = false,
  ownerLine,
  ownerName,
  ownerRole,
  initials,
  filename,
  fileUrl,
  uploading = false,
  error,
  onFile,
  rowTestId,
  inputTestId,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const sheetTitle = useId();
  const filled = Boolean(filename);
  const accessible = `${label} for ${ownerName || ownerRole}, ${ownerRole.toLowerCase()}`;

  const openPicker = () => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse) {
      setSheet(true);
      return;
    }
    inputRef.current?.click();
  };

  const take = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    if (files.length > 1) setNotice('One file per document');
    else setNotice(null);
    onFile(files[0]);
  };

  const view = () => {
    if (!fileUrl || !filename) return;
    if (isPdfName(filename)) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setLightbox(true);
  };

  return (
    <div
      data-testid={rowTestId}
      role="button"
      tabIndex={0}
      aria-label={accessible}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('[data-row-action], input')) return;
        openPicker();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        take(event.dataTransfer.files);
      }}
      className={`relative flex min-h-32 items-center gap-3 rounded-[12px] px-4 py-4 ${
        filled ? 'border border-solid border-dealer-border bg-dealer-surface' : 'border border-dashed border-dealer-border bg-dealer-surface'
      } ${over ? 'border-dashed border-dealer-navy bg-dealer-surface-soft' : ''} ${focus}`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dealer-surface-soft text-[11px] font-semibold text-dealer-navy"
        aria-hidden
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5 text-dealer-text" title={label}>
          {label}
          {required ? <span className="text-dealer-error"> *</span> : null}
        </p>
        <p className="truncate text-[13px] leading-[18px] text-dealer-text-quiet md:hidden" title={ownerLine}>
          {ownerLine}
        </p>
        {filled ? (
          <p className="truncate text-[13px] leading-[18px] text-dealer-text">{filename}</p>
        ) : (
          <p className="truncate text-[13px] leading-[18px] text-dealer-text-quiet">
            {uploading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Uploading…
              </span>
            ) : (
              'Drop file or tap to upload'
            )}
          </p>
        )}
      </div>
      {filled ? (
        <div className="flex shrink-0 items-center gap-1">
          {fileUrl && filename && isImageName(filename) ? (
            <img src={fileUrl} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <FileText className="h-10 w-10 text-dealer-text-quiet" aria-hidden />
          )}
          {fileUrl ? (
            <button
              type="button"
              data-row-action="view"
              className={`h-11 px-2 text-[13px] font-semibold text-dealer-navy ${focus}`}
              onClick={view}
            >
              View
            </button>
          ) : null}
          <button
            type="button"
            data-row-action="replace"
            className={`h-11 px-2 text-[13px] font-semibold text-dealer-navy ${focus}`}
            onClick={openPicker}
          >
            Replace
          </button>
        </div>
      ) : null}
      <p className="hidden max-w-[34%] shrink-0 truncate text-right text-[13px] leading-[18px] text-dealer-text-quiet md:block" title={ownerLine}>
        {ownerLine}
      </p>

      {error ? (
        <p className="text-[13px] leading-[18px] text-dealer-error" data-testid={`kyc-doc-error-${rowTestId.replace('kyc-doc-', '')}`}>
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-[13px] leading-[18px] text-dealer-text-quiet">{notice}</p> : null}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        data-testid={inputTestId}
        onChange={(event) => {
          take(event.target.files);
          event.target.value = '';
        }}
      />

      {uploading ? (
        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-dealer-navy" aria-hidden />
      ) : null}

      {sheet ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/40"
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            setSheet(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={sheetTitle}
            className="w-full rounded-t-[12px] bg-dealer-surface p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={sheetTitle} className="text-base font-semibold leading-6">
              Add a file
            </h2>
            <button
              type="button"
              className={`mt-3 flex h-11 w-full items-center text-left text-sm font-medium text-dealer-navy ${focus}`}
              onClick={() => cameraRef.current?.click()}
            >
              Take photo
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                take(event.target.files);
                event.target.value = '';
                setSheet(false);
              }}
            />
            <button
              type="button"
              className={`flex h-11 w-full items-center text-left text-sm font-medium text-dealer-navy ${focus}`}
              onClick={() => libraryRef.current?.click()}
            >
              Choose file
            </button>
            <input
              ref={libraryRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => {
                take(event.target.files);
                event.target.value = '';
                setSheet(false);
              }}
            />
          </div>
        </div>
      ) : null}

      {lightbox && fileUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={filename || label}
          onClick={(event) => {
            event.stopPropagation();
            setLightbox(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setLightbox(false);
          }}
        >
          <button
            type="button"
            className="absolute right-4 top-4 h-11 rounded-lg bg-dealer-surface px-3 text-sm font-medium text-dealer-navy"
            onClick={() => setLightbox(false)}
          >
            Close
          </button>
          <img src={fileUrl} alt={filename || label} className="max-h-[80vh] max-w-full" />
        </div>
      ) : null}
    </div>
  );
};
