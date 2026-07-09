import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { FormConfigCategory } from '../../lib/b2cEvDocuments';
import { getDoRequestReadiness } from '../../lib/b2cEvDoRequestGate';

export interface DoRequestReadinessPanelProps {
  formData: Record<string, unknown>;
  formConfig: FormConfigCategory[];
}

function StatusRow({
  done,
  label,
  detail,
  testId,
}: {
  done: boolean;
  label: string;
  detail?: string;
  testId: string;
}) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <div className="flex items-start gap-2 text-sm" data-testid={testId}>
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${done ? 'text-success' : 'text-neutral-400'}`}
        aria-hidden
      />
      <div>
        <p className="font-medium text-neutral-900">{label}</p>
        {detail ? <p className="text-xs text-neutral-600">{detail}</p> : null}
      </div>
    </div>
  );
}

export const DoRequestReadinessPanel: React.FC<DoRequestReadinessPanelProps> = ({
  formData,
  formConfig,
}) => {
  const readiness = getDoRequestReadiness(formData, formConfig);
  const complianceDone =
    readiness.complianceApprovedCount === readiness.complianceTotal &&
    readiness.complianceTotal > 0;
  const documentsDone =
    readiness.documentsRequiredCount === 0 ||
    readiness.documentsAddedCount === readiness.documentsRequiredCount;

  return (
    <div
      className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4"
      data-testid="do-request-readiness-panel"
    >
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">DO request readiness</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Request DO only after KAM approves compliance and all required uploads are marked as
          added to the folder. Insurance and Vehicle unlock after your KAM processes the DO
          request.
        </p>
      </div>

      <div className="space-y-2">
        <StatusRow
          done={complianceDone}
          label="Compliance approved by KAM"
          detail={`${readiness.complianceApprovedCount} of ${readiness.complianceTotal} confirmed`}
          testId="do-readiness-compliance"
        />
        <StatusRow
          done={documentsDone}
          label="Required uploads added to folder"
          detail={
            readiness.documentsRequiredCount > 0
              ? `${readiness.documentsAddedCount} of ${readiness.documentsRequiredCount} marked Yes, Added to Folder`
              : 'No required document checklist configured for this product'
          }
          testId="do-readiness-documents"
        />
        <StatusRow
          done={readiness.doRequested}
          label="DO requested"
          detail={
            readiness.doRequested
              ? readiness.doFulfilled
                ? 'Processed by KAM — Insurance and Vehicle are unlocked'
                : 'Sent to KAM — waiting for DO to be processed'
              : 'Not requested yet'
          }
          testId="do-readiness-do-request"
        />
      </div>

      {!readiness.canRequestDo && readiness.blockers.length > 0 && !readiness.doRequested ? (
        <div
          className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-neutral-800"
          data-testid="do-readiness-blockers"
        >
          <p className="font-medium text-neutral-900">Before you can request DO</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {readiness.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
