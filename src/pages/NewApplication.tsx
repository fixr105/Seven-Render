import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHero } from '../components/layout/PageHero';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Checkbox } from '../components/ui/Checkbox';
import { Select } from '../components/ui/Select';
import {
  Save,
  Send,
  AlertTriangle,
  RefreshCw,
  Copy,
  FolderOpen,
  FolderPlus,
  Share2,
  Link2,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
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

const GOOGLE_DRIVE_SHARE_EMAIL = 'automation.sevenfincorp@gmail.com';
const ONEDRIVE_SHARE_EMAIL = 'automation@sevenfincorp.email';

function isDocumentsFolderShareAcknowledged(value: unknown): boolean {
  return value === true || value === 'true' || value === 'yes';
}

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

export const NewApplication: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role || null;
  const userRoleId = user?.clientId || user?.kamId || user?.nbfcId || user?.creditTeamId || user?.id || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [formConfigLoading, setFormConfigLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loanProductsLoading, setLoanProductsLoading] = useState(true);
  const [loanProductsError, setLoanProductsError] = useState<string | null>(null);
  const [configuredProductIds, setConfiguredProductIds] = useState<Set<string>>(new Set());
  const [configuredProductsFetched, setConfiguredProductsFetched] = useState(false);
  const [formConfig, setFormConfig] = useState<any[]>([]); // Form configuration from backend
  const [currentStep, setCurrentStep] = useState(0); // Module 2: Stepper current step
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]); // Module 2: Soft validation warnings
  const [duplicateWarning, setDuplicateWarning] = useState<{ fileId: string; status: string } | null>(null); // Module 2: Duplicate detection
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // Strict validation: field-level errors
  const [formData, setFormData] = useState<FormData>({
    applicant_name: '',
    loan_product_id: '',
    requested_loan_amount: '',
    form_data: {
      _mobileNumber: '',
      _email: '',
      _typeOfPurchase: '',
    },
  });
  const [copiedWhich, setCopiedWhich] = useState<'google' | 'onedrive' | null>(null);
  const [folderLinkGenerating, setFolderLinkGenerating] = useState(false);
  const [folderLinkError, setFolderLinkError] = useState<string | null>(null);
  const [copiedFolderUrl, setCopiedFolderUrl] = useState(false);

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const handleCopyShareEmail = async (which: 'google' | 'onedrive') => {
    const email = which === 'google' ? GOOGLE_DRIVE_SHARE_EMAIL : ONEDRIVE_SHARE_EMAIL;
    try {
      await navigator.clipboard.writeText(email);
      setCopiedWhich(which);
      setTimeout(() => setCopiedWhich(null), 2500);
    } catch {
      alert(`Copy failed. Please copy manually: ${email}`);
    }
  };

  // Fetch on mount (including SPA navigation). Form config loads only when user selects a loan product.
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
        
        // Filter to only show configured products when explicit mappings exist
        const hasConfiguredProducts = configuredProductIds.size > 0;
        const visibleProducts = hasConfiguredProducts
          ? allProducts.filter(product => configuredProductIds.has(product.id))
          : allProducts;
        
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
        setConfiguredProductIds(new Set(response.data));
        setConfiguredProductsFetched(true);
      } else if (response.error) {
        setConfiguredProductsFetched(true); // Still mark as fetched to allow loan products to load
      }
    } catch (_error) {
      setConfiguredProductsFetched(true); // Still mark as fetched to allow loan products to load
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

  const handleGenerateFolderLink = async () => {
    if (userRole !== 'client') return;
    setFolderLinkError(null);
    setFolderLinkGenerating(true);
    try {
      const response = await apiService.generateDocumentsFolderLink();
      if (!response.success || !response.data?.folderUrl) {
        throw new Error(response.error || 'Failed to generate folder link');
      }
      const url = response.data.folderUrl;
      handleFieldChange('_documentsFolderLink', url);
      setFieldErrors((prev) => {
        if (!prev._documentsFolderLink) return prev;
        const next = { ...prev };
        delete next._documentsFolderLink;
        return next;
      });
      try {
        await navigator.clipboard.writeText(url);
        setCopiedFolderUrl(true);
        setTimeout(() => setCopiedFolderUrl(false), 2500);
      } catch {
        /* clipboard optional */
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate folder link';
      setFolderLinkError(message);
    } finally {
      setFolderLinkGenerating(false);
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
    if (!formData.requested_loan_amount?.trim()) {
      errors.requested_loan_amount = 'Requested Loan Amount is required';
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
    } else if (!isDocumentsFolderShareAcknowledged(fd._documentsFolderShareAcknowledged)) {
      errors._documentsFolderShareAcknowledged =
        'Confirm that you invited our team addresses to your folder (see steps above).';
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
          'requested_loan_amount',
          '_businessType',
          '_mobileNumber',
          '_email',
          '_typeOfPurchase',
        ]);
        const hasDocumentErrors =
          '_documentsFolderLink' in validation.errors ||
          '_documentsFolderShareAcknowledged' in validation.errors ||
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
      const response = await apiService.createApplication({
        productId: formData.loan_product_id,
        applicantName: formData.applicant_name,
        requestedLoanAmount: parseFloat(formData.requested_loan_amount.replace(/[^0-9.]/g, '')) || 0,
        formData: formDataToSend,
        saveAsDraft: saveAsDraft,
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

      // Module 2: Handle warnings and duplicate detection
      const validationWarns = response.data?.warnings ?? [];
      if (validationWarns.length > 0) {
        setValidationWarnings(validationWarns);
      }

      if (response.data?.duplicateFound) {
        setDuplicateWarning(response.data.duplicateFound);
      }

      const warnings = response.data?.warnings ?? [];
      // Submit with warnings is by design: user must confirm in the dialog below; we do not block submission.
      // Module 2: Soft validation - show warnings but allow submission after confirmation.
      if (!saveAsDraft && (warnings.length > 0 || response.data?.duplicateFound)) {
        // Show confirmation dialog with warnings
        const data = response.data;
        const warningMessages = [
          ...(data?.warnings ?? []),
          ...(data?.duplicateFound 
            ? [`Duplicate application found: ${data.duplicateFound.fileId ?? ''}`]
            : []),
        ];
        
        const proceed = window.confirm(
          `Application will be submitted with the following warnings:\n\n${warningMessages.join('\n')}\n\nDo you want to proceed?`
        );
        
        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      // Success - show message and navigate
      const successMessage = saveAsDraft 
        ? 'Application saved as draft successfully!'
        : (response.data?.warnings?.length ?? 0) > 0
        ? 'Application submitted successfully with warnings. Your KAM will review it.'
        : 'Application submitted successfully!';
      
      alert(successMessage);
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
        {/* Documents folder: steps, visible emails, confirmation, optional tutorial videos */}
        <Card id="documents-folder-link" className="mb-6">
          <CardHeader className="border-l-4 border-l-brand-primary bg-brand-primary/[0.06]">
            <div className="flex items-start gap-3">
              <FolderOpen className="h-6 w-6 shrink-0 text-brand-primary mt-0.5" aria-hidden />
              <div className="min-w-0">
                <CardTitle>Documents folder (required)</CardTitle>
                <p className="text-sm text-neutral-500 mt-0.5">
                  We can only process your application if we can open your documents folder. Use Google Drive or OneDrive
                  and follow the steps below.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ol className="space-y-5 list-none p-0 m-0">
              <li className="flex gap-3 text-sm text-neutral-800">
                <div className="flex flex-col items-center shrink-0 gap-1">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white shadow-sm"
                    aria-hidden
                  >
                    1
                  </span>
                  <FolderPlus className="h-4 w-4 text-brand-primary" aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <span className="font-medium text-neutral-900">Create a folder</span> in Google Drive or Microsoft
                  OneDrive and add your documents to it.
                </div>
              </li>
              <li className="flex gap-3 text-sm text-neutral-800">
                <div className="flex flex-col items-center shrink-0 gap-1">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white shadow-sm"
                    aria-hidden
                  >
                    2
                  </span>
                  <Share2 className="h-4 w-4 text-brand-primary" aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <span className="font-medium text-neutral-900">Share the folder with our team.</span> Invite the correct
                  address for the product you use (Viewer or Editor access is fine—do not rely on &quot;anyone with the
                  link&quot; unless you have been told to).
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose">
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2 transition-all duration-200 hover:border-brand-primary/50 hover:shadow-sm hover:bg-white focus-within:ring-2 focus-within:ring-brand-primary/30 focus-within:border-brand-primary/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Google Drive</p>
                      <p className="font-mono text-sm text-neutral-900 break-all">{GOOGLE_DRIVE_SHARE_EMAIL}</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Copy}
                        onClick={() => handleCopyShareEmail('google')}
                        aria-label="Copy Google Drive share email to clipboard"
                        title="Copies this address—paste it into the Share dialog in Google Drive."
                        data-testid="copy-google-drive-email"
                      >
                        Copy Google Drive share email
                      </Button>
                      {copiedWhich === 'google' && <span className="text-sm text-success">Copied!</span>}
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2 transition-all duration-200 hover:border-brand-primary/50 hover:shadow-sm hover:bg-white focus-within:ring-2 focus-within:ring-brand-primary/30 focus-within:border-brand-primary/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">OneDrive</p>
                      <p className="font-mono text-sm text-neutral-900 break-all">{ONEDRIVE_SHARE_EMAIL}</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Copy}
                        onClick={() => handleCopyShareEmail('onedrive')}
                        aria-label="Copy OneDrive share email to clipboard"
                        title="Copies this address—paste it into the Share dialog in OneDrive."
                        data-testid="copy-onedrive-email"
                      >
                        Copy OneDrive share email
                      </Button>
                      {copiedWhich === 'onedrive' && <span className="text-sm text-success">Copied!</span>}
                    </div>
                  </div>
                </div>
              </li>
              <li className="flex gap-3 text-sm text-neutral-800">
                <div className="flex flex-col items-center shrink-0 gap-1">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white shadow-sm"
                    aria-hidden
                  >
                    3
                  </span>
                  <Link2 className="h-4 w-4 text-brand-primary" aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <span className="font-medium text-neutral-900">Copy the folder link</span> from Drive or OneDrive (the
                  link should open the folder, not a single file).
                </div>
              </li>
              <li className="flex gap-3 text-sm text-neutral-800">
                <div className="flex flex-col items-center shrink-0 gap-1">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white shadow-sm"
                    aria-hidden
                  >
                    4
                  </span>
                  <CheckSquare className="h-4 w-4 text-brand-primary" aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <span className="font-medium text-neutral-900">Paste that link</span> in the field below and confirm the
                  checkbox.
                </div>
              </li>
            </ol>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <details className="group rounded-lg border border-neutral-200 bg-white open:shadow-sm">
                <summary className="cursor-pointer list-none px-3 py-2 rounded-md text-sm font-medium text-brand-primary outline-none transition-colors hover:bg-neutral-50 hover:underline [&::-webkit-details-marker]:hidden flex items-center justify-between focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2">
                  Watch: Google Drive tutorial
                  <span className="text-neutral-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div
                  data-video-slot="google-drive"
                  className="aspect-[9/16] max-h-[50vh] w-full max-w-[280px] mx-auto bg-neutral-100 border-t border-neutral-200 overflow-hidden"
                >
                  <video
                    controls
                    playsInline
                    muted
                    loop
                    className="w-full h-full object-contain"
                    title="How to create a shared folder in Google Drive"
                  >
                    <source src="/videos/drive.mp4" type="video/mp4" />
                    <p className="text-sm text-neutral-500 p-4">Video not available</p>
                  </video>
                </div>
              </details>
              <details className="group rounded-lg border border-neutral-200 bg-white open:shadow-sm">
                <summary className="cursor-pointer list-none px-3 py-2 rounded-md text-sm font-medium text-brand-primary outline-none transition-colors hover:bg-neutral-50 hover:underline [&::-webkit-details-marker]:hidden flex items-center justify-between focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2">
                  Watch: OneDrive tutorial
                  <span className="text-neutral-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div
                  data-video-slot="onedrive"
                  className="aspect-[9/16] max-h-[50vh] w-full max-w-[280px] mx-auto bg-neutral-100 border-t border-neutral-200 overflow-hidden"
                >
                  <video
                    controls
                    playsInline
                    muted
                    loop
                    className="w-full h-full object-contain"
                    title="How to create a shared folder in OneDrive"
                  >
                    <source src="/videos/onedrive.mp4" type="video/mp4" />
                    <p className="text-sm text-neutral-500 p-4">Video not available</p>
                  </video>
                </div>
              </details>
            </div>

            {userRole === 'client' && (
              <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
                <p className="text-sm text-neutral-700">
                  <span className="font-medium text-neutral-900">Optional:</span> click Send to request a folder link from
                  automation (POST to the createfolder webhook). You must still invite the Google Drive and/or OneDrive
                  addresses above and confirm the checkbox—the link will fill in below when the response returns.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    icon={Send}
                    onClick={handleGenerateFolderLink}
                    disabled={folderLinkGenerating}
                    loading={folderLinkGenerating}
                    aria-label="Send POST to create folder webhook and fill folder link"
                    data-testid="send-createfolder-webhook"
                  >
                    Send
                  </Button>
                  {copiedFolderUrl && <span className="text-sm text-success">Copied!</span>}
                </div>
                {folderLinkError && <p className="text-sm text-error">{folderLinkError}</p>}
              </div>
            )}

            <div
              id="_documentsFolderShareAcknowledged"
              data-field-id="_documentsFolderShareAcknowledged"
              data-testid="documents-folder-share-ack"
              className={`rounded-lg border p-3 transition-colors ${fieldErrors._documentsFolderShareAcknowledged ? 'border-error bg-red-50/50' : 'border-neutral-200 bg-neutral-50/80 hover:bg-neutral-50/90'}`}
            >
              <Checkbox
                checked={isDocumentsFolderShareAcknowledged(formData.form_data._documentsFolderShareAcknowledged)}
                onChange={(checked) => {
                  handleFieldChange('_documentsFolderShareAcknowledged', checked);
                  if (fieldErrors._documentsFolderShareAcknowledged) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next._documentsFolderShareAcknowledged;
                      return next;
                    });
                  }
                }}
                label="I have shared this folder with the Google Drive and/or OneDrive addresses above so Seven Fincorp can access my documents."
                className="items-start"
              />
              {fieldErrors._documentsFolderShareAcknowledged && (
                <p className="mt-2 text-sm text-error pl-6">{fieldErrors._documentsFolderShareAcknowledged}</p>
              )}
            </div>

            <Input
              id="_documentsFolderLink"
              label="Folder link"
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
                  : 'Must be a folder URL (…/folders/… or your OneDrive folder), not a link to a single file.'
              }
              title="Paste the shareable folder link. It should open the folder view, not one document."
            />

            <details className="rounded-lg border border-amber-100 bg-amber-50/80">
              <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm font-medium text-neutral-800 outline-none transition-colors hover:bg-amber-100/80 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                Having trouble?
              </summary>
              <ul className="list-disc list-inside px-3 pb-3 pt-0 text-sm text-neutral-700 space-y-1">
                <li>
                  Wrong link: use the <strong>folder</strong> URL, not a link to one PDF or image.
                </li>
                <li>
                  Still locked: open Sharing and ensure our addresses above are listed with access (not only a public
                  link).
                </li>
                <li>
                  Need help? Email{' '}
                  <a href="mailto:support@sevenfincorp.com" className="text-brand-primary hover:underline">
                    support@sevenfincorp.com
                  </a>
                  .
                </li>
              </ul>
            </details>

            <details className="rounded-lg border border-neutral-200">
              <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm font-medium text-neutral-800 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                Full troubleshooting (applicants)
              </summary>
              <div className="px-3 pb-3 pt-0 text-sm text-neutral-700 space-y-2">
                <p>
                  If we cannot open your folder, we cannot verify your documents. Double-check that you used a folder
                  link from the address bar while viewing the folder, and that you invited the correct share email for
                  Drive or OneDrive.
                </p>
                <p className="text-xs text-neutral-500">
                  Internal staff: see <code className="rounded bg-neutral-100 px-1">docs/SUPPORT_DOCUMENTS_FOLDER_SHARING.md</code>{' '}
                  in the repository for the full runbook.
                </p>
              </div>
            </details>
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
                id="requested_loan_amount"
                label="Requested Loan Amount *"
                type="text"
                placeholder="₹ 50,00,000"
                value={formData.requested_loan_amount}
                onChange={(e) => {
                  setFormData({ ...formData, requested_loan_amount: e.target.value });
                  // Clear error when field is changed
                  if (fieldErrors.requested_loan_amount) {
                    setFieldErrors(prev => {
                      const next = { ...prev };
                      delete next.requested_loan_amount;
                      return next;
                    });
                  }
                }}
                required
                helperText="Enter amount in Indian Rupees"
                error={fieldErrors.requested_loan_amount}
              />
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
