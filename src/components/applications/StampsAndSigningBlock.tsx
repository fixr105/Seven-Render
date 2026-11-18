import React, { useEffect, useState } from 'react';
import { isEsignEnabled, isStampOrderEnabled } from '../../lib/featureFlags';
import { stampsSigningStateLabel } from '../../lib/kamComplianceConfirm';
import { KamLoanAgreementProgress } from './review/KamLoanAgreementProgress';

type Props = {
  fileId: string;
  formData: Record<string, unknown>;
  onPersist: (next: Record<string, unknown>) => Promise<void>;
  open?: boolean;
  onOpen?: () => void;
};

export const StampsAndSigningBlock: React.FC<Props> = ({
  fileId,
  formData,
  onPersist,
  open = false,
  onOpen,
}) => {
  const [opened, setOpened] = useState(open);
  useEffect(() => {
    if (open) setOpened(true);
  }, [open]);

  const state = stampsSigningStateLabel(formData);
  const signed = state === 'Signed';
  const paidOff = !isStampOrderEnabled() || !isEsignEnabled();

  return (
    <section
      id="stamps-and-signing"
      className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5"
      data-testid="stamps-and-signing"
    >
      <h2 className="text-sm font-semibold text-dealer-navy">Stamps and signing</h2>
      <p className="mt-1 text-sm text-dealer-text" data-testid="stamps-signing-state">
        {state}
      </p>
      {paidOff ? (
        <p className="mt-2 text-sm text-dealer-text-quiet" data-testid="stamps-paid-off">
          Paid step is switched off. Contact support.
        </p>
      ) : null}
      {paidOff ? (
        <style>
          {`[data-testid="stamps-and-signing"] [data-testid="order-stamps-button"],
            [data-testid="stamps-and-signing"] [data-testid="esign-send-button"],
            [data-testid="stamps-and-signing"] [data-testid="stamp-order-again"],
            [data-testid="stamps-and-signing"] [data-testid="stamp-retry-failed"] { display: none; }`}
        </style>
      ) : null}
      {!signed && !opened ? (
        <button
          type="button"
          className="mt-3 inline-flex items-center justify-center rounded-[12px] border border-dealer-border px-4 py-2.5 text-sm font-semibold text-dealer-navy"
          data-testid="open-stamps-and-signing"
          onClick={() => {
            setOpened(true);
            onOpen?.();
          }}
        >
          Open stamps and signing
        </button>
      ) : null}
      {opened && !signed ? (
        <KamLoanAgreementProgress fileId={fileId} formData={formData} onPersist={onPersist} />
      ) : null}
    </section>
  );
};
