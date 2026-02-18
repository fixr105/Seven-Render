import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { DataTable, Column } from '../components/ui/DataTable';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { useNavigation } from '../hooks/useNavigation';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { Settings2, Plus, FileText, Pencil, Trash2, Layers, Save } from 'lucide-react';

interface ProductOption {
  id: string;
  label: string;
}

interface ProductDocumentRow {
  id?: string;
  'Product ID'?: string;
  'Record Title'?: string;
  'Display Order'?: number;
  'Is Required'?: boolean | string;
}

interface EditorField {
  key: string;
  label: string;
  enabled: boolean;
}

interface EditorSection {
  sectionNum: number | string;
  enabled: boolean;
  name: string;
  fields: EditorField[];
}

type ConfigSource = 'product_embedded' | 'product_documents' | null;

export function FormConfiguration() {
  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);
  const { user } = useAuth();

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [configSource, setConfigSource] = useState<ConfigSource>(null);

  const [productDocuments, setProductDocuments] = useState<ProductDocumentRow[]>([]);
  const [documentForm, setDocumentForm] = useState({ recordTitle: '', displayOrder: 0, isRequired: false });
  const [editingDocument, setEditingDocument] = useState<ProductDocumentRow | null>(null);

  const [formConfigEdit, setFormConfigEdit] = useState<{
    productId: string;
    productName: string;
    id: string;
    sections: EditorSection[];
  } | null>(null);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [submittingDocument, setSubmittingDocument] = useState(false);
  const [submittingFormConfig, setSubmittingFormConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchProductConfig = async () => {
    if (!selectedProductId) {
      setFormConfigEdit(null);
      setConfigSource(null);
      return;
    }
    try {
      setLoadingConfig(true);
      setError(null);
      const [formConfigRes, docsRes] = await Promise.all([
        apiService.getProductFormConfigEdit(selectedProductId),
        apiService.getProductDocuments(selectedProductId),
      ]);

      if (formConfigRes.success && formConfigRes.data) {
        const data = formConfigRes.data as any;
        const sections = data.sections || [];
        const hasSections = Array.isArray(sections) && sections.length > 0;
        setFormConfigEdit({
          productId: data.productId || selectedProductId,
          productName: data.productName || '',
          id: data.id || '',
          sections: sections.map((s: any) => ({
            sectionNum: s.sectionNum,
            enabled: !!s.enabled,
            name: s.name || '',
            fields: (s.fields || []).map((f: any) => ({
              key: f.key,
              label: f.label || '',
              enabled: !!f.enabled,
            })),
          })),
        });
        setConfigSource(hasSections ? 'product_embedded' : 'product_documents');
      } else {
        setFormConfigEdit(null);
        setConfigSource('product_documents');
      }

      if (docsRes.success && docsRes.data) {
        setProductDocuments((docsRes.data as ProductDocumentRow[]) || []);
      } else {
        setProductDocuments([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load product config');
      setFormConfigEdit(null);
      setConfigSource('product_documents');
      setProductDocuments([]);
    } finally {
      setLoadingConfig(false);
      setLoadingDocuments(false);
    }
  };

  const fetchProductDocuments = async () => {
    if (!selectedProductId) {
      setProductDocuments([]);
      return;
    }
    try {
      setLoadingDocuments(true);
      setError(null);
      const response = await apiService.getProductDocuments(selectedProductId);
      if (response.success && response.data) {
        setProductDocuments((response.data as ProductDocumentRow[]) || []);
      } else {
        setProductDocuments([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load product documents');
      setProductDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      fetchProductConfig();
    } else {
      setFormConfigEdit(null);
      setConfigSource(null);
      setProductDocuments([]);
    }
  }, [selectedProductId]);

  const handleUseSectionsAndFields = async () => {
    if (!selectedProductId || !formConfigEdit) return;
    const initialSections: EditorSection[] = [
      { sectionNum: 1, enabled: true, name: 'Section 1', fields: [{ key: 'Field 1', label: '', enabled: true }] },
    ];
    try {
      setSubmittingFormConfig(true);
      setError(null);
      const response = await apiService.patchProductFormConfig(selectedProductId, {
        sections: initialSections,
      });
      if (response.success) {
        setConfigSource('product_embedded');
        setFormConfigEdit((p) => (p ? { ...p, sections: initialSections } : null));
        fetchProductConfig();
      } else {
        setError(response.error || 'Failed to switch to Sections & Fields');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to switch to Sections & Fields');
    } finally {
      setSubmittingFormConfig(false);
    }
  };

  const handleUseDocumentChecklist = async () => {
    if (!selectedProductId || !formConfigEdit) return;
    if (
      !window.confirm(
        'Switch to Document Checklist? All Section N keys will be set to "N" and form config will use Product Documents instead. This is reversible.'
      )
    ) {
      return;
    }
    const disabledSections: EditorSection[] = formConfigEdit.sections.map((s) => ({
      ...s,
      enabled: false,
    }));
    try {
      setSubmittingFormConfig(true);
      setError(null);
      const response = await apiService.patchProductFormConfig(selectedProductId, {
        sections: disabledSections,
      });
      if (response.success) {
        setConfigSource('product_documents');
        fetchProductConfig();
      } else {
        setError(response.error || 'Failed to switch to Document Checklist');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to switch to Document Checklist');
    } finally {
      setSubmittingFormConfig(false);
    }
  };

  const handleSaveFormConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !formConfigEdit) return;
    try {
      setSubmittingFormConfig(true);
      setError(null);
      const response = await apiService.patchProductFormConfig(selectedProductId, {
        sections: formConfigEdit.sections,
      });
      if (response.success) {
        fetchProductConfig();
      } else {
        setError(response.error || 'Failed to save form config');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save form config');
    } finally {
      setSubmittingFormConfig(false);
    }
  };

  const addSection = () => {
    if (!formConfigEdit) return;
    const toNum = (s: number | string) =>
      typeof s === 'number' ? s : parseInt(String(s).replace(/[A-Za-z]/g, ''), 10) || 0;
    const maxNum = Math.max(0, ...formConfigEdit.sections.map((s) => toNum(s.sectionNum)));
    const newSectionNum = maxNum + 1;
    setFormConfigEdit({
      ...formConfigEdit,
      sections: [
        ...formConfigEdit.sections,
        { sectionNum: newSectionNum, enabled: true, name: `Section ${newSectionNum}`, fields: [] },
      ],
    });
  };

  const updateSection = (idx: number, updates: Partial<EditorSection>) => {
    if (!formConfigEdit) return;
    const next = [...formConfigEdit.sections];
    const prev = next[idx];
    next[idx] = { ...prev, ...updates };
    if ('enabled' in updates) {
      next[idx].fields = (next[idx].fields || []).map((f) => ({ ...f, enabled: updates.enabled! }));
    }
    setFormConfigEdit({ ...formConfigEdit, sections: next });
  };

  const removeSection = (idx: number) => {
    if (!formConfigEdit) return;
    setFormConfigEdit({
      ...formConfigEdit,
      sections: formConfigEdit.sections.filter((_, i) => i !== idx),
    });
  };

  const addField = (sectionIdx: number) => {
    if (!formConfigEdit) return;
    const section = formConfigEdit.sections[sectionIdx];
    if (!section) return;
    const sectionId = String(section.sectionNum);
    const existingKeys = new Set(
      formConfigEdit.sections.flatMap((s) => s.fields || []).map((f) => f.key)
    );
    let n = 1;
    let key = `Field ${sectionId}.${n}`;
    while (existingKeys.has(key)) {
      n++;
      key = `Field ${sectionId}.${n}`;
    }
    const next = [...formConfigEdit.sections];
    next[sectionIdx] = {
      ...section,
      fields: [...(section.fields || []), { key, label: '', enabled: section.enabled }],
    };
    setFormConfigEdit({ ...formConfigEdit, sections: next });
  };

  const updateField = (sectionIdx: number, fieldIdx: number, updates: Partial<EditorField>) => {
    if (!formConfigEdit) return;
    const next = [...formConfigEdit.sections];
    const section = next[sectionIdx];
    if (!section?.fields) return;
    const fields = [...section.fields];
    fields[fieldIdx] = { ...fields[fieldIdx], ...updates };
    next[sectionIdx] = { ...section, fields };
    setFormConfigEdit({ ...formConfigEdit, sections: next });
  };

  const removeField = (sectionIdx: number, fieldIdx: number) => {
    if (!formConfigEdit) return;
    const next = [...formConfigEdit.sections];
    const section = next[sectionIdx];
    if (!section?.fields) return;
    next[sectionIdx] = { ...section, fields: section.fields.filter((_, i) => i !== fieldIdx) };
    setFormConfigEdit({ ...formConfigEdit, sections: next });
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !documentForm.recordTitle.trim()) {
      setError('Select a product and enter a Record Title');
      return;
    }
    try {
      setSubmittingDocument(true);
      setError(null);
      const response = await apiService.createProductDocument({
        productId: selectedProductId,
        recordTitle: documentForm.recordTitle.trim(),
        displayOrder: documentForm.displayOrder,
        isRequired: documentForm.isRequired,
      });
      if (response.success) {
        setDocumentForm({ recordTitle: '', displayOrder: productDocuments.length + 1, isRequired: false });
        fetchProductDocuments();
      } else {
        setError(response.error || 'Failed to create document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create document');
    } finally {
      setSubmittingDocument(false);
    }
  };

  const handleEditDocument = (row: ProductDocumentRow) => setEditingDocument(row);
  const handleDeleteDocument = async (row: ProductDocumentRow) => {
    const id = row.id;
    if (!id) {
      setError('Cannot delete: row has no id');
      return;
    }
    if (!window.confirm('Delete this document?')) return;
    try {
      setError(null);
      const response = await apiService.deleteProductDocument(id);
      if (response.success) fetchProductDocuments();
      else setError(response.error || 'Failed to delete document');
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    }
  };

  const handleSaveDocumentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDocument?.id) return;
    try {
      setSubmittingDocument(true);
      setError(null);
      const response = await apiService.patchProductDocument(editingDocument.id, {
        productId: editingDocument['Product ID'],
        recordTitle: editingDocument['Record Title'],
        displayOrder: editingDocument['Display Order'],
        isRequired:
          editingDocument['Is Required'] === true ||
          editingDocument['Is Required'] === 'True' ||
          String(editingDocument['Is Required']).toLowerCase() === 'true',
      });
      if (response.success) {
        setEditingDocument(null);
        fetchProductDocuments();
      } else {
        setError(response.error || 'Failed to update document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update document');
    } finally {
      setSubmittingDocument(false);
    }
  };

  const productOptions = [
    { value: '', label: 'Select a product' },
    ...products.map((p) => ({ value: p.id, label: p.label })),
  ];

  const documentColumns: Column<ProductDocumentRow>[] = [
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
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleEditDocument(row)}
            className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
            aria-label="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteDocument(row)}
            className="p-1.5 rounded hover:bg-red-50 text-neutral-600 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    return '';
  };

  const showProductEmbeddedEditor = configSource === 'product_embedded' && formConfigEdit;
  const showProductDocumentsEditor = configSource === 'product_documents' || (configSource === null && selectedProductId && !loadingConfig);

  return (
    <MainLayout
      sidebarItems={sidebarItems || []}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Form Configuration"
      userRole={user?.role === 'admin' ? 'Admin' : (user?.role?.replace('_', ' ').toUpperCase() || 'Credit Team')}
      userName={getUserDisplayName()}
    >
      <div className="p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800 flex items-center gap-2">
            <Settings2 className="w-6 h-6" />
            Form Configuration
          </h1>
          <p className="text-neutral-500 mt-1">
            Configure form requirements per product. Use Sections & Fields (product-embedded) or Document Checklist (Product Documents).
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded text-error text-sm">
            {error}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Product</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              label="Product"
              options={productOptions}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={loadingProducts}
            />
          </CardContent>
        </Card>

        {selectedProductId && loadingConfig && (
          <Card>
            <CardContent className="py-8 text-center text-neutral-500">
              Loading configuration...
            </CardContent>
          </Card>
        )}

        {selectedProductId && !loadingConfig && (
          <>
            {showProductEmbeddedEditor && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5" />
                        Sections & Fields (Product-embedded)
                      </CardTitle>
                      <p className="text-sm text-neutral-500 mt-1">
                        Configure sections and text fields stored in Loan Products. Fields with label &quot;Empty&quot; or blank are omitted from the client form.
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                      Active config source
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSaveFormConfig}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-neutral-700">Sections & Fields</h3>
                        <Button type="button" variant="tertiary" size="sm" icon={Plus} onClick={addSection}>
                          Add Section
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {formConfigEdit.sections.map((s, sIdx) => (
                          <div
                            key={s.sectionNum}
                            className="border border-neutral-200 rounded-lg overflow-hidden"
                          >
                            <div className="flex flex-wrap items-center gap-2 p-3 bg-neutral-50 border-b border-neutral-200">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={s.enabled}
                                  onChange={(e) => updateSection(sIdx, { enabled: e.target.checked })}
                                  className="rounded border-neutral-300"
                                />
                                <span className="text-sm font-medium">Section {s.sectionNum}</span>
                              </label>
                              <Input
                                placeholder="Section name (optional)"
                                value={s.name}
                                onChange={(e) => updateSection(sIdx, { name: e.target.value })}
                                className="flex-1 min-w-[120px]"
                              />
                              <Button
                                type="button"
                                variant="tertiary"
                                size="sm"
                                icon={Plus}
                                onClick={() => addField(sIdx)}
                              >
                                Add Field
                              </Button>
                              <button
                                type="button"
                                onClick={() => removeSection(sIdx)}
                                className="p-1.5 rounded hover:bg-red-50 text-neutral-500 hover:text-red-600"
                                aria-label="Remove section"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="p-3 space-y-2 bg-white">
                              {(s.fields || []).map((f, fIdx) => (
                                <div
                                  key={f.key}
                                  className="flex flex-wrap items-center gap-2 pl-6 py-2 rounded hover:bg-neutral-50"
                                >
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={f.enabled}
                                      onChange={(e) =>
                                        updateField(sIdx, fIdx, { enabled: e.target.checked })
                                      }
                                      className="rounded border-neutral-300"
                                    />
                                    <span className="text-sm font-mono text-neutral-600 w-28">{f.key}</span>
                                  </label>
                                  <Input
                                    placeholder="Label (or Empty to omit)"
                                    value={f.label}
                                    onChange={(e) =>
                                      updateField(sIdx, fIdx, { label: e.target.value })
                                    }
                                    className="flex-1 min-w-[160px]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeField(sIdx, fIdx)}
                                    className="p-1.5 rounded hover:bg-red-50 text-neutral-500 hover:text-red-600"
                                    aria-label="Remove field"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              {(s.fields || []).length === 0 && (
                                <p className="text-sm text-neutral-400 pl-6 italic">No fields. Add one above.</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <Button type="submit" icon={Save} loading={submittingFormConfig} disabled={submittingFormConfig}>
                        Save Form Config
                      </Button>
                      <Button
                        type="button"
                        variant="tertiary"
                        size="sm"
                        icon={FileText}
                        onClick={handleUseDocumentChecklist}
                        loading={submittingFormConfig}
                        disabled={submittingFormConfig}
                      >
                        Use Document Checklist instead
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {showProductDocumentsEditor && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Document Checklist (Product Documents)
                      </CardTitle>
                      <p className="text-sm text-neutral-500 mt-1">
                        Define the document checklist for this product (e.g. PAN Card, Aadhaar, Bank Statement).
                      </p>
                    </div>
                    {configSource === 'product_documents' && (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                        Active config source
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {configSource === 'product_documents' && (
                    <div className="p-3 bg-neutral-50 rounded-lg">
                      <Button
                        type="button"
                        variant="tertiary"
                        size="sm"
                        icon={Layers}
                        onClick={handleUseSectionsAndFields}
                        loading={submittingFormConfig}
                        disabled={submittingFormConfig}
                      >
                        Use Sections & Fields instead
                      </Button>
                      <p className="text-xs text-neutral-500 mt-1">
                        Switch to product-embedded config (Section N, Field N) stored in Loan Products.
                      </p>
                    </div>
                  )}
                  <DataTable<ProductDocumentRow>
                    columns={documentColumns}
                    data={productDocuments}
                    keyExtractor={(r) => r.id || `${r['Record Title']}-${r['Display Order']}` || 'row'}
                    loading={loadingDocuments}
                    emptyMessage="No documents yet. Add one below."
                  />
                  <form
                    onSubmit={handleCreateDocument}
                    className="flex flex-wrap gap-4 items-end p-4 bg-neutral-50 rounded-lg"
                  >
                    <Input
                      label="Record Title"
                      value={documentForm.recordTitle}
                      onChange={(e) => setDocumentForm((p) => ({ ...p, recordTitle: e.target.value }))}
                      placeholder="e.g. PAN Card"
                      required
                    />
                    <Input
                      label="Display Order"
                      type="number"
                      value={documentForm.displayOrder}
                      onChange={(e) =>
                        setDocumentForm((p) => ({ ...p, displayOrder: parseInt(e.target.value, 10) || 0 }))
                      }
                    />
                    <label className="flex items-center gap-2 h-10">
                      <input
                        type="checkbox"
                        checked={documentForm.isRequired}
                        onChange={(e) => setDocumentForm((p) => ({ ...p, isRequired: e.target.checked }))}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm font-medium text-neutral-700">Required</span>
                    </label>
                    <Button type="submit" icon={Plus} loading={submittingDocument} disabled={submittingDocument}>
                      Add Document
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!selectedProductId && (
          <Card>
            <CardContent className="py-8 text-center text-neutral-500">
              Select a product above to configure its form requirements.
            </CardContent>
          </Card>
        )}

        <Modal isOpen={!!editingDocument} onClose={() => setEditingDocument(null)} size="md">
          <form onSubmit={handleSaveDocumentEdit}>
            <ModalHeader onClose={() => setEditingDocument(null)}>Edit Document</ModalHeader>
            <ModalBody>
              {editingDocument && (
                <div className="space-y-4">
                  <Input
                    label="Record Title"
                    value={editingDocument['Record Title'] ?? ''}
                    onChange={(e) =>
                      setEditingDocument((p) => (p ? { ...p, 'Record Title': e.target.value } : null))
                    }
                    placeholder="e.g. PAN Card"
                    required
                  />
                  <Input
                    label="Display Order"
                    type="number"
                    value={editingDocument['Display Order'] ?? 0}
                    onChange={(e) =>
                      setEditingDocument((p) =>
                        p ? { ...p, 'Display Order': parseInt(e.target.value, 10) || 0 } : null
                      )
                    }
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        editingDocument['Is Required'] === true ||
                        editingDocument['Is Required'] === 'True' ||
                        String(editingDocument['Is Required']).toLowerCase() === 'true'
                      }
                      onChange={(e) =>
                        setEditingDocument((p) => (p ? { ...p, 'Is Required': e.target.checked } : null))
                      }
                      className="rounded border-neutral-300"
                    />
                    <span className="text-sm font-medium text-neutral-700">Required</span>
                  </label>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setEditingDocument(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={submittingDocument} disabled={submittingDocument}>
                Save
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      </div>
    </MainLayout>
  );
}
