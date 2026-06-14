import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHero } from '../components/layout/PageHero';
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

const STATUS_VALUES = ['Active', 'Inactive'] as const;

interface UserAccountRow {
  id: string;
  username: string;
  role: string;
  accountStatus: string;
  lastLogin: string;
}

export const AdminUserAccounts: React.FC = () => {
  const { t } = useTranslation();
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

  const roleOptions = useMemo(
    () => [
      { value: 'client', label: t('roles.client') },
      { value: 'kam', label: t('roles.kam') },
      { value: 'credit_team', label: t('roles.creditTeam') },
      { value: 'nbfc', label: t('roles.nbfc') },
      { value: 'admin', label: t('roles.admin') },
    ],
    [t]
  );

  const statusOptions = useMemo(
    () =>
      STATUS_VALUES.map((value) => ({
        value,
        label: value === 'Active' ? t('common.active') : t('common.inactive'),
      })),
    [t]
  );

  const fetchAccounts = async (fresh = false): Promise<UserAccountRow[]> => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.listUserAccounts(fresh);
      if (response.success && response.data) {
        const accountsData = response.data.map((a) => ({
          id: a.id,
          username: a.username ?? '-',
          role: a.role ?? '-',
          accountStatus: a.accountStatus ?? '-',
          lastLogin: a.lastLogin ? new Date(a.lastLogin).toLocaleString() : '-',
        }));
        setAccounts(accountsData);
        return accountsData;
      } else {
        setError(response.error || t('pages.adminUserAccounts.loadFailed'));
        return [];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.adminUserAccounts.loadFailed'));
      return [];
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
      setCreateError(t('pages.adminUserAccounts.usernameRequired'));
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError(t('pages.adminUserAccounts.passwordMinLength'));
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
        const emailLower = email.toLowerCase();
        await new Promise((r) => setTimeout(r, 1500));
        for (let attempt = 0; attempt < 3; attempt++) {
          const accountsData = await fetchAccounts(true);
          const found = accountsData.some((a) => (a.username ?? '').toLowerCase() === emailLower);
          if (found) break;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      } else {
        const errMsg = res.error || 'Failed to create user';
        setCreateError(
          errMsg.includes('403') || errMsg.includes('Forbidden') || errMsg.includes('Insufficient')
            ? t('pages.adminUserAccounts.createPermissionDenied')
            : errMsg
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('pages.adminUserAccounts.createUser');
      if (message.includes('403') || message.includes('Forbidden') || message.includes('Insufficient')) {
        setCreateError(t('pages.adminUserAccounts.createPermissionDenied'));
      } else {
        setCreateError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<UserAccountRow>[] = useMemo(
    () => [
      { key: 'username', label: t('common.username'), sortable: true },
      { key: 'role', label: t('common.role'), sortable: true },
      {
        key: 'accountStatus',
        label: t('common.status'),
        render: (value) => (
          <Badge variant={value === 'Active' ? 'success' : 'neutral'}>{String(value)}</Badge>
        ),
      },
      { key: 'lastLogin', label: t('common.lastLogin'), sortable: true },
    ],
    [t]
  );

  if (userRole !== 'credit_team' && userRole !== 'admin') {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle={t('pages.adminUserAccounts.pageTitle')}
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={user?.name || user?.email?.split('@')[0] || ''}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <div className="p-6">
          <p className="text-neutral-600">{t('pages.adminUserAccounts.permissionDenied')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle={t('pages.adminUserAccounts.pageTitle')}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={user?.name || user?.email?.split('@')[0] || ''}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="p-6">
        <PageHero title={t('pages.adminUserAccounts.title')} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('pages.adminUserAccounts.title')}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" icon={Plus} onClick={openCreateModal}>
                {t('pages.adminUserAccounts.createUser')}
              </Button>
              <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={() => fetchAccounts()} disabled={loading}>
                {t('common.refresh')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-error text-sm mb-4">{error}</p>
            )}
            {loading ? (
              <div className="text-center py-8 text-neutral-500">{t('pages.adminUserAccounts.loadingUserAccounts')}</div>
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
            {t('pages.adminUserAccounts.createUser')}
          </ModalHeader>
          <ModalBody>
            {createError && (
              <p className="text-error text-sm mb-4">{createError}</p>
            )}
            <div className="space-y-4">
              <Input
                label={t('pages.adminUserAccounts.usernameEmail')}
                type="email"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                placeholder={t('pages.adminUserAccounts.usernamePlaceholder')}
                required
              />
              <Input
                label={t('common.password')}
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={t('pages.adminUserAccounts.passwordPlaceholder')}
                required
              />
              <Select
                label={t('common.role')}
                options={roleOptions}
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
              />
              <Input
                label={t('pages.adminUserAccounts.associatedProfile')}
                value={createForm.associatedProfile}
                onChange={(e) => setCreateForm((f) => ({ ...f, associatedProfile: e.target.value }))}
                placeholder={t('pages.adminUserAccounts.associatedProfilePlaceholder')}
              />
              <Select
                label={t('pages.adminUserAccounts.accountStatus')}
                options={statusOptions}
                value={createForm.accountStatus}
                onChange={(e) => setCreateForm((f) => ({ ...f, accountStatus: e.target.value }))}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="tertiary" onClick={() => setShowCreateModal(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreateUser} disabled={saving}>
              {saving ? t('common.creating') : t('pages.adminUserAccounts.createUser')}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </MainLayout>
  );
};
