import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { DataTable, Column } from '../components/ui/DataTable';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { useNavigation } from '../hooks/useNavigation';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { Settings2, Plus, Link2, FileText } from 'lucide-react';

interface ClientOption {
  id: string;
  label: string;
}

interface ProductOption {
  id: string;
  label: string;
}

interface FormLinkRow {
  id?: string;
  'Client ID'?: string;
  'Form link'?: string;
  'Product ID'?: string;
  'Mapping ID'?: string;
}

interface RecordTitleRow {
  id?: string;
  'Mapping ID'?: string;
  'Record Title'?: string;
  'Display Order'?: number;
  'Is Required'?: boolean | string;
}

export function FormConfiguration() {
  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);
  const { user } = useAuth();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [formLinks, setFormLinks] = useState<FormLinkRow[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>('');
  const [recordTitles, setRecordTitles] = useState<RecordTitleRow[]>([]);

  const [formLinkForm, setFormLinkForm] = useState({ formLink: '', productId: '', mappingId: '' });
  const [recordTitleForm, setRecordTitleForm] = useState({ recordTitle: '', displayOrder: 0, isRequired: false });

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingFormLinks, setLoadingFormLinks] = useState(false);
  const [loadingRecordTitles, setLoadingRecordTitles] = useState(false);
  const [submittingFormLink, setSubmittingFormLink] = useState(false);
  const [submittingRecordTitle, setSubmittingRecordTitle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const response = await apiService.listClients();
      if (response.success && response.data) {
        const options: ClientOption[] = (response.data as any[]).map((c) => ({
          id: c.id || c.clientId,
          label: c.clientName || c['Client Name'] || c.primaryContactName || c.id || 'Unknown',
        }));
        setClients(options);
      } else {
        setClients([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load clients');
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await apiService.listLoanProducts(true);
      if (response.success && response.data) {
        const options: ProductOption[] = (response.data as any[]).map((p) => ({
          id: p.productId || p.id,
          label: p.productName || p['Product Name'] || p.id || 'Unknown',
        }));
        setProducts(options);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchFormLinks = async () => {
    if (!selectedClientId) {
      setFormLinks([]);
      return;
    }
    try {
      setLoadingFormLinks(true);
      setError(null);
      const response = await apiService.getFormMappings(selectedClientId);
      if (response.success && response.data) {
        setFormLinks((response.data as FormLinkRow[]) || []);
      } else {
        setFormLinks([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load form links');
      setFormLinks([]);
    } finally {
      setLoadingFormLinks(false);
    }
  };

  const fetchRecordTitles = async () => {
    if (!selectedMappingId) {
      setRecordTitles([]);
      return;
    }
    try {
      setLoadingRecordTitles(true);
      setError(null);
      const response = await apiService.getRecordTitles(selectedMappingId);
      if (response.success && response.data) {
        setRecordTitles((response.data as RecordTitleRow[]) || []);
      } else {
        setRecordTitles([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load record titles');
      setRecordTitles([]);
    } finally {
      setLoadingRecordTitles(false);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchFormLinks();
    setSelectedMappingId('');
    setRecordTitles([]);
  }, [selectedClientId]);

  useEffect(() => {
    fetchRecordTitles();
  }, [selectedMappingId]);

  const handleCreateFormLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !formLinkForm.mappingId.trim()) {
      setError('Client and Mapping ID are required');
      return;
    }
    try {
      setSubmittingFormLink(true);
      setError(null);
      const response = await apiService.createFormLink(selectedClientId, {
        formLink: formLinkForm.formLink.trim() || undefined,
        productId: formLinkForm.productId || undefined,
        mappingId: formLinkForm.mappingId.trim(),
      });
      if (response.success) {
        setFormLinkForm({ formLink: '', productId: '', mappingId: '' });
        fetchFormLinks();
      } else {
        setError(response.error || 'Failed to create form link');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create form link');
    } finally {
      setSubmittingFormLink(false);
    }
  };

  const handleCreateRecordTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMappingId || !recordTitleForm.recordTitle.trim()) {
      setError('Select a Mapping ID and enter a Record Title');
      return;
    }
    try {
      setSubmittingRecordTitle(true);
      setError(null);
      const response = await apiService.createRecordTitle({
        mappingId: selectedMappingId,
        recordTitle: recordTitleForm.recordTitle.trim(),
        displayOrder: recordTitleForm.displayOrder,
        isRequired: recordTitleForm.isRequired,
      });
      if (response.success) {
        setRecordTitleForm({ recordTitle: '', displayOrder: recordTitles.length + 1, isRequired: false });
        fetchRecordTitles();
      } else {
        setError(response.error || 'Failed to create record title');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create record title');
    } finally {
      setSubmittingRecordTitle(false);
    }
  };

  const mappingIdOptions = formLinks
    .map((r) => r['Mapping ID'])
    .filter(Boolean)
    .map((mid) => ({ value: mid!, label: mid! }));

  const clientOptions = [
    { value: '', label: 'Select a client' },
    ...clients.map((c) => ({ value: c.id, label: c.label })),
  ];

  const productOptions = [
    { value: '', label: 'Any product' },
    ...products.map((p) => ({ value: p.id, label: p.label })),
  ];

  const formLinkColumns: Column<FormLinkRow>[] = [
    { key: 'Form link', label: 'Form Link', render: (v) => (v ? String(v) : '—') },
    { key: 'Product ID', label: 'Product ID', render: (v) => (v ? String(v) : 'Any') },
    { key: 'Mapping ID', label: 'Mapping ID', render: (v) => (v ? String(v) : '—') },
  ];

  const recordTitleColumns: Column<RecordTitleRow>[] = [
    { key: 'Record Title', label: 'Record Title', render: (v) => (v ? String(v) : '—') },
    { key: 'Display Order', label: 'Order', render: (v) => (v != null ? String(v) : '0') },
    {
      key: 'Is Required',
      label: 'Required',
      render: (v) => {
        const val = v;
        return val === true || val === 'True' || String(val).toLowerCase() === 'true' ? 'Yes' : 'No';
      },
    },
  ];

  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    return '';
  };

  return (
    <MainLayout
      sidebarItems={sidebarItems || []}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Form Configuration"
      userRole={user?.role?.replace('_', ' ').toUpperCase() || 'KAM'}
      userName={getUserDisplayName()}
    >
      <div className="p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800 flex items-center gap-2">
            <Settings2 className="w-6 h-6" />
            Form Configuration
          </h1>
          <p className="text-neutral-500 mt-1">
            Configure Form Link and Record Titles for your clients. Form Link links a client (and optionally a product) to a Mapping ID; Record Titles define the document checklist for that mapping.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded text-error text-sm">
            {error}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Client</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              label="Client"
              options={clientOptions}
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              disabled={loadingClients}
            />
          </CardContent>
        </Card>

        {selectedClientId && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Form Links
                </CardTitle>
                <p className="text-sm text-neutral-500 mt-1">
                  Link this client to a Mapping ID. Product ID is optional (empty = any product).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <DataTable<FormLinkRow>
                  columns={formLinkColumns}
                  data={formLinks}
                  keyExtractor={(r) => r.id || `${r['Mapping ID']}-${r['Product ID']}` || 'row'}
                  loading={loadingFormLinks}
                  emptyMessage="No form links yet. Add one below."
                />
                <form onSubmit={handleCreateFormLink} className="flex flex-wrap gap-4 items-end p-4 bg-neutral-50 rounded-lg">
                  <Input
                    label="Form link (URL)"
                    value={formLinkForm.formLink}
                    onChange={(e) => setFormLinkForm((p) => ({ ...p, formLink: e.target.value }))}
                    placeholder="https://..."
                  />
                  <div className="min-w-[180px]">
                    <Select
                      label="Product (optional)"
                      options={productOptions}
                      value={formLinkForm.productId}
                      onChange={(e) => setFormLinkForm((p) => ({ ...p, productId: e.target.value }))}
                    />
                  </div>
                  <Input
                    label="Mapping ID"
                    value={formLinkForm.mappingId}
                    onChange={(e) => setFormLinkForm((p) => ({ ...p, mappingId: e.target.value }))}
                    placeholder="e.g. M1"
                    required
                  />
                  <Button type="submit" icon={Plus} loading={submittingFormLink} disabled={submittingFormLink}>
                    Add Form Link
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Record Titles
                </CardTitle>
                <p className="text-sm text-neutral-500 mt-1">
                  Define the document checklist for a Mapping ID (e.g. PAN Card, Aadhaar, Bank Statement).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Mapping ID"
                  options={[
                    { value: '', label: 'Select a mapping' },
                    ...mappingIdOptions,
                  ]}
                  value={selectedMappingId}
                  onChange={(e) => setSelectedMappingId(e.target.value)}
                  disabled={mappingIdOptions.length === 0}
                  helperText={mappingIdOptions.length === 0 ? 'Add a Form Link first to get Mapping IDs' : undefined}
                />
                {selectedMappingId && (
                  <>
                    <DataTable<RecordTitleRow>
                      columns={recordTitleColumns}
                      data={recordTitles}
                      keyExtractor={(r) => r.id || `${r['Record Title']}-${r['Display Order']}` || 'row'}
                      loading={loadingRecordTitles}
                      emptyMessage="No record titles yet. Add one below."
                    />
                    <form onSubmit={handleCreateRecordTitle} className="flex flex-wrap gap-4 items-end p-4 bg-neutral-50 rounded-lg">
                      <Input
                        label="Record Title"
                        value={recordTitleForm.recordTitle}
                        onChange={(e) => setRecordTitleForm((p) => ({ ...p, recordTitle: e.target.value }))}
                        placeholder="e.g. PAN Card"
                        required
                      />
                      <Input
                        label="Display Order"
                        type="number"
                        value={recordTitleForm.displayOrder}
                        onChange={(e) =>
                          setRecordTitleForm((p) => ({ ...p, displayOrder: parseInt(e.target.value, 10) || 0 }))
                        }
                      />
                      <label className="flex items-center gap-2 h-10">
                        <input
                          type="checkbox"
                          checked={recordTitleForm.isRequired}
                          onChange={(e) => setRecordTitleForm((p) => ({ ...p, isRequired: e.target.checked }))}
                          className="rounded border-neutral-300"
                        />
                        <span className="text-sm font-medium text-neutral-700">Required</span>
                      </label>
                      <Button type="submit" icon={Plus} loading={submittingRecordTitle} disabled={submittingRecordTitle}>
                        Add Record Title
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!selectedClientId && (
          <Card>
            <CardContent className="py-8 text-center text-neutral-500">
              Select a client above to configure Form Links and Record Titles.
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
