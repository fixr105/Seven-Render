import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHero } from '../components/layout/PageHero';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { TextArea } from '../components/ui/TextArea';
import {
  Save,
  Send,
  AlertTriangle,
  RefreshCw,
  Copy,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiService, type ClientLinkPoolItem } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { Stepper } from '../components/ui/Stepper';
import { getPanValidationError, isPanField } from '../utils/panValidation';
import {
  isValidEmailFormat,
  isValidTypeOfPurchase,
  parseIndianMobile,
} from '../utils/basicApplicationFieldsValidation';

const USED_CLIENT_WEBHOOK_LINKS_STORAGE_KEY = 'seven_used_client_webhook_links';

type NormalizedLinkPoolItem = {
  link: string;
  status: string;
};

const normalizeLinkPoolItem = (item: string | ClientLinkPoolItem): NormalizedLinkPoolItem => {
  if (typeof item === 'string') {
    return { link: item.trim(), status: '' };
  }

  return {
    link: String(item.link || '').trim(),
    status: String(item.status || '').trim(),
  };
};

/** Business KYC section IDs (one of these is shown based on business type). */
const BUSINESS_KYC_SECTION_IDS = ['section-2a', 'section-2b', 'section-2c', 'section-2d'] as const;
/** Labels for Business type selector. */
const BUSINESS_KYC_LABELS: Record<string, string> = {
  '2a': 'Private Limited',
  '2b': 'LLP',
  '2c': 'Partnership Firm',
  '2d': 'Self Employed / Proprietor',
};

function getDisplayCategories(
  formConfig: any[],
  businessType: string | undefined
): any[] {
  const businessKycCategories = formConfig.filter((c: any) =>
    BUSINESS_KYC_SECTION_IDS.includes(c.categoryId)
  );
  const otherCategories = formConfig.filter(
    (c: any) => !BUSINESS_KYC_SECTION_IDS.includes(c.categoryId)
  );

  if (businessKycCategories.length === 0) return formConfig;
  if (businessKycCategories.length === 1) {
    return [...otherCategories, ...businessKycCategories];
  }
  // Two or more: show only the selected Business KYC section
  if (businessType && ['2a', '2b', '2c', '2d'].includes(businessType)) {
    const selected = businessKycCategories.find(
      (c: any) => c.categoryId === `section-${businessType}`
    );
    if (selected) return [...otherCategories, selected];
  }
  return otherCategories;
}

interface FormData {
  applicant_name: string;
  loan_product_id: string;
  requested_loan_amount: string;
  form_data: Record<string, any>;
}

interface VehicleOption {
  vehicleId: string;
  make: string;
  model: string;
  requestedLoanAmount: string;
}

const VEHICLE_FETCH_ATTEMPTS = 3;
const VEHICLE_FETCH_RETRY_DELAY_MS = 300;

