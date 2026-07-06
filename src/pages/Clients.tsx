import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Eye, UserPlus, RefreshCw, Copy, Check, Package, Settings, FileText } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApplications } from '../hooks/useApplications';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';
import { resolveClientApplicationCount } from '../utils/clientApplicationCounts';

interface Client {
  id: string;
  clientId?: string;
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
  applicationsCount?: number;
}

import { formatDateFull } from '../utils/dateFormatter';

// Use centralized date formatter
const formatDate = formatDateFull;

export const Clients: React.FC = () => {
  const { t } = useTranslation();
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
  const [newClient, setNewClient] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    password: '',
    commission_rate: '1.0',
    enabled_modules: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] as string[], // Preselect all M1-M7
  });
  const [onboardSuccess, setOnboardSuccess] = useState<{ email: string; tempPassword?: string } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [showModulesModal, setShowModulesModal] = useState(false);
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [modulesSelection, setModulesSelection] = useState<string[]>(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
  const [commissionRateEdit, setCommissionRateEdit] = useState('1.0');
  const [savingProducts, setSavingProducts] = useState(false);
  const [savingModules, setSavingModules] = useState(false);
  const [showFormConfigModal, setShowFormConfigModal] = useState(false);
  const [formConfigProductId, setFormConfigProductId] = useState('');
  const [formConfigCategories, setFormConfigCategories] = useState<Array<Record<string, unknown>>>([]);
  const [loadingFormConfig, setLoadingFormConfig] = useState(false);

  const MODULE_OPTIONS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];

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
          clientId: client.clientId || client['Client ID'] || client.id,
          company_name: client.clientName || client['Client Name'] || '',
          contact_person: client.primaryContactName || client['Primary Contact Name'] || '',
          email: client.contactEmailPhone?.split(' / ')[0] || client.email || '',
          phone: client.contactEmailPhone?.split(' / ')[1] || client.phone || '',
          kam_id: client.assignedKAM || client['Assigned KAM'] || null,
          kam_name: client.assignedKAMName || client['Assigned KAM Name'] || null,
          is_active: client.status === 'Active' || client.Status === 'Active',
          created_at: client.createdAt || client['Created At'] || client.createdTime || '',
          applicationsCount: client.applicationsCount,
          _count: client._count,
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
        applications: resolveClientApplicationCount({
          client: c,
          fallbackCount: applications.filter((a) => {
            const applicationClientId = String(a.client_id || (a as any).Client || '').trim();
            if (!applicationClientId) return false;
            const candidateClientIds = [c.id, c.clientId].map((id) => String(id || '').trim()).filter(Boolean);
            return candidateClientIds.includes(applicationClientId);
          }).length,
        }),
      },
    }));
  }, [clients, applications]);

  const validatePhone = (phone: string): boolean => {
    if (!phone) {
      setPhoneError('');
      return true;
    }
    if (!/^\d{10}$/.test(phone)) {
      setPhoneError(t('pages.clients.phoneInvalid'));
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setNewClient({ ...newClient, phone: digitsOnly });
    if (phoneError) validatePhone(digitsOnly);
  };

  const handleOnboardClient = async () => {
    
    if (!newClient.company_name || !newClient.contact_person || !newClient.email) {
      alert(t('pages.clients.fillRequiredFields'));
      return;
    }

    if (!validatePhone(newClient.phone)) {
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

      const tempPassword = response.data?.tempPassword;
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
      setOnboardSuccess({ email: newClient.email, tempPassword });
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

  const openFormConfigModal = async (client: Client) => {
    setSelectedClient(client);
    setShowFormConfigModal(true);
    setFormConfigProductId('');
    setFormConfigCategories([]);
    try {
      const [productsRes, assignedRes] = await Promise.all([
        apiService.listLoanProducts(true),
        userRole === 'kam'
          ? apiService.getKAMClientConfiguredProducts(client.id)
          : apiService.getClientAssignedProducts(client.id),
      ]);
      if (productsRes.success && productsRes.data) {
        const assignedIds = assignedRes.success && assignedRes.data ? assignedRes.data : [];
        const allProducts = productsRes.data.map(
          (p: { productId?: string; id?: string; productName?: string; name?: string }) => ({
            id: String(p.productId ?? p.id ?? ''),
            name: String(p.productName ?? p.name ?? p.id),
          })
        );
        setLoanProducts(
          assignedIds.length > 0
            ? allProducts.filter((p) => assignedIds.includes(p.id))
            : allProducts
        );
      }
      if (assignedRes.success && assignedRes.data?.length) {
        const firstProductId = String(assignedRes.data[0]);
        setFormConfigProductId(firstProductId);
        await loadFormConfigForClient(client.id, firstProductId);
      }
    } catch {
      setFormConfigCategories([]);
    }
  };

  const loadFormConfigForClient = async (clientId: string, productId: string) => {
    if (!productId) {
      setFormConfigCategories([]);
      return;
    }
    setLoadingFormConfig(true);
    try {
      const res =
        userRole === 'kam'
          ? await apiService.getKAMClientFormConfig(clientId, productId)
          : await apiService.getProductFormConfigEdit(productId);
      if (res.success && res.data) {
        const categories = Array.isArray(res.data)
          ? res.data
          : (res.data as { categories?: Array<Record<string, unknown>> }).categories ?? [];
        setFormConfigCategories(categories as Array<Record<string, unknown>>);
      } else {
        setFormConfigCategories([]);
      }
    } catch {
      setFormConfigCategories([]);
    } finally {
      setLoadingFormConfig(false);
    }
  };

  const openProductsModal = async (client: Client) => {
    setSelectedClient(client);
    setShowProductsModal(true);
    try {
      const [productsRes, assignedRes] = await Promise.all([
        apiService.listLoanProducts(true),
        apiService.getClientAssignedProducts(client.id),
      ]);
      if (productsRes.success && productsRes.data) {
        setLoanProducts(
          productsRes.data.map((p: { productId?: string; id?: string; productName?: string; name?: string }) => ({
            id: String(p.productId ?? p.id ?? ''),
            name: String(p.productName ?? p.name ?? p.id),
          }))
        );
      }
      if (assignedRes.success && assignedRes.data) {
        setSelectedProductIds(assignedRes.data);
      } else {
        setSelectedProductIds([]);
      }
    } catch {
      setSelectedProductIds([]);
    }
  };

  const handleSaveProducts = async () => {
    if (!selectedClient) return;
    setSavingProducts(true);
    try {
      const res = await apiService.assignProductsToClient(selectedClient.id, selectedProductIds);
      if (res.success) {
        setShowProductsModal(false);
        alert('Products assigned successfully.');
      } else {
        throw new Error(res.error || 'Failed to assign products');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to assign products');
    } finally {
      setSavingProducts(false);
    }
  };

  const openModulesModal = async (client: Client) => {
    setSelectedClient(client);
    setShowModulesModal(true);
    setModulesSelection(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
    setCommissionRateEdit('1.0');
    try {
      const res = await apiService.getKAMClient(client.id);
      if (res.success && res.data) {
        if (res.data.enabledModules?.length) {
          setModulesSelection(res.data.enabledModules);
        }
        if (res.data.commissionRate != null && !Number.isNaN(res.data.commissionRate)) {
          setCommissionRateEdit(String(res.data.commissionRate));
        }
      }
    } catch {
      // keep defaults
    }
  };

  const handleSaveModules = async () => {
    if (!selectedClient) return;
    setSavingModules(true);
    try {
      const res = await apiService.updateClientModules(selectedClient.id, {
        enabledModules: modulesSelection,
        commissionRate: parseFloat(commissionRateEdit) || 1.0,
      });
      if (res.success) {
        setShowModulesModal(false);
        alert('Client settings updated.');
      } else {
        throw new Error(res.error || 'Failed to update client');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update client');
    } finally {
      setSavingModules(false);
    }
  };

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

  const columns: Column<Client>[] = useMemo(() => [
    {
      key: 'company_name',
      label: t('common.companyName'),
      sortable: true,
    },
    {
      key: 'contact_person',
      label: t('common.contactPerson'),
      sortable: true,
    },
    {
      key: 'email',
      label: t('common.email'),
      sortable: false,
    },
    {
      key: 'phone',
      label: t('common.phone'),
      sortable: false,
    },
    {
      key: 'kam_id',
      label: t('common.assignedKam'),
      sortable: false,
      render: (value, row) => (
        value ? (
          <Badge variant="info">{String((row as Client).kam_name || value)}</Badge>
        ) : (
          <Badge variant="warning">{t('common.unassigned')}</Badge>
        )
      ),
    },
    {
      key: '_count',
      label: t('pages.applications.title'),
      align: 'center',
      render: (count) => (
        <Badge variant="neutral">{(count as { applications?: number })?.applications ?? 0}</Badge>
      ),
    },
    {
      key: 'is_active',
      label: t('common.status'),
      render: (value) => (
        <Badge variant={value ? 'success' : 'error'}>
          {value ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: t('common.onboarded'),
      sortable: true,
      render: (value) => formatDate(value as string | Date | null | undefined),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={Eye}
            onClick={() => navigate(`/applications?clientId=${encodeURIComponent(row.clientId ?? row.id)}`)}
          >
            {t('common.viewFiles')}
          </Button>
          {(userRole === 'kam' || userRole === 'credit_team' || userRole === 'admin') && (
            <Button
              size="sm"
              variant="secondary"
              icon={FileText}
              onClick={() => void openFormConfigModal(row)}
            >
              Form config
            </Button>
          )}
          {userRole === 'kam' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                icon={Package}
                onClick={() => openProductsModal(row)}
              >
                Assign Products
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={Settings}
                onClick={() => openModulesModal(row)}
              >
                Modules
              </Button>
            </>
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
              {row.kam_id ? t('common.reassignKam') : t('common.assignKam')}
            </Button>
          )}
        </div>
      ),
    },
  ], [t, navigate, userRole]);

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle={t('pages.clients.pageTitle')}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="space-y-6">
      {import.meta.env.DEV && debugInfo && (
        <Card className="mb-4 border-2 border-brand-primary">
          <CardContent className="p-3">
            <div className="text-sm font-mono bg-neutral-50 p-2 rounded">
              <strong>{t('pages.clients.debugInfo')}</strong> {debugInfo}
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
                placeholder={t('pages.clients.searchPlaceholder')}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                icon={RefreshCw} 
                onClick={() => fetchClients(true)}
                disabled={loading}
              >
                {t('common.refresh')}
              </Button>
            {userRole === 'kam' && (
              <Button variant="primary" icon={UserPlus} onClick={() => setShowOnboardModal(true)}>
                {t('pages.clients.onboardClient')}
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
            <p className="text-sm text-neutral-500">{t('common.totalClients')}</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{clientsWithCounts.length}</p>
          </CardContent>
        </Card>
        {userRole === 'credit_team' && (
          <Card>
            <CardContent>
              <p className="text-sm text-neutral-500">{t('common.unassignedClients')}</p>
              <p className="text-2xl font-bold text-warning mt-1">
                {clientsWithCounts.filter(c => !c.kam_id || c.kam_id === '').length}
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t('pages.clients.activeClients')}</p>
            <p className="text-2xl font-bold text-success mt-1">
              {clientsWithCounts.filter(c => c.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t('common.totalApplications')}</p>
            <p className="text-2xl font-bold text-brand-primary mt-1">
              {clientsWithCounts.reduce((sum, c) => sum + (c._count?.applications || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t('common.avgPerClient')}</p>
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
                {t('common.all')} ({clientsWithCounts.length})
              </Button>
              <Button
                variant={filterType === 'unassigned' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('unassigned')}
              >
                {t('common.unassigned')} ({clientsWithCounts.filter(c => !c.kam_id || c.kam_id === '').length})
              </Button>
              <Button
                variant={filterType === 'assigned' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('assigned')}
              >
                {t('common.assigned')} ({clientsWithCounts.filter(c => c.kam_id && c.kam_id !== '').length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('pages.clients.clientsCount', {
              filter: filterType === 'all' ? t('common.all') : filterType === 'unassigned' ? t('common.unassigned') : t('common.assigned'),
              count: filteredClients.length,
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredClients}
            keyExtractor={(row) => row.id}
            loading={loading}
            emptyMessage={t('pages.clients.noClients')}
          />
        </CardContent>
      </Card>

      {/* Onboard Client Modal */}
      <Modal
        isOpen={showOnboardModal}
        onClose={() => {
          setShowOnboardModal(false);
          setPhoneError('');
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
          {t('pages.clients.onboardNewClient')}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label={t('common.companyName')}
              placeholder={t('pages.clients.companyNamePlaceholder')}
              value={newClient.company_name}
              onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
              required
            />
            <Input
              label={t('common.contactPerson')}
              placeholder={t('pages.clients.contactPersonPlaceholder')}
              value={newClient.contact_person}
              onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })}
              required
            />
            <Input
              type="email"
              label={t('common.emailAddress')}
              placeholder={t('pages.clients.emailPlaceholder')}
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              required
            />
            <Input
              type="tel"
              label={t('common.phoneNumber')}
              placeholder={t('pages.clients.phonePlaceholder')}
              value={newClient.phone}
              onChange={handlePhoneChange}
              onBlur={() => validatePhone(newClient.phone)}
              error={phoneError}
              inputMode="numeric"
              maxLength={10}
            />
            <Input
              type="number"
              label={t('common.commissionRatePct')}
              placeholder="1.0"
              value={newClient.commission_rate}
              onChange={(e) => setNewClient({ ...newClient, commission_rate: e.target.value })}
              helperText={t('pages.clients.commissionRateHelper')}
            />
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('common.enabledModules')}
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
                {t('pages.clients.enabledModulesHelper')}
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
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleOnboardClient}
            disabled={submitting}
            loading={submitting}
          >
            {t('pages.clients.onboardClient')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Onboard success modal – copyable credentials */}
      <Modal
        isOpen={!!onboardSuccess}
        onClose={() => {
          setOnboardSuccess(null);
          setCopiedCredentials(false);
        }}
        size="md"
      >
        <ModalHeader
          onClose={() => {
            setOnboardSuccess(null);
            setCopiedCredentials(false);
          }}
        >
          {t('pages.clients.clientOnboardedSuccess')}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="rounded bg-neutral-50 p-3 font-mono text-sm text-neutral-800 space-y-1">
              <p><strong>{t('common.email')}:</strong> {onboardSuccess?.email}</p>
              {onboardSuccess?.tempPassword && (
                <p><strong>{t('common.password')}:</strong> {onboardSuccess.tempPassword}</p>
              )}
            </div>
            {onboardSuccess?.tempPassword && (
              <p className="text-sm text-neutral-600">
                {t('pages.clients.shareCredentialsHint')}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          {onboardSuccess?.tempPassword && (
            <Button
              variant="secondary"
              icon={copiedCredentials ? Check : Copy}
              onClick={async () => {
                const text = `Email: ${onboardSuccess?.email ?? ''}\nPassword: ${onboardSuccess?.tempPassword ?? ''}`;
                try {
                  await navigator.clipboard.writeText(text);
                  setCopiedCredentials(true);
                  setTimeout(() => setCopiedCredentials(false), 2000);
                } catch {
                  // Fallback: no clipboard API
                }
              }}
            >
              {copiedCredentials ? t('common.copied') : t('common.copyLoginCredentials')}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => {
              setOnboardSuccess(null);
              setCopiedCredentials(false);
            }}
          >
            {t('common.done')}
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
          {selectedClient?.kam_id ? t('common.reassignKam') : t('common.assignKam')}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {t('common.clientLabel')}: <strong>{selectedClient?.company_name}</strong>
            </p>
            {kamUsers.length === 0 ? (
              <div className="text-sm text-neutral-500 py-2">
                {t('common.loadingKams')}
              </div>
            ) : (
              <Select
                label={t('common.selectKam')}
                value={selectedKAMId}
                onChange={(e) => setSelectedKAMId(e.target.value)}
                options={[
                  { value: '', label: t('common.unassignNoKam') },
                  ...kamUsers.map(kam => ({
                    value: kam.kamId || kam.id,
                    label: `${kam.name || t('common.unknown')} (${kam.email || t('common.noEmail')})`
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
            {t('common.cancel')}
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
                  alert(t('pages.clients.kamAssignedSuccess'));
                } else {
                  alert(`Failed: ${response.error || 'Unknown error'}`);
                }
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                alert(`Failed: ${message}`);
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            loading={submitting}
          >
            {selectedKAMId ? t('common.assign') : t('common.unassign')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Assign Products Modal (KAM) */}
      <Modal
        isOpen={showProductsModal}
        onClose={() => setShowProductsModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowProductsModal(false)}>
          Assign Loan Products
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-neutral-600 mb-4">
            Client: <strong>{selectedClient?.company_name}</strong>
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loanProducts.length === 0 ? (
              <p className="text-sm text-neutral-500">No loan products available.</p>
            ) : (
              loanProducts.map((product) => (
                <label key={product.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(product.id)}
                    onChange={(e) => {
                      setSelectedProductIds((prev) =>
                        e.target.checked
                          ? [...prev, product.id]
                          : prev.filter((id) => id !== product.id)
                      );
                    }}
                  />
                  {product.name}
                </label>
              ))
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowProductsModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSaveProducts} loading={savingProducts} disabled={savingProducts}>
            Save
          </Button>
        </ModalFooter>
      </Modal>

      {/* Client Modules Modal (KAM) */}
      <Modal
        isOpen={showModulesModal}
        onClose={() => setShowModulesModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowModulesModal(false)}>
          Client Modules & Commission
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-neutral-600 mb-4">
            Client: <strong>{selectedClient?.company_name}</strong>
          </p>
          <div className="space-y-3">
            {MODULE_OPTIONS.map((mod) => (
              <label key={mod} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={modulesSelection.includes(mod)}
                  onChange={(e) => {
                    setModulesSelection((prev) =>
                      e.target.checked ? [...prev, mod] : prev.filter((m) => m !== mod)
                    );
                  }}
                />
                {mod}
              </label>
            ))}
            <Input
              label="Commission rate (%)"
              value={commissionRateEdit}
              onChange={(e) => setCommissionRateEdit(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowModulesModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSaveModules} loading={savingModules} disabled={savingModules}>
            Save
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={showFormConfigModal}
        onClose={() => setShowFormConfigModal(false)}
        size="lg"
      >
        <ModalHeader onClose={() => setShowFormConfigModal(false)}>
          Form configuration (read-only)
        </ModalHeader>
        <ModalBody>
          <p className="mb-4 text-sm text-neutral-600">
            Client: <strong>{selectedClient?.company_name}</strong>
          </p>
          <Select
            label="Loan product"
            options={[
              { value: '', label: 'Select product' },
              ...loanProducts.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={formConfigProductId}
            onChange={(e) => {
              const productId = e.target.value;
              setFormConfigProductId(productId);
              if (selectedClient && productId) {
                void loadFormConfigForClient(selectedClient.id, productId);
              }
            }}
          />
          <div className="mt-4 max-h-80 space-y-4 overflow-y-auto">
            {loadingFormConfig ? (
              <p className="text-sm text-neutral-500">Loading form config…</p>
            ) : formConfigCategories.length === 0 ? (
              <p className="text-sm text-neutral-500">No form categories for this product.</p>
            ) : (
              formConfigCategories.map((category, index) => {
                const name = String(
                  category.categoryName ?? category['Category Name'] ?? category.categoryId ?? `Category ${index + 1}`
                );
                const fields = (category.fields as Array<Record<string, unknown>> | undefined) ?? [];
                return (
                  <div key={`${name}-${index}`} className="rounded-lg border border-neutral-200 p-3">
                    <p className="text-sm font-semibold text-neutral-900">{name}</p>
                    <ul className="mt-2 space-y-1">
                      {fields.map((field, fieldIndex) => (
                        <li key={fieldIndex} className="text-sm text-neutral-600">
                          {String(field.label ?? field.fieldLabel ?? field['Field Label'] ?? field.fieldId ?? 'Field')}
                          {(field.isRequired || field.isMandatory || field['Is Mandatory'] === 'true') && (
                            <span className="ml-1 text-error">*</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowFormConfigModal(false)}>
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      </div>
    </MainLayout>
  );
};
