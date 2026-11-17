import React, { useRef, useState } from 'react';
import { airtableWrite } from '../../../services/engineClient';
import { formatDoApprovedWhen } from '../../../lib/doApproval';
import { isVkycComplete } from '../../../lib/b2cEvStepStatus';
import {
  KAM_COMPLIANCE_CONFIRM_IDS,
  applyKamComplianceConfirmation,
  canConfirmKamCompliance,
  keepDoneComplianceConfirmations,
  isComplianceChecklistComplete,
  isKamComplianceConfirmationDone,
  kamComplianceActionLabel,
  kamComplianceConfirmMessage,
  kamComplianceDoneLabel,
  kamComplianceRowLabel,
  loanAgreementDoneSuffix,
  readKamComplianceConfirmation,
  stampFlowAlreadyStarted,
  type KamComplianceConfirmId,
} from '../../../lib/kamComplianceConfirm';
import { KamLoanAgreementProgress } from './KamLoanAgreementProgress';

type Props = {
  formData: Record<string, unknown>;
  applicationId?: string;
  fileId?: string;
  userRole?: string | null;
  confirmedBy: string;
  onFormData: (next: Record<string, unknown>) => void;
  onUpdated?: () => void;
};

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function doneLine(
  label: string,
  confirmedAt: string,
  confirmedBy: string,
  suffix: string
): string {
  const parts = [label];
  if (confirmedAt) parts.push(formatDoApprovedWhen(confirmedAt));
  if (confirmedBy) parts.push(confirmedBy);
  const text = parts.join(' · ');
  return suffix ? `${text} ${suffix}` : text;
}

export const KamComplianceChecklist: React.FC<Props> = ({
  formData,
  applicationId,
  fileId,
  userRole,
  confirmedBy,
  onFormData,
  onUpdated,
}) => {
  const [pendingId, setPendingId] = useState<KamComplianceConfirmId | null>(null);
  const [saving, setSaving] = useState(false);
  const formDataRef = useRef(formData);
  formDataRef.current = keepDoneComplianceConfirmations(formData, formDataRef.current);
  const canAct = canConfirmKamCompliance(userRole) && Boolean(applicationId);
  const applicantName = readString(formData['borrower.customerName']);
  const allComplete = isComplianceChecklistComplete(formData);
  const resolvedFileId =
    readString(fileId) || readString(formData['_meta.fileId']) || readString(formData.fileId);
  const showStampProgress =
    canAct &&
    (isKamComplianceConfirmationDone(formData, 'loanAgreement') ||
      stampFlowAlreadyStarted(formData));

  const persist = async (next: Record<string, unknown>, notify = false) => {
    const merged = keepDoneComplianceConfirmations(next, formDataRef.current);
    formDataRef.current = merged;
    if (applicationId && applicationId.startsWith('rec')) {
      await airtableWrite({
        table: 'Loan Applications',
        record_id: applicationId,
        fields: {
          'Last Updated': new Date().toISOString(),
          'Form Data': JSON.stringify(merged),
        },
      });
    }
    onFormData(merged);
    if (notify) onUpdated?.();
  };

  const confirm = async () => {
    if (!pendingId || saving) return;
    setSaving(true);
    try {
      const applied = applyKamComplianceConfirmation(
        keepDoneComplianceConfirmations(formData, formDataRef.current),
        pendingId,
        {
          confirmedBy,
          confirmedAt: new Date().toISOString(),
        }
      );
      if (applied.wrote) await persist(applied.formData, true);
      setPendingId(null);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to save compliance');
    } finally {
      setSaving(false);
    }
  };

  const vkycDone = isVkycComplete(formData);
  const vkycAt = readString(formData['_meta.vkyc.doneAt'] || formData['_meta.vkyc.done_at']);
  const vkycBy = readString(formData['_meta.vkyc.doneBy'] || formData['_meta.vkyc.done_by']);

  return (
    <section
      className="rounded-xl border border-sf-border bg-white"
      data-testid="kam-compliance-card"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h4 className="text-sm font-semibold text-sf-text">Compliance Checklist</h4>
        {allComplete ? (
          <p className="text-sm font-medium text-sf-success" data-testid="kam-compliance-all-complete">
            All complete ✓
          </p>
        ) : null}
      </div>
      <ul className="divide-y divide-sf-border border-t border-sf-border">
        <li data-testid="kam-compliance-row-vkyc">
          <div className="flex min-h-[44px] items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${vkycDone ? 'bg-sf-success' : 'bg-neutral-300'}`}
              />
              <span className="text-sm text-sf-text">Video KYC</span>
            </div>
            <p className="text-sm text-sf-text" data-testid="kam-compliance-status-vkyc">
              {vkycDone
                ? canAct
                  ? doneLine('Video KYC Done ✓', vkycAt, vkycBy, '')
                  : 'Video KYC: Done'
                : canAct
                  ? 'Pending'
                  : 'Video KYC: Pending'}
            </p>
          </div>
        </li>
        {KAM_COMPLIANCE_CONFIRM_IDS.map((id) => {
          const done = isKamComplianceConfirmationDone(formData, id);
          const saved = readKamComplianceConfirmation(formData, id);
          const suffix = id === 'loanAgreement' && done ? loanAgreementDoneSuffix(formData) : '';
          const label = kamComplianceRowLabel(id);
          return (
            <li key={id} data-testid={`kam-compliance-row-${id}`}>
              <div className="flex min-h-[44px] items-center justify-between gap-3 px-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-sf-success' : 'bg-neutral-300'}`}
                  />
                  <span className="text-sm text-sf-text">{label}</span>
                </div>
                {done && saved ? (
                  <p className="text-right text-sm text-sf-text" data-testid={`kam-compliance-status-${id}`}>
                    {canAct
                      ? doneLine(kamComplianceDoneLabel(id), saved.confirmedAt, saved.confirmedBy, suffix)
                      : `${label}: Done`}
                  </p>
                ) : canAct ? (
                  <button
                    type="button"
                    className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg bg-sf-navy px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
                    data-testid={`kam-compliance-mark-${id}`}
                    disabled={saving || pendingId != null}
                    onClick={() => setPendingId(id)}
                  >
                    {kamComplianceActionLabel(id)}
                  </button>
                ) : (
                  <p className="text-sm text-sf-text" data-testid={`kam-compliance-status-${id}`}>
                    {`${label}: Pending`}
                  </p>
                )}
              </div>
              {id === 'loanAgreement' && showStampProgress ? (
                <div className="px-4 pb-3">
                  <KamLoanAgreementProgress
                    fileId={resolvedFileId}
                    formData={formData}
                    onPersist={persist}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pendingId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="kam-compliance-confirm"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-xl border border-sf-border bg-white p-5 shadow-lg">
            <p className="text-sm text-sf-text">{kamComplianceConfirmMessage(pendingId, applicantName)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-sf-border px-4 text-sm text-sf-text disabled:opacity-45"
                data-testid="kam-compliance-confirm-cancel"
                disabled={saving}
                onClick={() => setPendingId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg bg-sf-navy px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
                data-testid="kam-compliance-confirm-submit"
                disabled={saving}
                onClick={() => void confirm()}
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
