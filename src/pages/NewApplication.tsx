import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { FileUpload } from '../components/ui/FileUpload';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Save, Send } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { apiService } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';

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
  const [loading, setLoading] = useState(false);
  const [formConfigLoading, setFormConfigLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [formConfig, setFormConfig] = useState<any[]>([]); // Form configuration from backend
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

  const handleFileUpload = (fieldId: string, files: File[]) => {
    setUploadedFiles(prev => ({
      ...prev,
      [fieldId]: files,
    }));
    setFormData(prev => ({
      ...prev,
      form_data: {
        ...prev.form_data,
        [fieldId]: files.map(f => f.name).join(', '),
      },
    }));
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

  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    
    if (!formData.applicant_name || !formData.loan_product_id || !formData.requested_loan_amount) {
      alert('Please fill in all required fields: Applicant Name, Loan Product, and Requested Loan Amount');
      return;
    }

    if (!clientId) {
      alert('Client information not found. Please contact support.');
      return;
    }

    setLoading(true);

    try {
      // Generate file number
      const timestamp = Date.now().toString(36).toUpperCase();
      const fileNumber = `SF${timestamp.slice(-8)}`;

      // Prepare application data - only direct inputs per JSON spec
      const applicationData: any = {
        file_number: fileNumber,
        client_id: clientId,
        applicant_name: formData.applicant_name,
        loan_product_id: formData.loan_product_id,
        requested_loan_amount: parseFloat(formData.requested_loan_amount.replace(/[^0-9.]/g, '')) || 0,
        status: saveAsDraft ? 'draft' : 'pending_kam_review',
        form_data: formData.form_data, // Store additional form data
        // Computed fields - set automatically
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(saveAsDraft ? {} : { submitted_at: new Date().toISOString() }),
      };

      // Use API service to create application
      const response = await apiService.createApplication({
        productId: formData.loan_product_id,
        applicantName: formData.applicant_name,
        requestedLoanAmount: parseFloat(formData.requested_loan_amount.replace(/[^0-9.]/g, '')) || 0,
        formData: {
          ...formData.form_data,
          uploadedFiles: Object.keys(uploadedFiles).reduce((acc, key) => {
            acc[key] = uploadedFiles[key].map(f => f.name);
            return acc;
          }, {} as Record<string, string[]>),
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create application');
      }

      alert(saveAsDraft ? 'Application saved as draft successfully!' : 'Application submitted successfully!');
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
        {/* Core Required Fields per JSON Specification */}
        <Card className="mb-6">
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
          formConfig.map((category: any) => (
            <Card key={category.categoryId || category.id} className="mb-6">
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
                              }))}
                              onRemoveFile={(fileId) => {
                                const fileIndex = parseInt(fileId.split('-').pop() || '0');
                                const currentFiles = uploadedFiles[fieldId] || [];
                                const newFiles = currentFiles.filter((_, idx) => idx !== fileIndex);
                                handleFileUpload(fieldId, newFiles);
                              }}
                            />
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
