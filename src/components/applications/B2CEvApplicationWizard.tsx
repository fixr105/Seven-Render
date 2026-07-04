import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronLeft, ChevronRight, Save, Send } from 'lucide-react';
import { MainLayout } from '../layout/MainLayout';
import { PageHero } from '../layout/PageHero';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { Stepper } from '../ui/Stepper';
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
  buildPanLookupInputHash,
  clearBorrowerFields,
  getPanLookupPayload,
  isPanLookupSuccessful,
  migratePanLookupDraftFields,
  PAN_LOOKUP_FIELD_KEYS,
  PAN_LOOKUP_TIMEOUT_SECONDS,
} from '../../lib/b2cEvPanLookup';
import {
  buildSupportPanLookupInputHash,
  clearSupportPersonProfileFields,
  getSupportPanLookupPayload,
  getSupportPanLookupPhase,
  shouldRefetchSupportPanLookup,
  SUPPORT_PAN_LOOKUP_FIELD_KEYS,
  SUPPORT_PAN_LOOKUP_TIMEOUT_SECONDS,
} from '../../lib/b2cEvSupportPanLookup';
import { LoanCalculator } from './LoanCalculator';
import { SupportPersonPanWizard } from './SupportPersonPanWizard';
import { GeoTaggedPhotoUploads } from './GeoTaggedPhotoUploads';
import {
  formDataToFrozenValues,
  frozenValuesToFormDataPatch,
  type LoanFrozenValues,
} from '../../lib/loanCalculator';

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

