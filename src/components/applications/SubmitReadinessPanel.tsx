import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { B2cEvFormCompletion } from '../../lib/b2cEvFormValidation';
import { getPendingComplianceLabels } from '../../lib/b2cEvCompliance';
import { isDoFulfilled, isDoRequested } from '../../lib/b2cEvDoRequest';

export interface SubmitReadinessPanelProps {
  completion: B2cEvFormCompletion;
  complianceErrors: Record<string, string>;
  formData: Record<string, unknown>;
  canSubmit: boolean;
}

export function getSubmitBlockers(
  completion: B2cEvFormCompletion,
  complianceErrors: Record<string, string>,
  formData: Record<string, unknown>
): string[] {
  const blockers: string[] = [];

  for (const stage of completion.missingByStage) {
    blockers.push(`${stage.stageTitle}: ${stage.fieldLabels.join(', ')}`);
  }

  for (const message of Object.values(complianceErrors)) {
    if (!blockers.includes(message)) {
      blockers.push(message);
    }
  }

  if (isDoRequested(formData) && !isDoFulfilled(formData)) {
    blockers.push('Your KAM must process the DO request before you can submit');
  }

  return blockers;
}

export function shouldPromptKamWait(
  complianceErrors: Record<string, string>,
  formData: Record<string, unknown>
): boolean {
  if (Object.keys(complianceErrors).length > 0) return true;
  if (getPendingComplianceLabels(formData).length > 0) return true;
  return isDoRequested(formData) && !isDoFulfilled(formData);
}

export const SubmitReadinessPanel: React.FC<SubmitReadinessPanelProps> = ({
  completion,
  complianceErrors,
  formData,
  canSubmit,
}) => {
  if (canSubmit) {
    return (
      <div
        className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-neutral-800"
        data-testid="submit-readiness-panel"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <p>All required fields and compliance checks are complete. You can submit the application.</p>
      </div>
    );
  }

  const blockers = getSubmitBlockers(completion, complianceErrors, formData);
  const promptKamWait = shouldPromptKamWait(complianceErrors, formData);

  return (
    <div
      className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4"
      data-testid="submit-readiness-panel"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-neutral-900">What&apos;s blocking submit</h3>
          <p className="text-sm text-neutral-700">
            Submit stays disabled until every wizard step is complete and KAM has confirmed
            compliance.
          </p>
        </div>
      </div>

      {blockers.length > 0 ? (
        <ul
          className="list-disc space-y-1 pl-5 text-sm text-neutral-800"
          data-testid="submit-readiness-blockers"
        >
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-700" data-testid="submit-readiness-blockers">
          Complete the remaining required fields in earlier steps, then return here to submit.
        </p>
      )}

      <div
        className="rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-800"
        data-testid="submit-readiness-save-draft-prompt"
      >
        <p className="font-medium text-neutral-900">Save draft for now</p>
        <p className="mt-1 text-neutral-700">
          {promptKamWait
            ? 'Use Save draft to keep your Insurance and Vehicle details while your KAM completes compliance, processes the DO request, and finishes any remaining review steps. Submit once everything above is resolved.'
            : 'Use Save draft to keep your progress while you finish the remaining fields above. Return to this step to submit when ready.'}
        </p>
      </div>
    </div>
  );
};
