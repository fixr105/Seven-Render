import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHero } from '../components/layout/PageHero';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable, Column } from '../components/ui/DataTable';
import { Select } from '../components/ui/Select';
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
  const { t } = useTranslation();
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
  const [targetEntity, setTargetEntity] = useState('');
  const [performedByOptions, setPerformedByOptions] = useState<{ value: string; label: string }[]>([]);
  const [actionTypeOptions, setActionTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [targetEntityOptions, setTargetEntityOptions] = useState<{ value: string; label: string }[]>([]);

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
        targetEntity: targetEntity.trim() || undefined,
      });
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : [];
        setEntries(data);
        const bySet = new Set<string>();
        const typeSet = new Set<string>();
        const entitySet = new Set<string>();
        data.forEach((e: ActivityLogEntry) => {
          if (e.performedBy?.trim()) bySet.add(e.performedBy.trim());
          if (e.actionType?.trim()) typeSet.add(e.actionType.trim());
          if (e.targetEntity?.trim()) entitySet.add(e.targetEntity.trim());
        });
        setPerformedByOptions((prev) => {
          const prevValues = prev.filter((o) => o.value).map((o) => o.value);
          const merged = new Set([...prevValues, ...bySet]);
          return [{ value: '', label: t('common.all') }, ...Array.from(merged).sort().map((v) => ({ value: v, label: v }))];
        });
        setActionTypeOptions((prev) => {
          const prevValues = prev.filter((o) => o.value).map((o) => o.value);
          const merged = new Set([...prevValues, ...typeSet]);
          return [{ value: '', label: t('common.all') }, ...Array.from(merged).sort().map((v) => ({ value: v, label: v }))];
        });
        setTargetEntityOptions((prev) => {
          const prevValues = prev.filter((o) => o.value).map((o) => o.value);
          const merged = new Set([...prevValues, ...entitySet]);
          return [{ value: '', label: t('common.all') }, ...Array.from(merged).sort().map((v) => ({ value: v, label: v }))];
        });
      } else {
        setEntries([]);
        setError(response.error || t('pages.adminActivityLog.loadFailed'));
      }
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : t('pages.adminActivityLog.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, performedBy, actionType, targetEntity, t]);

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
    { key: 'timestamp', label: t('common.dateTime'), sortable: false, render: (_, row) => formatDateTime(row.timestamp) },
    { key: 'performedBy', label: t('common.performedBy'), sortable: true },
    { key: 'actionType', label: t('common.actionType'), sortable: true },
    { key: 'description', label: t('common.description'), sortable: false },
    { key: 'targetEntity', label: t('common.targetEntity'), sortable: true },
  ];

  if (userRole !== 'credit_team' && userRole !== 'admin') {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle={t('nav.activityLog')}
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={user?.name || user?.email?.split('@')[0] || ''}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <Card>
          <CardContent>
            <p className="text-center text-neutral-600 py-8">{t('pages.adminActivityLog.accessRestrictedHint')}</p>
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
      pageTitle={t('pages.adminActivityLog.pageTitle')}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={user?.name || user?.email?.split('@')[0] || ''}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="space-y-6">
        <PageHero
          title={t('pages.adminActivityLog.title')}
          description={t('pages.adminActivityLog.description')}
          actions={
            <Button variant="secondary" icon={RefreshCw} onClick={fetchLog} disabled={loading}>
              {t('common.refresh')}
            </Button>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              {t('common.filters')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">{t('common.dateFrom')}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">{t('common.dateTo')}</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Select
                  label={t('common.performedBy')}
                  options={performedByOptions.length > 0 ? performedByOptions : [{ value: '', label: t('common.all') }]}
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                />
              </div>
              <div>
                <Select
                  label={t('common.actionType')}
                  options={actionTypeOptions.length > 0 ? actionTypeOptions : [{ value: '', label: t('common.all') }]}
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                />
              </div>
              <div>
                <Select
                  label={t('common.targetEntity')}
                  options={targetEntityOptions.length > 0 ? targetEntityOptions : [{ value: '', label: t('common.all') }]}
                  value={targetEntity}
                  onChange={(e) => setTargetEntity(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <Button variant="primary" onClick={fetchLog} disabled={loading}>
                {t('common.applyFilters')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {t('pages.adminActivityLog.entriesCount', { count: entries.length })}
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
              emptyMessage={t('pages.adminActivityLog.noEntriesMatch')}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
