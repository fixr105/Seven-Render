import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { DealerWaiting } from '../dealer-ui/DealerWaiting';
import { formatElapsed } from '../../lib/postSubmitEngine/canonical';
import { fireDlaLead } from '../../lib/postSubmitEngine/dlaLead';
import { getApplicantParty } from '../../lib/postSubmitEngine/supportPersonParty';
import {
  buildStampOrderPayload,
  describeStampParties,
  extractStampPdfUrls,
  fetchStampStatus,
  mergeSigningPack,
  placeStampOrder,
  readStampsMeta,
  runStampFreeChecks,
  stampOrderEnabled,
  stampStatusAllDownloadable,
  type StampFreeCheckOk,
  type StampPaperPlan,
} from '../../lib/postSubmitEngine/stampFlow';
import { fileIdAlnum, loadStampConfig } from '../../lib/stampConfig';
import { isStampOrderEnabled } from '../../lib/featureFlags';
import type { FilledDocs } from '../../lib/postSubmitEngine/types';

const STATUS_POLL_MS = 60_000;

type Props = {
  fileId: string;
  formData: Record<string, unknown>;
  filledDocs: FilledDocs | null;
  writeFormData: (
    fields: Record<string, unknown>,
    nextFormData?: Record<string, unknown>
  ) => Promise<void>;
  onPackReady: (nextFormData: Record<string, unknown>) => void;
  onContinueToEsign: () => void;
};

type RowState = {
  refId: string;
  label: string;
  firstParty: string;
  stage: string;
  failed: boolean;
};

