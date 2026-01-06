import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Plus, Eye, UserPlus, RefreshCw } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { apiService } from '../services/api';

interface Client {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  kam_id: string | null;
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
  const { userRole, userRoleId, user } = useAuthSafe();
  
  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return '';
  };
  const { unreadCount } = useNotifications();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [newClient, setNewClient] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    password: '',
    commission_rate: '1.0',
    enabled_modules: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] as string[], // Preselect all M1-M7
  });

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
    { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
    ...(userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  // Removed automatic fetching - data will only load on manual refresh or page load
  // Users must click the Refresh button to fetch data

  const fetchClients = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      
      // Use correct endpoint based on user role
      const response = userRole === 'credit_team' 
        ? await apiService.listCreditClients()
        : await apiService.listClients(forceRefresh);
      
        success: response.success,
        dataLength: response.data?.length || 0,
        error: response.error,
        debug: (response as any)._debug
      });
      
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
          is_active: client.status === 'Active' || client.Status === 'Active',
          created_at: client.createdAt || client['Created At'] || new Date().toISOString(),
          _count: { applications: 0 },
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
        
        setClients(mappedClients);
      } else {
        setDebugInfo(`❌ Error: ${response.error || 'Unknown error'}`);
        setClients([]);
      }
    } catch (error: any) {
      setDebugInfo(`❌ Exception: ${error.message || 'Unknown error'}`);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardClient = async () => {
    
    if (!newClient.company_name || !newClient.contact_person || !newClient.email) {
      alert('Please fill in all required fields');
      return;
    }

    // Check if token is available before making request
    const token = apiService.getToken();
    const tokenFromStorage = localStorage.getItem('auth_token');
      fromService: token ? `${token.substring(0, 20)}...` : 'null',
      fromStorage: tokenFromStorage ? `${tokenFromStorage.substring(0, 20)}...` : 'null',
    });
    
    if (!token && !tokenFromStorage) {
      console.error('[Clients] ❌ No token available! User needs to login.');
      alert('Authentication required. Please log in again.');
      navigate('/login');
      return;
    }
    
    // If token exists in storage but not in service, reload it
    if (!token && tokenFromStorage) {
      apiService.setToken(tokenFromStorage);
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
      
      
      // No automatic refresh - user must click Refresh button to see the new client
      alert(`Client onboarded successfully!\n\nEmail: ${newClient.email}\n\nPlease click the Refresh button to see the new client in the list.`);
    } catch (error: any) {
      alert(`Failed to onboard client: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const filteredClients = clients.filter(client =>
    searchQuery === '' ||
    client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      key: '_count',
      label: 'Applications',
      align: 'center',
      render: (count) => (
        <Badge variant="neutral">{count?.applications || 0}</Badge>
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
      render: (value) => formatDate(value),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Button
          size="sm"
          variant="secondary"
          icon={Eye}
          onClick={() => navigate(`/applications?clientId=${row.id}`)}
        >
          View Files
        </Button>
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
    >
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Total Clients</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{clients.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Active Clients</p>
            <p className="text-2xl font-bold text-success mt-1">
              {clients.filter(c => c.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Total Applications</p>
            <p className="text-2xl font-bold text-brand-primary mt-1">
              {clients.reduce((sum, c) => sum + (c._count?.applications || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Avg per Client</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {clients.length > 0
                ? Math.round(clients.reduce((sum, c) => sum + (c._count?.applications || 0), 0) / clients.length)
                : 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Clients ({filteredClients.length})</CardTitle>
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
    </MainLayout>
  );
};
