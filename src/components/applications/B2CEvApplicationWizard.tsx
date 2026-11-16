import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { MainLayout } from '../layout/MainLayout';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import {
  persistUsedClientWebhookLinks,
  readUsedClientWebhookLinks,
  type FormConfigCategory,
} from '../../lib/b2cEvDocuments';
import { useAuth } from '../../auth/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useNavigation } from '../../hooks/useNavigation';
import { useSidebarItems } from '../../hooks/useSidebarItems';
import { apiService, type ClientKycDealerProfile } from '../../services/api';
import { isClientEditableApplication, resolveApplicationStatus } from '../../lib/statusUtils';
import {
  buildWizardResumeSearchParams,
  patchWizardStepMeta,
  resolveWizardResumeStepIndex,
} from '../../lib/b2cEvWizardResume';
import {
  B2C_EV_FORM_TEMPLATE_ID,
  B2C_EV_STAGES,
  createInitialB2cEvFormData,
  getVisibleB2cEvStages,
  type B2cEvFieldDef,
  type B2cEvStage,
  type SupportPersonType,
} from '../../config/forms/b2cEvFormSchema';
import {
  buildStepAdvanceBlockerMessage,
  clearSupportPersonFields,
  getB2cEvFormCompletion,
  isDealerKycPopulated,
  syncB2cEvComputedFields,
  validateB2cEvStage,
} from '../../lib/b2cEvFormValidation';
import {
  applyBorrowerManualProfilePhase,
  buildPanLookupInputHash,
  clearBorrowerFields,
  getPanLookupPayload,
  isPanLookupManual,
  isPanLookupProfileReady,
  migratePanLookupDraftFields,
  PAN_LOOKUP_FIELD_KEYS,
  PAN_LOOKUP_TIMEOUT_SECONDS,
  shouldRefetchPanLookup,
} from '../../lib/b2cEvPanLookup';
import {
  clearSupportPersonProfileFields,
  getSupportPanLookupPayload,
  getSupportPersonFieldPrefix,
  SUPPORT_PAN_LOOKUP_FIELD_KEYS,
} from '../../lib/b2cEvSupportPanLookup';
import { LoanCalculator, type LoanCalculatorPricing } from './LoanCalculator';
import { SupportPersonPanWizard } from './SupportPersonPanWizard';
import { GeoTaggedPhotoUploads } from './GeoTaggedPhotoUploads';
import { KycDocumentsStep } from './KycDocumentsStep';
import { JourneyRail } from '../dealer-ui/JourneyRail';
import { ActionBar } from '../dealer-ui/ActionBar';
import { PageHeader, saveStatusLabel } from '../dealer-ui/PageHeader';
import { buildKycRequiredDocSlots, getUploadedDocMap } from '../../lib/kycRequiredDocs';
import { getBorrowerCibilScoreFromFormData } from '../../lib/b2cEvCibilProbability';
import {
  getPricing,
  isPricingEligible,
  isPricingUnavailable,
  PRICING_NOT_ELIGIBLE_MESSAGE,
  PRICING_UNAVAILABLE_MESSAGE,
} from '../../lib/lenderBrePricing';
import { parseLenderRecord, pickActiveLender } from '../../lib/postSubmitEngine/offers';
import { fireEvent, flushCrm } from '../../lib/crmEvents';
import {
  buildComplianceKamRequestMessage,
  COMPLIANCE_ITEMS,
  validateComplianceForSubmit,
  type ComplianceItemId,
} from '../../lib/b2cEvCompliance';
import {
  buildDoRequestMessage,
  isDoFulfilled,
  isDoRequested,
  POST_DO_LOCKED_STAGE_IDS,
} from '../../lib/b2cEvDoRequest';
import { getDoRequestBlockers, getDoRequestReadiness } from '../../lib/b2cEvDoRequestGate';
import { SubmitReadinessPanel } from './SubmitReadinessPanel';
import { PostSubmitEngineFlow } from './PostSubmitEngineFlow';
import type { PostSubmitSession } from '../../lib/postSubmitEngine/types';
import { buildCanonical } from '../../lib/postSubmitEngine/canonical';
import {
  isOnlyNtcBankStatementRequired,
} from '../../lib/postSubmitEngine/ntcBankStatementGate';
import { writeApplicationRejectedOnCreditFail } from '../../lib/postSubmitEngine/rejectOnCreditFail';
import { decideQualifyAdvance } from '../../lib/postSubmitEngine/qualifyPassGate';
import { buildResumeSession, wizardUrlMayApply } from '../../lib/postSubmitEngine/resolveResumePhase';
import { interpretQualifyResult } from '../../lib/postSubmitEngine/qualifyResult';
import {
  decideSection1LenderOutcome,
} from '../../lib/qualifyKillCodes';
import {
  EXPRESS_B2C_EV_SUBMIT_REQUIRES_DELIVERY_FIELDS,
  getExpressSubmitStopMessage,
} from '../../lib/b2cEvExpressSubmitStop';
import {
  buildDeadlineMeta,
  mergeDeadlineIntoFormData,
} from '../../lib/deadlineCountdown';
import { mergeEngineLoanRowOverFormData } from '../../lib/kycDraftHydrate';
import {
  airtableGet,
  airtableWrite,
  ENGINE_BASE_ID,
  qualifyApplicant,
} from '../../services/engineClient';
import { FindingLenderPanel } from './FindingLenderPanel';
import { applyBureauGuard, loadBureauCacheDays } from '../../lib/bureauGuard';
import {
  applyAddressIndexToPatch,
  buildBureauVerifyKey,
  mergeBureauMetaIntoFormData,
  normalizePan,
  runBureauAndFill,
  type BureauOutcome,
} from '../../lib/runBureauAndFill';
import {
  formDataToFrozenValues,
  frozenValuesToFormDataPatch,
  type LoanCalculatorSnapshot,
  type LoanFrozenValues,
} from '../../lib/loanCalculator';

type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Section1LenderPhase =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found' }
  | { status: 'ntc'; reasons: string[] }
  | { status: 'soft_block'; reasons: string[] }
  | {
      status: 'hard_reject';
      reasons: string[];
      preview: string[];
      overflow: string[];
    };

const FIELD_AUTO_SAVE_DEBOUNCE_MS = 1500;
const GEO_PHOTO_AUTO_SAVE_DEBOUNCE_MS = 2000;
const PAN_MANUAL_FAILURE_MESSAGE =
  'No details found, please enter manually';

/** 1-indexed `step` or `stage` id from URL — for QA jumps (e.g. step=6 → geo-photos). */
export function parseWizardStepJumpParam(
  params: URLSearchParams,
  visibleStages: B2cEvStage[]
): number | null {
  const stageId = params.get('stage')?.trim();
  if (stageId) {
    const byStage = visibleStages.findIndex((stage) => stage.id === stageId);
    if (byStage >= 0) return byStage;
  }

  const stepRaw = params.get('step')?.trim();
  if (!stepRaw) return null;

  const stepNumber = Number.parseInt(stepRaw, 10);
  if (!Number.isFinite(stepNumber) || stepNumber < 1) return null;

  const index = stepNumber - 1;
  if (index >= visibleStages.length) return visibleStages.length - 1;
  return index;
}

interface WizardFormState {
  applicant_name: string;
  loan_product_id: string;
  requested_loan_amount: string;
  form_data: Record<string, unknown>;
}

/** First non-empty trimmed string among draft/Airtable/form candidates. */
function firstDraftString(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return '';
}

const DEMO_DEALER_PATCH: Record<string, unknown> = {
  'dealer.id': 'SFDLR11030',
  'dealer.tradeName': 'Ajay Enterprises',
  'dealer.name': 'Ajay Enterprises',
  'dealer.contact': '7905835489',
  'dealer.email': 'NAGENDRA998451@GMAIL.COM',
  'dealer.gstNumber': '09BMCPG4250M1ZY',
  'dealer.pan': 'BMCPG4250M',
  'dealer.address': 'FLAT NO -00047 NASHIRABAD SAGARPALI BALLIA',
  'dealer.city': 'BALLIA',
  'dealer.state': 'UTTAR PRADESH',
  'dealer.pincode': '277001',
  'dealer.bankName': 'HDFC BANK',
  'dealer.accountNumber': '50200041062642',
  'dealer.ifscCode': 'HDFC0001885',
  'dealer.nameInBank': 'NAGENDRA KUMAR GUPTA',
  'dealer.displayLabel': 'Ajay Enterprises - 7905835489',
  'dealer.linkedClientId': 'USER-1776170387392-b7n4q1v5z',
};

