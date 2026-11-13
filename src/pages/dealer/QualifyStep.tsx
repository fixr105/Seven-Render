import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle } from 'lucide-react';
import { enginePost } from '../../services/engineClient';
import { Button } from '../../components/ui/Button';
import { qualifyRequest } from './collectedInputs';
import { decideQualifyResult } from './qualifyDecision';
import type { SubmittedApplication } from './ApplicationFormStep';

interface QualifyStepProps {
  application: SubmittedApplication;
  formFields?: Record<string, unknown>;
  onQualified: (application: SubmittedApplication) => void;
  onRejected: () => void;
}

type QualifyView = 'loading' | 'error';

function statusUpdate(
  status: 'Qualified' | 'Rejected',
  recordId: string,
  formFields?: Record<string, unknown>
) {
  const fields: Record<string, unknown> = {
    Status: status,
    'Last Updated': new Date().toISOString(),
  };
  if (formFields) {
    fields['Form Data'] = JSON.stringify(formFields);
  }
  return {
    table: 'Loan Applications',
    action: 'update' as const,
    record_id: recordId,
    fields,
  };
}

export function QualifyRejection({ onHome }: { onHome: () => void }) {
  return (
    <div className="bg-white px-6 py-16 text-center">
      <X className="mx-auto h-10 w-10 text-brand-primary" aria-hidden />
      <h2 className="mt-4 font-michroma text-xl text-brand-primary">Application Not Eligible</h2>
      <p className="mx-auto mt-3 max-w-sm font-inter text-base text-brand-primary">
        This application does not meet current lending criteria.
      </p>
      <div className="mt-8">
        <Button type="button" variant="primary" onClick={onHome}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}

export function QualifyStep({ application, formFields, onQualified, onRejected }: QualifyStepProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<QualifyView>('loading');
  const [attempt, setAttempt] = useState(0);
  const onQualifiedRef = useRef(onQualified);
  const onRejectedRef = useRef(onRejected);
  onQualifiedRef.current = onQualified;
  onRejectedRef.current = onRejected;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setView('loading');
      try {
        const consentedAt = new Date().toISOString();
        const fileId = application.fileId.trim() || `DLR-${Date.now()}`;
        const requestedAmount = Number(application.canonical.requestedLoanAmount) || 0;
        const payload = await enginePost(
          'qualify',
          qualifyRequest(
            {
              name: application.canonical.fullName,
              mobile: application.canonical.mobile,
              pan: application.canonical.pan,
              email: application.canonical.email,
            },
            fileId,
            consentedAt,
            requestedAmount
          )
        );
        if (cancelled) return;
        const decision = decideQualifyResult(payload);
        switch (decision) {
          case 'fail':
            try {
              await enginePost('airtable_write', statusUpdate('Rejected', application.recordId, formFields));
            } catch {
              // Rejection still stands if the status write fails.
            }
            if (!cancelled) onRejectedRef.current();
            return;
          case 'error':
            if (!cancelled) setView('error');
            return;
          case 'pass':
            break;
          default: {
            const exhaustive: never = decision;
            return exhaustive;
          }
        }

        let coApplicantResult: unknown = null;
        const co = application.canonical.coApplicant;
        if (co?.pan && co.mobile) {
          try {
            coApplicantResult = await enginePost(
              'qualify',
              qualifyRequest(
                {
                  name: co.name,
                  mobile: co.mobile,
                  pan: co.pan,
                  email: co.email,
                },
                `${fileId}-CO`,
                consentedAt,
                requestedAmount
              )
            );
          } catch {
            coApplicantResult = null;
          }
        }

        await enginePost('airtable_write', statusUpdate('Qualified', application.recordId, formFields));
        if (cancelled) return;
        onQualifiedRef.current({
          ...application,
          qualifyResult: payload,
          coApplicantResult,
          includeCoApplicant: Boolean(co?.pan && co.mobile),
        });
      } catch {
        if (!cancelled) setView('error');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [application, attempt, formFields]);

  const goHome = () => navigate('/dashboard');

  if (view === 'error') {
    return (
      <div className="bg-white px-6 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-brand-primary" aria-hidden />
        <h2 className="mt-4 font-michroma text-xl text-brand-primary">Unable to check eligibility</h2>
        <p className="mx-auto mt-3 max-w-sm font-inter text-base text-brand-primary">
          Please try again in a moment. If this continues, contact support.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setView('loading');
              setAttempt((current) => current + 1);
            }}
          >
            Try Again
          </Button>
          <Button type="button" variant="secondary" onClick={goHome}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="bg-white px-6 py-16 text-center">
      <div
        className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-primary/20 border-t-brand-primary"
        aria-hidden
      />
      <h2 className="mt-6 font-michroma text-xl text-brand-primary">Checking eligibility...</h2>
      <p className="mt-3 font-inter text-base text-brand-primary">Running background checks</p>
      <p className="font-inter text-base text-brand-primary">This takes a few seconds</p>
    </div>
  );
}
