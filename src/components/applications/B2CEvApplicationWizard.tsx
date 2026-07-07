import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronLeft, ChevronRight, Save, Send } from 'lucide-react';
import { MainLayout } from '../layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
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
import { normalizeStatus } from '../../lib/statusUtils';
import {
  B2C_EV_FORM_TEMPLATE_ID,
  createInitialB2cEvFormData,
  getVisibleB2cEvStages,
  type B2cEvFieldDef,
  type B2cEvStage,
  type SupportPersonType,
} from '../../config/forms/b2cEvFormSchema';
import {
  clearSupportPersonFields,
  getB2cEvFormCompletion,
  isDealerKycPopulated,
  syncB2cEvComputedFields,
  validateB2cEvStage,
  validateSupportPanLookupInput,
  validateSupportPersonStageAccessible,
} from '../../lib/b2cEvFormValidation';
import {
  applyBorrowerManualProfilePhase,
  buildPanLookupInputHash,
  clearBorrowerFields,
  getPanLookupPayload,
  hasMeaningfulBorrowerAutofill,
  hasMeaningfulSupportPersonAutofill,
  isPanLookupManual,
  isPanLookupProfileReady,
  isPanLookupSuccessful,
  migratePanLookupDraftFields,
  PAN_LOOKUP_FIELD_KEYS,
  PAN_LOOKUP_TIMEOUT_SECONDS,
  shouldRefetchPanLookup,
} from '../../lib/b2cEvPanLookup';
import {
  buildSupportPanLookupInputHash,
  clearSupportPersonProfileFields,
  getSupportPanLookupPayload,
  getSupportPanLookupPhase,
  applySupportPersonManualProfilePhase,
  shouldRefetchSupportPanLookup,
  SUPPORT_PAN_LOOKUP_FIELD_KEYS,
  SUPPORT_PAN_LOOKUP_TIMEOUT_SECONDS,
} from '../../lib/b2cEvSupportPanLookup';
import { LoanCalculator } from './LoanCalculator';
import { SupportPersonPanWizard } from './SupportPersonPanWizard';
import { GeoTaggedPhotoUploads } from './GeoTaggedPhotoUploads';
import { B2cEvWizardStepper } from './B2cEvWizardStepper';
import { CibilProbabilityBar } from './CibilProbabilityBar';
import { getBorrowerCibilScoreFromFormData } from '../../lib/b2cEvCibilProbability';
import {
  buildComplianceKamRequestMessage,
  COMPLIANCE_ITEMS,
  validateComplianceForSubmit,
  type ComplianceItemId,
} from '../../lib/b2cEvCompliance';
import {
  buildDoRequestMessage,
  isDoRequested,
  POST_DO_LOCKED_STAGE_IDS,
} from '../../lib/b2cEvDoRequest';
import {
  formDataToFrozenValues,
  frozenValuesToFormDataPatch,
  type LoanCalculatorSnapshot,
  type LoanFrozenValues,
} from '../../lib/loanCalculator';

type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const FIELD_AUTO_SAVE_DEBOUNCE_MS = 1500;
const GEO_PHOTO_AUTO_SAVE_DEBOUNCE_MS = 2000;
const PAN_MANUAL_FAILURE_MESSAGE =
  'PAN verification returned no results. Enter all details manually below.';

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

