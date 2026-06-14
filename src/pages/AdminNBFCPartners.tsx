import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHero } from '../components/layout/PageHero';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable, Column } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Building2, RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

interface NBFCPartnerRow {
  id: string;
  lenderName: string;
  contactPerson: string;
  contactEmailPhone: string;
  addressRegion?: string;
  active: boolean;
}

export const AdminNBFCPartners: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userRole = user?.role || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [partners, setPartners] = useState<NBFCPartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    lenderName: '',
    contactPerson: '',
    contactEmailPhone: '',
    addressRegion: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.listNBFCPartners();
      if (response.success && response.data) {
        setPartners(
          response.data.map((p) => ({
            id: p.id,
            lenderName: p.lenderName ?? '-',
            contactPerson: p.contactPerson ?? '-',
            contactEmailPhone: p.contactEmailPhone ?? '-',
            addressRegion: p.addressRegion ?? '',
            active: p.active ?? true,
          }))
        );
      } else {
        setError(response.error || t('pages.adminNbfcPartners.loadFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.adminNbfcPartners.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'credit_team' || userRole === 'admin') {
      fetchPartners();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ lenderName: '', contactPerson: '', contactEmailPhone: '', addressRegion: '', active: true });
    setShowModal(true);
  };

  const openEdit = (row: NBFCPartnerRow) => {
    const p = partners.find((x) => x.id === row.id);
    if (!p) return;
    setEditingId(row.id);
    setForm({
      lenderName: row.lenderName,
      contactPerson: row.contactPerson,
      contactEmailPhone: row.contactEmailPhone,
      addressRegion: row.addressRegion ?? '',
      active: row.active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.lenderName.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await apiService.updateNBFCPartner(editingId, {
          lenderName: form.lenderName.trim(),
          contactPerson: form.contactPerson.trim() || undefined,
          contactEmailPhone: form.contactEmailPhone.trim() || undefined,
          addressRegion: form.addressRegion.trim() || undefined,
          active: form.active,
        });
        if (res.success) {
          setShowModal(false);
          fetchPartners();
        } else {
          setError(res.error || 'Update failed');
        }
      } else {
        const res = await apiService.createNBFCPartner({
          lenderName: form.lenderName.trim(),
          contactPerson: form.contactPerson.trim() || undefined,
          contactEmailPhone: form.contactEmailPhone.trim() || undefined,
          addressRegion: form.addressRegion.trim() || undefined,
          active: form.active,
        });
        if (res.success) {
          setShowModal(false);
          fetchPartners();
        } else {
          setError(res.error || 'Create failed');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<NBFCPartnerRow>[] = useMemo(
    () => [
      { key: 'lenderName', label: t('common.lenderName'), sortable: true },
      { key: 'contactPerson', label: t('common.contactPerson'), sortable: true },
      { key: 'contactEmailPhone', label: t('common.contactEmailPhone'), sortable: false },
      {
        key: 'active',
        label: t('common.active'),
        render: (value) => (
          <Badge variant={value ? 'success' : 'neutral'}>{value ? t('common.yes') : t('common.no')}</Badge>
        ),
      },
    ],
    [t]
  );

  const canManage = userRole === 'credit_team' || userRole === 'admin';

  if (userRole !== 'credit_team' && userRole !== 'admin') {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle={t('pages.adminNbfcPartners.pageTitle')}
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={user?.name || user?.email?.split('@')[0] || ''}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <div className="p-6">
          <p className="text-neutral-600">{t('pages.adminNbfcPartners.permissionDenied')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle={t('pages.adminNbfcPartners.pageTitle')}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={user?.name || user?.email?.split('@')[0] || ''}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="p-6">
        <PageHero title={t('pages.adminNbfcPartners.title')} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t('pages.adminNbfcPartners.title')}
            </CardTitle>
            <div className="flex gap-2">
              {canManage && (
                <Button variant="primary" size="sm" icon={Plus} onClick={openCreate}>
                  {t('common.addPartner')}
                </Button>
              )}
              <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={fetchPartners} disabled={loading}>
                {t('common.refresh')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-error text-sm mb-4">{error}</p>
            )}
            {loading ? (
              <div className="text-center py-8 text-neutral-500">{t('pages.adminNbfcPartners.loadingPartners')}</div>
            ) : (
              <DataTable
                columns={columns}
                data={partners}
                keyExtractor={(row) => row.id}
                onRowClick={canManage ? openEdit : undefined}
              />
            )}
          </CardContent>
        </Card>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !saving && setShowModal(false)}>
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editingId ? t('pages.adminNbfcPartners.editPartner') : t('pages.adminNbfcPartners.addPartnerTitle')}</h2>
              <div className="space-y-3">
                <Input
                  label={t('common.lenderName')}
                  value={form.lenderName}
                  onChange={(e) => setForm((f) => ({ ...f, lenderName: e.target.value }))}
                  required
                />
                <Input
                  label={t('common.contactPerson')}
                  value={form.contactPerson}
                  onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                />
                <Input
                  label={t('common.contactEmailPhone')}
                  value={form.contactEmailPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmailPhone: e.target.value }))}
                />
                <Input
                  label={t('common.addressRegion')}
                  value={form.addressRegion}
                  onChange={(e) => setForm((f) => ({ ...f, addressRegion: e.target.value }))}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="rounded border-neutral-300"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-neutral-700">{t('common.active')}</label>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <div>
                  {editingId && form.active && canManage && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        if (!window.confirm(t('pages.adminNbfcPartners.deactivateConfirm'))) return;
                        setDeactivating(true);
                        try {
                          const res = await apiService.deleteNBFCPartner(editingId);
                          if (res.success) {
                            setShowModal(false);
                            fetchPartners();
                          } else {
                            setError(res.error || 'Deactivate failed');
                          }
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Deactivate failed');
                        } finally {
                          setDeactivating(false);
                        }
                      }}
                      disabled={saving || deactivating}
                    >
                      {deactivating ? t('common.deactivating') : t('pages.adminNbfcPartners.deactivatePartner')}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="tertiary" onClick={() => !saving && !deactivating && setShowModal(false)} disabled={saving || deactivating}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" onClick={handleSave} disabled={saving || deactivating || !form.lenderName.trim()}>
                    {saving ? t('common.saving') : editingId ? t('common.update') : t('common.create')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
