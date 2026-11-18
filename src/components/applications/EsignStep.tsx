import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { DealerWaiting } from '../dealer-ui/DealerWaiting';
import { maskEmailForDisplay, isValidEmail } from '../../lib/esignConfig';
import { withSignedLoanAgreement } from '../../lib/esignCompliance';
import { isEsignEnabled } from '../../lib/featureFlags';
import { openKamComplianceRequest } from '../../lib/b2cEvKamRequest';
import {
  buildEsignPayload,
  buildEsignRefId,
  esignBootMode,
  esignEnabled,
  esignPreviewActive,
  fetchEsignStatus,
  pingEsignTool,
  readEsignMeta,
  runEsignPrechecks,
  sendEsign,
  type EsignPartyInput,
  type EsignPrecheckOk,
} from '../../lib/postSubmitEngine/esignFlow';

const STATUS_POLL_MS = 60_000;
const SIGNING_SENT_KEY = '_meta.signing.sentAt';

type Props = {
  fileId: string;
  formData: Record<string, unknown>;
  writeFormData: (
    fields: Record<string, unknown>,
    nextFormData?: Record<string, unknown>
  ) => Promise<void>;
  onSigned: (nextFormData: Record<string, unknown>) => void;
  onBackToStamp: () => void;
};

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function formatSignedAt(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const EsignStep: React.FC<Props> = ({
  fileId,
  formData,
  writeFormData,
  onSigned,
  onBackToStamp,
}) => {
  const [busy, setBusy] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [precheck, setPrecheck] = useState<EsignPrecheckOk | null>(null);
  const [needsEmails, setNeedsEmails] = useState<{
    applicant?: boolean;
    support?: boolean;
    supportLabel: string;
  } | null>(null);
  const [applicantEmailDraft, setApplicantEmailDraft] = useState('');
  const [supportEmailDraft, setSupportEmailDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [polling, setPolling] = useState(false);
  const [stage, setStage] = useState<string>('pending');
  const [signatoryStatuses, setSignatoryStatuses] = useState<
    Array<{ email: string; name: string; status: string; signedAt?: string }>
  >([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [notConfirmed, setNotConfirmed] = useState(false);
  const [canManualResend, setCanManualResend] = useState(false);
  const [localForm, setLocalForm] = useState(formData);
  const [parties, setParties] = useState<{
    applicant: EsignPartyInput;
    support: EsignPartyInput;
  } | null>(null);

  const precheckRef = useRef<EsignPrecheckOk | null>(null);
  const formRef = useRef(localForm);
  formRef.current = localForm;

  const persist = useCallback(
    async (next: Record<string, unknown>) => {
      setLocalForm(next);
      await writeFormData({}, next);
    },
    [writeFormData]
  );

  const refreshPrecheck = useCallback(async (fd: Record<string, unknown>) => {
    const ping = await pingEsignTool();
    if (!ping.ok) {
      setErrorMessage(ping.message);
      setBusy(false);
      return;
    }

    const result = await runEsignPrechecks({ formData: fd });
    if (!result.ok) {
      if (result.goBackToStamp) {
        onBackToStamp();
        return;
      }
      if (result.needsEmails) {
        setNeedsEmails({
          applicant: result.missing?.applicantEmail,
          support: result.missing?.supportEmail,
          supportLabel: 'Co-applicant',
        });
        setBusy(false);
        return;
      }
      setErrorMessage(result.message);
      setBusy(false);
      return;
    }

    precheckRef.current = result;
    setPrecheck(result);
    setParties({ applicant: result.applicant, support: result.support });
    setNeedsEmails(null);

    const esign = readEsignMeta(fd);
    const documentId = String(esign.documentId || '').trim();
    const existingSigned = String(esign.signed_url || '').trim();
    if (existingSigned.startsWith('https://') && esign.stage === 'signed') {
      setSignedUrl(existingSigned);
      setStage('signed');
      setBusy(false);
      return;
    }
    if (documentId) {
      setPolling(true);
      setBusy(false);
      return;
    }
    setBusy(false);
  }, [onBackToStamp]);

  useEffect(() => {
    let cancelled = false;
    if (esignBootMode(formRef.current) === 'poll') {
      setPolling(true);
      setBusy(false);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      if (cancelled) return;
      await refreshPrecheck(formRef.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId, refreshPrecheck]);

  const pollOnce = useCallback(async () => {
    const esign = readEsignMeta(formRef.current);
    const refId = String(esign.refId || buildEsignRefId(fileId));
    try {
      const { status, data } = await fetchEsignStatus(refId);
      const body = asObj(data);
      if (status === 404 || body.error_type === 'NOT_FOUND') {
        setNotConfirmed(true);
        setPolling(false);
        return { stop: true };
      }
      setNotConfirmed(false);

      if (body.stale === true) {
        // keep last stage; no error
        return { stop: false };
      }

      const nextStage = String(body.stage || stage);
      setStage(nextStage);

      const sigs = Array.isArray(body.signatories)
        ? (body.signatories as Array<Record<string, unknown>>)
        : [];
      setSignatoryStatuses(
        sigs.map((s) => ({
          email: String(s.email || ''),
          name: String(s.name || ''),
          status: String(s.status || ''),
          signedAt: s.signedAt ? String(s.signedAt) : undefined,
        }))
      );

      const next = {
        ...formRef.current,
        '_meta.esign': {
          ...esign,
          documentId: body.documentId ?? esign.documentId,
          stage: nextStage,
          updated_at: new Date().toISOString(),
        },
      };

      if (nextStage === 'signed') {
        const url = String(body.signedUrl || '');
        const signedAt = new Date().toISOString();
        const withSigned = withSignedLoanAgreement(
          {
            ...next,
            [SIGNING_SENT_KEY]: signedAt,
          },
          {
            ...asObj(next['_meta.esign']),
            stage: 'signed',
            signed_url: url,
            signed_at: signedAt,
          }
        );
        await persist(withSigned);
        setSignedUrl(url.startsWith('https://') ? url : null);
        setPolling(false);
        onSigned(withSigned);
        return { stop: true };
      }

      if (nextStage === 'failed') {
        await persist(next);
        setErrorMessage('Signing was not completed.');
        setCanManualResend(true);
        setPolling(false);
        return { stop: true };
      }

      setLocalForm(next);
      void writeFormData({}, next).catch(() => undefined);
    } catch {
      // keep polling
    }
    return { stop: false };
  }, [fileId, onSigned, persist, stage, writeFormData]);

  useEffect(() => {
    if (!polling || signedUrl) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') return;
      const result = await pollOnce();
      if (result.stop) cancelled = true;
    };
    void tick();
    const id = window.setInterval(() => void tick(), STATUS_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [polling, signedUrl, pollOnce]);

  const saveEmailsAndContinue = async () => {
    let next = { ...formRef.current };
    if (needsEmails?.applicant) {
      if (!isValidEmail(applicantEmailDraft)) {
        setErrorMessage('Enter a valid applicant email.');
        return;
      }
      next = { ...next, 'borrower.email': applicantEmailDraft.trim() };
    }
    if (needsEmails?.support) {
      if (!isValidEmail(supportEmailDraft)) {
        setErrorMessage(`Enter a valid ${needsEmails.supportLabel.toLowerCase()} email.`);
        return;
      }
      // Prefer whatever prefix is on the file
      const type = String(next['_meta.supportPersonType'] || '');
      const key = type === 'guarantor' ? 'guarantor.email' : 'coApplicant.email';
      next = { ...next, [key]: supportEmailDraft.trim() };
    }
    await persist(next);
    setBusy(true);
    await refreshPrecheck(next);
  };

  const doSend = async () => {
    if (!esignEnabled()) {
      setConfirmOpen(false);
      return;
    }
    const cfg = precheckRef.current;
    if (!cfg) {
      setErrorMessage('Signing checks are incomplete.');
      return;
    }
    setSending(true);
    setConfirmOpen(false);
    setErrorMessage(null);
    setCanManualResend(false);

    try {
      const refId = buildEsignRefId(fileId);
      let working = formRef.current;
      const existing = readEsignMeta(working);
      if (!existing.refId) {
        working = {
          ...working,
          '_meta.esign': {
            refId,
            requested_at: new Date().toISOString(),
          },
        };
        await persist(working);
      }

      const payload = buildEsignPayload({
        config: cfg.config,
        fileId,
        packUrl: cfg.packUrl,
        applicant: cfg.applicant,
        support: cfg.support,
      });

      let status = 0;
      let data: unknown = null;
      try {
        ({ status, data } = await sendEsign(payload));
      } catch {
        // timeout → status only
        setPolling(true);
        setSending(false);
        return;
      }

      const body = asObj(data);

      if (status === 200 && body.ok === true) {
        const next = {
          ...working,
          '_meta.esign': {
            ...readEsignMeta(working),
            documentId: body.documentId,
            stage: body.stage || 'pending',
          },
        };
        await persist(next);
        const kamPatch = await openKamComplianceRequest({
          applicationId: fileId,
          itemId: 'loanAgreement',
          applicantName: cfg.applicant.name,
          formData: next,
        });
        if (Object.keys(kamPatch).length > 0) {
          await persist({ ...next, ...kamPatch });
        }
        setPolling(true);
        setSending(false);
        return;
      }

      if (status === 409 && body.error_type === 'DUPLICATE_REFID') {
        const existingDoc = asObj(body.existing);
        const next = {
          ...working,
          '_meta.esign': {
            ...readEsignMeta(working),
            documentId: existingDoc.documentId ?? readEsignMeta(working).documentId,
            stage: 'pending',
          },
        };
        await persist(next);
        setPolling(true);
        setSending(false);
        return;
      }

      if (
        (status === 409 && body.error_type === 'UNCONFIRMED_REFID') ||
        status === 504 ||
        body.error_type === 'ESIGN_UNCONFIRMED'
      ) {
        const next = {
          ...working,
          '_meta.esign': {
            ...readEsignMeta(working),
            stage: 'unconfirmed',
          },
        };
        await persist(next);
        setErrorMessage('Signing request not confirmed. Contact support.');
        setNotConfirmed(true);
        setSending(false);
        return;
      }

      if (status === 400 || body.error_type === 'VALIDATION_ERROR') {
        setErrorMessage('Signing details need correction.');
        setSending(false);
        return;
      }

      if (status === 502 && body.error_type === 'DOWNLOAD_FAILED') {
        setErrorMessage('Could not prepare the signing pack. Try again.');
        setCanManualResend(true);
        setSending(false);
        return;
      }
      if (status === 502 && body.error_type === 'ESIGN_FAILED') {
        setErrorMessage('Could not send for signing. Try again.');
        setCanManualResend(true);
        setSending(false);
        return;
      }
      if (status === 502 && body.error_type === 'STORE_ERROR') {
        setErrorMessage('Signing is not available right now. Contact support.');
        setSending(false);
        return;
      }

      setPolling(true);
    } finally {
      setSending(false);
    }
  };

  if (busy) {
    return (
      <DealerWaiting testId="esign-step" title="Checking signing setup…">
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-dealer-navy" aria-hidden />
      </DealerWaiting>
    );
  }

  if (signedUrl || stage === 'signed') {
    return (
      <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5" data-testid="esign-step">
        <div className="mb-3 flex items-center gap-2 text-dealer-navy">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <h2 className="text-lg font-semibold">Both signatures are in</h2>
        </div>
        {signedUrl ? (
          <a
            className="mb-4 inline-flex rounded-[12px] border border-dealer-border px-5 py-3 text-sm font-semibold text-dealer-navy"
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="view-signed-docs"
          >
            View signed documents
          </a>
        ) : null}
        <p className="text-sm text-dealer-text-quiet">Continue to delivery is unlocked.</p>
      </div>
    );
  }

  if (needsEmails) {
    return (
      <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5" data-testid="esign-step">
        <h2 className="mb-3 text-lg font-semibold text-dealer-navy">Email for signing</h2>
        {needsEmails.applicant ? (
          <label className="mb-3 block text-sm">
            Applicant email
            <input
              type="email"
              className="mt-1 w-full rounded-[12px] border border-dealer-border px-3 py-2"
              value={applicantEmailDraft}
              onChange={(e) => setApplicantEmailDraft(e.target.value)}
              data-testid="esign-applicant-email"
            />
          </label>
        ) : null}
        {needsEmails.support ? (
          <label className="mb-3 block text-sm">
            {needsEmails.supportLabel} email
            <input
              type="email"
              className="mt-1 w-full rounded-[12px] border border-dealer-border px-3 py-2"
              value={supportEmailDraft}
              onChange={(e) => setSupportEmailDraft(e.target.value)}
              data-testid="esign-support-email"
            />
          </label>
        ) : null}
        {errorMessage ? (
          <p className="mb-3 text-sm text-dealer-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button
          type="button"
          className="w-full rounded-[12px] bg-dealer-navy px-5 py-3 text-sm font-semibold text-white"
          onClick={() => void saveEmailsAndContinue()}
        >
          Save and continue
        </button>
      </div>
    );
  }

  if (errorMessage && !precheck && !polling) {
    return (
      <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5" data-testid="esign-step">
        <p className="text-sm text-dealer-error" role="alert">
          {errorMessage}
        </p>
      </div>
    );
  }

  const applicant = parties?.applicant;
  const support = parties?.support;

  return (
    <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5" data-testid="esign-step">
      <h2 className="mb-2 text-lg font-semibold text-dealer-navy">
        {polling ? 'Sent for signing' : 'Ready to send for signing'}
      </h2>

      {!polling && applicant && support ? (
        <>
          <p className="post-submit-body mb-4 text-sm text-dealer-text-quiet">
            Ready to send for signing
          </p>
          <p className="mb-4 text-sm text-dealer-text-quiet">
            {applicant.name} ({maskEmailForDisplay(applicant.email)}) then {support.name} (
            {maskEmailForDisplay(support.email)})
          </p>
          {esignPreviewActive() ? (
            <p className="mb-3 text-sm text-dealer-text-quiet" data-testid="paid-call-preview">
              Preview success. No paid eSign is sent.
            </p>
          ) : null}
          {esignEnabled() ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => setConfirmOpen(true)}
              className="w-full rounded-[12px] bg-dealer-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="esign-send-button"
            >
              {sending ? 'Sending…' : 'Send for signing'}
            </button>
          ) : (
            <p className="text-sm text-dealer-text-quiet" data-testid="esign-flag-off">
              Ready to send for signing
            </p>
          )}
        </>
      ) : null}

      {polling && applicant && support ? (
        <>
          <p className="post-submit-body mb-2 text-sm text-dealer-text-quiet">
            Signing links were sent to {maskEmailForDisplay(applicant.email)} and{' '}
            {maskEmailForDisplay(support.email)}.
          </p>
          <p className="mb-4 text-sm text-dealer-text-quiet">
            {applicant.name} signs first, then {support.name}, each with an Aadhaar OTP.
          </p>
          <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm">
            <li className="flex justify-between gap-3">
              <span>{applicant.name}</span>
              <span>
                {(() => {
                  const row = signatoryStatuses.find(
                    (s) => s.email.toLowerCase() === applicant.email.toLowerCase()
                  );
                  if (!row) return stage === 'pending' ? 'Pending' : stage;
                  if (row.status === 'signed') {
                    return `Signed ${formatSignedAt(row.signedAt || '')}`;
                  }
                  return row.status || 'Pending';
                })()}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>{support.name}</span>
              <span>
                {(() => {
                  const row = signatoryStatuses.find(
                    (s) => s.email.toLowerCase() === support.email.toLowerCase()
                  );
                  if (!row) return 'Waiting';
                  if (row.status === 'signed') {
                    return `Signed ${formatSignedAt(row.signedAt || '')}`;
                  }
                  return row.status || 'Pending';
                })()}
              </span>
            </li>
          </ol>
          <p className="text-sm text-dealer-text-quiet">
            You can close this and come back. Your place is saved.
          </p>
        </>
      ) : null}

      {notConfirmed ? (
        <div className="mt-3">
          <p className="text-sm text-dealer-error">Signing request not confirmed</p>
          <button
            type="button"
            className="mt-2 rounded-[12px] border border-dealer-border px-4 py-2 text-sm font-semibold"
            onClick={() => {
              setNotConfirmed(false);
              setPolling(true);
            }}
            data-testid="esign-check-again"
          >
            Check again
          </button>
        </div>
      ) : null}

      {canManualResend && isEsignEnabled() ? (
        <button
          type="button"
          className="mt-3 w-full rounded-[12px] bg-dealer-navy px-5 py-3 text-sm font-semibold text-white"
          onClick={() => setConfirmOpen(true)}
          data-testid="esign-resend"
        >
          Send again
        </button>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 text-sm text-dealer-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {confirmOpen && applicant && support ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="esign-confirm-dialog"
        >
          <div className="w-full max-w-md rounded-[12px] bg-dealer-surface p-5">
            <p className="post-submit-body mb-4">
              Send the loan documents to {applicant.name} and {support.name} for signing? This
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-[12px] border border-dealer-border px-4 py-2 text-sm font-semibold"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-[12px] bg-dealer-navy px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void doSend()}
                data-testid="esign-confirm-send"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
