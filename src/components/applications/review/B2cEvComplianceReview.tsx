import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import {
  COMPLIANCE_ITEMS,
  type ComplianceItemId,
} from '../../../lib/b2cEvCompliance';
import {
  getRequiredDocumentReadiness,
  type FormConfigCategory,
} from '../../../lib/b2cEvDocuments';
import { extractPendingB2cActions } from '../../../lib/b2cEvKamActions';
import {
  getDoRejectionReason,
  hasDoRejectionOnRecord,
  isDoFulfilled,
  isDoRequested,
} from '../../../lib/b2cEvDoRequest';
import { apiService } from '../../../services/api';
import { completeVkycLink, fetchVkycByFileId, type VkycRow } from '../../../lib/vkycLinks';
import {
  doStatusLabel,
  isKamComplianceOpen,
  kamComplianceStatusLabel,
} from '../../../lib/b2cEvStepStatus';
import { Button } from '../../ui/Button';
import { Toast } from '../../ui/Toast';
import { useAuth } from '../../../auth/AuthContext';
import { airtableWrite, DoPdfGenerationError, requestDoPdf } from '../../../services/engineClient';
import {
  buildDoWebhookPayload,
  defaultDoChecklistTicks,
  DO_APPROVAL_CHECKLIST,
  formatDoApprovedWhen,
  readDoApproval,
  type DoApprovalRecord,
} from '../../../lib/doApproval';
import { keepDoneComplianceConfirmations, repairComplianceFlags } from '../../../lib/kamComplianceConfirm';
import { KamComplianceChecklist } from './KamComplianceChecklist';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export interface B2cEvComplianceReviewProps {
  formData: Record<string, unknown>;
  formConfig?: FormConfigCategory[];
  applicationId?: string;
  fileId?: string;
  userRole?: string | null;
  highlightComplianceItem?: ComplianceItemId;
  highlightDoRequest?: boolean;
  onUpdated?: () => void;
}

