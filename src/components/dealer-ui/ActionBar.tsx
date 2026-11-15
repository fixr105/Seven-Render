import React from 'react';
import { Loader2 } from 'lucide-react';

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dealer-navy';

type ActionBarProps = {
  onBack: () => void;
  backDisabled?: boolean;
  onSave: () => void;
  saveDisabled?: boolean;
  onPrimary: () => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  primaryTestId?: string;
  disabledReason?: string | null;
  hideBack?: boolean;
  hideSave?: boolean;
};

export const ActionBar: React.FC<ActionBarProps> = ({
  onBack,
  backDisabled = false,
  onSave,
  saveDisabled = false,
  onPrimary,
  primaryLabel,
  primaryDisabled = false,
  primaryBusy = false,
  primaryTestId,
  disabledReason,
  hideBack = false,
  hideSave = false,
}) => {
  return (
    <div className="sticky bottom-0 z-30 border-t border-dealer-border bg-dealer-surface">
      <div className="flex w-full flex-col gap-2 px-0 py-3">
        {primaryDisabled && disabledReason ? (
          <p className="text-[13px] leading-[18px] text-dealer-text-quiet">{disabledReason}</p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          {hideBack ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onBack}
              disabled={backDisabled}
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-dealer-navy bg-dealer-surface px-4 text-sm font-medium text-dealer-navy disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}
            >
              Back
            </button>
          )}
          <div className="flex items-center gap-2">
            {hideSave ? null : (
              <button
                type="button"
                onClick={onSave}
                disabled={saveDisabled}
                className={`inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-dealer-navy disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}
              >
                Save draft
              </button>
            )}
            <button
              type="button"
              onClick={onPrimary}
              disabled={primaryDisabled || primaryBusy}
              data-testid={primaryTestId}
              className={`inline-flex h-11 min-w-[8.5rem] items-center justify-center gap-2 rounded-lg bg-dealer-navy px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}
            >
              {primaryBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
