import React, { useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { DealerWaiting } from '../dealer-ui/DealerWaiting';

type Props = {
  phase: 'searching' | 'found' | 'ntc' | 'soft_block' | 'hard_reject';
  reasons?: string[];
  preview?: string[];
  overflow?: string[];
};

export const FindingLenderPanel: React.FC<Props> = ({
  phase,
  reasons = [],
  preview = [],
  overflow = [],
}) => {
  const [overflowOpen, setOverflowOpen] = useState(false);

  if (phase === 'searching') {
    return (
      <DealerWaiting className="mt-4" testId="finding-lender-panel" title="Finding a lender…">
        <div className="lender-pendulum mx-auto mt-4" aria-hidden>
          <div className="lender-pendulum-track">
            <div className="lender-pendulum-bob" />
          </div>
        </div>
      </DealerWaiting>
    );
  }

  if (phase === 'found' || phase === 'ntc') {
    return (
      <div
        className="mt-4 flex flex-col items-center gap-3 rounded-[12px] border border-dealer-success/30 bg-dealer-success/5 px-4 py-5"
        data-testid="finding-lender-panel"
        aria-live="polite"
      >
        <div className="lender-thumb-pop flex h-14 w-14 items-center justify-center rounded-full bg-dealer-success text-white">
          <ThumbsUp className="h-7 w-7" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-dealer-navy">
          {phase === 'ntc' ? 'Lender path available — bank statement needed later' : 'Lender found'}
        </p>
        <p className="text-xs text-dealer-text-quiet">You can continue to the next step.</p>
      </div>
    );
  }

  const visible = phase === 'hard_reject' ? preview : reasons;
  const extra = phase === 'hard_reject' ? overflow : [];

  return (
    <div
      className="mt-4 rounded-[12px] border border-dealer-error/30 bg-dealer-error/5 px-4 py-4"
      data-testid="finding-lender-panel"
      role="alert"
    >
      <p className="mb-2 text-sm font-semibold text-dealer-error">
        {phase === 'hard_reject' ? 'Rejected — does not meet lending criteria' : 'Cannot proceed'}
      </p>
      <ul className="space-y-1.5">
        {visible.map((reason) => (
          <li key={reason} className="text-sm text-dealer-text-quiet">
            {reason}
          </li>
        ))}
      </ul>
      {extra.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-dealer-border bg-dealer-surface px-3 py-1 text-xs font-semibold text-dealer-text hover:bg-dealer-surface-soft"
            data-testid="qualify-overflow-chip"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((open) => !open)}
          >
            +{extra.length}
          </button>
          {overflowOpen && (
            <ul className="mt-2 space-y-1.5" data-testid="qualify-overflow-list">
              {extra.map((reason) => (
                <li key={reason} className="text-sm text-dealer-text-quiet">
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
