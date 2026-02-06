import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable, Column } from '../components/ui/DataTable';
import { ClipboardList, RefreshCw, Filter } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

interface ActivityLogEntry {
  id: string;
  activityId: string;
  timestamp: string;
  performedBy: string;
  actionType: string;
  description: string;
  targetEntity: string;
}

export const AdminActivityLog: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [actionType, setActionType] = useState('');

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const fetchLog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAdminActivityLog({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        performedBy: performedBy.trim() || undefined,
        actionType: actionType || undefined,
      });
      if (response.success && response.data) {
        setEntries(Array.isArray(response.data) ? response.data : []);
      } else {
        setEntries([]);
        setError(response.error || 'Failed to load activity log');
      }
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, performedBy, actionType]);

  useEffect(() => {
    if (userRole === 'credit_team' || userRole === 'admin') {
      fetchLog();
    } else {
      setLoading(false);
    }
  }, [userRole, fetchLog]);

  const formatDateTime = (dateString: string): string => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      return d.toLocaleString('en-IN', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dateString;
    }
  };

  const columns: Column<ActivityLogEntry>[] = [
    { key: 'timestamp', label: 'Date / Time', sortable: false, render: (_, row) => formatDateTime(row.timestamp) },
    { key: 'performedBy', label: 'Performed By', sortable: true },
    { key: 'actionType', label: 'Action Type', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'targetEntity', label: 'Target Entity', sortable: true },
  ];

  if (userRole !== 'credit_team' && userRole !== 'admin') {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="Activity Log"
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={user?.name || user?.email?.split('@')[0] || ''}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <Card>
          <CardContent>
            <p className="text-center text-neutral-600 py-8">Access restricted to Credit Team and Administrators.</p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Admin Activity Log"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={user?.name || user?.email?.split('@')[0] || ''}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Admin Activity Log</h1>
            <p className="text-sm text-neutral-600 mt-1">View system activity by user, date, and action type</p>
          </div>
          <Button variant="secondary" icon={RefreshCw} onClick={fetchLog} disabled={loading}>
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Date from</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Date to</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Performed by</label>
                <input
                  type="text"
                  placeholder="User email or name"
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Action type</label>
                <input
                  type="text"
                  placeholder="Action type"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4">
              <Button variant="primary" onClick={fetchLog} disabled={loading}>
                Apply filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Entries ({entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-error text-sm mb-4">{error}</p>
            )}
            <DataTable<ActivityLogEntry>
              columns={columns}
              data={entries}
              keyExtractor={(row) => row.id || row.activityId || String(Math.random())}
              loading={loading}
              emptyMessage="No activity log entries match your filters."
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