const normalizeProductId = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const createClientSubmissionId = (): string =>
  `submit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const NewApplication: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role || null;
  const userRoleId = user?.clientId || user?.kamId || user?.nbfcId || user?.creditTeamId || user?.id || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [clientSubmissionId, setClientSubmissionId] = useState<string>(() => createClientSubmissionId());
  const [formConfigLoading, setFormConfigLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loanProductsLoading, setLoanProductsLoading] = useState(true);
  const [loanProductsError, setLoanProductsError] = useState<string | null>(null);
  const [configuredProductsError, setConfiguredProductsError] = useState<string | null>(null);
  const [configuredProductIds, setConfiguredProductIds] = useState<Set<string>>(new Set());
  const [configuredProductsFetched, setConfiguredProductsFetched] = useState(false);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [vehicleOptionsLoading, setVehicleOptionsLoading] = useState(false);
  const [vehicleOptionsError, setVehicleOptionsError] = useState<string | null>(null);
  const [formConfig, setFormConfig] = useState<any[]>([]); // Form configuration from backend
  const [currentStep, setCurrentStep] = useState(0); // Module 2: Stepper current step
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]); // Module 2: Soft validation warnings
  const [duplicateWarning, setDuplicateWarning] = useState<{ fileId: string; status: string } | null>(null); // Module 2: Duplicate detection
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // Strict validation: field-level errors
  const [formData, setFormData] = useState<FormData>({
    applicant_name: '',
    loan_product_id: '',
    requested_loan_amount: '0',
    form_data: {
      _mobileNumber: '',
      _email: '',
      _typeOfPurchase: '',
      Remarks: '',
    },
  });
  const [folderLinkGenerating, setFolderLinkGenerating] = useState(false);
  const [copiedFolderUrl, setCopiedFolderUrl] = useState(false);
  const [usedWebhookLinks, setUsedWebhookLinks] = useState<Set<string>>(new Set());
  const [folderLinkStatus, setFolderLinkStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Fetch on mount (including SPA navigation). Form config loads only when user selects a loan product.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(USED_CLIENT_WEBHOOK_LINKS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setUsedWebhookLinks(new Set(parsed.filter((item) => typeof item === 'string' && item.trim() !== '')));
      }
    } catch {
      // ignore parse/storage errors
    }
  }, []);

  useEffect(() => {
    if (userRole === 'client') {
      fetchClientId();
      fetchConfiguredProducts();
      setFormConfigLoading(false);
    } else {
      setFormConfigLoading(false);
      setLoanProductsLoading(false);
    }
  }, [userRoleId, userRole]);

  // Fetch loan products when configured product IDs have been fetched (from reload or Load form)
  useEffect(() => {
    if (userRole === 'client' && configuredProductsFetched) {
      fetchLoanProducts();
    }
  }, [configuredProductIds, configuredProductsFetched, userRole]);

  // Refetch form config when user selects a loan product (e.g. Money Multiplier)
  // Product-specific configs require productId to load correctly; backend resolves clientId by email if needed
  useEffect(() => {
    if (userRole === 'client' && formData.loan_product_id) {
      fetchFormConfig(formData.loan_product_id);
    }
  }, [formData.loan_product_id]);

  useEffect(() => {
    const productId = formData.loan_product_id;
    if (userRole !== 'client' || !productId) {
      setVehicleOptions([]);
      setVehicleOptionsError(null);
      return;
    }
    const fetchVehicles = async () => {
      setVehicleOptionsLoading(true);
      setVehicleOptionsError(null);
      try {
        let response: Awaited<ReturnType<typeof apiService.getClientVehicles>> | null = null;
        let delayMs = VEHICLE_FETCH_RETRY_DELAY_MS;

        for (let attempt = 1; attempt <= VEHICLE_FETCH_ATTEMPTS; attempt += 1) {
          response = await apiService.getClientVehicles(productId);
          const data = Array.isArray(response.data) ? response.data : [];
          const isValidArray = !!response.success && Array.isArray(response.data);
          const hasVehicles = isValidArray && data.length > 0;
          const shouldRetry = !hasVehicles && !response.error && attempt < VEHICLE_FETCH_ATTEMPTS;
          if (!shouldRetry) break;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
        }

        if (!response || !response.success || !Array.isArray(response.data)) {
          setVehicleOptions([]);
          setVehicleOptionsError(response?.error || 'Failed to load vehicle options');
          return;
        }
        setVehicleOptions(response.data);
      } catch (error: any) {
        setVehicleOptions([]);
        setVehicleOptionsError(error.message || 'Failed to load vehicle options');
      } finally {
        setVehicleOptionsLoading(false);
      }
    };
    fetchVehicles();
    setFormData((prev) => ({
      ...prev,
      form_data: {
        ...prev.form_data,
        _vehicleId: '',
        _vehicleMake: '',
        _vehicleModel: '',
      },
    }));
  }, [formData.loan_product_id, userRole]);

  const loadForm = () => {
    if (userRole !== 'client') return;
    fetchClientId();
    if (formData.loan_product_id) {
      fetchFormConfig(formData.loan_product_id);
    }
    fetchConfiguredProducts();
  };

  const fetchClientId = async () => {
    if (userRole !== 'client' || !userRoleId) return;
    
    // Get clientId from user context (from API auth)
    if (user?.clientId) {
      setClientId(user.clientId);
    }
  };

  const fetchFormConfig = async (productId?: string) => {
    if (userRole !== 'client') {
      setFormConfigLoading(false);
      return;
    }

    // Backend resolves clientId from email when missing in JWT (e.g. cross-origin deploy)
    try {
      setFormConfigLoading(true);
      // Fetch form configuration for this client (product-specific when productId provided)
      const response = await apiService.getFormConfig(productId);
      if (response.success && response.data) {
        // The backend returns an array of categories with fields
        const configData = Array.isArray(response.data) ? response.data : [];
        
        // Handle both nested module format and flat category format
        let categoriesList: any[] = [];
        if (configData.length > 0) {
          // Check if data is nested in modules or flat categories
          if (configData[0]?.modules) {
            // Nested format: extract categories from modules
            configData.forEach((module: any) => {
              if (module.categories && Array.isArray(module.categories)) {
                categoriesList.push(...module.categories);
              }
            });
          } else {
            // Flat format: already categories
            categoriesList = configData;
          }
        }
        setFormConfig(categoriesList);
      } else {
        setFormConfig([]);
      }
    } catch (_error) {
      setFormConfig([]);
    } finally {
      setFormConfigLoading(false);
    }
  };

  const fetchLoanProducts = async () => {
    try {
      setLoanProductsLoading(true);
      setLoanProductsError(null);
      const response = await apiService.listLoanProducts(true); // activeOnly = true
      
      if (response.success && response.data) {
        // Map products and deduplicate by ID
        const productsMap = new Map<string, { id: string; name: string }>();
        response.data.forEach((product: any) => {
          const id = product.productId || product.id;
          const name = product.productName || product['Product Name'] || product.name;
          if (id && name && !productsMap.has(id)) {
            productsMap.set(id, { id, name });
          }
        });
        const allProducts = Array.from(productsMap.values());

        // Enforce backend-provided configured IDs strictly for clients.
        const configuredProductIdsNormalized = new Set(
          Array.from(configuredProductIds).map((id) => normalizeProductId(id))
        );
        if (configuredProductsError) {
          setLoanProducts([]);
          setLoanProductsError(configuredProductsError);
          return;
        }
        const visibleProducts = allProducts.filter((product) =>
          configuredProductIdsNormalized.has(normalizeProductId(product.id))
        );
        
        setLoanProducts(visibleProducts);
        
        if (visibleProducts.length === 0) {
          if (allProducts.length === 0) {
            setLoanProductsError('No loan products are currently available. Please contact your KAM or administrator.');
          } else {
            setLoanProductsError('No loan products are configured for your account. Please contact your KAM.');
          }
        }
      } else {
        setLoanProductsError(response.error || 'Failed to load loan products. Please try again.');
      }
    } catch (error: any) {
      setLoanProductsError(error.message || 'Failed to load loan products. Please try again.');
    } finally {
      setLoanProductsLoading(false);
    }
  };

  const fetchConfiguredProducts = async () => {
    if (userRole !== 'client') return;
    
    try {
      const response = await apiService.getConfiguredProducts();
      
      if (response.success && response.data) {
        const normalizedProductIds = response.data
          .map((productId: unknown) => String(productId ?? '').trim())
          .filter(Boolean);
        setConfiguredProductsError(null);
        setConfiguredProductIds(new Set(normalizedProductIds));
        setConfiguredProductsFetched(true);
      } else if (response.error) {
        setConfiguredProductsError(response.error);
        setLoanProductsError(response.error);
        setConfiguredProductIds(new Set());
        setConfiguredProductsFetched(true);
      }
    } catch (_error) {
      setConfiguredProductsError('No loan products are assigned to your account. Please contact your KAM to allocate products.');
      setLoanProductsError('No loan products are assigned to your account. Please contact your KAM to allocate products.');
      setConfiguredProductIds(new Set());
      setConfiguredProductsFetched(true);
    }
  };

  /** Default category name when none set; must match backend (mandatoryFieldValidation.service) */
  const DEFAULT_CATEGORY_NAME = 'Documents';
  /** File/document radio option values; skip PAN format validation for these (align with backend). */
  const isFileOptionValue = (v: unknown): boolean => {
    if (v == null) return false;
    const s = typeof v === 'string' ? v.trim() : String(v).trim();
    return ['Yes, Added to Folder', 'Awaiting, Will Update Folder', 'added_to_link', 'to_be_shared', 'yes_added_to_folder', 'awaiting_will_update', 'Not Available', 'not_available'].includes(s);
  };
  /** Build display key for form_data: "Label - Category Name" (human-readable, unique) */
  const getDisplayKey = (fieldLabel: string, categoryName: string) =>
    `${fieldLabel} - ${categoryName || DEFAULT_CATEGORY_NAME}`;

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      form_data: {
        ...prev.form_data,
        [key]: value,
      },
    }));
  };

  const vehicleMakes = useMemo(
    () =>
      Array.from(new Set(vehicleOptions.map((option) => option.make))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [vehicleOptions]
  );

  const selectedVehicleMake = String(formData.form_data._vehicleMake || '');
  const selectedVehicleModel = String(formData.form_data._vehicleModel || '');
  const modelsForSelectedMake = useMemo(
    () =>
      vehicleOptions
        .filter((option) => option.make === selectedVehicleMake)
        .map((option) => option.model)
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .sort((a, b) => a.localeCompare(b)),
    [vehicleOptions, selectedVehicleMake]
  );

  const handleGenerateFolderLink = async () => {
    if (userRole !== 'client') return;
    setFolderLinkStatus(null);
    setFolderLinkGenerating(true);
    try {
      const poolResponse = await apiService.getClientLinkPool();
      if (!poolResponse.success || !Array.isArray(poolResponse.data)) {
        throw new Error(poolResponse.error || 'Failed to fetch link pool');
      }

      const candidates = poolResponse.data
        .map(normalizeLinkPoolItem)
        .filter((item) => item.link !== '' && item.status.toUpperCase() !== 'YES');
      const selectedLink = candidates.find((item) => !usedWebhookLinks.has(item.link))?.link;
      if (!selectedLink) {
        setFolderLinkStatus({
          type: 'info',
          message: 'No unused links are available right now. Please try again shortly.',
        });
        return;
      }

      handleFieldChange('_documentsFolderLink', selectedLink);
      setFieldErrors((prev) => {
        if (!prev._documentsFolderLink) return prev;
        const next = { ...prev };
        delete next._documentsFolderLink;
        return next;
      });
      setCopiedFolderUrl(false);
      setFolderLinkStatus({ type: 'success', message: 'Link generated and added to the folder link field.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate folder link';
      setFolderLinkStatus({ type: 'error', message });
    } finally {
      setFolderLinkGenerating(false);
    }
  };

  const markFolderLinkUsed = async (link: string) => {
    if (usedWebhookLinks.has(link)) return;

    const consumeResponse = await apiService.consumeClientLink(link);
    if (!consumeResponse.success) {
      throw new Error(consumeResponse.error || 'Failed to mark link as used');
    }

    const nextUsedLinks = new Set(usedWebhookLinks);
    nextUsedLinks.add(link);
    setUsedWebhookLinks(nextUsedLinks);
    try {
      sessionStorage.setItem(
        USED_CLIENT_WEBHOOK_LINKS_STORAGE_KEY,
        JSON.stringify(Array.from(nextUsedLinks))
      );
    } catch {
      // ignore storage write errors
    }
  };

  const handleCopyFolderLink = async () => {
    const link = String(formData.form_data._documentsFolderLink || '').trim();
    if (!link) return;
    try {
      await markFolderLinkUsed(link);
      await navigator.clipboard.writeText(link);
      setCopiedFolderUrl(true);
      setTimeout(() => setCopiedFolderUrl(false), 2500);
      setFolderLinkStatus({ type: 'success', message: 'Link copied to clipboard.' });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not copy the folder link. Please copy it manually from the input.';
      setFolderLinkStatus({
        type: 'error',
        message,
      });
    }
  };

  const handleOpenFolderLink = async () => {
    const link = String(formData.form_data._documentsFolderLink || '').trim();
    if (!link) return;

    try {
      const parsedUrl = new URL(link);
      await markFolderLinkUsed(link);
      const opened = window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer');
      if (!opened) {
        setFolderLinkStatus({
          type: 'error',
          message: 'Popup blocked. Please allow popups for this site and try again.',
        });
      }
    } catch {
      setFolderLinkStatus({
        type: 'error',
        message: 'Please enter a valid folder link before opening.',
      });
    }
  };

  const displayCategories = useMemo(
    () => getDisplayCategories(formConfig, formData.form_data._businessType),
    [formConfig, formData.form_data._businessType]
  );

  const businessKycCategories = useMemo(
    () => formConfig.filter((c: any) => BUSINESS_KYC_SECTION_IDS.includes(c.categoryId)),
    [formConfig]
  );

  // Default _businessType when there is one or more Business KYC section so one section is visible (first tab when multiple).
  useEffect(() => {
    if (businessKycCategories.length === 0) return;
    const firstSection = businessKycCategories[0];
    const sectionId = firstSection?.categoryId?.replace(/^section-/, '') || '';
    if (sectionId && ['2a', '2b', '2c', '2d'].includes(sectionId)) {
      setFormData(prev =>
        prev.form_data._businessType
          ? prev
          : {
              ...prev,
              form_data: { ...prev.form_data, _businessType: sectionId },
            }
      );
    }
  }, [businessKycCategories]);

  // Validate mandatory fields before submission (strict validation)
  const validateMandatoryFields = (saveAsDraft: boolean): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    // Skip validation for drafts
    if (saveAsDraft) {
      return { isValid: true, errors: {} };
    }

    // Validate core required fields
    if (!formData.applicant_name?.trim()) {
      errors.applicant_name = 'Applicant Name is required';
    }
    if (!formData.loan_product_id) {
      errors.loan_product_id = 'Loan Product is required';
    }
    if (!String(formData.form_data._vehicleMake || '').trim()) {
      errors._vehicleMake = 'Vehicle make is required';
    }
    if (!String(formData.form_data._vehicleModel || '').trim()) {
      errors._vehicleModel = 'Vehicle model is required';
    }
    if (businessKycCategories.length > 1 && !formData.form_data._businessType) {
      errors._businessType = 'Please select your business type.';
    }

    const mobileParsed = parseIndianMobile(formData.form_data._mobileNumber);
    if (mobileParsed.ok === false) {
      errors._mobileNumber =
        mobileParsed.reason === 'empty'
          ? 'Mobile Number is required'
          : 'Please enter a valid 10-digit Indian mobile number';
    }
    const emailRaw = formData.form_data._email;
    if (emailRaw == null || (typeof emailRaw === 'string' && emailRaw.trim().length === 0)) {
      errors._email = 'Email ID is required';
    } else if (!isValidEmailFormat(emailRaw)) {
      errors._email = 'Please enter a valid email address';
    }
    const topType = formData.form_data._typeOfPurchase;
    if (!isValidTypeOfPurchase(topType)) {
      errors._typeOfPurchase =
        !topType || (typeof topType === 'string' && topType.trim().length === 0)
          ? 'Type of Purchase is required'
          : 'Type of Purchase must be Rental or EMI';
    }
    // Validate mandatory form fields from configuration (required + PAN format)
    // Use displayCategories so only the selected Business KYC section is validated
    displayCategories.forEach((category: any) => {
      const categoryName = category.categoryName || category['Category Name'] || category.categoryId || DEFAULT_CATEGORY_NAME;
      (category.fields || []).forEach((field: any) => {
        const fieldId = field.fieldId || field['Field ID'] || field.id;
        const fieldLabel = field.label || field['Field Label'] || field.fieldLabel;
        const displayKey = getDisplayKey(fieldLabel, categoryName);
        const fieldType = field.type || field['Field Type'] || field.fieldType;
        const isRequired = field.isRequired || field['Is Required'] === 'True' || field['Is Mandatory'] === 'True' || field.isMandatory === true;

        const value = formData.form_data[displayKey] ?? formData.form_data[fieldId];
        // File fields: satisfied if Yes/Added or Awaiting or Not Available (new or old values)
        const fileFieldSatisfied = fieldType === 'file' && (
          value === 'Yes, Added to Folder' || value === 'Awaiting, Will Update Folder' ||
          value === 'Not Available' || value === 'not_available' ||
          value === 'added_to_link' || value === 'to_be_shared' ||
          value === 'yes_added_to_folder' || value === 'awaiting_will_update'
        );

        if (isRequired) {
          let isEmpty = false;
          if (fieldType === 'file') {
            isEmpty = !fileFieldSatisfied;
          } else if (fieldType === 'checkbox') {
            isEmpty = value !== true && value !== 'true';
          } else {
            isEmpty = !value || (typeof value === 'string' && value.trim().length === 0);
          }

          if (isEmpty) {
            errors[fieldId] = `${fieldLabel} is required`;
          }
        }

        // PAN format validation (when value is present). Skip for file-type or file-option values.
        const panField = { fieldId, label: fieldLabel, type: fieldType };
        if (
          isPanField(panField) &&
          fieldType !== 'file' &&
          value &&
          typeof value === 'string' &&
          value.trim().length > 0 &&
          !isFileOptionValue(value)
        ) {
          const panError = getPanValidationError(value);
          if (panError) {
            errors[fieldId] = errors[fieldId] || panError;
          }
        }
      });
    });

    // Require a valid Documents Folder Link in the dedicated field only (no other field may satisfy this)
    const fd = formData.form_data;
    const folderLink = fd._documentsFolderLink;
    const isValidFolderLink =
      folderLink &&
      typeof folderLink === 'string' &&
      folderLink.trim().length > 0 &&
      (folderLink.toLowerCase().includes('drive.google.com') ||
        folderLink.toLowerCase().includes('onedrive.live.com') ||
        folderLink.toLowerCase().includes('sharepoint.com'));
    if (!isValidFolderLink) {
      errors._documentsFolderLink =
        'Please provide the document folder link and update the document checklist before submitting the application.';
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  };

  // Module 2: Enhanced submit with strict mandatory field validation
  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    
    // Clear previous errors
    setFieldErrors({});
    setValidationWarnings([]);
    setDuplicateWarning(null);

    if (!clientId) {
      alert('Client information not found. Please contact support.');
      return;
    }

    // Strict validation for non-draft submissions
    if (!saveAsDraft) {
      const validation = validateMandatoryFields(saveAsDraft);
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        // Scroll to first error
        const firstErrorField = Object.keys(validation.errors)[0];
        const errorElement = document.getElementById(firstErrorField) || 
                           document.querySelector(`[data-field-id="${firstErrorField}"]`);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const basicApplicationErrorKeys = new Set([
          'applicant_name',
          'loan_product_id',
          '_businessType',
          '_mobileNumber',
          '_email',
          '_typeOfPurchase',
          '_vehicleMake',
          '_vehicleModel',
        ]);
        const hasDocumentErrors =
          '_documentsFolderLink' in validation.errors ||
          Object.keys(validation.errors).some((k) => !basicApplicationErrorKeys.has(k));
        const message = hasDocumentErrors
          ? 'Please provide the document folder link and update the document checklist before submitting the application.'
          : `Please fill in all required fields:\n\n${Object.values(validation.errors).join('\n')}`;
        alert(message);
        return;
      }
    }

    setLoading(true);

    // Transform form_data: ensure file field values are human-readable for storage
    const formDataToSend = { ...formData.form_data };
    Object.keys(formDataToSend).forEach((k) => {
      const v = formDataToSend[k];
      if (v === 'yes_added_to_folder') formDataToSend[k] = 'Yes, Added to Folder';
      else if (v === 'awaiting_will_update') formDataToSend[k] = 'Awaiting, Will Update Folder';
      else if (v === 'not_available') formDataToSend[k] = 'Not Available';
    });

    try {
      if (!saveAsDraft) {
        const validationResponse = await apiService.validateApplicationSubmission({
          productId: formData.loan_product_id,
          applicantName: formData.applicant_name,
          formData: formDataToSend,
          clientSubmissionId,
        });

        if (!validationResponse.success) {
          const missingFieldsErrors: Record<string, string> = {};
          if (validationResponse.data?.missingFields && Array.isArray(validationResponse.data.missingFields)) {
            validationResponse.data.missingFields.forEach((field: { fieldId: string; label: string; displayKey?: string }) => {
              const msg = `${field.label} is required`;
              missingFieldsErrors[field.fieldId] = msg;
              if (field.displayKey) missingFieldsErrors[field.displayKey] = msg;
            });
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

        const preflightWarnings = validationResponse.data?.warnings ?? [];
        const preflightDuplicate = validationResponse.data?.duplicateFound ?? null;
        if (preflightWarnings.length > 0) {
          setValidationWarnings(preflightWarnings);
        }
        if (preflightDuplicate) {
          setDuplicateWarning(preflightDuplicate);
        }
        if (preflightWarnings.length > 0 || preflightDuplicate) {
          const warningMessages = [
            ...preflightWarnings,
            ...(preflightDuplicate
              ? [`Duplicate application found: ${preflightDuplicate.fileId ?? ''}`]
              : []),
          ];
          const proceed = window.confirm(
            `Application will be submitted with the following warnings:\n\n${warningMessages.join('\n')}\n\nDo you want to proceed?`
          );
          if (!proceed) {
            return;
          }
        }
      }

      const response = await apiService.createApplication({
        productId: formData.loan_product_id,
        applicantName: formData.applicant_name,
        formData: formDataToSend,
        saveAsDraft: saveAsDraft,
        clientSubmissionId,
      });

      if (!response.success) {
        // Handle backend validation errors (400 with missingFields and/or formatErrors)
        const missingFieldsErrors: Record<string, string> = {};
        if (response.data?.missingFields && Array.isArray(response.data.missingFields)) {
          response.data.missingFields.forEach((field: { fieldId: string; label: string; displayKey?: string }) => {
            const msg = `${field.label} is required`;
            missingFieldsErrors[field.fieldId] = msg;
            if (field.displayKey) missingFieldsErrors[field.displayKey] = msg;
          });
        }
        if (response.data?.formatErrors && Array.isArray(response.data.formatErrors)) {
          response.data.formatErrors.forEach((err: { fieldId: string; message: string }) => {
            missingFieldsErrors[err.fieldId] = err.message;
          });
        }
        if (Object.keys(missingFieldsErrors).length > 0) {
          setFieldErrors(missingFieldsErrors);
          const firstErrorField = Object.keys(missingFieldsErrors)[0];
          const errorElement = document.getElementById(firstErrorField) || 
                             document.querySelector(`[data-field-id="${firstErrorField}"]`);
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          alert(response.error || Object.values(missingFieldsErrors).join('\n'));
          return;
        }
        throw new Error(response.error || 'Failed to create application');
      }

      const createdLoanApplicationId = response.data?.loanApplicationId;
      const createdFileId = response.data?.fileId;
      if (!createdLoanApplicationId || !createdFileId) {
        throw new Error(
          'Submission was not confirmed by the server (missing application ID). Please retry.'
        );
      }

      // Module 2: Handle warnings and duplicate detection
      const validationWarns = response.data?.warnings ?? [];
      if (validationWarns.length > 0) {
        setValidationWarnings(validationWarns);
      }

      if (response.data?.duplicateFound) {
        setDuplicateWarning(response.data.duplicateFound);
      }

      // Success - show message and navigate
      const successMessage = saveAsDraft 
        ? 'Application saved as draft successfully!'
        : (response.data?.warnings?.length ?? 0) > 0
        ? 'Application submitted successfully with warnings. Your KAM will review it.'
        : 'Application submitted successfully!';
      
      alert(successMessage);
      setClientSubmissionId(createClientSubmissionId());
      navigate('/applications');
    } catch (error: any) {
      alert(`Failed to ${saveAsDraft ? 'save' : 'submit'} application: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (user?.name) {
      return user.name;
    }
    if (user?.email) {
      return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return '';
  };

  /** Get form_data value for a field - supports displayKey and fieldId (backward compat) */
  const getFormValue = (displayKey: string, fieldId: string) =>
    formData.form_data[displayKey] ?? formData.form_data[fieldId];

  /** Map internal radio value to human-readable for Airtable storage */
  const toStoredValue = (v: string) => {
    if (v === 'yes_added_to_folder') return 'Yes, Added to Folder';
    if (v === 'awaiting_will_update') return 'Awaiting, Will Update Folder';
    if (v === 'not_available') return 'Not Available';
    return v;
  };

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="New Loan Application"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <PageHero title="New Loan Application" />
      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* Documents folder: backend-generated link with manual override */}
        <Card id="documents-folder-link" className="mb-6 overflow-hidden">
          <CardHeader className="border-b border-neutral-200 bg-gradient-to-r from-brand-primary/[0.10] via-brand-primary/[0.06] to-white">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-white p-2 shadow-sm ring-1 ring-brand-primary/20">
                <FolderOpen className="h-5 w-5 text-brand-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Documents Folder (Required)</CardTitle>
                <p className="mt-1 text-sm text-neutral-600">
                  Generate a shareable folder link and verify it before submitting.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <section
                role="button"
                tabIndex={userRole === 'client' ? 0 : -1}
                aria-label="Generate and fill folder link"
                data-testid="generate-link-button"
                onClick={() => {
                  if (userRole === 'client' && !folderLinkGenerating) {
                    void handleGenerateFolderLink();
                  }
                }}
                onKeyDown={(e) => {
                  if (userRole !== 'client' || folderLinkGenerating) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void handleGenerateFolderLink();
                  }
                }}
                className={`rounded-2xl border border-brand-primary/20 bg-brand-primary/[0.05] p-4 sm:p-5 transition-all duration-200 ${
                  userRole === 'client'
                    ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:bg-brand-primary/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2'
                    : 'opacity-70'
                }`}
              >
                <h3 className="text-base font-semibold text-neutral-900">Generate Link</h3>
                <p className="mt-1 text-sm text-neutral-700">
                  Fetch and auto-fill a shareable folder link.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-primary ring-1 ring-brand-primary/20">
                  {folderLinkGenerating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  <span>{folderLinkGenerating ? 'Generating link...' : 'Generate Link'}</span>
                </div>
                {userRole !== 'client' && (
                  <p className="mt-2 text-xs text-neutral-500">Only client users can generate links.</p>
                )}
                {folderLinkStatus && (
                  <p
                    className={`mt-3 text-sm ${
                      folderLinkStatus.type === 'error'
                        ? 'text-error'
                        : folderLinkStatus.type === 'success'
                        ? 'text-success'
                        : 'text-neutral-700'
                    }`}
                    aria-live="polite"
                  >
                    {folderLinkStatus.message}
                  </p>
                )}
                {copiedFolderUrl && (
                  <p className="mt-2 text-sm text-success" aria-live="polite">
                    Link copied to clipboard.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
                <h3 className="text-base font-semibold text-neutral-900">Folder Link</h3>
                <p className="mt-1 text-sm text-neutral-600">You can edit this link before submission.</p>
              <Input
                id="_documentsFolderLink"
                label="Folder Link"
                type="url"
                required
                placeholder="https://drive.google.com/... or https://onedrive.live.com/..."
                value={formData.form_data._documentsFolderLink || ''}
                onChange={(e) => {
                  handleFieldChange('_documentsFolderLink', e.target.value);
                  if (fieldErrors._documentsFolderLink) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next._documentsFolderLink;
                      return next;
                    });
                  }
                }}
                error={fieldErrors._documentsFolderLink}
                helperText={
                  fieldErrors._documentsFolderLink
                    ? undefined
                    : 'Paste a folder URL (not a link to one file).'
                }
                title="Paste the shareable folder link. It should open the folder view, not one document."
                className="mt-3"
              />
              <div className="mt-4 flex flex-col gap-3">
                <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:min-w-[320px]">
                  <Button
                    type="button"
                    variant="secondary"
                    icon={Copy}
                    onClick={handleCopyFolderLink}
                    disabled={!String(formData.form_data._documentsFolderLink || '').trim()}
                    data-testid="copy-folder-link"
                    className="w-full justify-center whitespace-nowrap rounded-xl border-neutral-300 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-neutral-50"
                  >
                    Copy Link
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    icon={ExternalLink}
                    onClick={handleOpenFolderLink}
                    disabled={!String(formData.form_data._documentsFolderLink || '').trim()}
                    aria-label="Open folder link in new tab"
                    title="Open folder link in a new tab"
                    data-testid="open-folder-link"
                    className="w-full justify-center whitespace-nowrap rounded-xl border-neutral-300 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-neutral-50"
                  >
                    Open Link
                  </Button>
                </div>
                <p className="text-xs text-neutral-500 sm:text-sm">
                  Make sure the link opens the entire folder for reviewers.
                </p>
              </div>
              </section>
            </div>
            <p className="text-xs text-neutral-500">
              Need help? Email{' '}
              <a href="mailto:contact@sevenfincorp.com" className="text-brand-primary hover:underline">
                contact@sevenfincorp.com
              </a>
              .
            </p>
          </CardContent>
        </Card>

        {/* Module 2: Stepper */}
        {formConfig.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <Stepper
                steps={[
                  { id: 'details', label: 'Application Details', description: 'Basic Information' },
                  ...displayCategories.map((cat: any, idx: number) => ({
                    id: cat.categoryId || `category-${idx}`,
                    label: cat.categoryName || cat['Category Name'] || cat.categoryId || DEFAULT_CATEGORY_NAME,
                    description: cat.description || '',
                  })),
                ]}
                currentStep={currentStep}
                onStepClick={(stepIndex) => {
                  const sectionId = stepIndex === 0 ? 'application-details' : `category-${stepIndex - 1}`;
                  const element = document.getElementById(sectionId);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  setCurrentStep(stepIndex);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Module 2: Validation Warnings */}
        {(validationWarnings.length > 0 || duplicateWarning) && (
          <Card className="mb-6 border-warning/30 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-warning mb-2">Validation Warnings</h4>
                  <ul className="space-y-1 text-sm text-neutral-700">
                    {validationWarnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                    {duplicateWarning && (
                      <li className="font-medium">
                        • Duplicate application found: File ID {duplicateWarning.fileId} (Status: {duplicateWarning.status})
                      </li>
                    )}
                  </ul>
                  <p className="text-xs text-neutral-600 mt-2">
                    You can still submit, but please review these warnings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Core Required Fields per JSON Specification */}
        <Card id="application-details" className="mb-6">
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
            <p className="text-sm text-neutral-500 mt-0.5">Basic Information</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="applicant_name"
                data-testid="applicant-name-input"
                label="Applicant Name *"
                placeholder="Enter applicant's full name"
                value={formData.applicant_name}
                onChange={(e) => {
                  setFormData({ ...formData, applicant_name: e.target.value });
                  // Clear error when field is changed
                  if (fieldErrors.applicant_name) {
                    setFieldErrors(prev => {
                      const next = { ...prev };
                      delete next.applicant_name;
                      return next;
                    });
                  }
                }}
                required
                error={fieldErrors.applicant_name}
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-0 sm:min-w-[200px]">
                    <Select
                      data-testid="loan-product-select"
                      label="Loan Product *"
                      options={[
                        { value: '', label: loanProductsLoading ? 'Loading products...' : loanProducts.length === 0 ? 'No products available' : 'Select Loan Product' },
                        ...loanProducts.map(p => ({ value: p.id, label: p.name }))
                      ]}
                      value={formData.loan_product_id}
                      onChange={(e) => {
                        setFormData({ ...formData, loan_product_id: e.target.value });
                        // Clear error when field is changed
                        if (fieldErrors.loan_product_id) {
                          setFieldErrors(prev => {
                            const next = { ...prev };
                            delete next.loan_product_id;
                            return next;
                          });
                        }
                      }}
                      required
                      error={fieldErrors.loan_product_id || loanProductsError || undefined}
                      disabled={loanProductsLoading || loanProducts.length === 0}
                      helperText={loanProductsError || (loanProducts.length === 0 ? 'No loan products are configured for your account. Please contact your KAM.' : undefined)}
                    />
                  </div>
                  {userRole === 'client' && (
                    <Button data-testid="load-form-button" variant="tertiary" size="sm" icon={RefreshCw} onClick={loadForm} disabled={formConfigLoading} className="mb-1">
                      Load form
                    </Button>
                  )}
                </div>
              </div>
              <Input
                id="_mobileNumber"
                data-testid="basic-mobile"
                label="Mobile Number *"
                type="tel"
                placeholder="10-digit mobile number"
                value={formData.form_data._mobileNumber ?? ''}
                onChange={(e) => {
                  handleFieldChange('_mobileNumber', e.target.value);
                  if (fieldErrors._mobileNumber) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next._mobileNumber;
                      return next;
                    });
                  }
                }}
                required
                error={fieldErrors._mobileNumber}
              />
              <Input
                id="_email"
                data-testid="basic-email"
                label="Email ID *"
                type="email"
                placeholder="name@example.com"
                value={formData.form_data._email ?? ''}
                onChange={(e) => {
                  handleFieldChange('_email', e.target.value);
                  if (fieldErrors._email) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next._email;
                      return next;
                    });
                  }
                }}
                required
                error={fieldErrors._email}
              />
              <Select
                id="_typeOfPurchase"
                data-testid="basic-type-of-purchase"
                label="Type of Purchase *"
                options={[
                  { value: '', label: 'Select type' },
                  { value: 'Rental', label: 'Rental' },
                  { value: 'EMI', label: 'EMI' },
                ]}
                value={formData.form_data._typeOfPurchase ?? ''}
                onChange={(e) => {
                  handleFieldChange('_typeOfPurchase', e.target.value);
                  if (fieldErrors._typeOfPurchase) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next._typeOfPurchase;
                      return next;
                    });
                  }
                }}
                required
                error={fieldErrors._typeOfPurchase}
              />
              <Select
                id="_vehicleMake"
                data-testid="vehicle-make-select"
                label="Vehicle Make *"
                options={[
                  {
                    value: '',
                    label: vehicleOptionsLoading
                      ? 'Loading makes...'
                      : vehicleMakes.length === 0
                        ? 'No makes available'
                        : 'Select make',
                  },
                  ...vehicleMakes.map((make) => ({ value: make, label: make })),
                ]}
                value={selectedVehicleMake}
                onChange={(e) => {
                  const nextMake = e.target.value;
                  const resetModel = nextMake !== selectedVehicleMake;
                  if (fieldErrors._vehicleMake || fieldErrors._vehicleModel) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next._vehicleMake;
                      delete next._vehicleModel;
                      return next;
                    });
                  }
                  setFormData((prev) => ({
                    ...prev,
                    form_data: {
                      ...prev.form_data,
                      _vehicleMake: nextMake,
                      _vehicleModel: resetModel ? '' : prev.form_data._vehicleModel,
                      _vehicleId: '',
                    },
                  }));
                }}
                required
                disabled={vehicleOptionsLoading}
                error={fieldErrors._vehicleMake || vehicleOptionsError || undefined}
                helperText={
                  vehicleOptionsError ||
                  (formData.loan_product_id && vehicleMakes.length === 0
                    ? 'No mapped vehicles found for this product. Please contact your KAM.'
                    : undefined)
                }
              />
              <Select
                id="_vehicleModel"
                data-testid="vehicle-model-select"
                label="Vehicle Model *"
                options={[
                  {
                    value: '',
                    label:
                      !selectedVehicleMake
                        ? 'Select make first'
                        : modelsForSelectedMake.length === 0
                          ? 'No models available'
                          : 'Select model',
                  },
                  ...modelsForSelectedMake.map((model) => ({ value: model, label: model })),
                ]}
                value={selectedVehicleModel}
                onChange={(e) => {
                  const nextModel = e.target.value;
                  const selectedOption = vehicleOptions.find(
                    (option) =>
                      option.make === selectedVehicleMake && option.model === nextModel
                  );
                  if (fieldErrors._vehicleModel) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next._vehicleModel;
                      return next;
                    });
                  }
                  setFormData((prev) => ({
                    ...prev,
                    form_data: {
                      ...prev.form_data,
                      _vehicleModel: nextModel,
                      _vehicleId: selectedOption?.vehicleId || '',
                    },
                  }));
                }}
                required
                disabled={!selectedVehicleMake || modelsForSelectedMake.length === 0}
                error={fieldErrors._vehicleModel}
              />
              <div className="md:col-span-2">
                <TextArea
                  id="Remarks"
                  data-testid="remarks-textarea"
                  label="Remarks"
                  placeholder="Optional notes about this application"
                  value={formData.form_data.Remarks ?? ''}
                  onChange={(e) => handleFieldChange('Remarks', e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business type: tabs (swipe/tap to switch) — only the selected section is shown */}
        {formConfig.length > 0 && businessKycCategories.length >= 1 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Business type</CardTitle>
              <p className="text-sm text-neutral-500 mt-0.5">
                {businessKycCategories.length > 1
                  ? 'Tap a type below or swipe to switch. Submit for the selected type.'
                  : 'Your application form includes documents for this business type.'}
              </p>
            </CardHeader>
            <CardContent>
              <div
                className="flex gap-1 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory"
                style={{ scrollbarWidth: 'thin' }}
                role="tablist"
                aria-label="Business type"
              >
                {businessKycCategories.map((c: any) => {
                  const sectionId = c.categoryId?.replace(/^section-/, '') || '';
                  const label = BUSINESS_KYC_LABELS[sectionId] || c.categoryName || c.categoryId;
                  const isSelected = (formData.form_data._businessType ?? '') === sectionId;
                  return (
                    <button
                      key={c.categoryId}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      data-testid={`business-type-tab-${sectionId}`}
                      className={`shrink-0 snap-start rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary text-white'
                          : 'border-neutral-300 bg-neutral-50 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-100'
                      }`}
                      onClick={() => {
                        handleFieldChange('_businessType', sectionId);
                        if (fieldErrors._businessType) {
                          setFieldErrors(prev => {
                            const next = { ...prev };
                            delete next._businessType;
                            return next;
                          });
                        }
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {fieldErrors._businessType && (
                <p className="mt-2 text-sm text-error" role="alert">
                  {fieldErrors._businessType}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Configured Form Fields from KAM */}
        {formConfigLoading ? (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-neutral-600">Loading form configuration...</p>
              </div>
            </CardContent>
          </Card>
        ) : formConfig.length === 0 && formData.loan_product_id ? (
          <Card className="mb-6">
            <CardContent className="p-6">
              <p className="text-sm text-neutral-600">
                No form configuration found for this product. Please try &quot;Load form&quot; or contact your KAM to configure the application form.
              </p>
            </CardContent>
          </Card>
        ) : formConfig.length > 0 ? (
          displayCategories
            .filter((category: any) => category.fields && category.fields.length > 0)
            .map((category: any, categoryIndex: number) => (
            <Card 
              key={category.categoryId || category.id} 
              id={`category-${categoryIndex}`}
              className="mb-6"
            >
              <CardHeader>
                <CardTitle>{category.categoryName || category['Category Name'] || category.categoryId || DEFAULT_CATEGORY_NAME}</CardTitle>
                {category.description && (
                  <p className="text-sm text-neutral-600 mt-1">{category.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(category.fields || []).map((field: any) => {
                    const fieldId = field.fieldId || field['Field ID'] || field.id;
                    const fieldLabel = field.label || field['Field Label'] || field.fieldLabel;
                    const categoryName = category.categoryName || category['Category Name'] || category.categoryId || DEFAULT_CATEGORY_NAME;
                    const displayKey = getDisplayKey(fieldLabel, categoryName);
                    const fieldType = field.type || field['Field Type'] || field.fieldType;
                    const isRequired = field.isRequired || field['Is Required'] === 'True' || field.isMandatory === 'True';
                    const placeholder = field.placeholder || field['Field Placeholder'] || field.fieldPlaceholder;
                    let options: string[] = [];
                    try {
                      options = field.options || (field['Field Options'] ? (typeof field['Field Options'] === 'string' ? JSON.parse(field['Field Options']) : field['Field Options']) : []);
                    } catch (_e) {
                      options = [];
                    }
                    const hasError = !!fieldErrors[fieldId];
                    const fieldError = fieldErrors[fieldId];
                    const formValue = getFormValue(displayKey, fieldId);

                    const fileRadioOptions = [
                      { value: 'yes_added_to_folder', label: 'Yes, Added to Folder' },
                      { value: 'awaiting_will_update', label: 'Awaiting, Will Update Folder' },
                      { value: 'not_available', label: 'Not Available' },
                    ];
                    const isFileOptionChecked = (opt: { value: string }) => {
                      const v = formValue;
                      if (opt.value === 'yes_added_to_folder') return v === 'Yes, Added to Folder' || v === 'added_to_link';
                      if (opt.value === 'awaiting_will_update') return v === 'Awaiting, Will Update Folder' || v === 'to_be_shared';
                      if (opt.value === 'not_available') return v === 'Not Available' || v === 'not_available';
                      return false;
                    };

                    return (
                      <div key={fieldId}>
                        {fieldType === 'file' ? (
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-neutral-700">
                              {fieldLabel}
                              {isRequired && <span className="text-error ml-1">*</span>}
                            </label>
                            <div className="flex flex-wrap gap-4" role="radiogroup" aria-label={fieldLabel}>
                              {fileRadioOptions.map((opt) => (
                                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={fieldId}
                                    value={opt.value}
                                    checked={isFileOptionChecked(opt)}
                                    onChange={() => {
                                      handleFieldChange(displayKey, toStoredValue(opt.value));
                                      if (fieldErrors[fieldId]) {
                                        setFieldErrors(prev => {
                                          const next = { ...prev };
                                          delete next[fieldId];
                                          return next;
                                        });
                                      }
                                    }}
                                    className="w-4 h-4 text-brand-primary border-neutral-300 focus:ring-brand-primary"
                                  />
                                  <span className="text-sm text-neutral-700">{opt.label}</span>
                                </label>
                              ))}
                            </div>
                            {hasError && (
                              <p className="text-sm text-error mt-1">{fieldError}</p>
                            )}
                          </div>
                        ) : fieldType === 'checkbox' ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={fieldId}
                                checked={formValue === true || formValue === 'true'}
                                onChange={(e) => {
                                  handleFieldChange(displayKey, e.target.checked);
                                  // Clear error when field is changed
                                  if (fieldErrors[fieldId]) {
                                    setFieldErrors(prev => {
                                      const next = { ...prev };
                                      delete next[fieldId];
                                      return next;
                                    });
                                  }
                                }}
                                className={`w-4 h-4 text-brand-primary border-neutral-300 rounded focus:ring-brand-primary ${hasError ? 'border-error' : ''}`}
                              />
                              <label htmlFor={fieldId} className="text-sm font-medium text-neutral-700">
                                {fieldLabel}
                                {isRequired && <span className="text-error ml-1">*</span>}
                              </label>
                            </div>
                            {hasError && (
                              <p className="text-sm text-error mt-1">{fieldError}</p>
                            )}
                          </div>
                        ) : fieldType === 'select' ? (
                          <div>
                            <Select
                              label={fieldLabel}
                              required={isRequired}
                              value={(formValue ?? '') as string}
                              onChange={(value) => {
                                handleFieldChange(displayKey, value);
                                // Clear error when field is changed
                                if (fieldErrors[fieldId]) {
                                  setFieldErrors(prev => {
                                    const next = { ...prev };
                                    delete next[fieldId];
                                    return next;
                                  });
                                }
                              }}
                              options={Array.isArray(options) ? options.map((o: string) => ({ value: o, label: o })) : []}
                              error={hasError ? fieldError : undefined}
                            />
                          </div>
                        ) : fieldType === 'textarea' ? (
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              {fieldLabel}
                              {isRequired && <span className="text-error ml-1">*</span>}
                            </label>
                            <textarea
                              id={fieldId}
                              value={(formValue ?? '') as string}
                              onChange={(e) => {
                                handleFieldChange(displayKey, e.target.value);
                                // Clear error when field is changed
                                if (fieldErrors[fieldId]) {
                                  setFieldErrors(prev => {
                                    const next = { ...prev };
                                    delete next[fieldId];
                                    return next;
                                  });
                                }
                              }}
                              placeholder={placeholder}
                              required={isRequired}
                              rows={4}
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent ${hasError ? 'border-error' : 'border-neutral-300'}`}
                            />
                            {hasError && (
                              <p className="text-sm text-error mt-1">{fieldError}</p>
                            )}
                          </div>
                        ) : (
                          <Input
                            id={fieldId}
                            data-field-id={fieldId}
                            type={fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text'}
                            label={fieldLabel}
                            required={isRequired}
                            placeholder={placeholder}
                            value={(formValue ?? '') as string}
                            onChange={(e) => {
                              handleFieldChange(displayKey, e.target.value);
                              if (fieldErrors[fieldId]) {
                                setFieldErrors(prev => {
                                  const next = { ...prev };
                                  delete next[fieldId];
                                  return next;
                                });
                              }
                            }}
                            onBlur={
                              isPanField({ fieldId, label: fieldLabel, type: fieldType })
                                ? () => {
                                    const value = formValue;
                                    const panError = getPanValidationError(value);
                                    if (panError) {
                                      setFieldErrors(prev => ({ ...prev, [fieldId]: panError }));
                                    } else if (fieldErrors[fieldId]) {
                                      setFieldErrors(prev => {
                                        const next = { ...prev };
                                        delete next[fieldId];
                                        return next;
                                      });
                                    }
                                  }
                                : undefined
                            }
                            error={hasError ? fieldError : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        ) : null}


        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            icon={Save}
            onClick={(e) => handleSubmit(e as any, true)}
            loading={loading}
            disabled={loading}
            data-testid="save-draft"
          >
            Save as Draft
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Send}
            loading={loading}
            disabled={loading}
            data-testid="submit-application"
          >
            Submit Application
          </Button>
        </div>
      </form>
    </MainLayout>
  );
};
