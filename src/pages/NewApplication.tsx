import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { FileUpload } from '../components/ui/FileUpload';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Save, Send, AlertTriangle } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { apiService } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { Stepper } from '../components/ui/Stepper';

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
  const [formConfig, setFormConfig] = useState<any[]>([]); // Form configuration from backend
  const [currentStep, setCurrentStep] = useState(0); // Module 2: Stepper current step
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]); // Module 2: Soft validation warnings
  const [duplicateWarning, setDuplicateWarning] = useState<{ fileId: string; status: string } | null>(null); // Module 2: Duplicate detection
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

  useEffect(() => {
    if (userRole === 'client') {
      fetchClientId();
      fetchLoanProducts();
      fetchFormConfig();
    }
  }, [userRoleId, userRole]);

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
      console.warn('NewApplication: Client ID not available in user context');
      setFormConfigLoading(false);
      setFormConfig([]);
      return;
    }

    try {
      setFormConfigLoading(true);
      console.log('NewApplication: Fetching form config for client:', user.clientId);
      
      // Fetch form configuration for this client
      const response = await apiService.getFormConfig();
      
      console.log('NewApplication: Form config response:', response);
      
      if (response.success && response.data) {
        // The backend returns an array of categories with fields
        const configData = Array.isArray(response.data) ? response.data : [];
        console.log('NewApplication: Form config data:', configData);
        console.log('NewApplication: Number of categories:', configData.length);
        configData.forEach((cat: any, idx: number) => {
          console.log(`NewApplication: Category ${idx + 1}:`, cat.categoryName || cat['Category Name'], 'Fields:', cat.fields?.length || 0);
        });
        setFormConfig(configData);
      } else {
        console.warn('NewApplication: No form configuration found. Response:', response);
        if (response.error) {
          console.error('NewApplication: Error from API:', response.error);
        }
        setFormConfig([]);
      }
    } catch (error: any) {
      console.error('NewApplication: Error fetching form configuration:', error);
      console.error('NewApplication: Error details:', error.message, error.stack);
      setFormConfig([]);
    } finally {
      setFormConfigLoading(false);
    }
  };

  const fetchLoanProducts = async () => {
    try {
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
        setLoanProducts(Array.from(productsMap.values()));
      }
    } catch (error) {
      console.error('Error fetching loan products:', error);
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
      console.error(`[NewApplication] Error uploading files for ${fieldId}:`, error);
      // Keep files in state even if upload fails (user can retry)
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

  // Module 2: Enhanced submit with soft validation and duplicate detection
  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    
    // Basic required field check
    if (!formData.applicant_name || !formData.loan_product_id || !formData.requested_loan_amount) {
      alert('Please fill in all required fields: Applicant Name, Loan Product, and Requested Loan Amount');
      return;
    }

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

    setLoading(true);
    setValidationWarnings([]);
    setDuplicateWarning(null);

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
      console.error('Error saving application:', error);
      alert(`Failed to ${saveAsDraft ? 'save' : 'submit'} application: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="New Loan Application"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName="User"
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
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Applicant Name *"
                placeholder="Enter applicant's full name"
                value={formData.applicant_name}
                onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                required
              />
              <Select
                label="Loan Product *"
                options={[
                  { value: '', label: 'Select Loan Product' },
                  ...loanProducts.map(p => ({ value: p.id, label: p.name }))
                ]}
                value={formData.loan_product_id}
                onChange={(e) => setFormData({ ...formData, loan_product_id: e.target.value })}
                required
              />
              <Input
                label="Requested Loan Amount *"
                type="text"
                placeholder="₹ 50,00,000"
                value={formData.requested_loan_amount}
                onChange={(e) => setFormData({ ...formData, requested_loan_amount: e.target.value })}
                required
                helperText="Enter amount in Indian Rupees"
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
          formConfig.map((category: any, categoryIndex: number) => (
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
                              onFilesSelected={(files) => handleFileUpload(fieldId, files)}
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
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={fieldId}
                              checked={formData.form_data[fieldId] || false}
                              onChange={(e) => handleFieldChange(fieldId, e.target.checked)}
                              className="w-4 h-4 text-brand-primary border-neutral-300 rounded focus:ring-brand-primary"
                            />
                            <label htmlFor={fieldId} className="text-sm font-medium text-neutral-700">
                              {fieldLabel}
                              {isRequired && <span className="text-error ml-1">*</span>}
                            </label>
                          </div>
                        ) : fieldType === 'select' ? (
                          <Select
                            label={fieldLabel}
                            required={isRequired}
                            value={formData.form_data[fieldId] || ''}
                            onChange={(value) => handleFieldChange(fieldId, value)}
                            options={Array.isArray(options) ? options : []}
                          />
                        ) : fieldType === 'textarea' ? (
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              {fieldLabel}
                              {isRequired && <span className="text-error ml-1">*</span>}
                            </label>
                            <textarea
                              value={formData.form_data[fieldId] || ''}
                              onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                              placeholder={placeholder}
                              required={isRequired}
                              rows={4}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                          </div>
                        ) : (
                          <Input
                            type={fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text'}
                            label={fieldLabel}
                            required={isRequired}
                            placeholder={placeholder}
                            value={formData.form_data[fieldId] || ''}
                            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
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
            <CardHeader>
              <CardTitle>Additional Information (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 mb-4">
                No custom form configuration found. Please contact your KAM to configure your form.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="applicant@example.com"
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                />
                <Input
                  label="Mobile Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                />
              </div>
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
          >
            Save as Draft
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Send}
            loading={loading}
          >
            Submit Application
          </Button>
        </div>
      </form>
    </MainLayout>
  );
};
