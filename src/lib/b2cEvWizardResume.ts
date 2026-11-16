import { readStoredDocumentUploads } from './postSubmitEngine/requiredDocs';

export const WIZARD_LAST_STAGE_ID_KEY = '_meta.wizard.lastStageId';
export const WIZARD_LAST_STEP_KEY = '_meta.wizard.lastStep';
const KYC_DOCUMENTS_STAGE_ID = 'kyc-documents';

const STAGE_FILL_ORDER = [
  KYC_DOCUMENTS_STAGE_ID,
  'support-person',
  'dealer',
  'loan',
  'borrower',
  'product',
] as const;

const STAGE_FILL_KEYS: Record<(typeof STAGE_FILL_ORDER)[number], string[]> = {
  'kyc-documents': [],
  'support-person': [
    '_meta.supportPanLookup.panNumber',
    '_meta.supportPanLookup.fullName',
    'coApplicant.pan',
    'coApplicant.name',
    'guarantor.pan',
    'guarantor.name',
  ],
  dealer: ['dealer.id', 'dealer.name', 'dealer.tradeName'],
  loan: ['loan.vehiclePrice', 'loan.amount', 'loan.tenureMonths', 'loan.insurance'],
  borrower: [
    'borrower.firstName',
    'borrower.lastName',
    'borrower.customerName',
    'borrower.aadhaar',
    'borrower.fatherName',
    'borrower.address.line1',
    'borrower.pan',
  ],
  product: [
    '_meta.panLookup.panNumber',
    '_meta.panLookup.mobileNumber',
    '_meta.panLookup.fullName',
  ],
};

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function isFilledValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && trimmed !== '0' && trimmed !== 'none' && trimmed !== 'pending';
  }
  return false;
}

function stageIsFilled(formData: Record<string, unknown>, stageId: (typeof STAGE_FILL_ORDER)[number]): boolean {
  if (stageId === KYC_DOCUMENTS_STAGE_ID) {
    if (Object.keys(readStoredDocumentUploads(formData)).length > 0) return true;
    return readString(formData['_meta.kycDocuments.documentsString']) !== '';
  }
  if (stageId === 'support-person') {
    const supportType = readString(formData['_meta.supportPersonType']);
    if (supportType === 'co_applicant' || supportType === 'guarantor') return true;
  }
  return STAGE_FILL_KEYS[stageId].some((key) => isFilledValue(formData[key]));
}

/** Furthest wizard step that already has data. Used when an older file never stored a stage. */
export function inferLastFilledWizardStageId(formData: Record<string, unknown>): string | null {
  for (const stageId of STAGE_FILL_ORDER) {
    if (stageIsFilled(formData, stageId)) return stageId;
  }
  return null;
}

function resumeStageId(formData: Record<string, unknown>): string {
  return readString(formData[WIZARD_LAST_STAGE_ID_KEY]) || inferLastFilledWizardStageId(formData) || '';
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

  const stageId = resumeStageId(formData);
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
  const stageId = resumeStageId(formData);
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
