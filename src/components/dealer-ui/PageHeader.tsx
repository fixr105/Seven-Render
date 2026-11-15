import React, { useState } from 'react';
import { DeadlineCountdownChip } from '../applications/DeadlineCountdownChip';

export type PageHeaderProps = {
  phase: string;
  title: string;
  helper: string;
  titleTestId?: string;
  fileId?: string;
  saveLabel: string;
  meta?: string[];
  formData?: Record<string, unknown>;
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  phase,
  title,
  helper,
  titleTestId,
  fileId,
  saveLabel,
  meta = [],
  formData,
}) => {
  const [copied, setCopied] = useState(false);

  const copyFileId = async () => {
    if (!fileId) return;
    try {
      await navigator.clipboard.writeText(fileId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <header className="border-b border-dealer-border pb-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase leading-4 tracking-[0.1em] text-dealer-text-quiet">
            {phase}
          </p>
          <h2
            className="sf-page-title truncate"
            data-testid={titleTestId}
            title={title}
          >
            {title}
          </h2>
          {helper ? (
            <p className="text-sm font-normal leading-5 text-dealer-text-quiet">{helper}</p>
          ) : null}
          {meta.length > 0 ? (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] leading-[18px] text-dealer-text-quiet">
              {meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {fileId ? (
            <button
              type="button"
              onClick={() => void copyFileId()}
              className="inline-flex h-11 items-center rounded-lg border border-dealer-border bg-dealer-surface px-3 text-[13px] font-medium text-dealer-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dealer-navy"
            >
              {copied ? 'Copied' : fileId}
            </button>
          ) : null}
          {formData ? <DeadlineCountdownChip formData={formData} /> : null}
          {saveLabel ? (
            <span className="text-[13px] leading-[18px] text-dealer-text-quiet">{saveLabel}</span>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export function saveStatusLabel(status: 'idle' | 'saving' | 'saved' | 'error'): string {
  if (status === 'saving') return 'Saving draft…';
  if (status === 'saved') return 'Draft saved';
  if (status === 'error') return 'Draft save failed — use Save draft to retry';
  return 'Not saved';
}
