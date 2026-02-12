import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable, Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Users, RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

const ROLE_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'kam', label: 'KAM' },
  { value: 'credit_team', label: 'Credit Team' },
  { value: 'nbfc', label: 'NBFC' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

interface UserAccountRow {
  id: string;
  username: string;
  role: string;
  accountStatus: string;
  lastLogin: string;
}

export const AdminUserAccounts: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [accounts, setAccounts] = useState<UserAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    role: 'client',
    associatedProfile: '',
    accountStatus: 'Active',
  });

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.listUserAccounts();
      if (response.success && response.data) {
        setAccounts(
          response.data.map((a) => ({
            id: a.id,
            username: a.username ?? '-',
            role: a.role ?? '-',
            accountStatus: a.accountStatus ?? '-',
            lastLogin: a.lastLogin ? new Date(a.lastLogin).toLocaleString() : '-',
          }))
        );
      } else {
        setError(response.error || 'Failed to load user accounts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'credit_team' || userRole === 'admin') {
      fetchAccounts();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  const openCreateModal = () => {
    setCreateForm({
      username: '',
      password: '',
      role: 'client',
      associatedProfile: '',
      accountStatus: 'Active',
    });
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateUser = async () => {
    const email = createForm.username.trim();
    if (!email) {
      setCreateError('Username (email) is required');
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const res = await apiService.createUserAccount({
        username: email,
        password: createForm.password,
        role: createForm.role,
        associatedProfile: createForm.associatedProfile.trim() || undefined,
        accountStatus: createForm.accountStatus,
      });
      if (res.success) {
        setShowCreateModal(false);
        await fetchAccounts();
      } else {
        setCreateError(res.error || 'Failed to create user');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<UserAccountRow>[] = [
    { key: 'username', label: 'Username', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    {
      key: 'accountStatus',
      label: 'Status',
      render: (value) => (
        <Badge variant={value === 'Active' ? 'success' : 'neutral'}>{String(value)}</Badge>
      ),
    },
    { key: 'lastLogin', label: 'Last Login', sortable: true },
  ];

  if (userRole !== 'credit_team' && userRole !== 'admin') {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="User Accounts"
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={user?.name || user?.email?.split('@')[0] || ''}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <div className="p-6">
          <p className="text-neutral-600">You do not have permission to view user accounts.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="User Accounts"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={user?.name || user?.email?.split('@')[0] || ''}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Accounts
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" icon={Plus} onClick={openCreateModal}>
                Create user
              </Button>
              <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={fetchAccounts} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-error text-sm mb-4">{error}</p>
            )}
            {loading ? (
              <div className="text-center py-8 text-neutral-500">Loading user accounts...</div>
            ) : (
              <DataTable
                columns={columns}
                data={accounts}
                keyExtractor={(row) => row.id}
              />
            )}
          </CardContent>
        </Card>

        <Modal isOpen={showCreateModal} onClose={() => !saving && setShowCreateModal(false)} size="md">
          <ModalHeader onClose={saving ? undefined : () => setShowCreateModal(false)}>
            Create user
          </ModalHeader>
          <ModalBody>
            {createError && (
              <p className="text-error text-sm mb-4">{createError}</p>
            )}
            <div className="space-y-4">
              <Input
                label="Username (email)"
                type="email"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="user@example.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters"
                required
              />
              <Select
                label="Role"
                options={ROLE_OPTIONS}
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
              />
              <Input
                label="Associated profile (optional)"
                value={createForm.associatedProfile}
                onChange={(e) => setCreateForm((f) => ({ ...f, associatedProfile: e.target.value }))}
                placeholder="e.g. client or KAM profile ID"
              />
              <Select
                label="Account status"
                options={STATUS_OPTIONS}
                value={createForm.accountStatus}
                onChange={(e) => setCreateForm((f) => ({ ...f, accountStatus: e.target.value }))}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="tertiary" onClick={() => setShowCreateModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateUser} disabled={saving}>
              {saving ? 'Creating…' : 'Create user'}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </MainLayout>
  );
};
