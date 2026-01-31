import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FileUpload } from '../components/ui/FileUpload';
import { Select } from '../components/ui/Select';
import { Send } from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

// Form Modules Configuration (same as FormConfiguration)
interface FormModule {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'file' | 'date' | 'number' | 'select' | 'checkbox' | 'textarea';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

// Form Modules - must match FormConfiguration.tsx exactly
const FORM_MODULES: FormModule[] = [
  {
    id: 'universal_checklist',
    name: 'Universal Checklist',
    description: 'Housing Loan/LAP, Credit Line, Business Loan',
    fields: [
      { id: 'checklist_complete', label: 'Checklist Complete', type: 'checkbox', required: false },
    ],
  },
  {
    id: 'personal_kyc',
    name: 'Personal KYC (All Applicants/Co-Applicants)',
    description: 'Personal identification and address documents',
    fields: [
      { id: 'pan_card', label: 'PAN Card – Applicant/Co-applicant', type: 'file', required: true },
      { id: 'aadhaar_passport_voter', label: 'Aadhaar Card / Passport / Voter ID', type: 'file', required: true },
      { id: 'passport_photo', label: 'Passport Size Photograph – 2 Copies', type: 'file', required: true },
      { id: 'residence_proof', label: 'Residence Address Proof (Utility Bill / Rent Agreement)', type: 'file', required: true },
      { id: 'bank_statement_personal', label: 'Latest 6 Months Bank Statement – Personal', type: 'file', required: true },
      { id: 'itr_personal', label: 'ITR – Last 2 Years (if applicable)', type: 'file', required: false },
    ],
  },
  {
    id: 'company_kyc',
    name: 'Company/Business KYC (Proprietor / Partnership / Pvt Ltd / LLP)',
    description: 'Business registration and company documents',
    fields: [
      { id: 'business_registration', label: 'Business Registration Proof (GST / Udyam / Trade License / Partnership Deed / MOA & AOA)', type: 'file', required: true },
      { id: 'company_pan', label: 'Company PAN Card', type: 'file', required: true },
      { id: 'gst_certificate', label: 'GST Certificate', type: 'file', required: true },
      { id: 'business_address_proof', label: 'Business Address Proof', type: 'file', required: true },
      { id: 'partners_directors', label: 'List of Partners/Directors with Shareholding (if applicable)', type: 'file', required: false },
      { id: 'bank_statement_business', label: 'Latest 12 Months Bank Statement – Business', type: 'file', required: true },
      { id: 'company_itr', label: 'Latest 2 Years Company ITR', type: 'file', required: true },
      { id: 'audited_financials', label: 'Latest Audited Financials (if available)', type: 'file', required: false },
      { id: 'gst_3b', label: 'GST 3B – Last 12 Months', type: 'file', required: true },
    ],
  },
  {
    id: 'income_banking',
    name: 'Income & Banking Documents',
    description: 'Financial statements and banking documents',
    fields: [
      { id: 'itr_computation', label: 'Latest 2 Years ITR with Computation', type: 'file', required: true },
      { id: 'balance_sheet', label: 'Balance Sheet & Profit/Loss Statement (if applicable)', type: 'file', required: false },
      { id: 'bank_statement_main', label: '12 Months Bank Statement of Main Business Account', type: 'file', required: true },
      { id: 'loan_sanction_letters', label: 'Existing Loan Sanction Letters (if any)', type: 'file', required: false },
      { id: 'repayment_schedule', label: 'Repayment Schedule (for takeover cases)', type: 'file', required: false },
    ],
  },
  {
    id: 'asset_details',
    name: 'Asset Details (HL/LAP Specific)',
    description: 'Property and asset documentation',
    fields: [
      { id: 'property_title', label: 'Property Title Deed / Sale Deed', type: 'file', required: true },
      { id: 'mother_deed', label: 'Mother Deed / Chain of Documents', type: 'file', required: true },
      { id: 'encumbrance_certificate', label: 'Encumbrance Certificate (EC)', type: 'file', required: true },
      { id: 'property_tax', label: 'Property Tax Receipt', type: 'file', required: true },
      { id: 'building_plan', label: 'Approved Building Plan (if applicable)', type: 'file', required: false },
      { id: 'occupation_certificate', label: 'Occupation/Completion Certificate (if applicable)', type: 'file', required: false },
      { id: 'utility_bill_property', label: 'Latest Electricity/Water Bill (Property Proof)', type: 'file', required: true },
    ],
  },
  {
    id: 'invoice_financial',
    name: 'Invoice / Financial Requirement Details (Credit Line / Business Loan Specific)',
    description: 'Purchase orders and financial requirements',
    fields: [
      { id: 'purchase_order', label: 'Purchase Order (PO)', type: 'file', required: false },
      { id: 'grn', label: 'Goods Received Note (GRN)', type: 'file', required: false },
      { id: 'tax_invoice', label: 'Tax Invoice / Revised Proforma Invoice', type: 'file', required: false },
      { id: 'quotation', label: 'Quotation (if applicable)', type: 'file', required: false },
      { id: 'business_projections', label: 'Business Projections (if required)', type: 'file', required: false },
    ],
  },
  {
    id: 'security_documents',
    name: 'Security Documents',
    description: 'Security and guarantee documents',
    fields: [
      { id: 'pdc', label: 'Post-dated Cheques (if applicable)', type: 'file', required: false },
      { id: 'nach_mandate', label: 'NACH Mandate Form', type: 'file', required: false },
      { id: 'hypothecation_agreement', label: 'Hypothecation Agreement (if applicable)', type: 'file', required: false },
      { id: 'insurance_copy', label: 'Insurance Copy (if applicable)', type: 'file', required: false },
    ],
  },
  {
    id: 'additional_requirements',
    name: 'Additional Requirements (Common Across All Products)',
    description: 'Credit checks and additional documentation',
    fields: [
      { id: 'cibil_report', label: 'CIBIL Report (Minimum score as per program)', type: 'file', required: true },
      { id: 'no_dpd', label: 'No DPD in last 3 months / No 60+ in last 6 months', type: 'checkbox', required: true },
      { id: 'financial_owners', label: 'All financial owners must be part of the loan structure', type: 'checkbox', required: true },
    ],
  },
];

export const ClientForm: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modulesParam = searchParams.get('modules') || '';
  
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [configuredModules, setConfiguredModules] = useState<string[]>([]);

