import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { enginePost } from '../../services/engineClient';
import type { SubmittedApplication } from './ApplicationFormStep';
import { ApprovedStep } from './ApprovedStep';
import { rankRequest } from './collectedInputs';
import { DocumentsStep } from './DocumentsStep';
import { readQualifySnapshot } from './formModel';
import { OfferStep } from './OfferStep';
import { buildDisplayOffers, normalizeRankedOffers, type DisplayOffer } from './offers';
import { QualifyRejection, QualifyStep } from './QualifyStep';
import { resolveLoanRecordId } from './resolveLoanRecordId';

type PostStep =
  | 'resolving'
  | 'qualify'
  | 'documents'
  | 'ranking'
  | 'offer'
  | 'approved'
  | 'rejected'
  | 'rank_error'
  | 'resolve_error';

interface DealerPostSubmitFlowProps {
  application: SubmittedApplication;
  productId: string;
  formFields: Record<string, unknown>;
}

export function DealerPostSubmitFlow({ application, productId, formFields }: DealerPostSubmitFlowProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<PostStep>('resolving');
  const [sessionApp, setSessionApp] = useState(application);
  const [offers, setOffers] = useState<DisplayOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<DisplayOffer | null>(null);
  const [rankAttempt, setRankAttempt] = useState(0);
  const [resolveAttempt, setResolveAttempt] = useState(0);
  const rankingStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStep('resolving');
      try {
        const resolved = await resolveLoanRecordId(application.recordId, application.fileId);
        if (cancelled) return;
        setSessionApp({
          ...application,
          recordId: resolved.recordId,
          fileId: resolved.fileId || application.fileId,
        });
        setStep('qualify');
      } catch {
        if (!cancelled) setStep('resolve_error');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [application, resolveAttempt]);

  useEffect(() => {
    if (step !== 'ranking') {
      rankingStarted.current = false;
      return;
    }
    if (rankingStarted.current) return;
    rankingStarted.current = true;
    let cancelled = false;
    const run = async () => {
      try {
        const snapshot = readQualifySnapshot(sessionApp.qualifyResult);
        const coRaw =
          sessionApp.coApplicantResult && typeof sessionApp.coApplicantResult === 'object'
            ? (sessionApp.coApplicantResult as Record<string, unknown>)
            : null;
        const ranked = await enginePost(
          'multi_lender_rank',
          rankRequest(
            sessionApp.canonical,
            sessionApp.fileId,
            snapshot.score,
            coRaw,
            snapshot.monthlyObligations
          )
        );
        if (cancelled) return;
        const nextOffers = buildDisplayOffers(
          normalizeRankedOffers(ranked, {
            amount: sessionApp.canonical.requestedLoanAmount,
            tenure: sessionApp.canonical.preferredTenure || 36,
          })
        );
        if (nextOffers.length === 0) {
          setStep('rank_error');
          return;
        }
        setOffers(nextOffers);
        setStep('offer');
      } catch {
        if (!cancelled) setStep('rank_error');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionApp, step, rankAttempt]);

  if (step === 'resolving') {
    return (
      <div role="status" className="bg-white px-6 py-16 text-center">
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-primary/20 border-t-brand-primary"
          aria-hidden
        />
        <h2 className="mt-6 font-michroma text-xl text-brand-primary">Preparing application...</h2>
      </div>
    );
  }

  if (step === 'resolve_error') {
    return (
      <div className="bg-white px-6 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-brand-primary" aria-hidden />
        <h2 className="mt-4 font-michroma text-xl text-brand-primary">Unable to open this application</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => setResolveAttempt((n) => n + 1)}
          >
            Try Again
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'rejected') {
    return <QualifyRejection onHome={() => navigate('/dashboard')} />;
  }

  if (step === 'qualify') {
    return (
      <QualifyStep
        application={sessionApp}
        formFields={formFields}
        onQualified={(next) => {
          setSessionApp(next);
          setStep('documents');
        }}
        onRejected={() => setStep('rejected')}
      />
    );
  }

  if (step === 'documents') {
    return (
      <DocumentsStep
        productId={productId || 'ev_dealer'}
        recordId={sessionApp.recordId}
        includeCoApplicant={sessionApp.includeCoApplicant || Boolean(sessionApp.canonical.coApplicant)}
        formFields={formFields}
        onComplete={() => setStep('ranking')}
      />
    );
  }

  if (step === 'ranking') {
    return (
      <div role="status" className="bg-white px-6 py-16 text-center">
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-primary/20 border-t-brand-primary"
          aria-hidden
        />
        <h2 className="mt-6 font-michroma text-xl text-brand-primary">Matching lenders...</h2>
        <p className="mt-3 font-inter text-base text-brand-primary">Preparing your offer options</p>
      </div>
    );
  }

  if (step === 'rank_error') {
    return (
      <div className="bg-white px-6 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-brand-primary" aria-hidden />
        <h2 className="mt-4 font-michroma text-xl text-brand-primary">
          Application does not meet current lending criteria.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              rankingStarted.current = false;
              setStep('ranking');
              setRankAttempt((n) => n + 1);
            }}
          >
            Try Again
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'offer') {
    return (
      <OfferStep
        application={sessionApp}
        offers={offers}
        formFields={formFields}
        onAccepted={(offer) => {
          setSelectedOffer(offer);
          setStep('approved');
        }}
        onBackToForm={() => navigate('/dashboard')}
      />
    );
  }

  if (step === 'approved' && selectedOffer) {
    return <ApprovedStep fileId={sessionApp.fileId} offer={selectedOffer} />;
  }

  return null;
}