function renderField(
  field: B2cEvFieldDef,
  value: string,
  error: string | undefined,
  onChange: (key: string, value: string) => void
): React.ReactNode {
  const common = {
    id: field.key,
    label: field.label,
    required: field.required,
    readOnly: field.readOnly,
    error,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(field.key, e.target.value),
  };

  if (field.type === 'textarea') {
    return <TextArea key={field.key} {...common} rows={3} />;
  }
  if (field.type === 'select' && field.options) {
    return (
      <Select
        key={field.key}
        label={field.label}
        required={field.required}
        error={error}
        value={value}
        disabled={field.readOnly}
        options={[{ value: '', label: `Select ${field.label}` }, ...field.options]}
        onChange={(e) => onChange(field.key, e.target.value)}
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
      placeholder={field.placeholder}
      data-testid={`b2c-field-${field.key.replace(/\./g, '-')}`}
    />
  );
}

export const B2CEvApplicationWizard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');
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
  const [dealerProfile, setDealerProfile] = useState<ClientKycDealerProfile | null>(null);
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
  const [clientSubmissionId] = useState(createClientSubmissionId);
  const submitInFlightRef = useRef(false);

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
    () => getB2cEvFormCompletion(visibleStages, formState.form_data, formState.loan_product_id),
    [visibleStages, formState.form_data, formState.loan_product_id]
  );

  const isLastStep = currentStep === visibleStages.length - 1;

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

  const completedStepIndices = useMemo(() => {
    return visibleStages
      .map((stage, index) => {
        const { errors } = getB2cEvFormCompletion(
          [stage],
          formState.form_data,
          formState.loan_product_id
        );
        return Object.keys(errors).length === 0 ? index : null;
      })
      .filter((index): index is number => index !== null);
  }, [visibleStages, formState.form_data, formState.loan_product_id]);

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
        setFormState({
          applicant_name: app.applicant_name || app.applicantName || '',
          loan_product_id: productId,
          requested_loan_amount: String(app.requested_loan_amount ?? app.requestedLoanAmount ?? '0'),
          form_data: syncB2cEvComputedFields(
            migratePanLookupDraftFields({
              ...createInitialB2cEvFormData(),
              ...parsedFormData,
            })
          ),
        });
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

  const updateField = (key: string, value: string) => {
    setFormState((prev) => {
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
  };

  const updateFields = (patch: Record<string, string>) => {
    setFormState((prev) => {
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
  };

  const validateCurrentStep = (saveAsDraft = false): boolean => {
    const errors = validateB2cEvStage(currentStage, formState.form_data, {
      loanProductId: formState.loan_product_id,
      saveAsDraft,
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const advanceStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, visibleStages.length - 1));
  };

  const runPanLookup = async (): Promise<boolean> => {
    const inputHash = buildPanLookupInputHash(formState.form_data);
    const cachedHash = readFieldValue(formState.form_data, '_meta.panLookup.inputHash');
    const status = readFieldValue(formState.form_data, '_meta.panLookup.status');
    // Only skip re-fetch when we already have address autofill. n8n sometimes returns
    // profile without address; caching that would leave address blank forever.
    const hasAddressAutofill = Boolean(
      readFieldValue(formState.form_data, 'borrower.address.line1')
    );

    if (status === 'success' && inputHash === cachedHash && hasAddressAutofill) {
      return true;
    }

    setPanLookupLoading(true);
    setPanLookupError(null);

    try {
      const payload = getPanLookupPayload(formState.form_data);
      const response = await apiService.lookupBorrowerPan({
        mobileNumber: payload.mobileNumber,
        panNumber: payload.panNumber,
        fullName: payload.fullName,
        borrowerEmail: payload.borrowerEmail ?? null,
      });

      if (!response.success || !response.data?.formDataPatch) {
        const message =
          response.error || 'Could not fetch borrower details. Please verify PAN and try again.';
        setPanLookupError(message);
        setFormState((prev) => ({
          ...prev,
          form_data: {
            ...prev.form_data,
            '_meta.panLookup.status': 'failed',
          },
        }));
        return false;
      }

      setFormState((prev) => {
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
        error instanceof Error
          ? error.message
          : 'Could not fetch borrower details. Please verify PAN and try again.';
      setPanLookupError(message);
      setFormState((prev) => ({
        ...prev,
        form_data: {
          ...prev.form_data,
          '_meta.panLookup.status': 'failed',
        },
      }));
      return false;
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
    const inputErrors = validateSupportPanLookupInput(formState.form_data);
    if (Object.keys(inputErrors).length > 0) {
      setFieldErrors(inputErrors);
      return false;
    }

    const payload = getSupportPanLookupPayload(formState.form_data);
    if (!payload) return false;

    const inputHash = buildSupportPanLookupInputHash(formState.form_data);
    if (!shouldRefetchSupportPanLookup(formState.form_data)) {
      setFormState((prev) => ({
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
    setFormState((prev) => ({
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
        const message =
          response.error ||
          'Could not fetch support person details. Please verify PAN and try again.';
        setSupportPanLookupError(message);
        setFormState((prev) => ({
          ...prev,
          form_data: {
            ...prev.form_data,
            '_meta.supportPanLookup.status': 'failed',
            '_meta.supportPanLookup.phase': 'input',
          },
        }));
        return false;
      }

      const prefix = payload.target;
      if (prefix !== 'coApplicant' && prefix !== 'guarantor') {
        return false;
      }
      setFormState((prev) => {
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
      const message =
        error instanceof Error
          ? error.message
          : 'Could not fetch support person details. Please verify PAN and try again.';
      setSupportPanLookupError(message);
      setFormState((prev) => ({
        ...prev,
        form_data: {
          ...prev.form_data,
          '_meta.supportPanLookup.status': 'failed',
          '_meta.supportPanLookup.phase': 'input',
        },
      }));
      return false;
    } finally {
      setSupportPanLookupLoading(false);
    }
  };

  const goNext = async () => {
    if (!validateCurrentStep(false)) return;

    if (currentStage?.id === 'product') {
      const lookupOk = await runPanLookup();
      if (!lookupOk) return;
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
    if (nextStage?.id === 'borrower' && !isPanLookupSuccessful(formState.form_data)) {
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
    } else if (!formState.loan_product_id) {
      alert('Please select a loan product before saving a draft.');
      return;
    }

    submitInFlightRef.current = true;
    setLoading(true);
    const formDataToSend = {
      ...formState.form_data,
      '_meta.formTemplate': B2C_EV_FORM_TEMPLATE_ID,
    };

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
                    updateField
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

    if (stage.id === 'borrower' && !isPanLookupSuccessful(formState.form_data)) {
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
          onFrozenValuesChange={(values: LoanFrozenValues | null) => {
            setFormState((prev) => {
              const nextFormData = { ...prev.form_data };
              for (const key of Object.keys(nextFormData)) {
                if (key.startsWith('loan.')) delete nextFormData[key];
              }
              if (values) {
                Object.assign(nextFormData, frozenValuesToFormDataPatch(values));
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
          onBatchChange={updateFields}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profileFields.map((field) => (
            <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
              {renderField(
                field,
                readFieldValue(formState.form_data, field.key),
                fieldErrors[field.key],
                updateField
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
                    updateField
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
      <PageHero
        title={t('pages.newApplication.pageTitle')}
        description="B2C EV manual entry — staged application"
      />

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

      {dealerProfile && (
        <Card className="mb-4 border-brand-primary/20 bg-brand-primary/5">
          <CardContent className="p-4 text-sm text-neutral-700">
            Dealer profile loaded for <strong>{dealerProfile.clientId}</strong>
            {dealerProfile.displayLabel ? ` — ${dealerProfile.displayLabel}` : ''}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardContent className="p-6">
          <Stepper
            fitToWidth
            steps={visibleStages.map((stage) => ({
              id: stage.id,
              label: stage.title,
              description: stage.description,
            }))}
            currentStep={currentStep}
            completedSteps={completedStepIndices}
            onStepClick={(index) => {
              const targetStage = visibleStages[index];
              if (
                targetStage?.id === 'borrower' &&
                index > currentStep &&
                !isPanLookupSuccessful(formState.form_data)
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
              if (index <= currentStep) setCurrentStep(index);
            }}
          />
        </CardContent>
      </Card>

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
              disabled={loading || !completion.isComplete}
              data-testid="b2c-submit-application"
              title={
                !completion.isComplete
                  ? 'Complete all required fields before submitting'
                  : undefined
              }
            >
              {loading ? 'Submitting...' : 'Submit application'}
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
