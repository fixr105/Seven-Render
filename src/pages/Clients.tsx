import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Eye, UserPlus, RefreshCw, Package } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApplications } from '../hooks/useApplications';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

interface Client {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  kam_id: string | null;
  kam_name?: string | null;
  is_active: boolean;
  created_at: string;
  _count?: {
    applications: number;
  };
}

import { formatDateFull } from '../utils/dateFormatter';

// Use centralized date formatter
const formatDate = formatDateFull;

export const Clients: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role || null;
  
  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return '';
  };
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { applications } = useApplications();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [kamUsers, setKamUsers] = useState<any[]>([]);
  const [selectedKAMId, setSelectedKAMId] = useState<string>('');
  const [showAssignProductsModal, setShowAssignProductsModal] = useState(false);
  const [clientForProducts, setClientForProducts] = useState<Client | null>(null);
  const [allProducts, setAllProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productsModalLoading, setProductsModalLoading] = useState(false);
  const [newClient, setNewClient] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    password: '',
    commission_rate: '1.0',
    enabled_modules: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] as string[], // Preselect all M1-M7
  });

  const sidebarItems = useSidebarItems();

  const fetchClients = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      
      // Use correct endpoint based on user role
      const response = userRole === 'credit_team' 
        ? await apiService.listCreditClients()
        : await apiService.listClients(forceRefresh);
      
      // Show debug info if present
      if ((response as any)._debug) {
        const debug = (response as any)._debug;
        setDebugInfo(`⚠️ DEBUG MODE: ${debug.message}. KAM ID filter: "${debug.kamIdFilter}", User ID filter: "${debug.userIdFilter}". Found ${debug.totalClients} total clients, ${debug.matchedClients} matched.`);
      }
      
      if (response.success && response.data) {
        // Map API response to Client interface
        const mappedClients = response.data.map((client: any) => ({
          id: client.id || client.clientId,
          company_name: client.clientName || client['Client Name'] || '',
          contact_person: client.primaryContactName || client['Primary Contact Name'] || '',
          email: client.contactEmailPhone?.split(' / ')[0] || client.email || '',
          phone: client.contactEmailPhone?.split(' / ')[1] || client.phone || '',
          kam_id: client.assignedKAM || client['Assigned KAM'] || null,
          kam_name: client.assignedKAMName || client['Assigned KAM Name'] || null,
          is_active: client.status === 'Active' || client.Status === 'Active',
          created_at: client.createdAt || client['Created At'] || new Date().toISOString(),
          _count: { applications: 0 }, // enriched below with applications count
        }));
        
        
        // Set debug info for visual display
        if ((response as any)._debug) {
          const debug = (response as any)._debug;
          setDebugInfo(`⚠️ ${debug.message}. Filtered out ${debug.filteredOutClients} clients. KAM ID filter: "${debug.kamIdFilter}", User ID filter: "${debug.userIdFilter}". Check backend logs for filtered clients.`);
        } else {
          setDebugInfo(`✅ Found ${mappedClients.length} clients. API returned ${response.data.length} clients.`);
        }
        
        // Log debug info from clients if available
        mappedClients.forEach((client: any) => {
          if (client._debug && !client._debug.matched) {
            console.warn(`[Clients] 🔍 Unmatched client: ${client.company_name}, Assigned KAM: "${client._debug.assignedKAM}"`);
          }
        });
        
        // Clear any previous errors on success
        if (mappedClients.length === 0 && userRole === 'kam') {
          setDebugInfo(`⚠️ No clients found. If you're expecting clients, please contact your administrator to ensure clients are assigned to you.`);
        }
        
        setClients(mappedClients);
      } else {
        const errorMsg = response.error || 'Failed to fetch clients. Please try again or contact support.';
        setDebugInfo(`❌ Error: ${errorMsg}`);
        setClients([]);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'An unexpected error occurred. Please try again or contact support.';
      setDebugInfo(`❌ Exception: ${errorMsg}`);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount (including SPA navigation) and via Refresh.
  useEffect(() => {
    fetchClients();
  }, []);

  const clientsWithCounts = useMemo(() => {
    return clients.map((c) => ({
      ...c,
      _count: {
        applications: applications.filter((a) => String(a.client_id || (a as any).Client) === String(c.id)).length,
      },
    }));
  }, [clients, applications]);

  const handleOnboardClient = async () => {
    
    if (!newClient.company_name || !newClient.contact_person || !newClient.email) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Use API service to create client
      const response = await apiService.createClient({
        name: newClient.company_name,
        contactPerson: newClient.contact_person,
        email: newClient.email,
        phone: newClient.phone || '',
        commissionRate: newClient.commission_rate || '1.0',
        enabledModules: newClient.enabled_modules.length > 0 ? newClient.enabled_modules : ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'],
      });
      

      if (!response.success) {
        throw new Error(response.error || 'Failed to onboard client');
      }

      setShowOnboardModal(false);
      setNewClient({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        password: '',
        commission_rate: '1.0',
        enabled_modules: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'],
      });
      
      
      // Refresh list so the new client appears immediately
      await fetchClients(true);
      alert(`Client onboarded successfully!\n\nEmail: ${newClient.email}`);
    } catch (error: any) {
      alert(`Failed to onboard client: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Fetch KAM users when modal opens (credit team only)
  useEffect(() => {
    if (userRole === 'credit_team' && showAssignModal) {
      console.log('[Clients] Fetching KAM users for assignment modal...');
      setKamUsers([]); // Clear previous list
      apiService.listKAMUsers()
        .then(response => {
          console.log('[Clients] KAM users response:', response);
          if (response.success && response.data) {
            console.log('[Clients] Setting KAM users:', response.data);
            setKamUsers(response.data);
          } else {
            console.error('[Clients] Failed to fetch KAM users:', response.error);
            alert(`Failed to load KAM list: ${response.error || 'Unknown error'}`);
          }
        })
        .catch(error => {
          console.error('[Clients] Error fetching KAM users:', error);
          alert(`Error loading KAM list: ${error.message || 'Unknown error'}`);
        });
    } else if (showAssignModal && userRole !== 'credit_team') {
      console.warn('[Clients] Assign KAM modal opened but user is not credit_team:', userRole);
    }
  }, [showAssignModal, userRole]);

  useEffect(() => {
    if (showAssignProductsModal && clientForProducts && userRole === 'kam') {
      setProductsModalLoading(true);
      Promise.all([
        apiService.listLoanProducts(true),
        apiService.getAssignedProducts(clientForProducts.id),
      ])
        .then(([productsRes, assignedRes]) => {
          if (productsRes.success && productsRes.data) {
            const prods = (productsRes.data as any[]).map((p: any) => ({
              id: p.productId || p.id,
              name: p.productName || p['Product Name'] || p.name || p.id,
            }));
            setAllProducts(prods);
          }
          if (assignedRes.success && Array.isArray(assignedRes.data)) {
            setSelectedProductIds(new Set(assignedRes.data as string[]));
          }
        })
        .catch((err) => {
          console.error('[AssignProducts] Error:', err);
          alert(err.message || 'Failed to load products');
        })
        .finally(() => setProductsModalLoading(false));
    }
  }, [showAssignProductsModal, clientForProducts?.id, userRole]);

  const filteredClients = clientsWithCounts.filter(client => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Assignment filter
    if (filterType === 'unassigned') {
      return !client.kam_id || client.kam_id === '';
    } else if (filterType === 'assigned') {
      return !!client.kam_id && client.kam_id !== '';
    }
    return true; // 'all'
  });

  const columns: Column<Client>[] = [
    {
      key: 'company_name',
      label: 'Company Name',
      sortable: true,
    },
    {
      key: 'contact_person',
      label: 'Contact Person',
      sortable: true,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: false,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
    },
    {
      key: 'kam_id',
      label: 'Assigned KAM',
      sortable: false,
      render: (value, row) => (
        value ? (
          <Badge variant="info">{String((row as Client).kam_name || value)}</Badge>
        ) : (
          <Badge variant="warning">Unassigned</Badge>
        )
      ),
    },
    {
      key: '_count',
      label: 'Applications',
      align: 'center',
      render: (count) => (
        <Badge variant="neutral">{(count as { applications?: number })?.applications ?? 0}</Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (value) => (
        <Badge variant={value ? 'success' : 'error'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Onboarded',
      sortable: true,
      render: (value) => formatDate(value as string | Date | null | undefined),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={Eye}
            onClick={() => navigate(`/applications?clientId=${row.id}`)}
          >
            View Files
          </Button>
          {userRole === 'kam' && (
            <Button
              size="sm"
              variant="secondary"
              icon={Package}
              onClick={() => {
                setClientForProducts(row);
                setShowAssignProductsModal(true);
              }}
            >
              Assign Products
            </Button>
          )}
          {userRole === 'credit_team' && (
            <Button
              size="sm"
              variant="primary"
              icon={UserPlus}
              onClick={() => {
                setSelectedClient(row);
                setSelectedKAMId(row.kam_id || '');
                setShowAssignModal(true);
              }}
            >
              {row.kam_id ? 'Reassign KAM' : 'Assign KAM'}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Client Management"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
    >
      <div className="space-y-6">
      {/* Debug Info Panel */}
      {debugInfo && (
        <Card className="mb-4 border-2 border-brand-primary">
          <CardContent className="p-3">
            <div className="text-sm font-mono bg-neutral-50 p-2 rounded">
              <strong>Debug Info:</strong> {debugInfo}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header Actions */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search clients by name, contact, or email..."
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                icon={RefreshCw} 
                onClick={() => fetchClients(true)}
                disabled={loading}
              >
                Refresh
              </Button>
            {userRole === 'kam' && (
              <Button variant="primary" icon={UserPlus} onClick={() => setShowOnboardModal(true)}>
                Onboard Client
              </Button>
            )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-4 ${userRole === 'credit_team' ? 'lg:grid-cols-5' : ''} gap-4 mb-6`}>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Total Clients</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{clientsWithCounts.length}</p>
          </CardContent>
        </Card>
        {userRole === 'credit_team' && (
          <Card>
            <CardContent>
              <p className="text-sm text-neutral-500">Unassigned Clients</p>
              <p className="text-2xl font-bold text-warning mt-1">
                {clientsWithCounts.filter(c => !c.kam_id || c.kam_id === '').length}
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Active Clients</p>
            <p className="text-2xl font-bold text-success mt-1">
              {clientsWithCounts.filter(c => c.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Total Applications</p>
            <p className="text-2xl font-bold text-brand-primary mt-1">
              {clientsWithCounts.reduce((sum, c) => sum + (c._count?.applications || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Avg per Client</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {clientsWithCounts.length > 0
                ? Math.round(clientsWithCounts.reduce((sum, c) => sum + (c._count?.applications || 0), 0) / clientsWithCounts.length)
                : 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons (Credit Team only) */}
      {userRole === 'credit_team' && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterType === 'all' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('all')}
              >
                All ({clientsWithCounts.length})
              </Button>
              <Button
                variant={filterType === 'unassigned' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('unassigned')}
              >
                Unassigned ({clientsWithCounts.filter(c => !c.kam_id || c.kam_id === '').length})
              </Button>
              <Button
                variant={filterType === 'assigned' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('assigned')}
              >
                Assigned ({clientsWithCounts.filter(c => c.kam_id && c.kam_id !== '').length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filterType === 'all' ? 'All' : filterType === 'unassigned' ? 'Unassigned' : 'Assigned'} Clients ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredClients}
            keyExtractor={(row) => row.id}
            loading={loading}
            emptyMessage="No clients found. Onboard your first client to get started."
          />
        </CardContent>
      </Card>

      {/* Onboard Client Modal */}
      <Modal
        isOpen={showOnboardModal}
        onClose={() => {
          setShowOnboardModal(false);
          setNewClient({
            company_name: '',
            contact_person: '',
            email: '',
            phone: '',
            password: '',
            commission_rate: '1.0',
            enabled_modules: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'], // Reset to all selected
          });
        }}
        size="md"
      >
        <ModalHeader onClose={() => setShowOnboardModal(false)}>
          Onboard New Client
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="Company Name"
              placeholder="Enter company name"
              value={newClient.company_name}
              onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
              required
            />
            <Input
              label="Contact Person"
              placeholder="Enter contact person name"
              value={newClient.contact_person}
              onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })}
              required
            />
            <Input
              type="email"
              label="Email Address"
              placeholder="Enter email address"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              required
            />
            <Input
              type="tel"
              label="Phone Number"
              placeholder="Enter phone number"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            />
            <Input
              type="number"
              label="Commission Rate (%)"
              placeholder="1.0"
              value={newClient.commission_rate}
              onChange={(e) => setNewClient({ ...newClient, commission_rate: e.target.value })}
              helperText="Default commission rate for this client (e.g., 1.0 for 1%)"
            />
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Enabled Modules
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map((module) => (
                  <label key={module} className="flex items-center gap-2 p-2 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newClient.enabled_modules.includes(module)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewClient({
                            ...newClient,
                            enabled_modules: [...newClient.enabled_modules, module],
                          });
                        } else {
                          setNewClient({
                            ...newClient,
                            enabled_modules: newClient.enabled_modules.filter(m => m !== module),
                          });
                        }
                      }}
                      className="w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="text-sm text-neutral-700">{module}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Select which modules this client has access to
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowOnboardModal(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleOnboardClient}
            disabled={submitting}
            loading={submitting}
          >
            Onboard Client
          </Button>
        </ModalFooter>
      </Modal>

      {/* Assign KAM Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedClient(null);
          setSelectedKAMId('');
        }}
        size="md"
      >
        <ModalHeader onClose={() => setShowAssignModal(false)}>
          {selectedClient?.kam_id ? 'Reassign KAM' : 'Assign KAM'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Client: <strong>{selectedClient?.company_name}</strong>
            </p>
            {kamUsers.length === 0 ? (
              <div className="text-sm text-neutral-500 py-2">
                Loading KAMs...
              </div>
            ) : (
              <Select
                label="Select KAM"
                value={selectedKAMId}
                onChange={(e) => setSelectedKAMId(e.target.value)}
                options={[
                  { value: '', label: 'Unassign (No KAM)' },
                  ...kamUsers.map(kam => ({
                    value: kam.kamId || kam.id,
                    label: `${kam.name || 'Unknown'} (${kam.email || 'No email'})`
                  }))
                ]}
              />
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setShowAssignModal(false);
              setSelectedClient(null);
              setSelectedKAMId('');
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!selectedClient) return;
              setSubmitting(true);
              try {
                const kamId = selectedKAMId || null;
                const response = await apiService.assignKAMToClient(selectedClient.id, kamId);
                if (response.success) {
                  await fetchClients(true);
                  setShowAssignModal(false);
                  setSelectedClient(null);
                  setSelectedKAMId('');
                  alert('KAM assigned successfully');
                } else {
                  alert(`Failed: ${response.error || 'Unknown error'}`);
                }
              } catch (error: any) {
                alert(`Failed: ${error.message || 'Unknown error'}`);
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            loading={submitting}
          >
            {selectedKAMId ? 'Assign' : 'Unassign'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Assign Products Modal (KAM only) */}
      <Modal
        isOpen={showAssignProductsModal}
        onClose={() => {
          setShowAssignProductsModal(false);
          setClientForProducts(null);
          setSelectedProductIds(new Set());
        }}
        size="md"
      >
        <ModalHeader onClose={() => setShowAssignProductsModal(false)}>
          Assign Products to Client
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Client: <strong>{clientForProducts?.company_name}</strong>
            </p>
            <p className="text-xs text-neutral-500">
              Select which loan products this client can see and apply for. Clients only see products you assign here.
            </p>
            {productsModalLoading ? (
              <div className="text-sm text-neutral-500 py-4">Loading products...</div>
            ) : allProducts.length === 0 ? (
              <div className="text-sm text-neutral-500 py-4">No loan products available.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-neutral-200 rounded p-3 space-y-2">
                {allProducts.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-2 p-2 border border-neutral-100 rounded hover:bg-neutral-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(product.id)}
                      onChange={(e) => {
                        const next = new Set(selectedProductIds);
                        if (e.target.checked) next.add(product.id);
                        else next.delete(product.id);
                        setSelectedProductIds(next);
                      }}
                      className="w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="text-sm text-neutral-700">{product.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setShowAssignProductsModal(false);
              setClientForProducts(null);
              setSelectedProductIds(new Set());
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!clientForProducts) return;
              setSubmitting(true);
              try {
                const response = await apiService.assignProductsToClient(
                  clientForProducts.id,
                  Array.from(selectedProductIds)
                );
                if (response.success) {
                  await fetchClients(true);
                  setShowAssignProductsModal(false);
                  setClientForProducts(null);
                  setSelectedProductIds(new Set());
                  alert('Products assigned successfully');
                } else {
                  alert(`Failed: ${response.error || 'Unknown error'}`);
                }
              } catch (error: any) {
                alert(`Failed: ${error.message || 'Unknown error'}`);
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting || productsModalLoading || allProducts.length === 0}
            loading={submitting}
          >
            Save
          </Button>
        </ModalFooter>
      </Modal>
      </div>
    </MainLayout>
  );
};
