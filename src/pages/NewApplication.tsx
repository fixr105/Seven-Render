import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { FileUpload } from '../components/ui/FileUpload';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Save, Send, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { apiService } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { Stepper } from '../components/ui/Stepper';
import { isPageReload } from '../utils/isPageReload';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress?: number;
}

interface FormData {
  applicant_name: string;
  loan_product_id: string;
  requested_loan_amount: string;
  form_data: Record<string, any>;
}

export const NewApplication: React.FC = () => {
  const navigate = useNavigate();
  const { userRole, userRoleId, user } = useAuthSafe();
  const { unreadCount } = useNotifications();
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [documentLinks, setDocumentLinks] = useState<Record<string, string>>({}); // Module 2: OneDrive links
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({}); // Module 2: Upload progress
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

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications', badge: 5 },
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Fetch only on page refresh (F5) or via Load form. No auto-fetch on SPA navigation.
  useEffect(() => {
    if (isPageReload() && userRole === 'client') {
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

  const loadForm = () => {
    if (userRole !== 'client') return;
    fetchClientId();
    fetchFormConfig();
    fetchConfiguredProducts();
  };

  const fetchClientId = async () => {
    if (userRole !== 'client' || !userRoleId) return;
    
    // Get clientId from user context (from API auth)
    if (user?.clientId) {
      setClientId(user.clientId);
    }
  };

  const fetchFormConfig = async () => {
    if (userRole !== 'client') {
      setFormConfigLoading(false);
      return;
    }

    // Check if clientId is available
    if (!user?.clientId) {
      setFormConfigLoading(false);
      setFormConfig([]);
      return;
    }

    try {
      setFormConfigLoading(true);
      // Fetch form configuration for this client
      const response = await apiService.getFormConfig();
      
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
    } catch (error: any) {
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
    } catch (error) {
      setConfiguredProductsFetched(true); // Still mark as fetched to allow loan products to load
    }
  };

  // Module 2: Enhanced file upload with OneDrive integration
  const handleFileUpload = async (fieldId: string, files: File[]) => {
    setUploadedFiles(prev => ({
      ...prev,
      [fieldId]: files,
    }));

    // Module 2: Upload files to OneDrive immediately
    setUploadingFiles(prev => ({ ...prev, [fieldId]: true }));
    
    try {
      const uploadPromises = files.map(async (file) => {
        const uploadResponse = await apiService.uploadDocument(file, fieldId, file.name);
        if (uploadResponse.success && uploadResponse.data) {
          return {
            fieldId,
            fileUrl: uploadResponse.data.shareLink || uploadResponse.data.webUrl,
            fileName: uploadResponse.data.fileName || file.name,
          };
        }
        throw new Error(uploadResponse.error || 'Upload failed');
      });

      const uploadResults = await Promise.all(uploadPromises);
      
      // Store OneDrive links
      const links = uploadResults.map(r => r.fileUrl).join(', ');
      setDocumentLinks(prev => ({
        ...prev,
        [fieldId]: links,
      }));

      // Update form data with file names (for display)
      setFormData(prev => ({
        ...prev,
        form_data: {
          ...prev.form_data,
          [fieldId]: files.map(f => f.name).join(', '),
        },
      }));
    } catch (error: any) {
      // Log error for debugging
      console.error(`[NewApplication] File upload failed for field ${fieldId}:`, error);
      
      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to upload files. Please try again.';
      alert(`Upload failed: ${errorMessage}`);
      
      // Remove failed files from state to allow retry
      setUploadedFiles(prev => {
        const updated = { ...prev };
        delete updated[fieldId];
        return updated;
      });
      
      // Clear document links for this field
      setDocumentLinks(prev => {
        const updated = { ...prev };
        delete updated[fieldId];
        return updated;
      });
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      form_data: {
        ...prev.form_data,
        [fieldId]: value,
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

    // Validate mandatory form fields from configuration
    formConfig.forEach((category: any) => {
      (category.fields || []).forEach((field: any) => {
        const fieldId = field.fieldId || field['Field ID'] || field.id;
        const fieldLabel = field.label || field['Field Label'] || field.fieldLabel;
        const fieldType = field.type || field['Field Type'] || field.fieldType;
        const isRequired = field.isRequired || field['Is Required'] === 'True' || field['Is Mandatory'] === 'True' || field.isMandatory === true;

        if (isRequired) {
          const value = formData.form_data[fieldId];
          const hasDocument = documentLinks[fieldId] && documentLinks[fieldId].trim().length > 0;

          let isEmpty = false;
          if (fieldType === 'file') {
            isEmpty = !hasDocument && (!value || (typeof value === 'string' && value.trim().length === 0));
          } else if (fieldType === 'checkbox') {
            isEmpty = value !== true && value !== 'true';
          } else {
            isEmpty = !value || (typeof value === 'string' && value.trim().length === 0);
          }

          if (isEmpty) {
            errors[fieldId] = `${fieldLabel} is required`;
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

    // Module 2: Check if files are still uploading
    const isUploading = Object.values(uploadingFiles).some(uploading => uploading);
    if (isUploading) {
      alert('Please wait for file uploads to complete before submitting.');
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

    try {
      // Module 2: Prepare document uploads array with OneDrive links
      const documentUploads: Array<{ fieldId: string; fileUrl: string; fileName: string }> = [];
      Object.keys(documentLinks).forEach(fieldId => {
        const links = documentLinks[fieldId].split(',').map(l => l.trim()).filter(Boolean);
        const files = uploadedFiles[fieldId] || [];
        links.forEach((link, index) => {
          documentUploads.push({
            fieldId,
            fileUrl: link,
            fileName: files[index]?.name || `${fieldId}_${index + 1}`,
          });
        });
      });

      // Use API service to create application
      const response = await apiService.createApplication({
        productId: formData.loan_product_id,
        applicantName: formData.applicant_name,
        requestedLoanAmount: parseFloat(formData.requested_loan_amount.replace(/[^0-9.]/g, '')) || 0,
        formData: formData.form_data,
        documentUploads: documentUploads.length > 0 ? documentUploads : undefined, // Module 2: Include OneDrive links
        saveAsDraft: saveAsDraft,
      });

      if (!response.success) {
        // Handle backend validation errors (400 with missingFields)
        if (response.data?.missingFields && Array.isArray(response.data.missingFields)) {
          const missingFieldsErrors: Record<string, string> = {};
          response.data.missingFields.forEach((field: any) => {
            missingFieldsErrors[field.fieldId] = `${field.label} is required`;
          });
          setFieldErrors(missingFieldsErrors);
          
          // Scroll to first error
          const firstErrorField = Object.keys(missingFieldsErrors)[0];
          const errorElement = document.getElementById(firstErrorField) || 
                             document.querySelector(`[data-field-id="${firstErrorField}"]`);
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          alert(`Missing required fields:\n\n${response.data.missingFields.map((f: any) => f.label).join('\n')}`);
          return;
        }
        throw new Error(response.error || 'Failed to create application');
      }

      // Module 2: Handle warnings and duplicate detection
      if (response.data?.warnings && response.data.warnings.length > 0) {
        setValidationWarnings(response.data.warnings);
      }

      if (response.data?.duplicateFound) {
        setDuplicateWarning(response.data.duplicateFound);
      }

      // Module 2: Soft validation - show warnings but allow submission
      if (!saveAsDraft && (response.data?.warnings?.length > 0 || response.data?.duplicateFound)) {
        // Show confirmation dialog with warnings
        const warningMessages = [
          ...(response.data.warnings || []),
          ...(response.data.duplicateFound 
            ? [`Duplicate application found: ${response.data.duplicateFound.fileId}`]
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
        : response.data?.warnings?.length > 0
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

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="New Loan Application"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
    >
      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* Module 2: Stepper */}
        {formConfig.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <Stepper
                steps={[
                  { id: 'details', label: 'Application Details', description: 'Basic information' },
                  ...formConfig.map((cat: any, idx: number) => ({
                    id: cat.categoryId || `category-${idx}`,
                    label: cat.categoryName || cat['Category Name'] || `Section ${idx + 1}`,
                    description: cat.description,
                  })),
                ]}
                currentStep={currentStep}
                onStepClick={(stepIndex) => {
                  // Scroll to section
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
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Application Details</CardTitle>
            {userRole === 'client' && (
              <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={loadForm} disabled={formConfigLoading}>
                Load form
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="applicant_name"
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
              <Select
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
                    const fieldType = field.type || field['Field Type'] || field.fieldType;
                    const isRequired = field.isRequired || field['Is Required'] === 'True' || field.isMandatory === 'True';
                    const placeholder = field.placeholder || field['Field Placeholder'] || field.fieldPlaceholder;
                    let options: string[] = [];
                    try {
                      options = field.options || (field['Field Options'] ? (typeof field['Field Options'] === 'string' ? JSON.parse(field['Field Options']) : field['Field Options']) : []);
                    } catch (e) {
                      options = [];
                    }

                    return (
                      <div key={fieldId}>
                        {fieldType === 'file' ? (
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">
                              {fieldLabel}
                              {isRequired && <span className="text-error ml-1">*</span>}
                            </label>
                            <FileUpload
                              acceptedTypes={['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                              maxSizeInMB={10}
                              maxFiles={5}
                              onFilesSelected={(files) => {
                                handleFileUpload(fieldId, files);
                                // Clear error when files are uploaded
                                if (fieldErrors[fieldId]) {
                                  setFieldErrors(prev => {
                                    const next = { ...prev };
                                    delete next[fieldId];
                                    return next;
                                  });
                                }
                              }}
                              uploadedFiles={(uploadedFiles[fieldId] || []).map((file, idx) => ({
                                id: `${fieldId}-${idx}`,
                                name: file.name,
                                size: file.size,
                                type: file.type,
                                progress: uploadingFiles[fieldId] ? 50 : 100, // Module 2: Show upload progress
                              }))}
                              onRemoveFile={(fileId) => {
                                const fileIndex = parseInt(fileId.split('-').pop() || '0');
                                const currentFiles = uploadedFiles[fieldId] || [];
                                const newFiles = currentFiles.filter((_, idx) => idx !== fileIndex);
                                handleFileUpload(fieldId, newFiles);
                                // Remove document link
                                const currentLinks = documentLinks[fieldId]?.split(',').map(l => l.trim()) || [];
                                const newLinks = currentLinks.filter((_, idx) => idx !== fileIndex);
                                setDocumentLinks(prev => ({
                                  ...prev,
                                  [fieldId]: newLinks.join(', '),
                                }));
                                // Check if field becomes empty and is required
                                if (newFiles.length === 0 && isRequired) {
                                  setFieldErrors(prev => ({
                                    ...prev,
                                    [fieldId]: `${fieldLabel} is required`,
                                  }));
                                }
                              }}
                            />
                            {uploadingFiles[fieldId] && (
                              <p className="text-xs text-neutral-500 mt-2">Uploading to OneDrive...</p>
                            )}
                            {documentLinks[fieldId] && !uploadingFiles[fieldId] && (
                              <p className="text-xs text-success mt-2">✓ Documents uploaded to OneDrive</p>
                            )}
                          </div>
                        ) : fieldType === 'checkbox' ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={fieldId}
                                checked={formData.form_data[fieldId] || false}
                                onChange={(e) => {
                                  handleFieldChange(fieldId, e.target.checked);
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
                              value={formData.form_data[fieldId] || ''}
                              onChange={(value) => {
                                handleFieldChange(fieldId, value);
                                // Clear error when field is changed
                                if (fieldErrors[fieldId]) {
                                  setFieldErrors(prev => {
                                    const next = { ...prev };
                                    delete next[fieldId];
                                    return next;
                                  });
                                }
                              }}
                              options={Array.isArray(options) ? options : []}
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
                              value={formData.form_data[fieldId] || ''}
                              onChange={(e) => {
                                handleFieldChange(fieldId, e.target.value);
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
                            type={fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text'}
                            label={fieldLabel}
                            required={isRequired}
                            placeholder={placeholder}
                            value={formData.form_data[fieldId] || ''}
                            onChange={(e) => {
                              handleFieldChange(fieldId, e.target.value);
                              // Clear error when field is changed
                              if (fieldErrors[fieldId]) {
                                setFieldErrors(prev => {
                                  const next = { ...prev };
                                  delete next[fieldId];
                                  return next;
                                });
                              }
                            }}
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
        ) : (
          <Card className="mb-6">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Form Configuration</CardTitle>
              {userRole === 'client' && (
                <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={loadForm} disabled={formConfigLoading}>
                  Load form
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 mb-4">
                {formConfigLoading
                  ? 'Loading form configuration...'
                  : 'No form configuration loaded. Click "Load form" to fetch your configuration, or contact your KAM to configure your form.'}
              </p>
            </CardContent>
          </Card>
        )}


        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            icon={Save}
            onClick={(e) => handleSubmit(e as any, true)}
            loading={loading}
            disabled={loading}
          >
            Save as Draft
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Send}
            loading={loading}
            disabled={loading}
          >
            Submit Application
          </Button>
        </div>
      </form>
    </MainLayout>
  );
};