export const B2cEvComplianceReview: React.FC<B2cEvComplianceReviewProps> = ({
  formData,
  formConfig = [],
  applicationId,
  fileId,
  userRole,
  highlightComplianceItem,
  highlightDoRequest = false,
  onUpdated,
}) => {
  const [vkycLink, setVkycLink] = useState<VkycRow | null>(null);

  const formFileId = readString(formData['_meta.fileId']);
  const altFileId = readString(formData.fileId);

  useEffect(() => {
    const lookupIds = [fileId, formFileId, altFileId]
      .map((value) => String(value ?? '').trim())
      .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
    if (lookupIds.length === 0) {
      setVkycLink(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const lookupId of lookupIds) {
        try {
          const row = await fetchVkycByFileId(lookupId);
          if (cancelled) return;
          if (row) {
            setVkycLink(row);
            return;
          }
        } catch {
          // Try the next file id. A missing links row still leaves the saved form status.
        }
      }
      if (!cancelled) setVkycLink(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId, formFileId, altFileId]);

  const { doRequest } = extractPendingB2cActions(formData);
  const documentReadiness = getRequiredDocumentReadiness(formData, formConfig);
  const doRequested = isDoRequested(formData);
  const doFulfilled = isDoFulfilled(formData);
  const doRejectionReason = getDoRejectionReason(formData);
  const doRejectedOnRecord = hasDoRejectionOnRecord(formData);
  const canManageCompliance = userRole === 'kam' && Boolean(applicationId);
  const canApproveDo = (userRole === 'kam' || userRole === 'admin') && Boolean(applicationId);
  const { user } = useAuth();
  const [localForm, setLocalForm] = useState(formData);
  const localFormRef = useRef(formData);
  localFormRef.current = localForm;
  const repairKey = useRef('');
  useEffect(() => {
    const next = repairComplianceFlags(
      keepDoneComplianceConfirmations(formData, localFormRef.current)
    );
    if (next.changed) setLocalForm(next.formData);
    else setLocalForm((current) => keepDoneComplianceConfirmations(formData, current));
    if (!next.changed || !applicationId?.startsWith('rec')) return;
    const key = [
      applicationId,
      next.formData['compliance.ekycDone'],
      next.formData['compliance.enachDone'],
      next.formData['compliance.loanAgreementSigned'],
    ].join('|');
    if (repairKey.current === key) return;
    repairKey.current = key;
    void airtableWrite({
      table: 'Loan Applications',
      record_id: applicationId,
      fields: {
        'Last Updated': new Date().toISOString(),
        'Form Data': JSON.stringify(next.formData),
      },
    });
  }, [formData, applicationId]);
  const reviewFormData = useMemo(() => {
    if (!vkycLink?.status || readString(localForm['_meta.vkyc.status'])) return localForm;
    return {
      ...localForm,
      '_meta.vkyc.status': vkycLink.status,
      '_meta.vkyc.requestedAt': vkycLink.requested_at || localForm['_meta.vkyc.requestedAt'],
      '_meta.kamRequests.vkyc.requestedAt':
        readString(localForm['_meta.kamRequests.vkyc.requestedAt']) || vkycLink.requested_at,
    };
  }, [localForm, vkycLink]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<boolean[]>(() =>
    DO_APPROVAL_CHECKLIST.map(() => false)
  );
  const [sendingDo, setSendingDo] = useState(false);
  const [doSendError, setDoSendError] = useState<string | null>(null);
  const [doErrorKind, setDoErrorKind] = useState<'http' | 'failed' | 'network' | null>(null);
  const [doToast, setDoToast] = useState<string | null>(null);
  const [sentDo, setSentDo] = useState<DoApprovalRecord | null>(null);
  const savedApprovalRef = useRef<DoApprovalRecord | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const storedApproval = readDoApproval(formData);
  const approvedRecord = storedApproval?.doUrl ? storedApproval : sentDo;
  const allChecksTicked = checkedItems.every(Boolean);

  const sendDo = async (retry: boolean) => {
    if (!applicationId || sendingDo) return;
    if (!retry && !allChecksTicked) return;
    setSendingDo(true);
    setDoSendError(null);
    setDoErrorKind(null);
    try {
      let approval = savedApprovalRef.current;
      if (!retry || !approval) {
        approval = {
          checklist: [...DO_APPROVAL_CHECKLIST],
          approvedBy: user?.email || '',
          approvedAt: new Date().toISOString(),
        };
        const saved = await apiService.kamB2cDoRequestAction(applicationId, {
          action: 'save_checklist',
          doApproval: approval,
        });
        if (!saved.success) {
          throw new Error(saved.error || 'Failed to save DO checklist');
        }
        savedApprovalRef.current = approval;
      }
      const pdf = await requestDoPdf(
        buildDoWebhookPayload({
          formData,
          fileId: fileId || readString(formData['_meta.fileId']) || readString(formData.fileId),
          applicationId,
          approvedBy: approval.approvedBy,
          approvedAt: approval.approvedAt,
        })
      );
      const completed: DoApprovalRecord = {
        ...approval,
        doUrl: pdf.url,
        doFileName: pdf.fileName,
        doGeneratedAt: new Date().toISOString(),
      };
      const fulfilled = await apiService.kamB2cDoRequestAction(applicationId, {
        action: 'fulfill',
        doApproval: completed,
      });
      if (!fulfilled.success) {
        throw new Error(fulfilled.error || 'Failed to update DO request');
      }
      if (String(applicationId).startsWith('rec')) {
        try {
          await airtableWrite({
            table: 'Loan Applications',
            record_id: applicationId,
            fields: { DO: pdf.url },
          });
        } catch (columnError) {
          console.error('[DO approval] DO column write failed', columnError);
        }
      }
      setSentDo(completed);
      setChecklistOpen(false);
      setDoToast('DO sent ✓');
      onUpdated?.();
      window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (error: unknown) {
      if (error instanceof DoPdfGenerationError) {
        setDoErrorKind('failed');
        setDoSendError(error.message);
      } else if (error instanceof Error && error.message === 'Could not generate DO. Try again.') {
        setDoErrorKind('http');
        setDoSendError(error.message);
      } else if (error instanceof Error && error.message === 'No response. Check with ops.') {
        setDoErrorKind('network');
        setDoSendError(error.message);
      } else {
        setDoErrorKind('failed');
        setDoSendError(error instanceof Error ? error.message : 'Failed to update DO request');
      }
    } finally {
      setSendingDo(false);
    }
  };

  const runDoAction = async (action: 'fulfill' | 'clear_request', rejectionReason?: string) => {
    if (!applicationId) return;
    setLoadingAction(action);
    try {
      const response = await apiService.kamB2cDoRequestAction(applicationId, {
        action,
        rejectionReason,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update DO request');
      }
      setShowRejectModal(false);
      setRejectReason('');
      onUpdated?.();
      window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update DO request');
    } finally {
      setLoadingAction(null);
    }
  };

  const highlightedItemId = useMemo(() => {
    if (highlightComplianceItem) return highlightComplianceItem;
    const pending = COMPLIANCE_ITEMS.find((item) => isKamComplianceOpen(reviewFormData, item.id));
    return pending?.id;
  }, [reviewFormData, highlightComplianceItem]);

  const runComplianceAction = async (
    itemId: ComplianceItemId,
    action: 'fulfill' | 'clear_request'
  ) => {
    if (!applicationId) return;
    const actionKey = `${action}-${itemId}`;
    setLoadingAction(actionKey);
    try {
      const response = await apiService.kamB2cComplianceAction(applicationId, { itemId, action });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update compliance');
      }
      if (itemId === 'vkyc' && action === 'fulfill' && fileId) {
        try {
          await completeVkycLink(fileId);
        } catch {
          // The file is already marked Done. The links row can still be closed from the desk.
        }
      }
      onUpdated?.();
      window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update compliance');
    } finally {
      setLoadingAction(null);
    }
  };

  const fulfilledBy = readString(formData['_meta.doRequest.fulfilledBy']);
  const fulfilledAt = readString(formData['_meta.doRequest.fulfilledAt']);
  const rejectedBy = readString(formData['_meta.doRequest.rejectedBy']);
  const rejectedAt = readString(formData['_meta.doRequest.rejectedAt']);

  return (
    <div
      id="b2c-compliance"
      className="space-y-4 border-t border-neutral-200 pt-4"
      data-testid="b2c-compliance-review"
    >
      <KamComplianceChecklist
        formData={localForm}
        applicationId={applicationId}
        fileId={fileId}
        userRole={userRole}
        confirmedBy={user?.email || ''}
        onFormData={setLocalForm}
        onUpdated={onUpdated}
      />

      <div>
        <h4 className="text-sm font-semibold text-neutral-900">Compliance checklist</h4>
        <p className="mt-1 text-sm text-neutral-600">
          VKYC, loan agreement, and eNACH status. KAM can approve pending client requests here.
        </p>
      </div>

      <div className="space-y-3">
        {COMPLIANCE_ITEMS.map((item) => {
          const open = isKamComplianceOpen(reviewFormData, item.id);
          const statusLabel = kamComplianceStatusLabel(reviewFormData, item.id);
          const requestedAt = readString(reviewFormData[item.requestedAtKey]);
          const isHighlighted = highlightedItemId === item.id;

          return (
            <div
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                isHighlighted ? 'border-brand-primary bg-brand-primary/5' : 'border-neutral-200'
              }`}
              data-testid={`compliance-review-${item.id}`}
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                <p className="text-xs text-neutral-500" data-testid={`compliance-status-${item.id}`}>
                  {statusLabel}
                  {requestedAt ? ` · Requested ${new Date(requestedAt).toLocaleString()}` : ''}
                </p>
              </div>
              {canManageCompliance && open && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={loadingAction != null}
                    onClick={() => void runComplianceAction(item.id, 'fulfill')}
                    data-testid={`compliance-approve-${item.id}`}
                  >
                    {loadingAction === `fulfill-${item.id}` ? 'Saving…' : 'Approve'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loadingAction != null}
                    onClick={() => void runComplianceAction(item.id, 'clear_request')}
                    data-testid={`compliance-reject-${item.id}`}
                  >
                    {loadingAction === `clear_request-${item.id}` ? 'Saving…' : 'Reject'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
        data-testid="b2c-document-readiness-review"
      >
        <p className="text-sm font-semibold text-neutral-900">Upload folder readiness</p>
        <p className="mt-1 text-sm text-neutral-600">
          {documentReadiness.requiredCount > 0
            ? `${documentReadiness.addedToFolderCount} of ${documentReadiness.requiredCount} required uploads marked “Yes, Added to Folder”.`
            : 'No required document checklist configured for this product.'}
        </p>
        {documentReadiness.pendingLabels.length > 0 ? (
          <p className="mt-2 text-xs text-neutral-500">
            Pending: {documentReadiness.pendingLabels.join(', ')}
          </p>
        ) : null}
      </div>

      {(doRequest || doRequested || doFulfilled || doRejectedOnRecord) && (
        <div
          id="b2c-do-request-review"
          className={`rounded-xl border p-4 ${
            highlightDoRequest && doRequested && !doFulfilled
              ? 'border-brand-primary bg-brand-primary/5'
              : 'border-warning/30 bg-warning/5'
          }`}
          data-testid="b2c-do-request-review"
        >
          <p className="text-sm font-semibold text-neutral-900">Disbursement Order (DO) request</p>
          <p className="mt-1 text-sm text-neutral-600" data-testid="do-request-status">
            {doStatusLabel(formData)}
            {doFulfilled && fulfilledAt
              ? ` · Approved ${new Date(fulfilledAt).toLocaleString()}${fulfilledBy ? ` by ${fulfilledBy}` : ''} — Insurance and Vehicle unlocked for client`
              : doRequested
                ? ' · Pending KAM approval to unlock Insurance and Vehicle for the client'
                : doRejectedOnRecord && rejectedAt
                  ? ` · Rejected ${new Date(rejectedAt).toLocaleString()}${rejectedBy ? ` by ${rejectedBy}` : ''}`
                  : ''}
          </p>
          {doRejectionReason && !doRequested ? (
            <p className="mt-2 text-sm text-error" data-testid="do-rejection-reason">
              Rejection reason: {doRejectionReason}
            </p>
          ) : null}
          {approvedRecord?.doUrl ? (
            <div className="mt-3 space-y-2" data-testid="do-approval-done">
              <p className="text-sm font-medium text-sf-success">DO approved ✓</p>
              <p className="text-sm text-sf-text">
                DO approved on {formatDoApprovedWhen(approvedRecord.approvedAt)}
                {approvedRecord.approvedBy ? ` by ${approvedRecord.approvedBy}` : ''}
              </p>
              <a
                href={approvedRecord.doUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-sf-navy underline"
                data-testid="do-approval-view"
              >
                View DO
              </a>
            </div>
          ) : null}
          {doFulfilled && fileId ? (
            <a
              href={`/dealer/delivery/${encodeURIComponent(fileId)}`}
              className="mt-3 inline-flex text-sm font-medium text-sf-navy underline"
              data-testid="do-next-steps"
            >
              Next: Insurance and Vehicle
            </a>
          ) : null}
          {canApproveDo && doRequested && !approvedRecord?.doUrl && (
            <div className="mt-3 space-y-3">
              {!checklistOpen ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loadingAction != null}
                    onClick={() => {
                      setCheckedItems(defaultDoChecklistTicks(localForm));
                      setChecklistOpen(true);
                    }}
                    className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg bg-sf-navy px-4 text-sm font-medium text-white"
                    data-testid="do-request-approve"
                  >
                    Approve DO
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loadingAction != null}
                    onClick={() => setShowRejectModal(true)}
                    data-testid="do-request-reject"
                  >
                    Reject DO
                  </Button>
                </div>
              ) : (
                <div data-testid="do-approval-checklist">
                  <p className="text-sm text-sf-text">Before approving, confirm:</p>
                  <ul className="mt-2 space-y-2">
                    {DO_APPROVAL_CHECKLIST.map((label, index) => {
                      const ticked = checkedItems[index];
                      return (
                        <li key={label}>
                          <label className="flex items-center gap-2 font-sans text-sm text-sf-text">
                            <input
                              type="checkbox"
                              checked={ticked}
                              disabled={sendingDo}
                              onChange={(event) => {
                                const next = [...checkedItems];
                                next[index] = event.target.checked;
                                setCheckedItems(next);
                              }}
                              data-testid={`do-approval-check-${index}`}
                            />
                            {ticked ? <Check className="h-4 w-4 text-sf-success" aria-hidden /> : null}
                            <span className={ticked ? 'text-sf-success' : ''}>{label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {doSendError ? (
                    <p className="mt-3 text-sm text-sf-error" role="alert" data-testid="do-approval-error">
                      {doSendError}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={sendingDo}
                      onClick={() => {
                        setChecklistOpen(false);
                        setCheckedItems(defaultDoChecklistTicks(localForm));
                        setDoSendError(null);
                        setDoErrorKind(null);
                        savedApprovalRef.current = null;
                      }}
                      className="text-sm text-sf-navy disabled:opacity-45"
                      data-testid="do-approval-cancel"
                    >
                      Cancel
                    </button>
                    <div className="flex items-center gap-2">
                      {doErrorKind === 'http' || doErrorKind === 'failed' ? (
                        <button
                          type="button"
                          disabled={sendingDo}
                          onClick={() => void sendDo(true)}
                          className="text-sm text-sf-navy underline"
                          data-testid="do-approval-retry"
                        >
                          Retry
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!allChecksTicked || sendingDo}
                        onClick={() => void sendDo(false)}
                        className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-lg bg-sf-navy px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
                        data-testid="do-approval-send"
                      >
                        {sendingDo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                        {sendingDo ? 'Sending DO…' : 'Send DO'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {doToast ? (
            <div className="fixed bottom-4 right-4 z-50">
              <Toast type="success" message={doToast} onClose={() => setDoToast(null)} />
            </div>
          ) : null}
        </div>
      )}

      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="do-reject-modal"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-neutral-900">Reject DO request</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Provide a reason so the client knows what to fix before submitting again.
            </p>
            <textarea
              className="mt-4 w-full rounded-lg border border-neutral-300 p-3 text-sm"
              rows={4}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Rejection reason"
              data-testid="do-reject-reason-input"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingAction != null}
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={loadingAction != null || !rejectReason.trim()}
                onClick={() => void runDoAction('clear_request', rejectReason.trim())}
                data-testid="do-reject-confirm"
              >
                {loadingAction === 'clear_request' ? 'Saving…' : 'Confirm reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