const createClientSubmissionId = (): string =>
  `submit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const DRAFT_NOT_FOUND_USER_MESSAGE =
  "This draft can't be found. Please start a new application.";

function isApplicationNotFoundError(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  return /application not found/i.test(errorMessage);
}

function isDraftNotFoundForDoRequest(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  return isApplicationNotFoundError(errorMessage) || /not found/i.test(errorMessage);
}

function readFieldValue(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value);
}

function isFieldReadOnly(field: B2cEvFieldDef, formData: Record<string, unknown>): boolean {
  if (field.key === 'borrower.pan' && isPanLookupManual(formData)) {
    return false;
  }
  return Boolean(field.readOnly);
}

const UPPERCASE_IDENTITY_FIELD_KEYS = new Set([
  '_meta.panLookup.panNumber',
  '_meta.panLookup.fullName',
  '_meta.supportPanLookup.panNumber',
  '_meta.supportPanLookup.fullName',
]);

function forceUppercaseIdentityValue(key: string, value: string): string {
  return UPPERCASE_IDENTITY_FIELD_KEYS.has(key) ? value.toUpperCase() : value;
}

function renderField(
  field: B2cEvFieldDef,
  value: string,
  error: string | undefined,
  onChange: (key: string, value: string) => void,
  formData: Record<string, unknown>
): React.ReactNode {
  const readOnly = isFieldReadOnly(field, formData);
  const forceChars = UPPERCASE_IDENTITY_FIELD_KEYS.has(field.key);
  const common = {
    id: field.key,
    label: field.label,
    required: field.required,
    readOnly,
    disabled: readOnly,
    error,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(field.key, forceUppercaseIdentityValue(field.key, e.target.value)),
    ...(forceChars ? { autoCapitalize: 'characters' as const } : {}),
  };

  if (field.type === 'textarea') {
    return (
      <TextArea
        key={field.key}
        {...common}
        tone="dealer"
        rows={3}
        placeholder={readOnly ? undefined : field.placeholder}
      />
    );
  }
  if (field.type === 'select' && field.options) {
    const emptyOption = readOnly
      ? { value: '', label: '' }
      : { value: '', label: `Select ${field.label}` };
    return (
      <Select
        key={field.key}
        label={field.label}
        required={field.required}
        error={error}
        value={value}
        disabled={readOnly}
        options={[emptyOption, ...field.options]}
        onChange={(e) => onChange(field.key, e.target.value)}
        data-testid={`b2c-field-${field.key.replace(/\./g, '-')}`}
        tone="dealer"
      />
    );
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'tel'
        ? 'tel'
        : field.type === 'date'
          ? 'date'
          : field.type === 'number' || field.type === 'currency' || field.type === 'percent'
            ? 'text'
            : 'text';

  return (
    <Input
      key={field.key}
      {...common}
      type={inputType}
      placeholder={readOnly ? undefined : field.placeholder}
      data-testid={`b2c-field-${field.key.replace(/\./g, '-')}`}
      tone="dealer"
    />
  );
}

export const B2CEvApplicationWizard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');
  const productIdParam = searchParams.get('productId');
  const wizardStepParam = searchParams.get('step');
  const wizardStageParam = searchParams.get('stage');
  const wizardStageQueryPinned = B2C_EV_STAGES.some((stage) => stage.id === wizardStageParam);
  const { user } = useAuth();
  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loanProductsLoading, setLoanProductsLoading] = useState(true);
  const [loanProductsError, setLoanProductsError] = useState<string | null>(null);
  const [, setDealerProfile] = useState<ClientKycDealerProfile | null>(null);
  const [dealerKycError, setDealerKycError] = useState<string | null>(null);
  const [dealerKycLoading, setDealerKycLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [stepAdvanceMessage, setStepAdvanceMessage] = useState<string | null>(null);
  const [panLookupLoading, setPanLookupLoading] = useState(false);
  const [panLookupError, setPanLookupError] = useState<string | null>(null);
  const [panLookupCountdown, setPanLookupCountdown] = useState(0);
  const [supportPanLookupLoading, setSupportPanLookupLoading] = useState(false);
  const [supportPanLookupError, setSupportPanLookupError] = useState<string | null>(null);
  const [supportBureauOutcome, setSupportBureauOutcome] = useState<BureauOutcome | null>(null);
  const [supportBureauManualMode, setSupportBureauManualMode] = useState(false);
  const [supportBureauConsent, setSupportBureauConsent] = useState(false);
  const [supportBureauConsentAt, setSupportBureauConsentAt] = useState<string | null>(null);
  const [supportBureauAutofilledKeys, setSupportBureauAutofilledKeys] = useState<string[]>([]);
  const [supportBureauAddressIndex, setSupportBureauAddressIndex] = useState(0);
  const supportBureauVerifiedKeyRef = useRef<string | null>(null);
  const supportBureauOutcomeRef = useRef<BureauOutcome | null>(null);
  const [kamRequestLoadingId, setKamRequestLoadingId] = useState<ComplianceItemId | null>(null);
  const [doRequestLoading, setDoRequestLoading] = useState(false);
  const [productFormConfig, setProductFormConfig] = useState<FormConfigCategory[]>([]);
  const [productFormConfigLoading, setProductFormConfigLoading] = useState(false);
  const [usedWebhookLinks, setUsedWebhookLinks] = useState<Set<string>>(() =>
    readUsedClientWebhookLinks()
  );
  const [clientSubmissionId] = useState(createClientSubmissionId);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
  const [postSubmitSession, setPostSubmitSession] = useState<PostSubmitSession | null>(null);
  /** Hard stop from Experian / credit check — blocks submit and drives visible UI state. */
  const [creditGateError, setCreditGateError] = useState<string | null>(null);
  const [section1Lender, setSection1Lender] = useState<Section1LenderPhase>({ status: 'idle' });
  const [loanPricing, setLoanPricing] = useState<LoanCalculatorPricing | null>(null);
  const [loanPricingError, setLoanPricingError] = useState<string | null>(null);
  const [loanPricingLoading, setLoanPricingLoading] = useState(false);
  const submitInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const formStateRef = useRef<WizardFormState>({
    applicant_name: '',
    loan_product_id: '',
    requested_loan_amount: '0',
    form_data: createInitialB2cEvFormData(),
  });
  const editingDraftIdRef = useRef<string | null>(null);
  const draftUrlSyncedRef = useRef(false);
  const draftResumeAppliedRef = useRef(false);
  const wizardJumpAppliedRef = useRef(false);
  const currentStepRef = useRef(0);
  const visibleStagesRef = useRef<B2cEvStage[]>([]);
  const autoSaveTimerRef = useRef<number | null>(null);
  const pendingSaveChainRef = useRef<Promise<unknown>>(Promise.resolve());

  const [formState, setFormState] = useState<WizardFormState>({
    applicant_name: '',
    loan_product_id: '',
    requested_loan_amount: '0',
    form_data: createInitialB2cEvFormData(),
  });

  const visibleStages = useMemo(
    () => getVisibleB2cEvStages(formState.form_data),
    [formState.form_data]
  );
  const currentStage = visibleStages[currentStep] ?? visibleStages[0];

  const completion = useMemo(
    () =>
      getB2cEvFormCompletion(visibleStages, formState.form_data, formState.loan_product_id, {
        formConfig: productFormConfig,
      }),
    [visibleStages, formState.form_data, formState.loan_product_id, productFormConfig]
  );

  const complianceErrors = useMemo(
    () => validateComplianceForSubmit(formState.form_data),
    [formState.form_data]
  );

  const canSubmitApplication =
    completion.isComplete && Object.keys(complianceErrors).length === 0;

  const isLastStep = currentStep === visibleStages.length - 1;

  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    editingDraftIdRef.current = editingDraftId;
  }, [editingDraftId]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    visibleStagesRef.current = visibleStages;
  }, [visibleStages]);

  const cancelScheduledAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current != null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const commitFormState = useCallback((updater: (prev: WizardFormState) => WizardFormState) => {
    setFormState((prev) => {
      const next = updater(prev);
      formStateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!wizardStageQueryPinned) return;
    if (!wizardUrlMayApply(formState.form_data)) return;
    setPostSubmitSession(null);
  }, [wizardStageQueryPinned, formState.form_data]);

  const clearStaleWizardJump = useCallback(() => {
    setSearchParams(
      (prev) => {
        if (!prev.get('stage') && !prev.get('step')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('stage');
        next.delete('step');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (!wizardStepParam && !wizardStageParam) return;
    if (draftLoading) return;
    if (!wizardUrlMayApply(formState.form_data)) {
      clearStaleWizardJump();
      return;
    }
    if (wizardJumpAppliedRef.current) return;

    const targetIndex = parseWizardStepJumpParam(searchParams, visibleStages);
    if (targetIndex != null) {
      setCurrentStep(targetIndex);
    }
    wizardJumpAppliedRef.current = true;
  }, [
    wizardStepParam,
    wizardStageParam,
    visibleStages,
    searchParams,
    draftLoading,
    formState.form_data,
    clearStaleWizardJump,
  ]);

  const syncWizardStageInUrl = useCallback(
    (stepIndex: number) => {
      const stage = visibleStagesRef.current[stepIndex];
      if (!stage) return;

      setSearchParams(
        (prev) => {
          if (prev.get('stage') === stage.id && !prev.get('step')) {
            return prev;
          }
          const next = new URLSearchParams(prev);
          next.delete('step');
          next.set('stage', stage.id);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!draftIdParam) {
      draftResumeAppliedRef.current = false;
      return;
    }
    // Wait until draft fetch finished and form_data is hydrated before applying resume.
    if (draftLoading || !editingDraftId) return;
    if (wizardStepParam || wizardStageParam) return;
    if (draftResumeAppliedRef.current) return;

    const resumeIndex = resolveWizardResumeStepIndex(formState.form_data, visibleStages);
    if (resumeIndex != null) {
      setCurrentStep(resumeIndex);
      syncWizardStageInUrl(resumeIndex);
    }
    draftResumeAppliedRef.current = true;
  }, [
    draftIdParam,
    draftLoading,
    editingDraftId,
    formState.form_data,
    visibleStages,
    wizardStepParam,
    wizardStageParam,
    syncWizardStageInUrl,
  ]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!panLookupLoading) {
      setPanLookupCountdown(0);
      return;
    }

    setPanLookupCountdown(PAN_LOOKUP_TIMEOUT_SECONDS);
    const interval = window.setInterval(() => {
      setPanLookupCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [panLookupLoading]);

  const panLookupLoadingMessage =
    panLookupCountdown > 0
      ? `Checking bureau cache… ${panLookupCountdown}s`
      : 'Checking bureau cache…';

  const supportPersonTypeLabel =
    String(formState.form_data['_meta.supportPersonType'] || '') === 'guarantor'
      ? 'guarantor'
      : 'co-applicant';
  const supportPanLookupLoadingMessage = `Checking ${supportPersonTypeLabel}…`;

  // Co-applicant / guarantor is check-only: any finished verify (pass/ntc/fail)
  // unlocks Next. Never writes Status Rejected for support-person fails.
  const supportBureauGateReady = (() => {
    if (supportBureauManualMode) return true;
    if (!supportBureauOutcome) return false;
    if (
      supportBureauOutcome.status === 'pass' ||
      supportBureauOutcome.status === 'ntc' ||
      supportBureauOutcome.status === 'fail'
    ) {
      return true;
    }
    if (supportBureauOutcome.status === 'error') return supportBureauManualMode;
    return false;
  })();

  const supportNextDisabled =
    currentStage?.id === 'support-person' && !supportBureauGateReady;

  const doRequested = isDoRequested(formState.form_data);
  const doFulfilled = isDoFulfilled(formState.form_data);
  const doRequestReadiness = useMemo(
    () => getDoRequestReadiness(formState.form_data, productFormConfig),
    [formState.form_data, productFormConfig]
  );

  const section1QualifyBlocked =
    section1Lender.status === 'soft_block' || section1Lender.status === 'hard_reject';

  const lockedStepIndices = useMemo(() => {
    // No KAM/DO lock in dealer flow (POST_DO_LOCKED_STAGE_IDS is empty).
    void POST_DO_LOCKED_STAGE_IDS;
    void doFulfilled;
    if (!section1QualifyBlocked) return [];

    // Grey out the full journey after a section-1 qualify fail (keep product clickable).
    return visibleStages
      .map((_, index) => (index === 0 ? null : index))
      .filter((index): index is number => index !== null);
  }, [visibleStages, section1QualifyBlocked]);

  const isGeoPhotosStage = currentStage?.id === 'geo-photos';
  const isKycDocumentsStage = currentStage?.id === 'kyc-documents';
  const [kycStepReady, setKycStepReady] = useState(false);
  const kycMissingCount = useMemo(() => {
    if (!isKycDocumentsStage) return 0;
    const slots = buildKycRequiredDocSlots(formState.form_data, productFormConfig);
    const uploaded = getUploadedDocMap(formState.form_data);
    return slots.filter((slot) => slot.required && !uploaded[slot.fieldId]).length;
  }, [isKycDocumentsStage, formState.form_data, productFormConfig]);
  const kycDisabledReason =
    !isKycDocumentsStage || kycStepReady
      ? null
      : kycMissingCount > 0
        ? `Upload ${kycMissingCount} more document${kycMissingCount === 1 ? '' : 's'}`
        : 'Request video KYC to continue';

  const completedStepIndices = useMemo(() => {
    return visibleStages
      .map((stage, index) => {
        const { errors } = getB2cEvFormCompletion(
          [stage],
          formState.form_data,
          formState.loan_product_id,
          { formConfig: productFormConfig }
        );
        return Object.keys(errors).length === 0 ? index : null;
      })
      .filter((index): index is number => index !== null);
  }, [visibleStages, formState.form_data, formState.loan_product_id, productFormConfig]);

  useEffect(() => {
    const productId = formState.loan_product_id.trim();
    if (!productId) {
      setProductFormConfig([]);
      return;
    }

    let cancelled = false;
    setProductFormConfigLoading(true);
    void apiService.getFormConfig(productId).then((response) => {
      if (cancelled) return;
      if (response.success && Array.isArray(response.data)) {
        setProductFormConfig(response.data as FormConfigCategory[]);
      } else {
        setProductFormConfig([]);
      }
      setProductFormConfigLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [formState.loan_product_id]);

  const loadLoanPricing = useCallback(async () => {
    const pan = String(
      formStateRef.current.form_data['borrower.pan'] ||
        formStateRef.current.form_data['_meta.panLookup.panNumber'] ||
        ''
    )
      .trim()
      .toUpperCase();
    const productId = formStateRef.current.loan_product_id.trim();
    if (!pan || !productId) {
      setLoanPricing(null);
      setLoanPricingError(PRICING_UNAVAILABLE_MESSAGE);
      return;
    }
    setLoanPricingLoading(true);
    setLoanPricingError(null);
    try {
      const lendersRes = await airtableGet({
        table: 'Lenders',
        filter_formula: "{status} = 'active'",
        max: 50,
      });
      const lenders = (lendersRes.records || [])
        .map((row) => parseLenderRecord(row as Record<string, unknown>))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      let defaultLenderName: string | null = null;
      if (lenders.length > 1) {
        try {
          const cfg = await airtableGet({
            table: 'Config',
            filter_formula: "{key} = 'default_lender'",
            max: 1,
          });
          defaultLenderName = String(cfg.records?.[0]?.value ?? '').trim() || null;
        } catch {
          defaultLenderName = null;
        }
      }
      const picked = pickActiveLender(lenders, defaultLenderName);
      if (!picked.ok) {
        setLoanPricing(null);
        setLoanPricingError(picked.reason);
        return;
      }
      const pricing = await getPricing(pan, picked.lender.name, productId);
      if (isPricingUnavailable(pricing)) {
        setLoanPricing(null);
        setLoanPricingError(pricing.message);
        const next = await fireEvent('PRICING_UNAVAILABLE', {
          summary: pricing.message,
          fileKey: String(formStateRef.current.form_data['_meta.fileId'] || editingDraftIdRef.current || pan),
          formData: formStateRef.current.form_data,
          applicantName: formStateRef.current.applicant_name,
          applicantMobile: String(formStateRef.current.form_data['borrower.mobile'] || ''),
        });
        commitFormState((prev) => ({ ...prev, form_data: next }));
        return;
      }
      if (!isPricingEligible(pricing)) {
        setLoanPricing(null);
        setLoanPricingError(PRICING_NOT_ELIGIBLE_MESSAGE);
        const next = await fireEvent('PRICING_NOT_ELIGIBLE', {
          summary: PRICING_NOT_ELIGIBLE_MESSAGE,
          fileKey: String(formStateRef.current.form_data['_meta.fileId'] || editingDraftIdRef.current || pan),
          formData: formStateRef.current.form_data,
          applicantName: formStateRef.current.applicant_name,
          applicantMobile: String(formStateRef.current.form_data['borrower.mobile'] || ''),
        });
        commitFormState((prev) => ({ ...prev, form_data: next }));
        return;
      }
      setLoanPricing({
        roi_pct: pricing.roi_pct,
        pf_pct: pricing.pf_pct,
        rule_id: pricing.rule_id,
      });
      commitFormState((prev) => ({
        ...prev,
        form_data: {
          ...prev.form_data,
          '_meta.pricing': {
            rule_id: pricing.rule_id,
            roi_pct: pricing.roi_pct,
            pf_pct: pricing.pf_pct,
            priced_at: new Date().toISOString(),
          },
        },
      }));
    } catch {
      setLoanPricing(null);
      setLoanPricingError(PRICING_UNAVAILABLE_MESSAGE);
    } finally {
      setLoanPricingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentStage?.id !== 'loan') return;
    void loadLoanPricing();
  }, [currentStage?.id, formState.loan_product_id, loadLoanPricing]);

  const handleFolderLinkConsumed = useCallback((link: string) => {
    setUsedWebhookLinks((prev) => {
      const next = new Set(prev);
      next.add(link);
      persistUsedClientWebhookLinks(next);
      return next;
    });
    setFormState((prev) => ({
      ...prev,
      form_data: {
        ...prev.form_data,
        '_meta.documentsFolderLink.consumedAt': new Date().toISOString(),
        '_meta.documentsFolderLink.consumedLink': link,
      },
    }));
  }, []);

  const applyDealerPatch = (patch: Record<string, unknown>) => {
    setFormState((prev) => ({
      ...prev,
      form_data: syncB2cEvComputedFields({ ...prev.form_data, ...patch }),
    }));
  };

  const loadDealerKyc = async (
    formData?: Record<string, unknown>
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (formData && isDealerKycPopulated(formData)) {
      return { ok: true };
    }

    setDealerKycLoading(true);
    try {
      const kycRes = await apiService.getClientKyc();
      if (kycRes.success && kycRes.data?.formDataPatch) {
        setDealerProfile(kycRes.data);
        setDealerKycError(null);
        setFormState((prev) => ({
          ...prev,
          form_data: syncB2cEvComputedFields({
            ...prev.form_data,
            ...kycRes.data!.formDataPatch!,
          }),
        }));
        return { ok: true };
      }

      const message =
        kycRes.error ||
        'No active Client KYC record found for your account. Contact your KAM to complete dealer KYC setup.';
      setDealerKycError(message);
      if (window.location.search.includes('b2cEv=1')) {
        applyDealerPatch(DEMO_DEALER_PATCH);
        return { ok: true };
      }
      return { ok: false, error: message };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to load dealer profile from Client KYC';
      setDealerKycError(message);
      return { ok: false, error: message };
    } finally {
      setDealerKycLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoanProductsLoading(true);
      try {
        const productsRes = await apiService.listLoanProducts(true);

        if (productsRes.success && productsRes.data) {
          setLoanProducts(
            (productsRes.data as Array<{ productId?: string; id?: string; productName?: string; name?: string }>).map(
              (p) => ({
                id: String(p.productId || p.id || ''),
                name: String(p.productName || p.name || p.productId || p.id || 'Product'),
              })
            )
          );
        } else {
          setLoanProductsError(productsRes.error || 'Failed to load loan products');
        }

        await loadDealerKyc();
      } finally {
        setLoanProductsLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial mount only
  }, []);

  // Pre-select product from ?productId= (dashboard tile +). Draft resume always wins.
  useEffect(() => {
    if (draftIdParam) return;
    const trimmed = productIdParam?.trim() ?? '';
    if (!trimmed) return;
    if (loanProductsLoading) return;

    setFormState((prev) => {
      if (prev.loan_product_id) return prev;
      if (loanProducts.length > 0 && !loanProducts.some((p) => p.id === trimmed)) {
        return prev;
      }
      const next = { ...prev, loan_product_id: trimmed };
      formStateRef.current = next;
      return next;
    });
  }, [draftIdParam, productIdParam, loanProductsLoading, loanProducts]);

  useEffect(() => {
    if (!draftIdParam) return;
    // Only load from the server for a draft we are NOT already editing in this
    // session (i.e. a genuine "Continue" from the client list, which mounts
    // fresh with editingDraftIdRef === null). When a new application autosaves,
    // it creates a draft and pushes its id into the URL; that must NOT re-trigger
    // a full reload (which would flash "Loading draft..." and clobber local edits).
    if (editingDraftIdRef.current === draftIdParam) return;
    const loadDraft = async () => {
      setDraftLoading(true);
      setDraftLoadError(null);
      try {
        const response = await apiService.getApplication(draftIdParam);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Draft not found');
        }
        const app = response.data;
        const statusKey = resolveApplicationStatus(app.status || app.Status || '');
        if (!isClientEditableApplication(statusKey)) {
          throw new Error('Only draft applications can be edited here');
        }
        let parsedFormData: Record<string, unknown> = {};
        const rawForm = app.formData ?? (app as unknown as Record<string, unknown>).form_data;
        if (rawForm != null) {
          if (typeof rawForm === 'string') {
            parsedFormData = JSON.parse(rawForm) as Record<string, unknown>;
          } else if (typeof rawForm === 'object' && !Array.isArray(rawForm)) {
            parsedFormData = rawForm as Record<string, unknown>;
          }
        }
        const appRecord = app as unknown as Record<string, unknown>;
        const productIdFromLoanProductObject =
          typeof app.loan_product === 'object' && app.loan_product
            ? String((app.loan_product as { code?: string }).code || '').trim()
            : '';
        const productId = firstDraftString(
          productIdFromLoanProductObject,
          app.loanProduct,
          typeof app.loan_product === 'string' ? app.loan_product : '',
          appRecord['Loan Product'],
          parsedFormData.loan_product_id,
          parsedFormData.loanProductId,
          parsedFormData.productId,
          productIdParam
        );

        let hydratedFormData = parsedFormData;
        if (String(draftIdParam).startsWith('rec')) {
          try {
            const engineRes = await airtableGet({
              table: 'Loan Applications',
              filter_formula: `RECORD_ID() = '${String(draftIdParam).replace(/'/g, "\\'")}'`,
              max: 1,
            });
            const engineRecord = engineRes.records?.[0];
            if (engineRecord) {
              hydratedFormData = mergeEngineLoanRowOverFormData(parsedFormData, engineRecord);
            }
          } catch {
            // Keep Express form_data if Engine merge fails.
          }
        }

        const fileId = firstDraftString(
          hydratedFormData['_meta.fileId'],
          appRecord['File ID'],
          appRecord.fileId
        );
        if (fileId) {
          hydratedFormData = { ...hydratedFormData, '_meta.fileId': fileId };
        }

        const canonicalDraftId = String(
          (app as { id?: string; loanApplicationId?: string }).id ||
            (app as { loanApplicationId?: string }).loanApplicationId ||
            draftIdParam
        );
        setEditingDraftId(canonicalDraftId);
        draftUrlSyncedRef.current = true;
        const nextFormState: WizardFormState = {
          applicant_name: firstDraftString(
            app.applicant_name,
            app.applicantName,
            appRecord['Applicant Name'],
            hydratedFormData['borrower.customerName']
          ),
          loan_product_id: productId,
          requested_loan_amount:
            firstDraftString(
              app.requested_loan_amount,
              app.requestedLoanAmount,
              appRecord['Requested Loan Amount'],
              hydratedFormData['loan.amount']
            ) || '0',
          form_data: syncB2cEvComputedFields(
            migratePanLookupDraftFields({
              ...createInitialB2cEvFormData(),
              ...hydratedFormData,
            })
          ),
        };
        formStateRef.current = nextFormState;
        setFormState(nextFormState);
        const resumed = buildResumeSession(nextFormState.form_data, canonicalDraftId);
        if (resumed && (!wizardStageQueryPinned || !wizardUrlMayApply(nextFormState.form_data))) {
          setPostSubmitSession(resumed);
        }
        if (!wizardUrlMayApply(nextFormState.form_data)) clearStaleWizardJump();
        const flushKey = String(
          nextFormState.form_data['_meta.fileId'] || canonicalDraftId || draftIdParam
        );
        void flushCrm(nextFormState.form_data, {
          fileKey: flushKey,
          applicantName: nextFormState.applicant_name,
          applicantMobile: String(nextFormState.form_data['borrower.mobile'] || ''),
        }).then((flushed) => {
          if (flushed === nextFormState.form_data) return;
          commitFormState((prev) => ({ ...prev, form_data: flushed }));
        });
        if (!isDealerKycPopulated(hydratedFormData)) {
          await loadDealerKyc(hydratedFormData);
        }
      } catch (error: unknown) {
        // Airtable-only rec* drafts may not exist in Express — still bind the id so
        // bureau Verify can persist Form Data via /engine/airtable_write.
        if (String(draftIdParam).startsWith('rec')) {
          setEditingDraftId(draftIdParam);
          editingDraftIdRef.current = draftIdParam;
          draftUrlSyncedRef.current = true;
          setDraftLoadError(null);
          try {
            const engineRes = await airtableGet({
              table: 'Loan Applications',
              filter_formula: `RECORD_ID() = '${String(draftIdParam).replace(/'/g, "\\'")}'`,
              max: 1,
            });
            const engineRecord = engineRes.records?.[0];
            if (engineRecord) {
              const hydrated = mergeEngineLoanRowOverFormData({}, engineRecord);
              const fileId = firstDraftString(
                hydrated['_meta.fileId'],
                engineRecord['File ID'],
                engineRecord.fileId
              );
              const formDataWithFileId = fileId
                ? { ...hydrated, '_meta.fileId': fileId }
                : hydrated;
              const nextFormState: WizardFormState = {
                applicant_name: firstDraftString(
                  engineRecord['Applicant Name'],
                  formDataWithFileId['borrower.customerName']
                ),
                loan_product_id: firstDraftString(
                  formDataWithFileId.loan_product_id,
                  formDataWithFileId.loanProductId,
                  engineRecord['Loan Product'],
                  formDataWithFileId.productId
                ),
                requested_loan_amount:
                  firstDraftString(
                    engineRecord['Requested Loan Amount'],
                    formDataWithFileId['loan.amount']
                  ) || '0',
                form_data: syncB2cEvComputedFields(
                  migratePanLookupDraftFields({
                    ...createInitialB2cEvFormData(),
                    ...formDataWithFileId,
                  })
                ),
              };
              formStateRef.current = nextFormState;
              setFormState(nextFormState);
              const resumed = buildResumeSession(nextFormState.form_data, draftIdParam);
              if (resumed && (!wizardStageQueryPinned || !wizardUrlMayApply(nextFormState.form_data))) {
                setPostSubmitSession(resumed);
              }
              if (!wizardUrlMayApply(nextFormState.form_data)) clearStaleWizardJump();
              void flushCrm(nextFormState.form_data, {
                fileKey: String(
                  nextFormState.form_data['_meta.fileId'] || draftIdParam
                ),
                applicantName: nextFormState.applicant_name,
                applicantMobile: String(nextFormState.form_data['borrower.mobile'] || ''),
              }).then((flushed) => {
                if (flushed === nextFormState.form_data) return;
                commitFormState((prev) => ({ ...prev, form_data: flushed }));
              });
            }
          } catch {
            // Leave empty initial form if Engine also fails.
          }
        } else {
          setDraftLoadError(error instanceof Error ? error.message : 'Failed to load draft');
        }
      } finally {
        setDraftLoading(false);
      }
    };
    void loadDraft();
  }, [draftIdParam, commitFormState]);

  useEffect(() => {
    if (currentStage?.id !== 'dealer') return;
    if (dealerKycLoading || isDealerKycPopulated(formState.form_data)) return;
    void loadDealerKyc(formState.form_data);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when dealer stage is opened
  }, [currentStage?.id, currentStep]);

  useEffect(() => {
    if (!isGeoPhotosStage || !doFulfilled) return;
    setStepAdvanceMessage('DO approved by your KAM. Continue to Insurance and Vehicle details.');
  }, [isGeoPhotosStage, doFulfilled]);

  const buildFormDataPayloadFromState = (
    state: WizardFormState,
    patch?: Record<string, string>
  ): Record<string, unknown> => {
    const synced = syncB2cEvComputedFields({ ...state.form_data, ...patch });
    const stage = visibleStagesRef.current[currentStepRef.current];
    const withWizardMeta = stage
      ? patchWizardStepMeta(synced, stage.id, currentStepRef.current)
      : synced;

    return {
      ...withWizardMeta,
      '_meta.formTemplate': B2C_EV_FORM_TEMPLATE_ID,
    };
  };

  const persistDraft = useCallback(
    async (
      patch?: Record<string, string>,
      options?: { silent?: boolean }
    ): Promise<{ draftId: string }> => {
      const state = formStateRef.current;
      if (!state.loan_product_id) {
        throw new Error('Please select a loan product before saving.');
      }

      const runSave = async (): Promise<string> => {
        const latestState = formStateRef.current;
        const formDataToSend = buildFormDataPayloadFromState(latestState, patch);
        const applicantName =
          readFieldValue(formDataToSend, 'borrower.customerName') || latestState.applicant_name;
        const loanAmount = readFieldValue(formDataToSend, 'loan.amount').replace(/,/g, '');
        const requestedAmount = loanAmount || latestState.requested_loan_amount;

        let draftId = editingDraftIdRef.current;

        if (draftId) {
          const updateRes = await apiService.updateApplicationForm(draftId, {
            ...formDataToSend,
            applicant_name: applicantName,
            loan_product_id: latestState.loan_product_id,
            requested_loan_amount: requestedAmount,
          });
          if (!updateRes.success) {
            if (isApplicationNotFoundError(updateRes.error)) {
              setEditingDraftId(null);
              editingDraftIdRef.current = null;
              draftId = null;
            } else {
              throw new Error(updateRes.error || 'Failed to update draft');
            }
          } else {
            return draftId;
          }
        }

        const createRes = await apiService.createApplication({
          applicantName,
          productId: latestState.loan_product_id,
          requestedLoanAmount: Number(requestedAmount) || 0,
          formData: formDataToSend,
          saveAsDraft: true,
          clientSubmissionId,
        });
        if (!createRes.success) {
          throw new Error(createRes.error || 'Failed to create draft');
        }

        draftId = createRes.data?.loanApplicationId || createRes.data?.fileId || null;
        if (!draftId) {
          throw new Error('Draft ID missing after create');
        }
        setEditingDraftId(draftId);
        editingDraftIdRef.current = draftId;
        if (!draftUrlSyncedRef.current) {
          draftUrlSyncedRef.current = true;
          const resumeParams = buildWizardResumeSearchParams(draftId, formDataToSend);
          navigate(`/applications/new?${resumeParams.toString()}`, { replace: true });
        }
        return draftId;
      };

      const savePromise = pendingSaveChainRef.current.then(async () => {
        if (!options?.silent) {
          setDraftSaveStatus('saving');
        }
        saveInFlightRef.current = true;
        try {
          const draftId = await runSave();
          if (!options?.silent) {
            setDraftSaveStatus('saved');
          }
          return draftId;
        } catch (error) {
          if (!options?.silent) {
            setDraftSaveStatus('error');
          }
          console.error('[B2CEvApplicationWizard] draft save failed:', error);
          throw error;
        } finally {
          saveInFlightRef.current = false;
        }
      });

      pendingSaveChainRef.current = savePromise.then(
        () => undefined,
        () => undefined
      );

      const draftId = await savePromise;
      return { draftId };
    },
    [clientSubmissionId, navigate]
  );

  const ensureDraftSaved = useCallback(async (): Promise<string> => {
    const { draftId } = await persistDraft();
    return draftId;
  }, [persistDraft]);

  const persistDraftRef = useRef(persistDraft);
  useEffect(() => {
    persistDraftRef.current = persistDraft;
  }, [persistDraft]);

  const scheduleAutoSave = useCallback(
    (_debounceMs = FIELD_AUTO_SAVE_DEBOUNCE_MS) => {
      // Auto-save disabled — drafts persist only on explicit Save / Next / Submit.
    },
    []
  );

  const updateField = (key: string, value: string) => {
    const nextValue = forceUppercaseIdentityValue(key, value);
    commitFormState((prev) => {
      let nextFormData = { ...prev.form_data, [key]: nextValue };
      if (key === '_meta.supportPersonType') {
        nextFormData = clearSupportPersonFields(nextFormData, value as SupportPersonType);
      }
      if ((PAN_LOOKUP_FIELD_KEYS as readonly string[]).includes(key)) {
        nextFormData['_meta.panLookup.status'] = 'pending';
        nextFormData['_meta.panLookup.inputHash'] = '';
        nextFormData['_meta.panLookup.completedAt'] = '';
      }
      if (
        key === '_meta.supportPanLookup.panNumber' ||
        key === '_meta.supportPanLookup.mobileNumber'
      ) {
        nextFormData['_meta.supportPanLookup.status'] = 'pending';
        nextFormData['_meta.supportPanLookup.inputHash'] = '';
        nextFormData['_meta.supportPanLookup.completedAt'] = '';
        nextFormData['_meta.supportPanLookup.phase'] = 'input';
        const prefix = getSupportPersonFieldPrefix(
          readFieldValue(nextFormData, '_meta.supportPersonType') as SupportPersonType
        );
        if (prefix) {
          nextFormData = clearSupportPersonProfileFields(nextFormData, prefix);
        }
      }
      nextFormData = syncB2cEvComputedFields(nextFormData);
      const applicantName = readFieldValue(nextFormData, 'borrower.customerName');
      const loanAmount = readFieldValue(nextFormData, 'loan.amount').replace(/,/g, '');
      return {
        ...prev,
        applicant_name: applicantName,
        requested_loan_amount: loanAmount || prev.requested_loan_amount,
        form_data: nextFormData,
      };
    });
    if ((PAN_LOOKUP_FIELD_KEYS as readonly string[]).includes(key)) {
      setPanLookupError(null);
      setSection1Lender({ status: 'idle' });
    }
    if (
      key === '_meta.supportPanLookup.panNumber' ||
      key === '_meta.supportPanLookup.mobileNumber'
    ) {
      resetSupportBureauUi();
    } else if ((SUPPORT_PAN_LOOKUP_FIELD_KEYS as readonly string[]).includes(key)) {
      setSupportPanLookupError(null);
    }
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setStepAdvanceMessage(null);
    scheduleAutoSave();
  };

  const updateFields = (
    patch: Record<string, string>,
    options?: { debounceMs?: number }
  ) => {
    if (Object.keys(patch).length === 0) return;

    commitFormState((prev) => {
      const nextFormData = syncB2cEvComputedFields({ ...prev.form_data, ...patch });
      const applicantName = readFieldValue(nextFormData, 'borrower.customerName');
      const loanAmount = readFieldValue(nextFormData, 'loan.amount').replace(/,/g, '');
      return {
        ...prev,
        applicant_name: applicantName,
        requested_loan_amount: loanAmount || prev.requested_loan_amount,
        form_data: nextFormData,
      };
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) {
        delete next[key];
      }
      return next;
    });
    scheduleAutoSave(options?.debounceMs ?? FIELD_AUTO_SAVE_DEBOUNCE_MS);
  };


  const handleRequestFromKam = async (itemId: ComplianceItemId) => {
    const item = COMPLIANCE_ITEMS.find((entry) => entry.id === itemId);
    if (!item) return;

    setKamRequestLoadingId(itemId);
    try {
      const draftId = await ensureDraftSaved();
      const message = buildComplianceKamRequestMessage(item, {
        applicantName: formState.applicant_name,
        applicationId: draftId,
      });
      const response = await apiService.createClientQuery(draftId, {
        message,
        requestKind: 'b2c_compliance',
        itemId,
      });
      const queryId = response.data?.queryId || '';
      if (!response.success && !queryId) {
        throw new Error(response.error || 'Failed to send request to KAM');
      }
      const requestedAt = new Date().toISOString();
      const patch: Record<string, string> = { [item.requestedAtKey]: requestedAt };
      if (queryId) {
        patch[item.queryIdKey] = queryId;
      }
      if (!response.data?.formDataPatchApplied) {
        try {
          await persistDraft(patch);
        } catch (persistError) {
          console.warn('[B2CEvApplicationWizard] compliance request persist failed:', persistError);
        }
      }
      updateFields(patch);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to send request to KAM';
      alert(message);
    } finally {
      setKamRequestLoadingId(null);
    }
  };

  const recoverDoRequestFromServer = async (): Promise<boolean> => {
    const draftId = editingDraftIdRef.current;
    if (!draftId) return false;
    const appRes = await apiService.getApplication(draftId);
    if (!appRes.success || !appRes.data) return false;
    const app = appRes.data;
    const rawForm = app.formData ?? (app as unknown as Record<string, unknown>).form_data;
    let remoteFormData: Record<string, unknown> = {};
    if (rawForm != null) {
      if (typeof rawForm === 'string') {
        try {
          remoteFormData = JSON.parse(rawForm) as Record<string, unknown>;
        } catch {
          remoteFormData = {};
        }
      } else if (typeof rawForm === 'object' && !Array.isArray(rawForm)) {
        remoteFormData = rawForm as Record<string, unknown>;
      }
    }
    if (!isDoRequested(remoteFormData)) return false;

    const patch: Record<string, string> = {
      '_meta.doRequest.requestedAt': String(remoteFormData['_meta.doRequest.requestedAt'] ?? ''),
    };
    const remoteQueryId = String(remoteFormData['_meta.doRequest.queryId'] ?? '').trim();
    if (remoteQueryId) {
      patch['_meta.doRequest.queryId'] = remoteQueryId;
    }
    updateFields(patch);
    return true;
  };

  const handleRequestDO = async (options?: {
    fromKycDocuments?: boolean;
  }): Promise<boolean> => {
    setStepAdvanceMessage(null);
    const currentFormData = formStateRef.current.form_data;
    const fromKyc = Boolean(options?.fromKycDocuments);

    // KYC step 6 uses docs+VKYC enable rules only — do not wait on geo/compliance DO gates.
    if (fromKyc) {
      if (isDoRequested(currentFormData)) {
        setStepAdvanceMessage('DO request already sent to KAM');
        return false;
      }
    } else {
      const blockers = getDoRequestBlockers(currentFormData, productFormConfig);
      if (blockers.length > 0) {
        setStepAdvanceMessage(blockers.join('. '));
        return false;
      }
    }

    const stepErrors = validateB2cEvStage(currentStage, currentFormData, {
      loanProductId: formStateRef.current.loan_product_id,
      saveAsDraft: false,
      formConfig: productFormConfig,
    });
    if (Object.keys(stepErrors).length > 0) {
      setFieldErrors(stepErrors);
      reportStepAdvanceBlocker(stepErrors);
      return false;
    }
    setFieldErrors({});

    if (doRequestLoading) return false;
    setDoRequestLoading(true);
    try {
      // KYC Request DO may run after Status left draft (e.g. Qualified / in_negotiation).
      // Prefer the existing draft id so we do not full-save form_data through Express.
      let draftId = editingDraftIdRef.current;
      if (!draftId) {
        draftId = await ensureDraftSaved();
      }
      if (!draftId) {
        throw new Error('Draft ID missing — cannot request DO');
      }
      const message = buildDoRequestMessage({
        applicantName: formState.applicant_name,
        applicationId: draftId,
      });
      // Existing DO request: same endpoint + payload as before.
      const response = await apiService.createClientQuery(draftId, {
        message,
        requestKind: 'b2c_do',
      });
      const queryId = response.data?.queryId || '';
      if (!response.success && !queryId) {
        // Engine-only / unknown drafts are not in Express — do not start countdown or Engine flow.
        if (isDraftNotFoundForDoRequest(response.error)) {
          setStepAdvanceMessage(DRAFT_NOT_FOUND_USER_MESSAGE);
          if (!fromKyc) alert(DRAFT_NOT_FOUND_USER_MESSAGE);
          return false;
        }
        throw new Error(response.error || 'Failed to send DO request to KAM');
      }
      const requestedAt = new Date().toISOString();
      const doPatch: Record<string, string> = {
        '_meta.doRequest.requestedAt': requestedAt,
      };
      if (queryId) {
        doPatch['_meta.doRequest.queryId'] = queryId;
      }

      let nextFormData: Record<string, unknown> = {
        ...formStateRef.current.form_data,
        ...doPatch,
      };
      if (fromKyc) {
        nextFormData = mergeDeadlineIntoFormData(nextFormData, buildDeadlineMeta());
      }

      // Keep formStateRef in sync before persistDraft reads it.
      commitFormState((prev) => ({ ...prev, form_data: nextFormData }));
      formStateRef.current = {
        ...formStateRef.current,
        form_data: nextFormData,
      };

      if (!response.data?.formDataPatchApplied || fromKyc) {
        try {
          await persistDraft(doPatch);
        } catch (persistError) {
          console.warn('[B2CEvApplicationWizard] DO metadata persist failed:', persistError);
          if (!fromKyc) {
            const recovered = await recoverDoRequestFromServer();
            if (!recovered) throw persistError;
          } else if (String(draftId).startsWith('rec')) {
            await airtableWrite({
              table: 'Loan Applications',
              record_id: String(draftId),
              fields: {
                'Form Data': JSON.stringify(nextFormData),
                'Last Updated': new Date().toISOString(),
              },
            });
          } else {
            throw persistError;
          }
        }
      }

      if (fromKyc && String(draftId).startsWith('rec') && response.data?.formDataPatchApplied) {
        // Express may have patched DO keys only — ensure deadline lands on Engine Form Data.
        await airtableWrite({
          table: 'Loan Applications',
          record_id: String(draftId),
          fields: {
            'Form Data': JSON.stringify(nextFormData),
            'Last Updated': new Date().toISOString(),
          },
        });
      }

      if (fromKyc) {
        const fileId = String(nextFormData['_meta.fileId'] || '').trim();
        if (!fileId) {
          throw new Error('Missing Airtable File ID — cannot start Engine flow');
        }
        setPostSubmitSession({
          fileId,
          recordId: String(draftId),
          formData: nextFormData,
        });
        return true;
      }

      setStepAdvanceMessage(
        'DO request sent to your KAM. You can continue — the KAM will process the DO in parallel.'
      );
      return true;
    } catch (error: unknown) {
      const raw =
        error instanceof Error ? error.message : 'Failed to send DO request to KAM';
      if (isDraftNotFoundForDoRequest(raw)) {
        setStepAdvanceMessage(DRAFT_NOT_FOUND_USER_MESSAGE);
        if (!fromKyc) alert(DRAFT_NOT_FOUND_USER_MESSAGE);
        return false;
      }
      if (!fromKyc) {
        const recovered = await recoverDoRequestFromServer().catch(() => false);
        if (recovered) {
          setStepAdvanceMessage(
            'DO request sent to your KAM. You can continue — the KAM will process the DO in parallel.'
          );
          return true;
        }
      }
      setStepAdvanceMessage(raw);
      if (!fromKyc) alert(raw);
      return false;
    } finally {
      setDoRequestLoading(false);
    }
  };

  const reportStepAdvanceBlocker = (
    errors: Record<string, string>,
    options: { stageId?: string; loanValuesFrozen?: boolean; fallback?: string } = {}
  ) => {
    const message =
      buildStepAdvanceBlockerMessage(errors, {
        stageId: options.stageId ?? currentStage?.id,
        loanValuesFrozen: options.loanValuesFrozen,
      }) || options.fallback;
    if (message) {
      setStepAdvanceMessage(message);
    }
  };

  const setWizardStep = useCallback(
    (stepIndex: number) => {
      const clamped = Math.max(0, Math.min(stepIndex, visibleStagesRef.current.length - 1));
      setCurrentStep(clamped);
      syncWizardStageInUrl(clamped);
    },
    [syncWizardStageInUrl]
  );

  const advanceStep = () => {
    setWizardStep(currentStepRef.current + 1);
  };

  const borrowerBureauVerifiedKeyRef = useRef<string | null>(null);
  const borrowerBureauOutcomeRef = useRef<BureauOutcome | null>(null);

  /** One shared qualify call: autofill borrower + section-1 lender decision. */
  const runBorrowerBureauAndLenderFind = async (): Promise<boolean> => {
    cancelScheduledAutoSave();
    const currentFormData = formStateRef.current.form_data;
    const inputHash = buildPanLookupInputHash(currentFormData);
    const panPayload = getPanLookupPayload(currentFormData);

    if (
      !shouldRefetchPanLookup(currentFormData) &&
      (section1Lender.status === 'found' || section1Lender.status === 'ntc')
    ) {
      return true;
    }

    setPanLookupLoading(true);
    setPanLookupError(null);
    setSection1Lender({ status: 'searching' });
    setStepAdvanceMessage(null);

    try {
      const applicationIdForQualify =
        editingDraftIdRef.current || clientSubmissionId || `pending-${Date.now()}`;
      const amount =
        Number(
          String(
            currentFormData['loan.amount'] ||
              formStateRef.current.requested_loan_amount ||
              '0'
          ).replace(/,/g, '')
        ) || 100000;

      const bureau = await runBureauAndFill({
        prefix: 'borrower',
        fullName: panPayload.fullName,
        mobile: panPayload.mobileNumber,
        pan: panPayload.panNumber,
        consent_bureau_at: new Date().toISOString(),
        application_id: applicationIdForQualify,
        requested_amount: amount,
        keepPan: panPayload.panNumber,
        keepMobile: panPayload.mobileNumber,
        lastVerifiedKey: borrowerBureauVerifiedKeyRef.current,
        previousOutcome: borrowerBureauOutcomeRef.current,
        formData: currentFormData,
        cacheDays: await loadBureauCacheDays(),
      });

      borrowerBureauVerifiedKeyRef.current = buildBureauVerifyKey(
        panPayload.panNumber,
        panPayload.mobileNumber
      );
      borrowerBureauOutcomeRef.current = bureau;

      if (bureau.status === 'error' && Object.keys(bureau.formDataPatch).length === 0) {
        setPanLookupError(bureau.errorMessage || PAN_MANUAL_FAILURE_MESSAGE);
        commitFormState((prev) => ({
          ...prev,
          form_data: applyBorrowerManualProfilePhase(prev.form_data, inputHash),
        }));
        setSection1Lender({
          status: 'soft_block',
          reasons: [bureau.errorMessage || 'Could not check lender eligibility. Please try again.'],
        });
        return false;
      }

      commitFormState((prev) => {
        const cleared = clearBorrowerFields(prev.form_data);
        let patched = syncB2cEvComputedFields({
          ...cleared,
          ...bureau.formDataPatch,
          '_meta.panLookup.status':
            bureau.emptyApplicant || bureau.status === 'error' ? 'manual' : 'success',
          '_meta.panLookup.inputHash': inputHash,
          '_meta.panLookup.completedAt': bureau.meta.checked_at,
        });
        // Seed typed identity when applicant was empty.
        if (!readFieldValue(patched, 'borrower.firstName')) {
          const parts = panPayload.fullName.trim().split(/\s+/).filter(Boolean);
          if (parts[0]) patched['borrower.firstName'] = parts[0];
          if (parts.length > 1) patched['borrower.lastName'] = parts.slice(1).join(' ');
          patched['borrower.customerName'] = panPayload.fullName;
          patched['borrower.pan'] = normalizePan(panPayload.panNumber);
          patched['borrower.mobile'] = panPayload.mobileNumber;
        }
        patched = mergeBureauMetaIntoFormData(patched, bureau.metaKey, bureau.meta);
        if (bureau.guardWrite) patched = applyBureauGuard(patched, bureau.guardWrite);
        void persistFormDataIfRecordExists(patched);
        return {
          ...prev,
          applicant_name: readFieldValue(patched, 'borrower.customerName'),
          form_data: patched,
        };
      });

      if (bureau.emptyApplicant) {
        setPanLookupError(PAN_MANUAL_FAILURE_MESSAGE);
      }

      const knownBureauScore = getBorrowerCibilScoreFromFormData(
        formStateRef.current.form_data
      );
      const lenderOutcome = decideSection1LenderOutcome(bureau.raw, { knownBureauScore });
      const crmFileKey = String(
        formStateRef.current.form_data['_meta.fileId'] ||
          editingDraftIdRef.current ||
          panPayload.panNumber ||
          'pending'
      );
      const crmName = readFieldValue(formStateRef.current.form_data, 'borrower.customerName') ||
        panPayload.fullName;
      const crmMobile = String(
        formStateRef.current.form_data['borrower.mobile'] || panPayload.mobileNumber || ''
      );
      switch (lenderOutcome.kind) {
        case 'found':
          setSection1Lender({ status: 'found' });
          void fireEvent('ELIGIBILITY_PASS', {
            summary: `Lender found for ${crmName}`,
            fileKey: crmFileKey,
            formData: formStateRef.current.form_data,
            applicantName: crmName,
            applicantMobile: crmMobile,
            withJson: true,
          }).then((next) => {
            commitFormState((prev) => ({ ...prev, form_data: next }));
          });
          return true;
        case 'ntc':
          setSection1Lender({ status: 'ntc', reasons: lenderOutcome.reasons });
          return true;
        case 'soft_block':
          setSection1Lender({ status: 'soft_block', reasons: lenderOutcome.reasons });
          setStepAdvanceMessage('Cannot continue — eligibility criteria not met.');
          void fireEvent('ELIGIBILITY_FAIL', {
            summary: `Not eligible: ${lenderOutcome.reasons.join(', ')}`,
            fileKey: crmFileKey,
            formData: formStateRef.current.form_data,
            applicantName: crmName,
            applicantMobile: crmMobile,
          }).then((next) => {
            commitFormState((prev) => ({ ...prev, form_data: next }));
          });
          return false;
        case 'hard_reject': {
          setSection1Lender({
            status: 'hard_reject',
            reasons: lenderOutcome.reasons,
            preview: lenderOutcome.preview,
            overflow: lenderOutcome.overflow,
          });
          setStepAdvanceMessage('Application rejected.');
          void fireEvent('ELIGIBILITY_FAIL', {
            summary: `Not eligible: ${lenderOutcome.reasons.join(', ')}`,
            fileKey: crmFileKey,
            formData: formStateRef.current.form_data,
            applicantName: crmName,
            applicantMobile: crmMobile,
          }).then((next) => {
            commitFormState((prev) => ({ ...prev, form_data: next }));
          });
          try {
            const { draftId } = await persistDraftRef.current(undefined, { silent: true });
            await writeApplicationRejectedOnCreditFail({
              recordIdHint: draftId,
              fileIdHint: draftId,
              formData: formStateRef.current.form_data,
              reason: lenderOutcome.reasons.join('; ').slice(0, 500),
            });
          } catch {
            // Still block the UI if Airtable reject write fails.
          }
          return false;
        }
        default: {
          const _exhaustive: never = lenderOutcome;
          return _exhaustive;
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Could not check lender eligibility. Please try again.';
      setSection1Lender({ status: 'soft_block', reasons: [message] });
      setStepAdvanceMessage(message);
      return false;
    } finally {
      setPanLookupLoading(false);
    }
  };

  const resetSupportBureauUi = () => {
    setSupportBureauOutcome(null);
    supportBureauOutcomeRef.current = null;
    supportBureauVerifiedKeyRef.current = null;
    setSupportBureauManualMode(false);
    setSupportBureauAutofilledKeys([]);
    setSupportBureauAddressIndex(0);
    setSupportPanLookupError(null);
  };

  const handleSupportTypeChange = (type: SupportPersonType) => {
    setFormState((prev) => ({
      ...prev,
      form_data: clearSupportPersonFields(
        { ...prev.form_data, '_meta.supportPersonType': type },
        type
      ),
    }));
    resetSupportBureauUi();
    setSupportBureauConsent(false);
    setSupportBureauConsentAt(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next['_meta.supportPersonType'];
      return next;
    });
  };

  const persistFormDataIfRecordExists = async (formData: Record<string, unknown>) => {
    // Prefer Express draft id; fall back to URL draftId when it is an Airtable record id
    // (Express getApplication may 404 for Engine-created rec* rows).
    const draftId =
      editingDraftIdRef.current || editingDraftId || draftIdParam || '';
    if (!String(draftId).startsWith('rec')) return;
    try {
      await airtableWrite({
        table: 'Loan Applications',
        record_id: String(draftId),
        fields: {
          'Form Data': JSON.stringify(formData),
          'Last Updated': new Date().toISOString(),
        },
        base_id: ENGINE_BASE_ID,
      });
      if (!editingDraftIdRef.current) {
        setEditingDraftId(String(draftId));
        editingDraftIdRef.current = String(draftId);
      }
    } catch {
      // Non-blocking — wizard state still holds the values.
    }
  };

  const runSupportBureauVerify = async (): Promise<boolean> => {
    cancelScheduledAutoSave();
    const payload = getSupportPanLookupPayload(formStateRef.current.form_data);
    if (!payload) return false;
    const prefix = payload.target;
    if (prefix !== 'coApplicant' && prefix !== 'guarantor') return false;

    if (!supportBureauConsent || !supportBureauConsentAt) {
      setSupportPanLookupError('Consent is required before verification.');
      return false;
    }

    const borrowerPan =
      readFieldValue(formStateRef.current.form_data, 'borrower.pan') ||
      readFieldValue(formStateRef.current.form_data, '_meta.panLookup.panNumber');

    setSupportPanLookupLoading(true);
    setSupportPanLookupError(null);
    setSupportBureauManualMode(false);

    try {
      const amount =
        Number(
          String(
            formStateRef.current.form_data['loan.amount'] ||
              formStateRef.current.requested_loan_amount ||
              '0'
          ).replace(/,/g, '')
        ) || 0;
      const fileId = editingDraftIdRef.current || clientSubmissionId || '';
      const applicationId = fileId ? `${fileId}-CO` : '';

      const outcome = await runBureauAndFill({
        prefix,
        fullName: payload.fullName,
        mobile: payload.mobileNumber,
        pan: payload.panNumber,
        consent_bureau_at: supportBureauConsentAt,
        application_id: applicationId,
        requested_amount: amount,
        keepPan: payload.panNumber,
        keepMobile: payload.mobileNumber,
        borrowerPan,
        lastVerifiedKey: supportBureauVerifiedKeyRef.current,
        previousOutcome: supportBureauOutcomeRef.current,
        formData: formStateRef.current.form_data,
        cacheDays: await loadBureauCacheDays(),
      });

      if (outcome.errorMessage?.match(/same person/i)) {
        setSupportPanLookupError(outcome.errorMessage);
        setSupportBureauOutcome(outcome);
        supportBureauOutcomeRef.current = outcome;
        supportBureauVerifiedKeyRef.current = null;
        return false;
      }

      supportBureauOutcomeRef.current = outcome;
      setSupportBureauOutcome(outcome);
      setSupportBureauAutofilledKeys(outcome.autofilledKeys);
      setSupportBureauAddressIndex(0);

      if (outcome.status === 'error') {
        // Do not cache error under PAN|mobile — Try again must re-call qualify.
        supportBureauVerifiedKeyRef.current = null;
        setSupportPanLookupError(outcome.errorMessage || 'Could not verify right now.');
        return false;
      }

      supportBureauVerifiedKeyRef.current = buildBureauVerifyKey(
        payload.panNumber,
        payload.mobileNumber
      );

      const coSummary =
        outcome.status === 'pass'
          ? 'Co-applicant pass'
          : outcome.status === 'ntc'
            ? 'Co-applicant ntc'
            : `Co-applicant fail: ${(outcome.meta.failed_codes || []).join(', ') || 'unknown'}`;
      const crmFileKey = String(
        formStateRef.current.form_data['_meta.fileId'] ||
          editingDraftIdRef.current ||
          payload.panNumber ||
          'pending'
      );
      const crmName = readFieldValue(formStateRef.current.form_data, 'borrower.customerName');
      const crmMobile = String(formStateRef.current.form_data['borrower.mobile'] || '');

      commitFormState((prev) => {
        const cleared = clearSupportPersonProfileFields(prev.form_data, prefix);
        let patched = syncB2cEvComputedFields({
          ...cleared,
          ...outcome.formDataPatch,
          '_meta.supportPanLookup.status':
            outcome.emptyApplicant || outcome.status === 'error' ? 'manual' : 'success',
          '_meta.supportPanLookup.completedAt': outcome.meta.checked_at,
          '_meta.supportPanLookup.phase': 'profile',
        });
        patched = mergeBureauMetaIntoFormData(patched, outcome.metaKey, outcome.meta);
        if (outcome.guardWrite) patched = applyBureauGuard(patched, outcome.guardWrite);
        void persistFormDataIfRecordExists(patched);
        void fireEvent('CO_APPLICANT_CHECK', {
          summary: coSummary,
          fileKey: crmFileKey,
          formData: patched,
          applicantName: crmName,
          applicantMobile: crmMobile,
        }).then((next) => {
          commitFormState((p) => ({ ...p, form_data: next }));
        });
        return { ...prev, form_data: patched };
      });
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Could not verify right now.';
      setSupportPanLookupError(message);
      return false;
    } finally {
      setSupportPanLookupLoading(false);
    }
  };

  const goNext = async () => {
    setStepAdvanceMessage(null);
    if (section1QualifyBlocked && currentStage?.id !== 'product') {
      setStepAdvanceMessage('Cannot continue — eligibility criteria not met.');
      return;
    }
    const stepErrors = validateB2cEvStage(currentStage, formStateRef.current.form_data, {
      loanProductId: formStateRef.current.loan_product_id,
      saveAsDraft: false,
      formConfig: productFormConfig,
    });
    if (Object.keys(stepErrors).length > 0) {
      setFieldErrors(stepErrors);
      reportStepAdvanceBlocker(stepErrors, {
        loanValuesFrozen: formDataToFrozenValues(formStateRef.current.form_data) != null,
      });
      return;
    }
    setFieldErrors({});

    if (currentStage?.id === 'product') {
      if (section1QualifyBlocked) {
        setStepAdvanceMessage('Cannot continue — eligibility criteria not met.');
        return;
      }
      if (section1Lender.status === 'found' || section1Lender.status === 'ntc') {
        advanceStep();
        return;
      }
      if (section1Lender.status === 'searching') return;

      // Stay on section 1 so the user sees lender-find result, then Next again to advance.
      await runBorrowerBureauAndLenderFind();
      return;
    }

    if (currentStage?.id === 'support-person') {
      if (!supportBureauGateReady) {
        const supportErrors = {
          '_meta.supportPanLookup.phase':
            'Verify the support person and complete their profile before continuing',
        };
        setFieldErrors(supportErrors);
        reportStepAdvanceBlocker(supportErrors);
        return;
      }
    }

    const nextStage = visibleStages[currentStep + 1];
    if (nextStage?.id === 'borrower' && !isPanLookupProfileReady(formStateRef.current.form_data)) {
      const panErrors = {
        '_meta.panLookup.status':
          'Borrower details must be verified on the Loan Product step before continuing',
      };
      setFieldErrors(panErrors);
      reportStepAdvanceBlocker(panErrors);
      return;
    }

    if (nextStage?.id === 'dealer') {
      const kycResult = await loadDealerKyc(formState.form_data);
      if (!kycResult.ok) {
        setStepAdvanceMessage(kycResult.error);
        return;
      }
    }

    if (currentStage?.id === 'kyc-documents') {
      const stepErrors = validateB2cEvStage(currentStage, formStateRef.current.form_data, {
        loanProductId: formStateRef.current.loan_product_id,
        formConfig: productFormConfig,
      });
      if (Object.keys(stepErrors).length > 0) {
        setFieldErrors(stepErrors);
        setStepAdvanceMessage(Object.values(stepErrors)[0] || 'Complete KYC & Documents');
        return;
      }
      // Next = Request DO (not Express submit). Engine flow starts after DO succeeds.
      void handleRequestDO({ fromKycDocuments: true });
      return;
    }

    // Next is local only — no n8n write on step advance.
    advanceStep();
  };

  const goBack = () => setWizardStep(currentStepRef.current - 1);

  const handleSubmit = async (saveAsDraft: boolean) => {
    if (submitInFlightRef.current) return;

    if (!saveAsDraft) {
      if (!isLastStep) return;
      if (EXPRESS_B2C_EV_SUBMIT_REQUIRES_DELIVERY_FIELDS) {
        const stop = getExpressSubmitStopMessage();
        setStepAdvanceMessage(stop);
        setCreditGateError(stop);
        return;
      }
      if (!completion.isComplete) {
        setFieldErrors(completion.errors);
        alert(
          `Please complete all required fields before submitting:\n\n${completion.missingByStage
            .map((s) => `${s.stageTitle}: ${s.fieldLabels.join(', ')}`)
            .join('\n')}`
        );
        return;
      }
      // Compliance checkboxes are post-submit outcomes in the KYC→Delivery flow.
    } else if (!formState.loan_product_id) {
      alert('Please select a loan product before saving a draft.');
      return;
    }

    submitInFlightRef.current = true;
    setLoading(true);
    if (!saveAsDraft) {
      setCreditGateError(null);
      setStepAdvanceMessage(null);
    }
    let formDataToSend = buildFormDataPayloadFromState(formState);

    try {
      if (!saveAsDraft) {
        const deadline = buildDeadlineMeta();
        formDataToSend = mergeDeadlineIntoFormData(formDataToSend, deadline);
        commitFormState((prev) => ({
          ...prev,
          form_data: mergeDeadlineIntoFormData(prev.form_data, deadline),
        }));

        // Hard gate: Experian / credit check must pass BEFORE any Express submit.
        const canonical = buildCanonical(formDataToSend);
        const applicationIdForQualify =
          editingDraftId || clientSubmissionId || `pending-${Date.now()}`;
        let qualifyRaw;
        try {
          qualifyRaw = await qualifyApplicant({
            Full_Name: canonical.fullName,
            Mobile_Number: canonical.mobile,
            PAN_Number: canonical.pan,
            name: canonical.fullName,
            mobile: canonical.mobile,
            pan: canonical.pan,
            email: canonical.email || '',
            consent_bureau: true,
            consent_bureau_at: new Date().toISOString(),
            application_id: applicationIdForQualify,
            product_code: 'ev_dealer',
            requested_amount:
              Number(canonical.requestedLoanAmount) ||
              Number(formState.requested_loan_amount) ||
              0,
          });
        } catch (qualifyErr) {
          const reason =
            qualifyErr instanceof Error && qualifyErr.message
              ? qualifyErr.message
              : 'No Experian / credit check result was returned. The application cannot proceed.';
          // Update UI state and return — do not throw (alert was blocking React paint).
          setCreditGateError(reason);
          setStepAdvanceMessage(reason);
          setPostSubmitSession(null);
          return;
        }

        const interpreted = interpretQualifyResult(qualifyRaw);
        const knownBureauScore = getBorrowerCibilScoreFromFormData(
          formStateRef.current.form_data
        );
        const advance = decideQualifyAdvance(qualifyRaw, { knownBureauScore });
        // Trust decideQualifyAdvance (includes score-only null-kill reconcile).
        const qualifyPassed = advance.advance;
        // NTC-only fail may enter post-submit for bank-statement upload; all other fails stop here.
        const ntcOnlyUpload = !qualifyPassed && isOnlyNtcBankStatementRequired(advance.raw);
        if (!qualifyPassed && !ntcOnlyUpload) {
          const reason =
            (!advance.advance ? advance.reason : null) ||
            interpreted.reason ||
            'Credit check did not pass. The application cannot proceed.';
          setCreditGateError(reason);
          setStepAdvanceMessage(reason);
          setPostSubmitSession(null);
          return; // mandatory — do not create/submit or open post-submit
        }

        // Single place write: no validateOnly preflight (server validates on submit/create).
        let draftId = editingDraftId;

        if (!draftId) {
          // No draft yet — create already under KAM review in one POST.
          const createRes = await apiService.createApplication({
            applicantName: formState.applicant_name,
            productId: formState.loan_product_id,
            requestedLoanAmount: Number(formState.requested_loan_amount) || 0,
            formData: formDataToSend,
            saveAsDraft: false,
            clientSubmissionId,
          });
          if (!createRes.success) {
            const missingFieldsErrors: Record<string, string> = {};
            if (createRes.data?.missingFields && Array.isArray(createRes.data.missingFields)) {
              createRes.data.missingFields.forEach(
                (field: { fieldId: string; label: string; displayKey?: string }) => {
                  const msg = `${field.label} is required`;
                  missingFieldsErrors[field.fieldId] = msg;
                  if (field.displayKey) missingFieldsErrors[field.displayKey] = msg;
                }
              );
            }
            if (createRes.data?.formatErrors && Array.isArray(createRes.data.formatErrors)) {
              createRes.data.formatErrors.forEach((err: { fieldId: string; message: string }) => {
                missingFieldsErrors[err.fieldId] = err.message;
              });
            }
            if (Object.keys(missingFieldsErrors).length > 0) {
              setFieldErrors(missingFieldsErrors);
            }
            throw new Error(createRes.error || 'Failed to submit application');
          }
          draftId = createRes.data?.loanApplicationId || createRes.data?.fileId || null;
          if (!draftId) throw new Error('Application ID missing after submit');
          setEditingDraftId(draftId);
          const createdFileId = String(createRes.data?.fileId || draftId);
          const createdRecordId = String(createRes.data?.loanApplicationId || draftId);
          // Do not pass qualifyResult — post-submit always re-calls /engine/qualify for fresh BRE.
          setPostSubmitSession({
            fileId: createdFileId,
            recordId: createdRecordId,
            formData: formDataToSend,
          });
          return;
        }

        // Existing draft — one submit POST that merges formData + status.
        const submitRes = await apiService.submitApplication(draftId, {
          clientSubmissionId,
          formData: formDataToSend,
          applicantName: formState.applicant_name,
          productId: formState.loan_product_id,
          requestedLoanAmount: formState.requested_loan_amount,
        });
        if (!submitRes.success) {
          const missingFieldsErrors: Record<string, string> = {};
          if (submitRes.data?.missingFields && Array.isArray(submitRes.data.missingFields)) {
            submitRes.data.missingFields.forEach(
              (field: { fieldId: string; label: string; displayKey?: string }) => {
                const msg = `${field.label} is required`;
                missingFieldsErrors[field.fieldId] = msg;
                if (field.displayKey) missingFieldsErrors[field.displayKey] = msg;
              }
            );
          }
          if (submitRes.data?.formatErrors && Array.isArray(submitRes.data.formatErrors)) {
            submitRes.data.formatErrors.forEach((err: { fieldId: string; message: string }) => {
              missingFieldsErrors[err.fieldId] = err.message;
            });
          }
          if (Object.keys(missingFieldsErrors).length > 0) {
            setFieldErrors(missingFieldsErrors);
          }
          throw new Error(submitRes.error || 'Submit failed');
        }

        const submittedFileId = String(submitRes.data?.fileId || draftId);
        // Do not pass qualifyResult — post-submit always re-calls /engine/qualify for fresh BRE.
        setPostSubmitSession({
          fileId: submittedFileId,
          recordId: String(draftId),
          formData: formDataToSend,
        });
        return;
      }

      let draftId = editingDraftId;

      if (draftId) {
        await persistDraft();
      } else {
        const { draftId: createdId } = await persistDraft();
        draftId = createdId;
      }

      alert('Draft saved successfully.');
      const resumeParams = buildWizardResumeSearchParams(
        draftId!,
        buildFormDataPayloadFromState(formState)
      );
      navigate(`/applications/new?${resumeParams.toString()}`, { replace: true });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to save application');
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  const renderStageBody = (stage: B2cEvStage) => {
    if (stage.id === 'product') {
      return (
        <div className="space-y-6">
          <Select
            data-testid="b2c-loan-product-select"
            label="Loan Product *"
            value={formState.loan_product_id}
            error={fieldErrors.loan_product_id || loanProductsError || undefined}
            disabled={loanProductsLoading || panLookupLoading}
            options={[
              {
                value: '',
                label: loanProductsLoading
                  ? 'Loading products...'
                  : loanProducts.length === 0
                    ? 'No products available'
                    : 'Select loan product',
              },
              ...loanProducts.map((p) => ({ value: p.id, label: p.name })),
            ]}
            onChange={(e) => {
              setFormState((prev) => ({ ...prev, loan_product_id: e.target.value }));
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.loan_product_id;
                return next;
              });
              scheduleAutoSave();
            }}
          />

          <div className="border-t border-dealer-border pt-6">
            <h3 className="mb-4 text-sm font-medium text-dealer-text">Borrower verification</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {stage.fields.map((field) => (
                <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
                  {renderField(
                    field,
                    readFieldValue(formState.form_data, field.key),
                    fieldErrors[field.key],
                    updateField,
                    formState.form_data
                  )}
                </div>
              ))}
            </div>
            {panLookupError && section1Lender.status === 'idle' && (
              <p className="mt-3 text-sm text-dealer-error" data-testid="b2c-pan-lookup-error">
                {panLookupError}
              </p>
            )}
            {panLookupLoading && (
              <p className="mt-3 text-sm text-dealer-text-quiet" data-testid="b2c-pan-lookup-loading">
                {panLookupLoadingMessage}
              </p>
            )}
            {section1Lender.status !== 'idle' && (
              <FindingLenderPanel
                phase={
                  section1Lender.status === 'searching'
                    ? 'searching'
                    : section1Lender.status === 'found'
                      ? 'found'
                      : section1Lender.status === 'ntc'
                        ? 'ntc'
                        : section1Lender.status === 'soft_block'
                          ? 'soft_block'
                          : 'hard_reject'
                }
                reasons={
                  section1Lender.status === 'soft_block' ||
                  section1Lender.status === 'ntc' ||
                  section1Lender.status === 'hard_reject'
                    ? section1Lender.reasons
                    : undefined
                }
                preview={
                  section1Lender.status === 'hard_reject' ? section1Lender.preview : undefined
                }
                overflow={
                  section1Lender.status === 'hard_reject' ? section1Lender.overflow : undefined
                }
              />
            )}
          </div>
        </div>
      );
    }

    if (stage.id === 'borrower' && !isPanLookupProfileReady(formState.form_data)) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-dealer-text-quiet">
            Borrower details must be verified on the Loan Product step before this section can be
            loaded.
          </p>
          <Button type="button" variant="secondary" onClick={() => setWizardStep(0)}>
            Go back to verify PAN
          </Button>
        </div>
      );
    }

    if (stage.id === 'loan') {
      const frozenValues = formDataToFrozenValues(formState.form_data);
      return (
        <LoanCalculator
          frozenValues={frozenValues}
          pricing={loanPricing}
          pricingError={loanPricingError || (loanPricingLoading ? 'Loading pricing…' : null)}
          onRetryPricing={() => void loadLoanPricing()}
          onFrozenValuesChange={(
            values: LoanFrozenValues | null,
            snapshot?: LoanCalculatorSnapshot
          ) => {
            setFormState((prev) => {
              const nextFormData = { ...prev.form_data };
              for (const key of Object.keys(nextFormData)) {
                if (key.startsWith('loan.')) delete nextFormData[key];
              }
              if (values) {
                Object.assign(nextFormData, frozenValuesToFormDataPatch(values, snapshot));
                if (loanPricing) {
                  nextFormData['_meta.pricing'] = {
                    rule_id: loanPricing.rule_id,
                    roi_pct: loanPricing.roi_pct,
                    pf_pct: loanPricing.pf_pct,
                    priced_at: new Date().toISOString(),
                  };
                }
              }
              const synced = syncB2cEvComputedFields(nextFormData);
              const loanAmount = readFieldValue(synced, 'loan.amount').replace(/,/g, '');
              return {
                ...prev,
                requested_loan_amount: loanAmount || '0',
                form_data: synced,
              };
            });
            setFieldErrors((prev) => {
              const next = { ...prev };
              for (const key of Object.keys(next)) {
                if (key.startsWith('loan.')) delete next[key];
              }
              return next;
            });
            setStepAdvanceMessage(null);
            scheduleAutoSave();
          }}
        />
      );
    }

    if (stage.id === 'dealer') {
      if (dealerKycLoading) {
        return (
          <p className="text-sm text-dealer-text-quiet" data-testid="b2c-dealer-kyc-loading">
            Loading dealer profile from Client KYC…
          </p>
        );
      }

      if (!isDealerKycPopulated(formState.form_data)) {
        return (
          <div className="space-y-4">
            <p className="text-sm text-dealer-text-quiet">
              Dealer details are auto-filled from your Client KYC profile.
            </p>
            {dealerKycError && (
              <p className="text-sm text-dealer-error" data-testid="b2c-dealer-kyc-error">
                {dealerKycError}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              data-testid="b2c-dealer-kyc-retry"
              onClick={() => void loadDealerKyc()}
            >
              Retry loading dealer profile
            </Button>
          </div>
        );
      }
    }

    if (stage.id === 'support-person') {
      return (
        <SupportPersonPanWizard
          formData={formState.form_data}
          fieldErrors={fieldErrors}
          loading={supportPanLookupLoading}
          loadingMessage={supportPanLookupLoadingMessage}
          lookupError={supportPanLookupError}
          bureauOutcome={supportBureauOutcome}
          manualMode={supportBureauManualMode}
          autofilledKeys={supportBureauAutofilledKeys}
          consentChecked={supportBureauConsent}
          addresses={supportBureauOutcome?.addresses ?? []}
          addressIndex={supportBureauAddressIndex}
          onFieldChange={updateField}
          onSupportTypeChange={handleSupportTypeChange}
          onConsentChange={(checked) => {
            setSupportBureauConsent(checked);
            setSupportBureauConsentAt(checked ? new Date().toISOString() : null);
          }}
          onVerify={() => void runSupportBureauVerify()}
          onUseDifferent={() => {
            const prefix = getSupportPersonFieldPrefix(
              readFieldValue(formStateRef.current.form_data, '_meta.supportPersonType') as SupportPersonType
            );
            resetSupportBureauUi();
            setSupportBureauConsent(false);
            setSupportBureauConsentAt(null);
            if (prefix) {
              commitFormState((prev) => ({
                ...prev,
                form_data: {
                  ...clearSupportPersonProfileFields(prev.form_data, prefix),
                  '_meta.supportPanLookup.fullName': '',
                  '_meta.supportPanLookup.mobileNumber': '',
                  '_meta.supportPanLookup.panNumber': '',
                  '_meta.supportPanLookup.status': 'pending',
                  '_meta.supportPanLookup.phase': 'input',
                },
              }));
            }
          }}
          onEnterManual={() => {
            const prefix = getSupportPersonFieldPrefix(
              readFieldValue(formStateRef.current.form_data, '_meta.supportPersonType') as SupportPersonType
            );
            setSupportBureauManualMode(true);
            setSupportPanLookupError(null);
            if (prefix) {
              commitFormState((prev) => ({
                ...prev,
                form_data: {
                  ...prev.form_data,
                  '_meta.supportPanLookup.status': 'manual',
                  '_meta.supportPanLookup.phase': 'profile',
                },
              }));
            }
          }}
          onAddressIndexChange={(index) => {
            setSupportBureauAddressIndex(index);
            const outcome = supportBureauOutcomeRef.current;
            const prefix = getSupportPersonFieldPrefix(
              readFieldValue(formStateRef.current.form_data, '_meta.supportPersonType') as SupportPersonType
            );
            if (!outcome || !prefix) return;
            const addressPatch = applyAddressIndexToPatch(
              prefix,
              outcome.addresses,
              index,
              outcome.formDataPatch
            );
            commitFormState((prev) => ({
              ...prev,
              form_data: syncB2cEvComputedFields({
                ...prev.form_data,
                ...addressPatch,
              }),
            }));
          }}
        />
      );
    }

    if (stage.id === 'kyc-documents') {
      const draftId =
        editingDraftIdRef.current || editingDraftId || draftIdParam || '';
      // Always use Airtable File ID — never the rec… record id.
      const fileId = String(formState.form_data['_meta.fileId'] || '').trim();
      return (
        <KycDocumentsStep
          formData={formState.form_data}
          formConfig={productFormConfig}
          recordId={String(draftId)}
          fileId={fileId}
          saveStatus={draftSaveStatus}
          onFormDataChange={(patch) => updateFields(patch)}
          onReadyChange={setKycStepReady}
        />
      );
    }

    if (stage.id === 'geo-photos') {
      return (
        <GeoTaggedPhotoUploads
          formData={formState.form_data}
          fieldErrors={fieldErrors}
          onBatchChange={(patch) => updateFields(patch, { debounceMs: GEO_PHOTO_AUTO_SAVE_DEBOUNCE_MS })}
          onGeoPhotoPersist={async (patch) => {
            await persistDraft(patch, { silent: true });
          }}
          requestingComplianceItemId={kamRequestLoadingId}
          onRequestFromKam={(itemId) => void handleRequestFromKam(itemId)}
          loanApplicationId={editingDraftId}
          ensureDraftSaved={ensureDraftSaved}
          formConfig={productFormConfig}
          formConfigLoading={productFormConfigLoading}
          usedWebhookLinks={usedWebhookLinks}
          onDocumentFieldChange={updateField}
          onFolderLinkConsumed={handleFolderLinkConsumed}
        />
      );
    }

    const profileFields =
      stage.id === 'borrower'
        ? stage.fields.filter((field) => !field.key.startsWith('borrower.address.'))
        : stage.fields;
    const addressFields =
      stage.id === 'borrower'
        ? stage.fields.filter((field) => field.key.startsWith('borrower.address.'))
        : [];

    return (
      <div className="space-y-6">
        {stage.id === 'borrower' && isPanLookupManual(formState.form_data) && (
          <div
            className="rounded-lg border border-dealer-warning/40 bg-dealer-warning/5 px-4 py-3 text-sm text-dealer-text"
            data-testid="borrower-pan-manual-message"
            role="status"
          >
            <p className="font-medium">
              {panLookupError || PAN_MANUAL_FAILURE_MESSAGE}
            </p>
            <p className="mt-1 text-dealer-text-quiet">
              Name, mobile, and PAN from the previous step are filled in. Add the remaining
              details below to continue.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profileFields.map((field) => (
            <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
              {renderField(
                field,
                readFieldValue(formState.form_data, field.key),
                fieldErrors[field.key],
                updateField,
                formState.form_data
              )}
            </div>
          ))}
        </div>
        {addressFields.length > 0 && (
          <div className="space-y-4 border-t border-dealer-border pt-6">
            <h3 className="text-sm font-semibold text-dealer-text">Address</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {addressFields.map((field) => (
                <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
                  {renderField(
                    field,
                    readFieldValue(formState.form_data, field.key),
                    fieldErrors[field.key],
                    updateField,
                    formState.form_data
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const userRole = user?.role || null;
  const getUserDisplayName = () => user?.name || user?.email || 'User';

  if (draftLoading) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle={t('pages.newApplication.pageTitle')}
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <div className="p-8 text-center text-dealer-text-quiet">Loading draft...</div>
      </MainLayout>
    );
  }

  if (postSubmitSession) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle={t('pages.newApplication.pageTitle')}
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <PostSubmitEngineFlow session={postSubmitSession} />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle={t('pages.newApplication.pageTitle')}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="flex min-h-full w-full flex-1 flex-col">
      {draftLoadError && (
        <Card className="mb-4 border-dealer-error/30 bg-dealer-error/5">
          <CardContent className="p-4 text-sm text-dealer-error">{draftLoadError}</CardContent>
        </Card>
      )}

      {dealerKycError && (
        <Card className="mb-4 border-dealer-warning/30 bg-dealer-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-dealer-warning flex-shrink-0" />
            <p className="text-sm text-dealer-text">{dealerKycError}</p>
          </CardContent>
        </Card>
      )}

      <div className="mb-2 w-full">
        <JourneyRail
          currentIndex={currentStep}
          currentStepId={currentStage?.id}
          completedIndices={completedStepIndices}
          lockedIndices={lockedStepIndices}
          onStepClick={(index) => {
            if (lockedStepIndices.includes(index) || index >= currentStep) return;
            setWizardStep(index);
          }}
        />
        {draftSaveStatus !== 'idle' && !isKycDocumentsStage ? (
          <p className="sr-only" data-testid="b2c-draft-save-status" aria-live="polite">
            {saveStatusLabel(draftSaveStatus)}
          </p>
        ) : null}
      </div>

      {creditGateError && (
        <Card className="mb-4 border-dealer-error/40 bg-dealer-error/5" data-testid="b2c-credit-gate-error">
          <CardContent className="p-4">
            <div className="flex items-start gap-3" role="alert">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-dealer-error" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-dealer-error">Not eligible — application stopped</p>
                <p className="mt-1 text-sm text-dealer-text" data-testid="b2c-credit-gate-reason">
                  {creditGateError}
                </p>
                <p className="mt-2 text-xs text-dealer-text-quiet">
                  No loan application was submitted. Fix the credit check issue or start a new
                  application.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 w-full flex-1">
        {currentStage && !isKycDocumentsStage ? (
          <PageHeader
            phase="Application"
            title={currentStage.title}
            helper={
              currentStage.id === 'borrower' && isPanLookupManual(formState.form_data)
                ? 'PAN verification had no match — complete borrower details manually'
                : currentStage.description
            }
            fileId={String(formState.form_data['_meta.fileId'] || '').trim() || undefined}
            saveLabel={saveStatusLabel(draftSaveStatus)}
            formData={formState.form_data}
          />
        ) : null}
        <div className={isKycDocumentsStage ? '' : 'pt-4'}>
          {currentStage ? renderStageBody(currentStage) : null}
        </div>
      </div>

      {stepAdvanceMessage && !creditGateError && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border border-dealer-error/30 bg-dealer-error/5 px-4 py-3 text-sm text-dealer-error"
          data-testid="b2c-step-advance-blocker"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{stepAdvanceMessage}</p>
        </div>
      )}

      {isKycDocumentsStage ? (
        <ActionBar
          onBack={goBack}
          backDisabled={currentStep === 0 || loading || panLookupLoading || supportPanLookupLoading}
          onSave={() => void handleSubmit(true)}
          saveDisabled={loading || panLookupLoading || !formState.loan_product_id || supportPanLookupLoading}
          onPrimary={() => void goNext()}
          primaryLabel={doRequestLoading ? 'Requesting DO…' : 'Request DO'}
          primaryBusy={doRequestLoading}
          primaryDisabled={
            loading ||
            doRequestLoading ||
            panLookupLoading ||
            supportPanLookupLoading ||
            supportNextDisabled ||
            section1Lender.status === 'searching' ||
            section1QualifyBlocked ||
            !kycStepReady
          }
          primaryTestId="b2c-wizard-request-do"
          disabledReason={kycDisabledReason}
        />
      ) : (
        <ActionBar
          onBack={goBack}
          backDisabled={currentStep === 0 || loading || panLookupLoading || supportPanLookupLoading}
          onSave={() => void handleSubmit(true)}
          saveDisabled={loading || panLookupLoading || !formState.loan_product_id || supportPanLookupLoading}
          onPrimary={() => void goNext()}
          primaryLabel={
            section1Lender.status === 'searching'
              ? 'Finding a lender…'
              : panLookupLoading
                ? panLookupLoadingMessage
                : supportPanLookupLoading
                  ? supportPanLookupLoadingMessage
                  : 'Next'
          }
          primaryBusy={section1Lender.status === 'searching' || panLookupLoading || supportPanLookupLoading}
          primaryDisabled={
            loading ||
            doRequestLoading ||
            panLookupLoading ||
            supportPanLookupLoading ||
            supportNextDisabled ||
            section1Lender.status === 'searching' ||
            section1QualifyBlocked ||
            (currentStage?.id === 'loan' &&
              (loanPricingLoading || Boolean(loanPricingError) || !loanPricing))
          }
          primaryTestId="b2c-wizard-next"
        />
      )}

      {user?.clientId && (
        <p className="mt-4 text-xs text-dealer-text-quiet">
          Logged in as {user.email} · Client ID {user.clientId}
        </p>
      )}
      </div>
    </MainLayout>
  );
};