function stampRowCopy(
  formData: Record<string, unknown>,
  index: number,
  firstParty: string
): { label: string; firstParty: string } {
  const parties = describeStampParties(formData, firstParty);
  const row = parties?.[index];
  if (row) return { label: row.rowLabel, firstParty: row.firstParty };
  const label =
    index === 0 ? 'Applicant' : index === 1 ? 'Co-applicant' : 'Applicant & co-applicant';
  return { label, firstParty };
}

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function maskSecretsInText(text: string): string {
  // Defensive: never show access keys / download URLs in UI copy.
  return text
    .replace(/accessKey[=:][^\s&"']+/gi, 'accessKey=***')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[link]');
}

export const StampPapersStep: React.FC<Props> = ({
  fileId,
  formData,
  filledDocs,
  writeFormData,
  onPackReady,
  onContinueToEsign,
}) => {
  const [busy, setBusy] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [check, setCheck] = useState<StampFreeCheckOk | null>(null);
  const [readyToOrder, setReadyToOrder] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [polling, setPolling] = useState(false);
  const [rows, setRows] = useState<RowState[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [orderNotConfirmed, setOrderNotConfirmed] = useState(false);
  const [partialFailedRefIds, setPartialFailedRefIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [packUrl, setPackUrl] = useState<string | null>(null);
  const [localForm, setLocalForm] = useState(formData);

  const mergeStartedRef = useRef(false);
  const firstPartyRef = useRef('');
  const dlaStepFiredRef = useRef(false);
  const checkOkRef = useRef<StampFreeCheckOk | null>(null);
  const papersRef = useRef<StampPaperPlan[]>([]);
  const formRef = useRef(localForm);
  formRef.current = localForm;

  const signingMeta = useMemo(() => {
    const raw = localForm['_meta.signing'];
    return asObj(raw);
  }, [localForm]);

  const stampsMeta = useMemo(() => readStampsMeta(localForm), [localForm]);
  const existingAccessKey = String(stampsMeta.accessKey || '').trim();
  const existingPack = String(signingMeta.pack_url || '').trim();

  const persist = useCallback(
    async (next: Record<string, unknown>) => {
      setLocalForm(next);
      await writeFormData({}, next);
    },
    [writeFormData]
  );

  // Initial free checks OR resume status / pack
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setBusy(true);
      setErrorMessage(null);

      if (existingPack.startsWith('https://')) {
        if (!cancelled) {
          setPackUrl(existingPack);
          setBusy(false);
          setPolling(false);
        }
        return;
      }

      if (!dlaStepFiredRef.current) {
        dlaStepFiredRef.current = true;
        const applicant = getApplicantParty(formRef.current);
        const next = await fireDlaLead({
          fileId,
          formData: formRef.current,
          applicantName: applicant.name,
          applicantMobile: applicant.mobile,
          stampOrdered: false,
          writeFormData: async (fd) => {
            setLocalForm(fd);
            await writeFormData({}, fd);
          },
        });
        if (!cancelled) setLocalForm(next);
      }

      if (existingAccessKey) {
        if (!cancelled) {
          setPolling(true);
          setBusy(false);
          const requestedAt = String(stampsMeta.requested_at || '');
          if (requestedAt) {
            setElapsedMs(Date.now() - new Date(requestedAt).getTime());
          }
          const refIds = Array.isArray(stampsMeta.refIds)
            ? (stampsMeta.refIds as string[])
            : [];
          const cfg = await loadStampConfig();
          const firstParty = cfg.ok ? cfg.config.stamp_first_party : '';
          firstPartyRef.current = firstParty;
          setRows(
            refIds.map((refId, i) => {
              const copy = stampRowCopy(formRef.current, i, firstParty);
              return {
                refId,
                label: copy.label,
                firstParty: copy.firstParty,
                stage: 'pending',
                failed: false,
              };
            })
          );
        }
        return;
      }

      try {
        const result = await runStampFreeChecks({ formData: formRef.current, fileId });
        if (cancelled) return;
        if (!result.ok) {
          setErrorMessage(result.message);
          setBusy(false);
          return;
        }
        checkOkRef.current = result;
        papersRef.current = result.papers;
        firstPartyRef.current = result.papers[0]?.firstParty || '';
        setCheck(result);
        setRows(
          result.papers.map((p) => ({
            refId: p.refId,
            label: p.rowLabel,
            firstParty: p.firstParty,
            stage: 'ready',
            failed: false,
          }))
        );
        setReadyToOrder(true);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Stamp checks failed');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
    // Only on mount / fileId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Elapsed timer while polling
  useEffect(() => {
    if (!polling || packUrl) return;
    const requestedAt = String(readStampsMeta(formRef.current).requested_at || '');
    if (!requestedAt) return;
    const tick = () => setElapsedMs(Date.now() - new Date(requestedAt).getTime());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [polling, packUrl]);

  const runMerge = useCallback(
    async (orders: Array<Record<string, unknown>>, refIds: [string, string, string]) => {
      if (mergeStartedRef.current) return;
      const existing = String(asObj(formRef.current['_meta.signing']).pack_url || '');
      if (existing.startsWith('https://')) {
        setPackUrl(existing);
        onPackReady(formRef.current);
        return;
      }
      const docs = filledDocs || {
        sanctionLetter: String(formRef.current['_meta.docs.sanctionLetter'] || ''),
        loanAgreement: String(formRef.current['_meta.docs.loanAgreement'] || ''),
        ckyc: String(formRef.current['_meta.docs.ckyc'] || ''),
      };
      if (
        !docs.sanctionLetter.startsWith('https://') ||
        !docs.loanAgreement.startsWith('https://') ||
        !docs.ckyc.startsWith('https://')
      ) {
        setErrorMessage('Loan documents are missing. Prepare documents again.');
        return;
      }
      const pdfUrls = extractStampPdfUrls(orders, refIds);
      if (!pdfUrls) {
        setErrorMessage('Could not prepare the signing pack. Try again.');
        return;
      }
      mergeStartedRef.current = true;
      setMerging(true);
      try {
        const merged = await mergeSigningPack({
          fileId,
          stampPdfUrls: pdfUrls,
          sanctionLetter: docs.sanctionLetter,
          loanAgreement: docs.loanAgreement,
          ckyc: docs.ckyc,
        });
        if (!merged.ok) {
          setErrorMessage(merged.message);
          mergeStartedRef.current = false;
          return;
        }
        const next = {
          ...formRef.current,
          '_meta.signing': {
            pack_url: merged.url,
            page_count: merged.pageCount,
            esign_ready: merged.esignReady,
            merged_at: new Date().toISOString(),
          },
        };
        await persist(next);
        setPackUrl(merged.url);
        onPackReady(next);
      } catch {
        setErrorMessage('Could not prepare the signing pack. Try again.');
        mergeStartedRef.current = false;
      } finally {
        setMerging(false);
      }
    },
    [fileId, filledDocs, onPackReady, persist]
  );

  const pollOnce = useCallback(async () => {
    const meta = readStampsMeta(formRef.current);
    const accessKey = String(meta.accessKey || '');
    const groupId = String(meta.groupId || fileIdAlnum(fileId));
    if (!accessKey) return { stop: false };

    try {
      const { status, data } = await fetchStampStatus(accessKey, groupId);
      const body = asObj(data);
      if (status === 404 || body.error_type === 'NOT_FOUND') {
        setOrderNotConfirmed(true);
        setPolling(false);
        return { stop: true };
      }
      setOrderNotConfirmed(false);
      const orders = Array.isArray(body.orders)
        ? (body.orders as Array<Record<string, unknown>>)
        : [];
      const summary = asObj(body.summary);

      setRows((prev) => {
        if (!prev.length && orders.length) {
          return orders.map((o, i) => {
            const copy = stampRowCopy(formRef.current, i, firstPartyRef.current);
            return {
              refId: String(o.refId || ''),
              label: copy.label,
              firstParty: copy.firstParty,
              stage: String(o.stage || 'pending'),
              failed: String(o.stage || '') === 'failed',
            };
          });
        }
        return prev.map((row) => {
          const match = orders.find((o) => String(o.refId) === row.refId);
          if (!match) return row;
          const stage = String(match.stage || row.stage);
          return { ...row, stage, failed: stage === 'failed' };
        });
      });

      const nextMeta = {
        ...meta,
        orders: orders.map((o) => ({
          refId: o.refId,
          orderId: o.orderId,
          reference: o.reference,
          stage: o.stage,
        })),
      };
      const nextForm = { ...formRef.current, '_meta.stamps': nextMeta };
      setLocalForm(nextForm);
      void writeFormData({}, nextForm).catch(() => undefined);

      if (summary.anyFailed === true) {
        setErrorMessage('Some stamp papers failed. Contact support.');
        setPolling(false);
        return { stop: true };
      }

      if (stampStatusAllDownloadable(body)) {
        setPolling(false);
        const refIds = (
          Array.isArray(meta.refIds) && meta.refIds.length === 3
            ? meta.refIds
            : [
                `${fileIdAlnum(fileId)}-S1`,
                `${fileIdAlnum(fileId)}-S2`,
                `${fileIdAlnum(fileId)}-S3`,
              ]
        ) as [string, string, string];
        await runMerge(orders, refIds);
        return { stop: true };
      }
    } catch {
      // keep polling
    }
    return { stop: false };
  }, [fileId, runMerge, writeFormData]);

  // Status poll: open, visibility, every 60s
  useEffect(() => {
    if (!polling || packUrl) return;
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
  }, [polling, packUrl, pollOnce]);

  const placeOrder = async (onlyRefIds?: string[]) => {
    if (!isStampOrderEnabled()) {
      setReadyToOrder(true);
      setConfirmOpen(false);
      return;
    }
    const cfg = checkOkRef.current;
    if (!cfg && !onlyRefIds) {
      setErrorMessage('Stamp checks are incomplete.');
      return;
    }

    setOrdering(true);
    setErrorMessage(null);
    setConfirmOpen(false);

    try {
      let accessKey = String(readStampsMeta(formRef.current).accessKey || '');
      let working = formRef.current;
      const papers = papersRef.current.length
        ? papersRef.current
        : cfg?.papers || [];

      if (!accessKey) {
        accessKey = crypto.randomUUID();
        const refIds = papers.map((p) => p.refId);
        working = {
          ...working,
          '_meta.stamps': {
            accessKey,
            groupId: fileIdAlnum(fileId),
            refIds,
            requested_at: new Date().toISOString(),
          },
        };
        await persist(working);
      }

      const productId = cfg?.productId || String(asObj(working['_meta.stamps']).productId || '');
      const config = cfg?.config;
      if (!config || !productId) {
        // Resume path shouldn't order without checks — only retry failed after checks
        setErrorMessage('Stamp setup is incomplete. Contact support.');
        setOrdering(false);
        return;
      }

      const payload = buildStampOrderPayload({
        config,
        productId,
        fileId,
        accessKey,
        papers,
        onlyRefIds,
      });

      let status = 0;
      let data: unknown = null;
      try {
        ({ status, data } = await placeStampOrder(payload));
      } catch {
        // Timeout / network → status only, never resend
        setPolling(true);
        setOrdering(false);
        return;
      }

      const body = asObj(data);

      if (status === 422 || status === 400 || body.error_type === 'VALIDATION_ERROR') {
        setErrorMessage(
          maskSecretsInText(String(body.error_message || 'Stamp details need correction.'))
        );
        setOrdering(false);
        return;
      }
      if (status === 402 || body.error_type === 'INSUFFICIENT_BALANCE') {
        setErrorMessage("Stamp papers can't be ordered right now. Contact support.");
        setOrdering(false);
        return;
      }

      if (status === 207) {
        const orders = Array.isArray(body.orders)
          ? (body.orders as Array<Record<string, unknown>>)
          : [];
        const failed = orders
          .filter((o) => String(o.stage || '') === 'failed')
          .map((o) => String(o.refId || ''));
        setPartialFailedRefIds(failed);
        const next = {
          ...working,
          '_meta.stamps': {
            ...readStampsMeta(working),
            productId,
            orders: orders.map((o) => ({
              refId: o.refId,
              orderId: o.orderId,
              reference: o.reference,
              stage: o.stage,
            })),
          },
        };
        await persist(next);
        setErrorMessage('Some stamp papers could not be ordered');
        setOrdering(false);
        setPolling(true);
        return;
      }

      if (
        status === 200 ||
        status === 409 ||
        body.error_type === 'DUPLICATE_REFID' ||
        body.ok === true
      ) {
        const orders = Array.isArray(body.orders)
          ? (body.orders as Array<Record<string, unknown>>)
          : Array.isArray(body.existing)
            ? (body.existing as Array<Record<string, unknown>>)
            : [];
        const next = {
          ...working,
          '_meta.stamps': {
            ...readStampsMeta(working),
            productId,
            orders: orders.map((o) => ({
              refId: o.refId,
              orderId: o.orderId,
              reference: o.reference,
              stage: o.stage,
            })),
          },
        };
        await persist(next);

        if (status === 200) {
          const applicant = getApplicantParty(next);
          const afterDla = await fireDlaLead({
            fileId,
            formData: next,
            applicantName: applicant.name,
            applicantMobile: applicant.mobile,
            stampOrdered: true,
            writeFormData: async (fd) => {
              setLocalForm(fd);
              await writeFormData({}, fd);
            },
          });
          setLocalForm(afterDla);
        }

        setPartialFailedRefIds([]);
        setPolling(true);
        setReadyToOrder(false);
      } else if (status === 502) {
        setErrorMessage("Stamp papers can't be ordered right now. Contact support.");
      } else {
        setPolling(true);
      }
    } finally {
      setOrdering(false);
    }
  };

  if (busy) {
    return (
      <DealerWaiting testId="stamp-step" title="Checking stamp papers…">
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-dealer-navy" aria-hidden />
      </DealerWaiting>
    );
  }

  if (packUrl) {
    return (
      <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5" data-testid="stamp-step">
        <div className="mb-3 flex items-center gap-2 text-dealer-navy">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <h2 className="text-lg font-semibold">Signing pack ready</h2>
        </div>
        <p className="post-submit-body mb-4 text-sm text-dealer-text-quiet">
          3 stamp papers and 3 loan documents are prepared. Signing will open once it is set up.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            className="inline-flex items-center justify-center rounded-[12px] border border-dealer-border bg-dealer-surface px-5 py-3 text-sm font-semibold text-dealer-navy"
            href={packUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="view-signing-pack"
          >
            View pack
          </a>
          <button
            type="button"
            onClick={onContinueToEsign}
            className="inline-flex items-center justify-center rounded-[12px] bg-dealer-navy px-5 py-3 text-sm font-semibold text-white"
            data-testid="continue-to-esign"
          >
            Continue to signing
          </button>
        </div>
      </div>
    );
  }

  if (errorMessage && !readyToOrder && !polling && !orderNotConfirmed) {
    return (
      <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5" data-testid="stamp-step">
        <p className="post-submit-body text-sm text-dealer-error" role="alert">
          {errorMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5" data-testid="stamp-step">
      <h2 className="mb-2 text-lg font-semibold text-dealer-navy">Stamp papers</h2>

      {readyToOrder && check ? (
        <>
          <p className="post-submit-body mb-4 text-sm text-dealer-text-quiet">
            Stamp papers are ready to order
            {check.quote.total != null ? ` · quote ₹${String(check.quote.total)}` : ''}.
          </p>
          <ul className="mb-4 space-y-2 text-sm text-dealer-text">
            {check.papers.map((p) => (
              <li key={p.refId} className="flex justify-between gap-3">
                <span>
                  <span className="block">{p.rowLabel}</span>
                  {p.firstParty ? (
                    <span className="block text-dealer-text-quiet">{p.firstParty}</span>
                  ) : null}
                </span>
                <span className="text-dealer-text-quiet">{p.secondParty}</span>
              </li>
            ))}
          </ul>
          {stampOrderEnabled() ? (
            <button
              type="button"
              disabled={ordering}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex w-full items-center justify-center rounded-[12px] bg-dealer-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="order-stamps-button"
            >
              {ordering ? 'Ordering…' : 'Order stamp papers'}
            </button>
          ) : (
            <p className="text-sm text-dealer-text-quiet" data-testid="stamp-order-flag-off">
              Stamp papers are ready to order
            </p>
          )}
        </>
      ) : null}

      {(polling || merging || orderNotConfirmed) && (
        <>
          <p className="post-submit-body mb-2">
            Preparing your documents — this takes a few minutes.
          </p>
          <p className="mb-4 text-sm text-dealer-text-quiet">
            Elapsed: {formatElapsed(elapsedMs)}. You can close this and come back. Your place is
            saved.
          </p>
          <ul className="mb-4 space-y-2 text-sm">
            {rows.map((row) => (
              <li key={row.refId} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block">{row.label}</span>
                  {row.firstParty ? (
                    <span className="block text-dealer-text-quiet">{row.firstParty}</span>
                  ) : null}
                </span>
                <span className={row.failed ? 'text-dealer-error' : 'text-dealer-text-quiet'}>
                  {row.failed ? 'Failed — Contact support' : row.stage}
                </span>
              </li>
            ))}
          </ul>
          {merging ? (
            <div className="flex items-center gap-2 text-dealer-navy">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span className="text-sm">Building signing pack…</span>
            </div>
          ) : null}
          {orderNotConfirmed ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-dealer-error">Order not confirmed</p>
              <button
                type="button"
                className="rounded-[12px] border border-dealer-border px-4 py-2 text-sm font-semibold text-dealer-navy"
                onClick={() => {
                  setOrderNotConfirmed(false);
                  setPolling(true);
                }}
                data-testid="stamp-check-again"
              >
                Check again
              </button>
              <button
                type="button"
                className="ml-2 rounded-[12px] bg-dealer-navy px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  // Clear accessKey so a fresh order can be placed after confirmed 404
                  const cleared = {
                    ...formRef.current,
                    '_meta.stamps': {},
                  };
                  void persist(cleared).then(() => {
                    checkOkRef.current = null;
                    setPolling(false);
                    setReadyToOrder(false);
                    setBusy(true);
                    void runStampFreeChecks({ formData: cleared, fileId }).then((result) => {
                      setBusy(false);
                      if (!result.ok) {
                        setErrorMessage(result.message);
                        return;
                      }
                      checkOkRef.current = result;
                      papersRef.current = result.papers;
                      setCheck(result);
                      setReadyToOrder(true);
                    });
                  });
                }}
                data-testid="stamp-order-again"
              >
                Order again
              </button>
            </div>
          ) : null}
          {partialFailedRefIds.length > 0 ? (
            <button
              type="button"
              className="mt-3 rounded-[12px] bg-dealer-navy px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void placeOrder(partialFailedRefIds)}
              data-testid="stamp-retry-failed"
            >
              Retry failed ones
            </button>
          ) : null}
        </>
      )}

      {errorMessage && (readyToOrder || polling) ? (
        <p className="mt-3 text-sm text-dealer-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="stamp-confirm-dialog"
        >
          <div className="w-full max-w-md rounded-[12px] bg-dealer-surface p-5">
            <p className="post-submit-body mb-4">
              Order 3 stamp papers
              {check?.quote.total != null ? ` for ₹${String(check.quote.total)}` : ''}? This cannot
              be undone.
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
                onClick={() => void placeOrder()}
                data-testid="stamp-confirm-order"
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
