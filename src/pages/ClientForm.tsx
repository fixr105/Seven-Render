import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FileUpload } from '../components/ui/FileUpload';
import { Select } from '../components/ui/Select';
import { Send } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

type FormConfigCategory = {
  categoryId: string;
  categoryName: string;
  description?: string;
  isRequired?: boolean;
  displayOrder?: number;
  fields: Array<{
    fieldId: string;
    label: string;
    type: string;
    placeholder?: string;
    options?: string[];
    isRequired?: boolean;
    isMandatory?: boolean;
    displayOrder?: number;
  }>;
};

export const ClientForm: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productIdParam = searchParams.get('productId') || undefined;

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<FormConfigCategory[]>([]);

  // Fetch form config from Form Fields table (Client Form Mapping + Form Categories + Form Fields)
  useEffect(() => {
    const fetchFormData = async () => {
      if (!clientId) {
        setError('Client ID is missing');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const response = await apiService.getPublicFormConfig(clientId, productIdParam);

        if (response.success && response.data && Array.isArray(response.data)) {
          const categoriesList = response.data.filter(
            (c: any) => c.fields && Array.isArray(c.fields) && c.fields.length > 0
          );
          setFormConfig(categoriesList);
          if (categoriesList.length === 0) {
            setError('No form configuration found for this client. Please contact your KAM.');
          }
        } else {
          setFormConfig([]);
          setError('No form configuration found for this client. Please contact your KAM.');
        }

        // Fetch client info (optional - for display; may fail if unauthenticated)
        try {
          const clientsResponse = await apiService.listClients();
          if (clientsResponse.success && clientsResponse.data) {
            const client = clientsResponse.data.find((c: any) => c.id === clientId || c.clientId === clientId);
            if (client) {
              setClientInfo(client);
            }
          }
        } catch (e) {
          console.warn('Could not fetch client info:', e);
        }
      } catch (err: any) {
        console.error('Error fetching form data:', err);
        setError(err.message || 'Failed to load form. Please contact your KAM.');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [clientId, productIdParam]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleFileUpload = (fieldId: string, files: File[]) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [fieldId]: files,
    }));
    setFormData((prev) => ({
      ...prev,
      [fieldId]: files.map((f) => f.name).join(', '),
    }));
  };

  const handleSubmit = async () => {
    const requiredFields: string[] = [];
    formConfig.forEach((category) => {
      (category.fields || []).forEach((field) => {
        const isRequired = field.isRequired || field.isMandatory;
        if (isRequired && !formData[field.fieldId] && !uploadedFiles[field.fieldId]?.length) {
          requiredFields.push(field.label);
        }
      });
    });

    if (requiredFields.length > 0) {
      setError(`Please fill in all required fields: ${requiredFields.join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const applicationData = {
        productId: formData.loan_product || '',
        applicantName: formData.applicant_name || '',
        requestedLoanAmount: formData.requested_amount || '0',
        formData: {
          ...formData,
          uploadedFiles: Object.keys(uploadedFiles).reduce(
            (acc, key) => {
              acc[key] = uploadedFiles[key].map((f) => f.name);
              return acc;
            },
            {} as Record<string, string[]>
          ),
          clientId: clientId,
        },
      };

      const response = await apiService.createApplication(applicationData);

      if (response.success) {
        setSuccess(true);
        setFormData({});
        setUploadedFiles({});
      } else {
        setError(response.error || 'Failed to submit form. Please try again.');
      }
    } catch (err: any) {
      console.error('Error submitting form:', err);
      setError(err.message || 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const { user } = useAuth();
  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  if (loading) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="LOADING FORM"
        userRole={user?.role}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading form configuration...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error && !formConfig.length) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="FORM ERROR"
        userRole={user?.role}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-error mb-4">{error}</p>
              <p className="text-sm text-neutral-600">
                Please contact your Key Account Manager (KAM) for assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  if (success) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="FORM SUBMITTED"
        userRole={user?.role}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Form Submitted Successfully!</h2>
              <p className="text-neutral-600 mb-6">
                Your loan application has been submitted. Your KAM will review it and get back to you soon.
              </p>
              <Button variant="primary" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="LOAN APPLICATION FORM"
      userRole={user?.role}
    >
      <div className="space-y-6">
        {clientInfo && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-neutral-600">
                <span className="font-medium">Client:</span> {clientInfo.clientName || clientInfo.company_name}
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardContent className="p-4 bg-error/10 border border-error/30">
              <p className="text-error text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Loan Application Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {formConfig.map((category, categoryIndex) => (
              <div
                key={category.categoryId || categoryIndex}
                className="border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0"
              >
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  {category.categoryName || category['Category Name']}
                </h3>
                {category.description && (
                  <p className="text-sm text-neutral-600 mb-4">{category.description}</p>
                )}

                <div className="space-y-4">
                  {(category.fields || []).map((field) => {
                    const fieldId = field.fieldId || field['Field ID'] || field.id;
                    const fieldLabel = field.label || field['Field Label'] || field.fieldLabel;
                    const fieldType = (field.type || field['Field Type'] || field.fieldType || 'text') as string;
                    const isRequired = field.isRequired || field.isMandatory || field['Is Required'] === 'True';
                    const placeholder = field.placeholder || field['Field Placeholder'] || field.fieldPlaceholder;
                    let options: string[] = [];
                    try {
                      options =
                        field.options ||
                        (field['Field Options']
                          ? typeof field['Field Options'] === 'string'
                            ? JSON.parse(field['Field Options'])
                            : field['Field Options']
                          : []);
                    } catch {
                      options = [];
                    }

                    return (
                      <div key={fieldId}>
                        {fieldType === 'file' ? (
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              {fieldLabel}
                              {isRequired && <span className="text-error ml-1">*</span>}
                            </label>
                            <FileUpload
                              acceptedTypes={[
                                'application/pdf',
                                'image/jpeg',
                                'image/png',
                                'application/msword',
                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                              ]}
                              onFilesSelected={(files) => handleFileUpload(fieldId, files)}
                              uploadedFiles={(uploadedFiles[fieldId] || []).map((f, i) => ({
                                id: `${fieldId}-${i}`,
                                name: f.name,
                                size: f.size,
                                type: f.type,
                              }))}
                            />
                          </div>
                        ) : fieldType === 'checkbox' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={fieldId}
                              checked={formData[fieldId] || false}
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
                            value={formData[fieldId] || ''}
                            onChange={(value) => handleFieldChange(fieldId, value)}
                            options={(options || []).map((o) =>
                              typeof o === 'string' ? { value: o, label: o } : o
                            )}
                          />
                        ) : fieldType === 'textarea' ? (
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              {fieldLabel}
                              {isRequired && <span className="text-error ml-1">*</span>}
                            </label>
                            <textarea
                              value={formData[fieldId] || ''}
                              onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                              placeholder={placeholder}
                              required={isRequired}
                              rows={4}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                          </div>
                        ) : (
                          <Input
                            type={
                              fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text'
                            }
                            label={fieldLabel}
                            required={isRequired}
                            placeholder={placeholder}
                            value={formData[fieldId] || ''}
                            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-4 pt-4 border-t border-neutral-200">
              <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Send}
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting}
              >
                Submit Application
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