  // Decode modules from URL parameter
  useEffect(() => {
    if (modulesParam) {
      try {
        // Decode base64 and get module IDs
        const decoded = atob(modulesParam + '==='.slice((modulesParam.length + 3) % 4));
        const moduleIds = decoded.split(',').filter(Boolean);
        setConfiguredModules(moduleIds);
      } catch (e) {
        console.error('Error decoding modules:', e);
        setError('Invalid form link. Please contact your KAM.');
      }
    }
  }, [modulesParam]);

  // Fetch client info and form mappings
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

        // Fetch form mappings for this client (public endpoint)
        const mappingsResponse = await apiService.getPublicFormMappings(clientId);
        
        if (mappingsResponse.success && mappingsResponse.data && mappingsResponse.data.length > 0) {
          // Fetch Form Categories to match category IDs to module names
          const categoriesResponse = await apiService.listFormCategories();
          
          if (categoriesResponse.success && categoriesResponse.data) {
            // Get category IDs from mappings
            const categoryIds = Array.from(
              new Set(
                mappingsResponse.data.map((m: any) => m.Category || m.category).filter(Boolean)
              )
            ) as string[];
            
            // Match categories to modules by name
            const matchedModules: string[] = [];
            categoryIds.forEach(categoryId => {
              const category = categoriesResponse.data?.find((c: any) => 
                c.id === categoryId || c['Category ID'] === categoryId
              );
              
              if (category) {
                const categoryName = category['Category Name'] || category.categoryName || '';
                // Match category name to module name
                const module = FORM_MODULES.find(m => 
                  m.name === categoryName || 
                  categoryName.toLowerCase().includes(m.name.toLowerCase()) ||
                  m.name.toLowerCase().includes(categoryName.toLowerCase())
                );
                
                if (module) {
                  matchedModules.push(module.id);
                }
              }
            });
            
            if (matchedModules.length > 0) {
              setConfiguredModules(matchedModules);
            } else if (configuredModules.length === 0) {
              // Fallback: use URL param if available
              if (!modulesParam) {
                setError('No form configuration found for this client. Please contact your KAM.');
              }
            }
          } else if (configuredModules.length === 0 && !modulesParam) {
            setError('No form configuration found for this client. Please contact your KAM.');
          }
        } else if (configuredModules.length === 0 && !modulesParam) {
          setError('No form configuration found for this client. Please contact your KAM.');
        }

