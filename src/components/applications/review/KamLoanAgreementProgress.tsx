import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DealerWaiting } from '../../dealer-ui/DealerWaiting';
import { EsignStep } from '../EsignStep';
import { StampPapersStep } from '../StampPapersStep';
import {
  fillCkyc,
  fillLoanAgreement,
  fillSanctionLetter,
} from '../../../services/engineClient';
import { ensureFilledLoanDocs } from '../../../lib/loanDocReadiness';
import {
  kamSigningProgressLabel,
  kamStampProgressLabel,
  loanDocsReady,
} from '../../../lib/kamComplianceConfirm';
import { stampBootMode } from '../../../lib/postSubmitEngine/stampFlow';
import type { FilledDocs } from '../../../lib/postSubmitEngine/types';

type Props = {
  fileId: string;
  formData: Record<string, unknown>;
  onPersist: (next: Record<string, unknown>) => Promise<void>;
};

function filledFromForm(formData: Record<string, unknown>): FilledDocs | null {
  if (!loanDocsReady(formData)) return null;
  return {
    sanctionLetter: String(formData['_meta.docs.sanctionLetter'] || ''),
    loanAgreement: String(formData['_meta.docs.loanAgreement'] || ''),
    ckyc: String(formData['_meta.docs.ckyc'] || ''),
  };
}

export const KamLoanAgreementProgress: React.FC<Props> = ({ fileId, formData, onPersist }) => {
  const initialFormRef = useRef(formData);
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  const [workingForm, setWorkingForm] = useState(formData);
  const [readyForStamps, setReadyForStamps] = useState(false);
  const [filling, setFilling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEsign, setShowEsign] = useState(() => stampBootMode(formData) === 'pack');

  useEffect(() => {
    const initial = initialFormRef.current;
    let cancelled = false;

    const run = async () => {
      const result = await ensureFilledLoanDocs(initial, fileId, {
        fillSanctionLetter,
        fillLoanAgreement,
        fillCkyc,
      });
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setFilling(false);
        return;
      }
      if (result.filled) {
        setWorkingForm(result.formData);
        await persistRef.current(result.formData);
      }
      if (!cancelled) {
        setReadyForStamps(true);
        setFilling(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const persistNext = useCallback(async (next: Record<string, unknown>) => {
    setWorkingForm(next);
    await persistRef.current(next);
  }, []);

  const writeFormData = useCallback(
    async (_fields: Record<string, unknown>, next?: Record<string, unknown>) => {
      await persistNext(next || initialFormRef.current);
    },
    [persistNext]
  );

  const handlePackReady = useCallback(
    (next: Record<string, unknown>) => {
      setWorkingForm(next);
      setShowEsign(true);
    },
    []
  );

  const continueToEsign = useCallback(() => setShowEsign(true), []);
  const backToStamp = useCallback(() => setShowEsign(false), []);

  const filledDocs = useMemo(
    () => filledFromForm(workingForm),
    [
      workingForm['_meta.docs.sanctionLetter'],
      workingForm['_meta.docs.loanAgreement'],
      workingForm['_meta.docs.ckyc'],
    ]
  );

  const stampLabel = kamStampProgressLabel(workingForm);
  const signingLabel = kamSigningProgressLabel(workingForm);

  return (
    <div className="space-y-3 py-3" data-testid="kam-loan-agreement-progress">
      {stampLabel ? (
        <DealerWaiting testId="kam-stamp-status" title={stampLabel}>
          {signingLabel ? <p data-testid="kam-signing-status">{signingLabel}</p> : null}
        </DealerWaiting>
      ) : signingLabel ? (
        <DealerWaiting testId="kam-signing-status" title={signingLabel} />
      ) : null}
      {filling ? <p data-testid="kam-doc-fill">Preparing loan documents…</p> : null}
      {error ? (
        <p className="text-sm text-sf-error" data-testid="kam-doc-fill-error" role="alert">
          {error}
        </p>
      ) : null}
      {readyForStamps && fileId ? (
        <StampPapersStep
          fileId={fileId}
          filledDocs={filledDocs}
          formData={workingForm}
          onContinueToEsign={continueToEsign}
          onPackReady={handlePackReady}
          writeFormData={writeFormData}
        />
      ) : null}
      {showEsign && fileId ? (
        <EsignStep
          fileId={fileId}
          formData={workingForm}
          onBackToStamp={backToStamp}
          onSigned={handlePackReady}
          writeFormData={writeFormData}
        />
      ) : null}
    </div>
  );
};
