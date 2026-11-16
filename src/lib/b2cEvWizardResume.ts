import { hasIncompleteDocumentUploads } from './postSubmitEngine/requiredDocs';

export const WIZARD_LAST_STAGE_ID_KEY = '_meta.wizard.lastStageId';
export const WIZARD_LAST_STEP_KEY = '_meta.wizard.lastStep';
const KYC_DOCUMENTS_STAGE_ID = 'kyc-documents';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function patchWizardStepMeta(
  formData: Record<string, unknown>,
  stageId: string,
  stepIndex: number
): Record<string, unknown> {
  return {
    ...formData,
    [WIZARD_LAST_STAGE_ID_KEY]: stageId,
    [WIZARD_LAST_STEP_KEY]: String(stepIndex + 1),
  };
}

export function buildWizardResumeSearchParams(
  draftId: string,
  formData?: Record<string, unknown>
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('draftId', draftId);

  if (!formData) return params;

  if (hasIncompleteDocumentUploads(formData)) {
    params.set('stage', KYC_DOCUMENTS_STAGE_ID);
    return params;
  }

  const stageId = readString(formData[WIZARD_LAST_STAGE_ID_KEY]);
  if (stageId) {
    params.set('stage', stageId);
    return params;
  }

  const stepRaw = readString(formData[WIZARD_LAST_STEP_KEY]);
  const stepNumber = Number.parseInt(stepRaw, 10);
  if (Number.isFinite(stepNumber) && stepNumber >= 1) {
    params.set('step', String(stepNumber));
  }

  return params;
}

export function buildWizardResumePath(
  draftId: string,
  formData?: Record<string, unknown>
): string {
  return `/applications/new?${buildWizardResumeSearchParams(draftId, formData).toString()}`;
}

export function resolveWizardResumeStepIndex(
  formData: Record<string, unknown>,
  visibleStages: Array<{ id: string }>
): number | null {
  if (hasIncompleteDocumentUploads(formData)) {
    const uploadStep = visibleStages.findIndex((stage) => stage.id === KYC_DOCUMENTS_STAGE_ID);
    if (uploadStep >= 0) return uploadStep;
  }

  const stageId = readString(formData[WIZARD_LAST_STAGE_ID_KEY]);
  if (stageId) {
    const byStage = visibleStages.findIndex((stage) => stage.id === stageId);
    if (byStage >= 0) return byStage;
  }

  const stepRaw = readString(formData[WIZARD_LAST_STEP_KEY]);
  const stepNumber = Number.parseInt(stepRaw, 10);
  if (!Number.isFinite(stepNumber) || stepNumber < 1) return null;

  const index = stepNumber - 1;
  if (index >= visibleStages.length) return Math.max(visibleStages.length - 1, 0);
  return index;
}