        // Fetch client info (optional - for display)
        try {
          const clientsResponse = await apiService.listClients();
          if (clientsResponse.success && clientsResponse.data) {
            const client = clientsResponse.data.find((c: any) => c.id === clientId || c.clientId === clientId);
            if (client) {
              setClientInfo(client);
            }
          }
        } catch (e) {
          // Client info is optional, continue without it
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
  }, [clientId]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleFileUpload = (fieldId: string, files: File[]) => {
    setUploadedFiles(prev => ({
      ...prev,
      [fieldId]: files,
    }));
    setFormData(prev => ({
      ...prev,
      [fieldId]: files.map(f => f.name).join(', '),
    }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    const requiredFields: string[] = [];
    configuredModules.forEach(moduleId => {
      const module = FORM_MODULES.find(m => m.id === moduleId);
      if (module) {
        module.fields.forEach(field => {
          if (field.required && !formData[field.id] && !uploadedFiles[field.id]?.length) {
            requiredFields.push(field.label);
          }
        });
      }
    });

    if (requiredFields.length > 0) {
      setError(`Please fill in all required fields: ${requiredFields.join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Create loan application with form data
      const applicationData = {
        productId: formData.loan_product || '',
        applicantName: formData.applicant_name || '',
        requestedLoanAmount: formData.requested_amount || '0',
        formData: {
          ...formData,
          uploadedFiles: Object.keys(uploadedFiles).reduce((acc, key) => {
            acc[key] = uploadedFiles[key].map(f => f.name);
            return acc;
          }, {} as Record<string, string[]>),
          modules: configuredModules,
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

  // Get fields from configured modules
  const formFields = configuredModules
    .map(moduleId => FORM_MODULES.find(m => m.id === moduleId))
    .filter(Boolean)
    .flatMap(module => module!.fields);

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  if (loading) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="LOADING FORM"
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

  if (error && !configuredModules.length) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="FORM ERROR"
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
            {configuredModules.map(moduleId => {
              const module = FORM_MODULES.find(m => m.id === moduleId);
              if (!module) return null;

              return (
                <div key={moduleId} className="border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-2">{module.name}</h3>
                  {module.description && (
                    <p className="text-sm text-neutral-600 mb-4">{module.description}</p>
                  )}
                  
                  <div className="space-y-4">
                    {module.fields.map(field => (
                      <div key={field.id}>
                        {field.type === 'file' ? (
                          <FileUpload
                            label={field.label}
                            required={field.required}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onFilesSelected={(files) => handleFileUpload(field.id, files)}
                            uploadedFiles={uploadedFiles[field.id] || []}
                          />
                        ) : field.type === 'checkbox' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={field.id}
                              checked={formData[field.id] || false}
                              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                              className="w-4 h-4 text-brand-primary border-neutral-300 rounded focus:ring-brand-primary"
                            />
                            <label htmlFor={field.id} className="text-sm font-medium text-neutral-700">
                              {field.label}
                              {field.required && <span className="text-error ml-1">*</span>}
                            </label>
                          </div>
                        ) : field.type === 'select' ? (
                          <Select
                            label={field.label}
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(value) => handleFieldChange(field.id, value)}
                            options={field.options || []}
                          />
                        ) : field.type === 'textarea' ? (
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              {field.label}
                              {field.required && <span className="text-error ml-1">*</span>}
                            </label>
                            <textarea
                              value={formData[field.id] || ''}
                              onChange={(e) => handleFieldChange(field.id, e.target.value)}
                              placeholder={field.placeholder}
                              required={field.required}
                              rows={4}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                          </div>
                        ) : (
                          <Input
                            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                            label={field.label}
                            required={field.required}
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

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

