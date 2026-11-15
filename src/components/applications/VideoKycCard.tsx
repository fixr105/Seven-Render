import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { VkycRow } from '../../lib/vkycLinks';
import { isVkycDone } from '../../lib/vkycLinks';

export type VideoKycCardProps = {
  row: VkycRow | null;
  busy?: boolean;
  disabled?: boolean;
  statusCheckError?: string | null;
  onRequest: () => void;
  onRequestAgain: () => void;
};

export const VideoKycCard: React.FC<VideoKycCardProps> = ({
  row,
  busy = false,
  disabled = false,
  statusCheckError = null,
  onRequest,
  onRequestAgain,
}) => {
  const status = row?.status || '';

  return (
    <div
      className="rounded-[12px] border border-dealer-border bg-dealer-surface p-4"
      data-testid="video-kyc-card"
      data-vkyc-status={status || 'none'}
    >
      <h3 className="text-base font-semibold leading-6 text-dealer-navy">
        Video KYC
      </h3>
      <p className="mt-1 text-sm leading-5 text-dealer-text-quiet">
        A Seven Fincorp officer will verify the customer on a short video call.
      </p>
      {statusCheckError ? (
        <p className="mt-2 text-sm text-amber-800" data-testid="vkyc-status-check-error" role="status">
          {statusCheckError}
        </p>
      ) : null}

      {!row || !status ? (
        <button
          type="button"
          className="mt-4 inline-flex items-center justify-center rounded-[12px] bg-dealer-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          onClick={onRequest}
          disabled={busy || disabled}
          data-testid="vkyc-request"
        >
          {busy ? 'Requesting…' : 'Request video KYC'}
        </button>
      ) : null}

      {status === 'Requested' ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-dealer-text" data-testid="vkyc-waiting">
          <Loader2 className="h-4 w-4 animate-spin text-dealer-navy" aria-hidden />
          Waiting for an officer…
        </div>
      ) : null}

      {status === 'Link Sent' && row?.link ? (
        <div className="mt-4 space-y-2" data-testid="vkyc-link-sent">
          <a
            href={row.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-[12px] bg-dealer-navy px-4 py-2.5 text-sm font-semibold text-white"
            data-testid="vkyc-join"
          >
            Join video call
          </a>
          <p className="text-xs text-dealer-text-quiet">Keep this page open — status updates automatically.</p>
        </div>
      ) : null}

      {isVkycDone(row) ? (
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-dealer-success" data-testid="vkyc-done">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Video KYC complete
        </div>
      ) : null}

      {status === 'Failed' ? (
        <div className="mt-4 space-y-2" data-testid="vkyc-failed">
          <p className="text-sm text-dealer-error">
            Video KYC not completed. {row?.remarks || ''}
          </p>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-[12px] border border-dealer-navy px-4 py-2 text-sm font-semibold text-dealer-navy disabled:opacity-50"
            onClick={onRequestAgain}
            disabled={busy || disabled}
            data-testid="vkyc-request-again"
          >
            Request again
          </button>
        </div>
      ) : null}
    </div>
  );
};
