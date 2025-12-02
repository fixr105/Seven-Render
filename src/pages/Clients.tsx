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
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Plus, Eye, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { supabase } from '../lib/supabase';

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

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export const Clients: React.FC = () => {
  const navigate = useNavigate();
  const { userRole, userRoleId } = useAuth();
  const { unreadCount } = useNotifications();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newClient, setNewClient] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    password: '',
    commission_rate: '1.0',
    enabled_modules: [] as string[],
  });

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
    { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
    ...(userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  useEffect(() => {
    fetchClients();

    const subscription = supabase
      .channel('clients_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dsa_clients' }, () => {
        fetchClients();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userRole, userRoleId]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('dsa_clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (userRole === 'kam') {
        query = query.eq('kam_id', userRoleId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const clientsWithCount = await Promise.all(
        (data || []).map(async (client) => {
          const { count } = await supabase
            .from('loan_applications')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', client.id);

          return {
            ...client,
            _count: { applications: count || 0 },
          };
        })
      );

      setClients(clientsWithCount);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardClient = async () => {
    if (!newClient.company_name || !newClient.contact_person || !newClient.email || !newClient.password) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newClient.email,
        password: newClient.password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      const { data: userRoleData, error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'client',
        })
        .select()
        .single();

      if (roleError) throw roleError;

      const { error: clientError } = await supabase
        .from('dsa_clients')
        .insert({
          user_id: userRoleData.id,
          company_name: newClient.company_name,
          contact_person: newClient.contact_person,
          email: newClient.email,
          phone: newClient.phone,
          kam_id: userRole === 'kam' ? userRoleId : null,
          is_active: true,
          commission_rate: parseFloat(newClient.commission_rate) / 100 || 0.01,
          modules_enabled: newClient.enabled_modules.length > 0 ? newClient.enabled_modules : ['M1', 'M2', 'M3', 'M4', 'M5'],
        });

      if (clientError) throw clientError;

      setShowOnboardModal(false);
      setNewClient({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        password: '',
        commission_rate: '1.0',
        enabled_modules: [],
      });
      fetchClients();
      alert('Client onboarded successfully!');
    } catch (error: any) {
      console.error('Error onboarding client:', error);
      alert(`Failed to onboard client: ${error.message}`);
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
      userName="User"
      notificationCount={unreadCount}
    >
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
            {userRole === 'kam' && (
              <Button variant="primary" icon={UserPlus} onClick={() => setShowOnboardModal(true)}>
                Onboard Client
              </Button>
            )}
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
            enabled_modules: [],
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
              type="password"
              label="Initial Password"
              placeholder="Set initial password"
              value={newClient.password}
              onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
              required
              helpText="The client will use this to log in for the first time"
            />
            <Input
              type="number"
              label="Commission Rate (%)"
              placeholder="1.0"
              value={newClient.commission_rate}
              onChange={(e) => setNewClient({ ...newClient, commission_rate: e.target.value })}
              helpText="Default commission rate for this client (e.g., 1.0 for 1%)"
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
