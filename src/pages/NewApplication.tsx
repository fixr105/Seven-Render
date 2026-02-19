import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Save, Send, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { Stepper } from '../components/ui/Stepper';
import { getPanValidationError, isPanField } from '../utils/panValidation';

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
    form_data: {},
  });

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Fetch on mount (including SPA navigation) and via Load form when client.
  useEffect(() => {
    if (userRole === 'client') {
      fetchClientId();
      fetchFormConfig();
      fetchConfiguredProducts();
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
    // Pass selected product so Money Multiplier (and other product-specific configs) load correctly
    fetchFormConfig(formData.loan_product_id || undefined);
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

  /** Build display key for form_data: "Label - Category Name" (human-readable, unique) */
  const getDisplayKey = (fieldLabel: string, categoryName: string) =>
    `${fieldLabel} - ${categoryName}`;

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      form_data: {
        ...prev.form_data,
        [key]: value,
      },
    }));
  };

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

    // Validate mandatory form fields from configuration (required + PAN format)
    formConfig.forEach((category: any) => {
      const categoryName = category.categoryName || category['Category Name'] || '';
      (category.fields || []).forEach((field: any) => {
        const fieldId = field.fieldId || field['Field ID'] || field.id;
        const fieldLabel = field.label || field['Field Label'] || field.fieldLabel;
        const displayKey = getDisplayKey(fieldLabel, categoryName);
        const fieldType = field.type || field['Field Type'] || field.fieldType;
        const isRequired = field.isRequired || field['Is Required'] === 'True' || field['Is Mandatory'] === 'True' || field.isMandatory === true;

        const value = formData.form_data[displayKey] ?? formData.form_data[fieldId];
        // File fields: satisfied if Yes/Added or Awaiting (new or old values)
        const fileFieldSatisfied = fieldType === 'file' && (
          value === 'Yes, Added to Folder' || value === 'Awaiting, Will Update Folder' ||
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

        // PAN format validation (when value is present)
        const panField = { fieldId, label: fieldLabel, type: fieldType };
        if (isPanField(panField) && value && typeof value === 'string' && value.trim().length > 0) {
          const panError = getPanValidationError(value);
          if (panError) {
            errors[fieldId] = errors[fieldId] || panError;
          }
        }
      });
    });

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
        alert(`Please fill in all required fields:\n\n${Object.values(validation.errors).join('\n')}`);
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
          response.data.missingFields.forEach((field: { fieldId: string; label: string }) => {
            missingFieldsErrors[field.fieldId] = `${field.label} is required`;
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
      // Module 2: Soft validation - show warnings but allow submission
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
      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* Video containers - 2 column layout, portrait on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-full">
          <div
            data-video-slot="google-drive"
            className="aspect-[9/16] max-h-[60vh] w-full max-w-[280px] mx-auto bg-neutral-100 rounded-lg border border-neutral-200 overflow-hidden"
          >
            <video
              controls
              playsInline
              muted
              loop
              className="w-full h-full object-contain rounded-lg"
              title="How to create a shared folder in Google Drive"
            >
              <source src="/videos/drive.mp4" type="video/mp4" />
              <p className="text-sm text-neutral-500 p-4">Video not available</p>
            </video>
          </div>
          <div
            data-video-slot="onedrive"
            className="aspect-[9/16] max-h-[60vh] w-full max-w-[280px] mx-auto bg-neutral-100 rounded-lg border border-neutral-200 overflow-hidden"
          >
            <video
              controls
              playsInline
              muted
              loop
              className="w-full h-full object-contain rounded-lg"
              title="How to create a shared folder in OneDrive"
            >
              <source src="/videos/onedrive.mp4" type="video/mp4" />
              <p className="text-sm text-neutral-500 p-4">Video not available</p>
            </video>
          </div>
        </div>

        {/* Documents folder link - paste Google Drive or OneDrive link */}
        <Card id="documents-folder-link" className="mb-6">
          <CardHeader>
            <CardTitle>Documents Folder</CardTitle>
            <p className="text-sm text-neutral-500 mt-0.5">Paste the link to your shared folder (Google Drive or OneDrive)</p>
          </CardHeader>
          <CardContent>
            <Input
              id="_documentsFolderLink"
              label="Folder Link"
              type="url"
              placeholder="https://drive.google.com/... or https://onedrive.live.com/..."
              value={formData.form_data._documentsFolderLink || ''}
              onChange={(e) => handleFieldChange('_documentsFolderLink', e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Module 2: Stepper */}
        {formConfig.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <Stepper
                steps={[
                  { id: 'details', label: 'Application Details', description: 'Basic Information' },
                  ...formConfig.map((cat: any, idx: number) => ({
                    id: cat.categoryId || `category-${idx}`,
                    label: cat.categoryName || cat['Category Name'] || `Section ${idx + 1}`,
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
            </div>
          </CardContent>
        </Card>

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
        ) : formConfig.length > 0 ? (
          formConfig
            .filter((category: any) => category.fields && category.fields.length > 0)
            .map((category: any, categoryIndex: number) => (
            <Card 
              key={category.categoryId || category.id} 
              id={`category-${categoryIndex}`}
              className="mb-6"
            >
              <CardHeader>
                <CardTitle>{category.categoryName || category['Category Name']}</CardTitle>
                {category.description && (
                  <p className="text-sm text-neutral-600 mt-1">{category.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(category.fields || []).map((field: any) => {
                    const fieldId = field.fieldId || field['Field ID'] || field.id;
                    const fieldLabel = field.label || field['Field Label'] || field.fieldLabel;
                    const categoryName = category.categoryName || category['Category Name'] || '';
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
