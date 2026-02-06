import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable, Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Users, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

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
            <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={fetchAccounts} disabled={loading}>
              Refresh
            </Button>
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
      </div>
    </MainLayout>
  );
};
