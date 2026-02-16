import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
// Checkbox is handled inline with native input
import { CheckCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

// Form Modules Configuration
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

export const FormConfiguration: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role || null;
  const userRoleId = user?.kamId || user?.id || null;
  
  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return '';
  };
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [, _setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>(''); // Module 1: Loan product selection
  const [selectedModulesWithFields, setSelectedModulesWithFields] = useState<Record<string, Set<string>>>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Fetch clients using API service (same as Clients page)
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  
  // Fetch form mappings from API (will be fetched per client as needed)
  const [formMappings] = useState<any[]>([]);

  const fetchClientsForForm = async () => {
    if (userRole !== 'kam' || !userRoleId) {
      setClients([]);
      setClientsLoading(false);
      return;
    }
    try {
      setClientsLoading(true);
      const response = await apiService.listClients();
      if (response.success && response.data) {
        setClients(response.data || []);
      } else {
        setClients([]);
      }
    } catch (_error) {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  };

  const fetchLoanProductsForForm = async () => {
    try {
      setLoadingProducts(true);
      const response = await apiService.listLoanProducts(true);
      if (response.success && response.data) {
        const products = response.data.map((product: any) => ({
          id: product.productId || product.id,
          name: product.productName || product['Product Name'] || product.name,
        }));
        setLoanProducts(products);
      }
    } catch (error) {
      console.error('Error fetching loan products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Fetch on mount (including SPA navigation) and via Refresh when KAM.
  useEffect(() => {
    if (userRole === 'kam' && userRoleId) {
      fetchClientsForForm();
    } else {
      setClients([]);
      setClientsLoading(false);
    }
  }, [userRole, userRoleId]);

  // Fetch on mount (including SPA navigation) and via Refresh.
  useEffect(() => {
    fetchLoanProductsForForm();
  }, []);

  // Filter clients for KAM (only managed clients) - API already filters, but we use all returned clients
  const managedClients = React.useMemo(() => {
    if (userRole !== 'kam' || !userRoleId) {
      console.log('FormConfiguration: Not KAM or no userRoleId', { userRole, userRoleId });
      return [];
    }
    // API endpoint /kam/clients already returns only managed clients
    // Return all clients from the API response
    console.log('FormConfiguration: Managed clients count:', clients.length);
    return clients;
  }, [clients, userRole, userRoleId]);

  // Get existing mappings for selected client
  const existingMappings = React.useMemo(() => {
    if (!selectedClient) return [];
    return formMappings.filter((mapping: any) => mapping.Client === selectedClient);
  }, [formMappings, selectedClient]);

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Check if user is KAM
  useEffect(() => {
    if (userRole !== 'kam') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  const handleModuleToggle = (moduleId: string) => {
    const module = FORM_MODULES.find((m) => m.id === moduleId);
    if (!module) return;

    const isCurrentlySelected = !!selectedModulesWithFields[moduleId];
    if (isCurrentlySelected) {
      setSelectedModulesWithFields((prev) => {
        const next = { ...prev };
        delete next[moduleId];
        return next;
      });
      setExpandedModules((exp) => {
        const e = new Set(exp);
        e.delete(moduleId);
        return e;
      });
    } else {
      setSelectedModulesWithFields((prev) => ({
        ...prev,
        [moduleId]: new Set(module.fields.map((f) => f.id)),
      }));
      setExpandedModules((exp) => new Set([...exp, moduleId]));
    }
  };

  const handleFieldToggle = (moduleId: string, fieldId: string) => {
    setSelectedModulesWithFields((prev) => {
      const moduleFields = prev[moduleId];
      if (!moduleFields) return prev;
      const next = { ...prev, [moduleId]: new Set(moduleFields) };
      if (next[moduleId].has(fieldId)) {
        next[moduleId].delete(fieldId);
      } else {
        next[moduleId].add(fieldId);
      }
      if (next[moduleId].size === 0) {
        delete next[moduleId];
      }
      return next;
    });
  };

  const handleExpandToggle = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const handleSaveForm = async () => {
    if (!selectedClient) {
      alert('Please select a client');
      return;
    }

    const moduleCount = Object.keys(selectedModulesWithFields).length;
    // Module 1: Require loan product selection when configuring modules
    if (moduleCount > 0 && !selectedProduct) {
      alert('Please select a loan product before saving the form configuration.');
      return;
    }

    if (moduleCount === 0) {
      alert('Please select at least one module');
      return;
    }

    setSaving(true);
    try {
      // Create form mappings in bulk - send modules with included field IDs
      const modulesPayload = Object.entries(selectedModulesWithFields)
        .filter(([, fields]) => fields.size > 0)
        .map(([moduleId, fields]) => ({
          moduleId,
          includedFieldIds: Array.from(fields),
        }));

      const response = await apiService.createFormMapping(selectedClient, {
        modules: modulesPayload,
        // Module 1: productId is required so each Client Form Mapping row has a Product ID
        productId: selectedProduct,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create form mappings');
      }

      // Get client name for success message
      const client = clients.find((c: any) => c.id === selectedClient || c.clientId === selectedClient);
      const clientName = client?.clientName || client?.company_name || 'the client';

      // Show success message
      setSuccessMessage(
        `Form configuration saved successfully for ${clientName}. The client can now access this form when creating a new loan application from their dashboard.`
      );

      // Reset form after a delay
      setTimeout(() => {
        setSelectedModulesWithFields({});
        setExpandedModules(new Set());
        setSelectedClient('');
        setSelectedProduct(''); // Module 1: Reset product selection
        setSuccessMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error saving form configuration:', error);
      alert(`Failed to save form configuration: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };


  const selectedModulesList = Object.keys(selectedModulesWithFields).map((id) =>
    FORM_MODULES.find((m) => m.id === id)
  ).filter(Boolean) as FormModule[];

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Configure Forms"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Configure Client Forms</CardTitle>
            <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={() => { fetchClientsForForm(); fetchLoanProductsForForm(); }}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600 mb-4">
              Create custom forms for clients by selecting a loan product and modules. Expand a module to include or exclude individual fields. The configured form will be automatically available to the client when they create a new loan application from their dashboard.
            </p>

            {/* Client Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Select Client *
              </label>
              {clientsLoading ? (
                <div className="text-sm text-neutral-500 py-2">Loading clients...</div>
              ) : managedClients.length === 0 ? (
                <div className="text-sm text-neutral-500 py-2">
                  No clients found. Please onboard a client first from the <Link to="/clients" className="text-brand-primary hover:underline">Clients page</Link>.
                  <br />
                  <span className="text-xs">Debug: userRole={userRole}, userRoleId={userRoleId}, clients.length={clients.length}</span>
                </div>
              ) : (
                <>
                  <Select
                    value={selectedClient}
                    onChange={(e) => {
                      setSelectedClient(e.target.value);
                      setSelectedModulesWithFields({});
                    }}
                    options={[
                      { value: '', label: '-- Select a Client --' },
                      ...managedClients.map((client: any) => {
                        // Handle different client data formats
                        const clientId = client.id || client.clientId || client['Client ID'];
                        const clientName = client.clientName || client['Client Name'] || client.company_name || client['Primary Contact Name'] || '';
                        return {
                          value: clientId,
                          label: `${clientName}${clientId ? ` (${clientId})` : ''}`,
                        };
                      }),
                    ]}
                    disabled={clientsLoading}
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    {managedClients.length} client(s) available
                  </p>
                </>
              )}
              {selectedClient && existingMappings.length > 0 && (
                <p className="text-xs text-neutral-500 mt-2">
                  This client has {existingMappings.length} existing form mapping(s)
                </p>
              )}
            </div>

            {/* Module 1: Loan Product Selection (Required) */}
            {selectedClient && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-900 mb-2">
                  Select Loan Product *
                </label>
                <p className="text-xs text-neutral-500 mb-2">
                  Select the loan product this form configuration applies to. A loan product is required so each Client Form Mapping row is tied to a specific product.
                </p>
                {loadingProducts ? (
                  <div className="text-sm text-neutral-500 py-2">Loading loan products...</div>
                ) : (
                  <Select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    options={[
                      { value: '', label: '-- Select a Loan Product --' },
                      ...loanProducts.map((product, index) => ({
                        value: product.id || `product-${index}`,
                        label: product.name || 'Unnamed Product',
                        key: product.id || `product-${index}`, // Ensure unique key
                      })),
                    ]}
                  />
                )}
              </div>
            )}

            {/* Module Selection */}
            {selectedClient && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-900 mb-3">
                  Select Modules * (Select one or many)
                </label>
                <p className="text-xs text-neutral-500 mb-2">
                  Expand a module to see and optionally untick individual fields. Unselecting a module clears all its fields.
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto border border-neutral-200 rounded-lg p-4">
                  {FORM_MODULES.map((module) => {
                    const isSelected = !!selectedModulesWithFields[module.id];
                    const selectedFieldCount = selectedModulesWithFields[module.id]?.size ?? 0;
                    const isExpanded = expandedModules.has(module.id);
                    return (
                      <div
                        key={module.id}
                        className="flex flex-col gap-0 p-3 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleModuleToggle(module.id)}
                            className="mt-1 w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => isSelected && handleExpandToggle(module.id)}
                                className="p-0.5 -ml-0.5 rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent"
                                disabled={!isSelected}
                                aria-label={isExpanded ? 'Collapse fields' : 'Expand fields'}
                              >
                                {isSelected && isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-neutral-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-neutral-600" />
                                )}
                              </button>
                              <h4 className="font-medium text-neutral-900">{module.name}</h4>
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1 ml-6">{module.description}</p>
                            {isSelected && (
                              <div className="mt-2 text-xs text-neutral-600 ml-6">
                                <span className="font-medium">
                                  {selectedFieldCount} of {module.fields.length} field(s) selected
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && isExpanded && (
                          <div className="mt-3 ml-7 pl-4 border-l-2 border-neutral-200 space-y-2">
                            {module.fields.map((field) => (
                              <div key={field.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`${module.id}-${field.id}`}
                                  checked={selectedModulesWithFields[module.id]?.has(field.id) ?? false}
                                  onChange={() => handleFieldToggle(module.id, field.id)}
                                  className="w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                                />
                                <label
                                  htmlFor={`${module.id}-${field.id}`}
                                  className="text-sm text-neutral-700 cursor-pointer"
                                >
                                  {field.label}
                                  {field.required && <span className="text-error ml-0.5">*</span>}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  {Object.keys(selectedModulesWithFields).length} module(s) selected
                </p>
              </div>
            )}

            {/* Selected Modules Summary */}
            {Object.keys(selectedModulesWithFields).length > 0 && (
              <div className="mb-6 p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-lg">
                <h4 className="font-medium text-neutral-900 mb-2">Selected Modules:</h4>
                <ul className="space-y-1">
                  {selectedModulesList.map((module) => (
                    <li key={module.id} className="text-sm text-neutral-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      {module.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Save Button */}
            {selectedClient && Object.keys(selectedModulesWithFields).length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={handleSaveForm}
                  loading={saving}
                  disabled={!selectedClient || Object.keys(selectedModulesWithFields).length === 0 || !selectedProduct || saving}
                >
                  Save Form Configuration
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success Message */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 max-w-md">
            <Card className="bg-success/10 border border-success/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-success mb-1">Configuration Saved</p>
                    <p className="text-sm text-neutral-700">{successMessage}</p>
                  </div>
                  <button
                    onClick={() => setSuccessMessage(null)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    ×
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

