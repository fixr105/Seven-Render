import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
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
  active: boolean;
}

export const AdminNBFCPartners: React.FC = () => {
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
            active: p.active ?? true,
          }))
        );
      } else {
        setError(response.error || 'Failed to load NBFC partners');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load NBFC partners');
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
      addressRegion: '',
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

  const columns: Column<NBFCPartnerRow>[] = [
    { key: 'lenderName', label: 'Lender Name', sortable: true },
    { key: 'contactPerson', label: 'Contact Person', sortable: true },
    { key: 'contactEmailPhone', label: 'Contact Email/Phone', sortable: false },
    {
      key: 'active',
      label: 'Active',
      render: (value) => (
        <Badge variant={value ? 'success' : 'neutral'}>{value ? 'Yes' : 'No'}</Badge>
      ),
    },
  ];

  const canManage = userRole === 'credit_team' || userRole === 'admin';

  if (userRole !== 'credit_team' && userRole !== 'admin') {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="NBFC Partners"
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={user?.name || user?.email?.split('@')[0] || ''}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <div className="p-6">
          <p className="text-neutral-600">You do not have permission to view NBFC partners.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="NBFC Partners"
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
              <Building2 className="w-5 h-5" />
              NBFC Partners
            </CardTitle>
            <div className="flex gap-2">
              {canManage && (
                <Button variant="primary" size="sm" icon={Plus} onClick={openCreate}>
                  Add Partner
                </Button>
              )}
              <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={fetchPartners} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-error text-sm mb-4">{error}</p>
            )}
            {loading ? (
              <div className="text-center py-8 text-neutral-500">Loading NBFC partners...</div>
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
              <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit NBFC Partner' : 'Add NBFC Partner'}</h2>
              <div className="space-y-3">
                <Input
                  label="Lender Name"
                  value={form.lenderName}
                  onChange={(e) => setForm((f) => ({ ...f, lenderName: e.target.value }))}
                  required
                />
                <Input
                  label="Contact Person"
                  value={form.contactPerson}
                  onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                />
                <Input
                  label="Contact Email/Phone"
                  value={form.contactEmailPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmailPhone: e.target.value }))}
                />
                <Input
                  label="Address/Region"
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
                  <label htmlFor="active" className="text-sm font-medium text-neutral-700">Active</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="tertiary" onClick={() => !saving && setShowModal(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={saving || !form.lenderName.trim()}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