function renderField(
  field: B2cEvFieldDef,
  value: string,
  error: string | undefined,
  onChange: (key: string, value: string) => void,
  formData: Record<string, unknown>
): React.ReactNode {
  const readOnly = isFieldReadOnly(field, formData);
  const common = {
    id: field.key,
    label: field.label,
    required: field.required,
    readOnly,
    disabled: readOnly,
    error,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(field.key, e.target.value),
  };

  if (field.type === 'textarea') {
    return (
      <TextArea
        key={field.key}
        {...common}
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
    />
  );
}

export const B2CEvApplicationWizard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');
  const wizardStepParam = searchParams.get('step');
  const wizardStageParam = searchParams.get('stage');
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
  const [panLookupLoading, setPanLookupLoading] = useState(false);
  const [panLookupError, setPanLookupError] = useState<string | null>(null);
  const [panLookupCountdown, setPanLookupCountdown] = useState(0);
  const [supportPanLookupLoading, setSupportPanLookupLoading] = useState(false);
  const [supportPanLookupError, setSupportPanLookupError] = useState<string | null>(null);
  const [supportPanLookupCountdown, setSupportPanLookupCountdown] = useState(0);
  const [kamRequestLoadingId, setKamRequestLoadingId] = useState<ComplianceItemId | null>(null);
  const [doRequestLoading, setDoRequestLoading] = useState(false);
  const [productFormConfig, setProductFormConfig] = useState<FormConfigCategory[]>([]);
  const [productFormConfigLoading, setProductFormConfigLoading] = useState(false);
  const [usedWebhookLinks, setUsedWebhookLinks] = useState<Set<string>>(() =>
    readUsedClientWebhookLinks()
  );
  const [clientSubmissionId] = useState(createClientSubmissionId);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
  const submitInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const formStateRef = useRef<WizardFormState>({
    applicant_name: '',
    loan_product_id: '',
    requested_loan_amount: '0',
    form_data: createInitialB2cEvFormData(),
  });
  const editingDraftIdRef = useRef<string | null>(null);
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
    if (!wizardStepParam && !wizardStageParam) return;
    const targetIndex = parseWizardStepJumpParam(searchParams, visibleStages);
    if (targetIndex != null) {
      setCurrentStep(targetIndex);
    }
  }, [wizardStepParam, wizardStageParam, visibleStages, searchParams, draftLoading]);

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
      ? `Fetching borrower details… ${panLookupCountdown}s remaining`
      : 'Fetching borrower details…';

  useEffect(() => {
    if (!supportPanLookupLoading) {
      setSupportPanLookupCountdown(0);
      return;
    }

    setSupportPanLookupCountdown(SUPPORT_PAN_LOOKUP_TIMEOUT_SECONDS);
    const interval = window.setInterval(() => {
      setSupportPanLookupCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [supportPanLookupLoading]);

  const supportPanLookupLoadingMessage =
    supportPanLookupCountdown > 0
      ? `Fetching support person details… ${supportPanLookupCountdown}s remaining`
      : 'Fetching support person details…';

  const supportPersonStepIndex = useMemo(
    () => visibleStages.findIndex((stage) => stage.id === 'support-person'),
    [visibleStages]
  );
  const supportPanPhase = getSupportPanLookupPhase(formState.form_data);
  const supportNextDisabled =
    currentStage?.id === 'support-person' && supportPanPhase !== 'profile';

  const geoPhotosStepIndex = useMemo(
    () => visibleStages.findIndex((stage) => stage.id === 'geo-photos'),
    [visibleStages]
  );

  const doRequested = isDoRequested(formState.form_data);

  const lockedStepIndices = useMemo(() => {
    if (doRequested) return [];
    return visibleStages
      .map((stage, index) =>
        POST_DO_LOCKED_STAGE_IDS.includes(stage.id as (typeof POST_DO_LOCKED_STAGE_IDS)[number])
          ? index
          : null
      )
      .filter((index): index is number => index !== null);
  }, [visibleStages, doRequested]);

  const isGeoPhotosStage = currentStage?.id === 'geo-photos';

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

  const loadDealerKyc = async (formData?: Record<string, unknown>): Promise<boolean> => {
    if (formData && isDealerKycPopulated(formData)) {
      return true;
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
        return true;
      }

      const message =
        kycRes.error ||
        'No active Client KYC record found for your account. Contact your KAM to complete dealer KYC setup.';
      setDealerKycError(message);
      if (window.location.search.includes('b2cEv=1')) {
        applyDealerPatch(DEMO_DEALER_PATCH);
        return true;
      }
      return false;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to load dealer profile from Client KYC';
      setDealerKycError(message);
      return false;
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

  useEffect(() => {
    if (!draftIdParam) return;
    const loadDraft = async () => {
      setDraftLoading(true);
      setDraftLoadError(null);
      try {
        const response = await apiService.getApplication(draftIdParam);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Draft not found');
        }
        const app = response.data;
        const statusKey = normalizeStatus(app.status || app.Status || '');
        if (statusKey !== 'draft' && statusKey !== 'query_with_client') {
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
        const productId =
          typeof app.loan_product === 'object' && app.loan_product
            ? String((app.loan_product as { code?: string }).code || '')
            : String(app.loanProduct || app.loan_product || '');

        setEditingDraftId(draftIdParam);
        const nextFormState: WizardFormState = {
          applicant_name: app.applicant_name || app.applicantName || '',
          loan_product_id: productId,
          requested_loan_amount: String(app.requested_loan_amount ?? app.requestedLoanAmount ?? '0'),
          form_data: syncB2cEvComputedFields(
            migratePanLookupDraftFields({
              ...createInitialB2cEvFormData(),
              ...parsedFormData,
            })
          ),
        };
        formStateRef.current = nextFormState;
        setFormState(nextFormState);
        if (!isDealerKycPopulated(parsedFormData)) {
          await loadDealerKyc(parsedFormData);
        }
      } catch (error: unknown) {
        setDraftLoadError(error instanceof Error ? error.message : 'Failed to load draft');
      } finally {
        setDraftLoading(false);
      }
    };
    void loadDraft();
  }, [draftIdParam]);

  useEffect(() => {
    if (currentStage?.id !== 'dealer') return;
    if (dealerKycLoading || isDealerKycPopulated(formState.form_data)) return;
    void loadDealerKyc(formState.form_data);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when dealer stage is opened
  }, [currentStage?.id, currentStep]);

  const buildFormDataPayloadFromState = (
    state: WizardFormState,
    patch?: Record<string, string>
  ): Record<string, unknown> => ({
    ...syncB2cEvComputedFields({ ...state.form_data, ...patch }),
    '_meta.formTemplate': B2C_EV_FORM_TEMPLATE_ID,
  });

  const canAutoSave = (): boolean => {
    if (submitInFlightRef.current || saveInFlightRef.current) return false;
    if (panLookupLoading || supportPanLookupLoading) return false;
    if (!formStateRef.current.loan_product_id) return false;
    return true;
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
            throw new Error(updateRes.error || 'Failed to update draft');
          }
          return draftId;
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
    [clientSubmissionId]
  );

  const ensureDraftSaved = useCallback(async (): Promise<string> => {
    const { draftId } = await persistDraft();
    return draftId;
  }, [persistDraft]);

  const scheduleAutoSave = useCallback(
    (debounceMs = FIELD_AUTO_SAVE_DEBOUNCE_MS) => {
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = window.setTimeout(() => {
        autoSaveTimerRef.current = null;
        if (!canAutoSave()) return;
        void persistDraft(undefined, { silent: true }).catch(() => undefined);
      }, debounceMs);
    },
    [persistDraft, panLookupLoading, supportPanLookupLoading]
  );

  const updateField = (key: string, value: string) => {
    commitFormState((prev) => {
      let nextFormData = { ...prev.form_data, [key]: value };
      if (key === '_meta.supportPersonType') {
        nextFormData = clearSupportPersonFields(nextFormData, value as SupportPersonType);
      }
      if ((PAN_LOOKUP_FIELD_KEYS as readonly string[]).includes(key)) {
        nextFormData['_meta.panLookup.status'] = 'pending';
        nextFormData['_meta.panLookup.inputHash'] = '';
        nextFormData['_meta.panLookup.completedAt'] = '';
      }
      if ((SUPPORT_PAN_LOOKUP_FIELD_KEYS as readonly string[]).includes(key)) {
        nextFormData['_meta.supportPanLookup.status'] = 'pending';
        nextFormData['_meta.supportPanLookup.inputHash'] = '';
        nextFormData['_meta.supportPanLookup.completedAt'] = '';
        nextFormData['_meta.supportPanLookup.phase'] = 'input';
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
    }
    if ((SUPPORT_PAN_LOOKUP_FIELD_KEYS as readonly string[]).includes(key)) {
      setSupportPanLookupError(null);
    }
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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

  const handleComplianceCheckboxChange = (key: string, checked: boolean) => {
    updateFields({ [key]: checked ? 'true' : 'false' });
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to send request to KAM');
      }
      const requestedAt = new Date().toISOString();
      const queryId = response.data?.queryId || '';
      const patch: Record<string, string> = { [item.requestedAtKey]: requestedAt };
      if (queryId) {
        patch[item.queryIdKey] = queryId;
      }
      await persistDraft(patch);
      updateFields(patch);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to send request to KAM';
      alert(message);
    } finally {
      setKamRequestLoadingId(null);
    }
  };

  const handleRequestDO = async () => {
    if (!validateCurrentStep(false)) return;

    setDoRequestLoading(true);
    try {
      const draftId = await ensureDraftSaved();
      const message = buildDoRequestMessage({
        applicantName: formState.applicant_name,
        applicationId: draftId,
      });
      const response = await apiService.createClientQuery(draftId, {
        message,
        requestKind: 'b2c_do',
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to send DO request to KAM');
      }
      const requestedAt = new Date().toISOString();
      const queryId = response.data?.queryId || '';
      const patch: Record<string, string> = { '_meta.doRequest.requestedAt': requestedAt };
      if (queryId) {
        patch['_meta.doRequest.queryId'] = queryId;
      }
      await persistDraft(patch);
      updateFields(patch);
      advanceStep();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to send DO request to KAM';
      alert(message);
    } finally {
      setDoRequestLoading(false);
    }
  };

  const validateCurrentStep = (saveAsDraft = false): boolean => {
    const errors = validateB2cEvStage(currentStage, formState.form_data, {
      loanProductId: formState.loan_product_id,
      saveAsDraft,
      formConfig: productFormConfig,
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const advanceStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, visibleStages.length - 1));
  };

  const runPanLookup = async (): Promise<boolean> => {
    cancelScheduledAutoSave();
    const currentFormData = formStateRef.current.form_data;
    const inputHash = buildPanLookupInputHash(currentFormData);

    if (!shouldRefetchPanLookup(currentFormData)) {
      return true;
    }

    setPanLookupLoading(true);
    setPanLookupError(null);

    const applyManualFailure = (message: string) => {
      setPanLookupError(message);
      commitFormState((prev) => ({
        ...prev,
        form_data: applyBorrowerManualProfilePhase(prev.form_data, inputHash),
      }));
      return true;
    };

    try {
      const payload = getPanLookupPayload(formStateRef.current.form_data);
      const response = await apiService.lookupBorrowerPan({
        mobileNumber: payload.mobileNumber,
        panNumber: payload.panNumber,
        fullName: payload.fullName,
        borrowerEmail: payload.borrowerEmail ?? null,
      });

      if (!response.success || !response.data?.formDataPatch) {
        return applyManualFailure(
          response.error || PAN_MANUAL_FAILURE_MESSAGE
        );
      }

      if (!hasMeaningfulBorrowerAutofill(response.data.formDataPatch)) {
        return applyManualFailure(PAN_MANUAL_FAILURE_MESSAGE);
      }

      commitFormState((prev) => {
        const cleared = clearBorrowerFields(prev.form_data);
        const patched = syncB2cEvComputedFields({
          ...cleared,
          ...response.data!.formDataPatch,
          '_meta.panLookup.status': 'success',
          '_meta.panLookup.inputHash': inputHash,
          '_meta.panLookup.completedAt': response.data!.lookupAt,
        });
        return {
          ...prev,
          applicant_name: readFieldValue(patched, 'borrower.customerName'),
          form_data: patched,
        };
      });
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : PAN_MANUAL_FAILURE_MESSAGE;
      return applyManualFailure(message);
    } finally {
      setPanLookupLoading(false);
    }
  };

  const handleSupportTypeChange = (type: SupportPersonType) => {
    setFormState((prev) => ({
      ...prev,
      form_data: clearSupportPersonFields(
        { ...prev.form_data, '_meta.supportPersonType': type },
        type
      ),
    }));
    setSupportPanLookupError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next['_meta.supportPersonType'];
      return next;
    });
  };

  const runSupportPanLookup = async (): Promise<boolean> => {
    cancelScheduledAutoSave();
    const inputErrors = validateSupportPanLookupInput(formStateRef.current.form_data);
    if (Object.keys(inputErrors).length > 0) {
      setFieldErrors(inputErrors);
      return false;
    }

    const payload = getSupportPanLookupPayload(formStateRef.current.form_data);
    if (!payload) return false;

    const prefix = payload.target;
    if (prefix !== 'coApplicant' && prefix !== 'guarantor') return false;

    const inputHash = buildSupportPanLookupInputHash(formStateRef.current.form_data);
    if (!shouldRefetchSupportPanLookup(formStateRef.current.form_data)) {
      commitFormState((prev) => ({
        ...prev,
        form_data: {
          ...prev.form_data,
          '_meta.supportPanLookup.phase': 'profile',
        },
      }));
      return true;
    }

    setSupportPanLookupLoading(true);
    setSupportPanLookupError(null);
    commitFormState((prev) => ({
      ...prev,
      form_data: {
        ...prev.form_data,
        '_meta.supportPanLookup.phase': 'loading',
      },
    }));

    try {
      const response = await apiService.lookupBorrowerPan({
        mobileNumber: payload.mobileNumber,
        panNumber: payload.panNumber,
        fullName: payload.fullName,
        borrowerEmail: payload.borrowerEmail ?? null,
        target: payload.target,
      });

      if (!response.success || !response.data?.formDataPatch) {
        setSupportPanLookupError(response.error || PAN_MANUAL_FAILURE_MESSAGE);
        commitFormState((prev) => ({
          ...prev,
          form_data: applySupportPersonManualProfilePhase(prev.form_data, prefix, inputHash),
        }));
        return true;
      }

      if (!hasMeaningfulSupportPersonAutofill(response.data.formDataPatch, prefix)) {
        setSupportPanLookupError(PAN_MANUAL_FAILURE_MESSAGE);
        commitFormState((prev) => ({
          ...prev,
          form_data: applySupportPersonManualProfilePhase(prev.form_data, prefix, inputHash),
        }));
        return true;
      }

      commitFormState((prev) => {
        const cleared = clearSupportPersonProfileFields(prev.form_data, prefix);
        const patched = syncB2cEvComputedFields({
          ...cleared,
          ...response.data!.formDataPatch,
          '_meta.supportPanLookup.status': 'success',
          '_meta.supportPanLookup.inputHash': inputHash,
          '_meta.supportPanLookup.completedAt': response.data!.lookupAt,
          '_meta.supportPanLookup.phase': 'profile',
        });
        return {
          ...prev,
          form_data: patched,
        };
      });
      return true;
    } catch (error: unknown) {
      setSupportPanLookupError(
        error instanceof Error ? error.message : PAN_MANUAL_FAILURE_MESSAGE
      );
      commitFormState((prev) => ({
        ...prev,
        form_data: applySupportPersonManualProfilePhase(prev.form_data, prefix, inputHash),
      }));
      return true;
    } finally {
      setSupportPanLookupLoading(false);
    }
  };

  const goNext = async () => {
    if (!validateCurrentStep(false)) return;

    if (currentStage?.id === 'product') {
      const lookupOk = await runPanLookup();
      if (!lookupOk) return;
      try {
        await persistDraft(undefined, { silent: true });
      } catch (error) {
        console.error('[B2CEvApplicationWizard] auto-save after PAN lookup failed:', error);
      }
      advanceStep();
      return;
    }

    if (currentStage?.id === 'support-person') {
      if (supportPanPhase !== 'profile') {
        setFieldErrors({
          '_meta.supportPanLookup.phase':
            'Verify PAN and complete the support person profile before continuing',
        });
        return;
      }
    }

    const nextStage = visibleStages[currentStep + 1];
    if (nextStage?.id === 'borrower' && !isPanLookupProfileReady(formStateRef.current.form_data)) {
      setFieldErrors({
        '_meta.panLookup.status':
          'Borrower details must be verified on the Loan Product step before continuing',
      });
      return;
    }

    if (nextStage?.id === 'dealer') {
      const kycOk = await loadDealerKyc(formState.form_data);
      if (!kycOk) return;
    }

    const nextStepIndex = currentStep + 1;
    if (lockedStepIndices.includes(nextStepIndex)) {
      return;
    }

    if (currentStage?.id === 'geo-photos') {
      return;
    }

    try {
      await persistDraft(undefined, { silent: true });
    } catch (error) {
      console.error('[B2CEvApplicationWizard] auto-save before step advance failed:', error);
    }

    advanceStep();
  };

  const goBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async (saveAsDraft: boolean) => {
    if (submitInFlightRef.current) return;

    if (!saveAsDraft) {
      if (!isLastStep) return;
      if (!completion.isComplete) {
        setFieldErrors(completion.errors);
        alert(
          `Please complete all required fields before submitting:\n\n${completion.missingByStage
            .map((s) => `${s.stageTitle}: ${s.fieldLabels.join(', ')}`)
            .join('\n')}`
        );
        return;
      }
      const submitComplianceErrors = validateComplianceForSubmit(formState.form_data);
      if (Object.keys(submitComplianceErrors).length > 0) {
        setFieldErrors({ ...completion.errors, ...submitComplianceErrors });
        alert(
          `Please complete the compliance checklist before submitting:\n\n${Object.values(submitComplianceErrors).join('\n')}`
        );
        return;
      }
    } else if (!formState.loan_product_id) {
      alert('Please select a loan product before saving a draft.');
      return;
    }

    submitInFlightRef.current = true;
    setLoading(true);
    const formDataToSend = buildFormDataPayloadFromState(formState);

    try {
      if (!saveAsDraft) {
        const validationResponse = await apiService.validateApplicationSubmission({
          productId: formState.loan_product_id,
          applicantName: formState.applicant_name,
          requestedLoanAmount: Number(formState.requested_loan_amount) || 0,
          formData: formDataToSend,
          clientSubmissionId,
        });

        if (!validationResponse.success) {
          const missingFieldsErrors: Record<string, string> = {};
          if (validationResponse.data?.missingFields && Array.isArray(validationResponse.data.missingFields)) {
            validationResponse.data.missingFields.forEach(
              (field: { fieldId: string; label: string; displayKey?: string }) => {
                const msg = `${field.label} is required`;
                missingFieldsErrors[field.fieldId] = msg;
                if (field.displayKey) missingFieldsErrors[field.displayKey] = msg;
              }
            );
          }
          if (validationResponse.data?.formatErrors && Array.isArray(validationResponse.data.formatErrors)) {
            validationResponse.data.formatErrors.forEach((err: { fieldId: string; message: string }) => {
              missingFieldsErrors[err.fieldId] = err.message;
            });
          }
          if (Object.keys(missingFieldsErrors).length > 0) {
            setFieldErrors(missingFieldsErrors);
          }
          throw new Error(validationResponse.error || 'Submission validation failed');
        }

        let draftId = editingDraftId;

        if (!draftId) {
          const createRes = await apiService.createApplication({
            applicantName: formState.applicant_name,
            productId: formState.loan_product_id,
            requestedLoanAmount: Number(formState.requested_loan_amount) || 0,
            formData: formDataToSend,
            saveAsDraft: true,
            clientSubmissionId,
          });
          if (!createRes.success) {
            throw new Error(createRes.error || 'Failed to create draft');
          }
          draftId = createRes.data?.loanApplicationId || createRes.data?.fileId || null;
          if (!draftId) throw new Error('Draft ID missing after create');
          setEditingDraftId(draftId);
        }

        const updateRes = await apiService.updateApplicationForm(draftId, {
          ...formDataToSend,
          applicant_name: formState.applicant_name,
          loan_product_id: formState.loan_product_id,
          requested_loan_amount: formState.requested_loan_amount,
        });
        if (!updateRes.success) {
          throw new Error(updateRes.error || 'Failed to update draft');
        }

        const submitRes = await apiService.submitApplication(draftId, { clientSubmissionId });
        if (!submitRes.success) {
          throw new Error(submitRes.error || 'Submit failed');
        }

        alert('Application submitted successfully.');
        navigate(`/applications/${draftId}`);
        return;
      }

      let draftId = editingDraftId;

      if (draftId) {
        const updateRes = await apiService.updateApplicationForm(draftId, {
          ...formDataToSend,
          applicant_name: formState.applicant_name,
          loan_product_id: formState.loan_product_id,
          requested_loan_amount: formState.requested_loan_amount,
        });
        if (!updateRes.success) {
          throw new Error(updateRes.error || 'Failed to update draft');
        }
      } else {
        const createRes = await apiService.createApplication({
          applicantName: formState.applicant_name,
          productId: formState.loan_product_id,
          requestedLoanAmount: Number(formState.requested_loan_amount) || 0,
          formData: formDataToSend,
          saveAsDraft: true,
          clientSubmissionId,
        });
        if (!createRes.success) {
          throw new Error(createRes.error || 'Failed to save draft');
        }
        draftId = createRes.data?.loanApplicationId || createRes.data?.fileId || null;
        if (!draftId) throw new Error('Draft ID missing after create');
        setEditingDraftId(draftId);
      }

      alert('Draft saved successfully.');
      const draftQuery = new URLSearchParams(window.location.search);
      draftQuery.set('draftId', draftId!);
      navigate(`/applications/new?${draftQuery.toString()}`, { replace: true });
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

          <div className="border-t border-neutral-200 pt-6">
            <h3 className="mb-4 text-sm font-medium text-neutral-800">Borrower verification</h3>
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
            {panLookupError && (
              <p className="mt-3 text-sm text-error" data-testid="b2c-pan-lookup-error">
                {panLookupError}
              </p>
            )}
            {panLookupLoading && (
              <p className="mt-3 text-sm text-neutral-600" data-testid="b2c-pan-lookup-loading">
                {panLookupLoadingMessage}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (stage.id === 'borrower' && !isPanLookupProfileReady(formState.form_data)) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Borrower details must be verified on the Loan Product step before this section can be
            loaded.
          </p>
          <Button type="button" variant="secondary" onClick={() => setCurrentStep(0)}>
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
            scheduleAutoSave();
          }}
        />
      );
    }

    if (stage.id === 'dealer') {
      if (dealerKycLoading) {
        return (
          <p className="text-sm text-neutral-600" data-testid="b2c-dealer-kyc-loading">
            Loading dealer profile from Client KYC…
          </p>
        );
      }

      if (!isDealerKycPopulated(formState.form_data)) {
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Dealer details are auto-filled from your Client KYC profile.
            </p>
            {dealerKycError && (
              <p className="text-sm text-error" data-testid="b2c-dealer-kyc-error">
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
          onFieldChange={updateField}
          onSupportTypeChange={handleSupportTypeChange}
          onVerify={() => void runSupportPanLookup()}
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
          onComplianceCheckboxChange={handleComplianceCheckboxChange}
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
          <p className="text-sm text-neutral-600" data-testid="borrower-pan-manual-message">
            {PAN_MANUAL_FAILURE_MESSAGE}
          </p>
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
          <div className="space-y-4 border-t border-neutral-200 pt-6">
            <h3 className="text-sm font-semibold text-neutral-900">Address</h3>
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
        <div className="p-8 text-center text-neutral-600">Loading draft...</div>
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
      {draftLoadError && (
        <Card className="mb-4 border-error/30 bg-error/5">
          <CardContent className="p-4 text-sm text-error">{draftLoadError}</CardContent>
        </Card>
      )}

      {dealerKycError && (
        <Card className="mb-4 border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm text-neutral-700">{dealerKycError}</p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardContent className="p-6">
          <B2cEvWizardStepper
            steps={visibleStages.map((stage) => ({
              id: stage.id,
              label: stage.title,
              description: stage.description,
            }))}
            currentStep={currentStep}
            completedSteps={completedStepIndices}
            lockedSteps={lockedStepIndices}
            onStepClick={(index) => {
              if (lockedStepIndices.includes(index)) return;

              if (index > currentStep) {
                const targetStage = visibleStages[index];
                if (
                  targetStage?.id === 'borrower' &&
                  !isPanLookupProfileReady(formState.form_data)
                ) {
                  return;
                }
                if (
                  supportPersonStepIndex >= 0 &&
                  index > supportPersonStepIndex &&
                  !validateSupportPersonStageAccessible(formState.form_data)
                ) {
                  return;
                }
                if (geoPhotosStepIndex >= 0 && index > geoPhotosStepIndex && !doRequested) {
                  return;
                }
              }

              setCurrentStep(index);
            }}
          />
          {draftSaveStatus !== 'idle' && (
            <p
              className="mt-3 text-xs text-neutral-500"
              data-testid="b2c-draft-save-status"
              aria-live="polite"
            >
              {draftSaveStatus === 'saving' && 'Saving draft…'}
              {draftSaveStatus === 'saved' && 'Draft saved'}
              {draftSaveStatus === 'error' && 'Draft save failed — use Save draft to retry'}
            </p>
          )}
        </CardContent>
      </Card>

      {currentStage?.id === 'borrower' && (
        <CibilProbabilityBar
          cibilScore={
            isPanLookupSuccessful(formState.form_data)
              ? getBorrowerCibilScoreFromFormData(formState.form_data)
              : null
          }
        />
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{currentStage?.title}</CardTitle>
          <p className="text-sm text-neutral-500">{currentStage?.description}</p>
        </CardHeader>
        <CardContent>{currentStage ? renderStageBody(currentStage) : null}</CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          icon={ChevronLeft}
          onClick={goBack}
          disabled={
            currentStep === 0 || loading || panLookupLoading || supportPanLookupLoading
          }
        >
          Back
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="tertiary"
            icon={Save}
            onClick={() => void handleSubmit(true)}
            disabled={loading || panLookupLoading || !formState.loan_product_id || supportPanLookupLoading}
          >
            Save draft
          </Button>

          {isLastStep ? (
            <Button
              type="button"
              icon={Send}
              onClick={() => void handleSubmit(false)}
              disabled={loading || !canSubmitApplication}
              data-testid="b2c-submit-application"
              title={
                !canSubmitApplication
                  ? 'Complete all required fields and compliance checklist before submitting'
                  : undefined
              }
            >
              {loading ? 'Submitting...' : 'Submit application'}
            </Button>
          ) : isGeoPhotosStage ? (
            <Button
              type="button"
              size="lg"
              onClick={() => void handleRequestDO()}
              disabled={
                loading ||
                doRequestLoading ||
                panLookupLoading ||
                supportPanLookupLoading
              }
              data-testid="b2c-wizard-request-do"
              className="min-h-[52px] min-w-[12rem] px-8 text-base font-bold shadow-md"
            >
              {doRequestLoading ? 'Requesting DO…' : 'Request DO'}
            </Button>
          ) : (
            <Button
              type="button"
              icon={ChevronRight}
              onClick={() => void goNext()}
              disabled={
                loading ||
                panLookupLoading ||
                supportPanLookupLoading ||
                supportNextDisabled
              }
              data-testid="b2c-wizard-next"
            >
              {panLookupLoading
                ? panLookupLoadingMessage
                : supportPanLookupLoading
                  ? supportPanLookupLoadingMessage
                  : 'Next'}
            </Button>
          )}
        </div>
      </div>

      {user?.clientId && (
        <p className="mt-4 text-xs text-neutral-500">
          Logged in as {user.email} · Client ID {user.clientId}
        </p>
      )}
    </MainLayout>
  );
};
