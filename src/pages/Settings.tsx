import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Home, FileText, Users, DollarSign, BarChart3, Settings as SettingsIcon, Bell, Lock, Moon, Globe } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { userRole } = useAuthSafe();
  const { unreadCount } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    preferences: {
      language: 'en',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD-MM-YYYY',
    },
    security: {
      twoFactor: false,
      sessionTimeout: '30',
    },
  });

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save settings to localStorage or backend
      localStorage.setItem('userSettings', JSON.stringify(settings));
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      alert('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert(`Failed to save settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  React.useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem('userSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
  }, []);

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Settings"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName="User"
      notificationCount={unreadCount}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-primary" />
              <CardTitle>Notification Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-900">Email Notifications</span>
                  <span className="text-xs text-neutral-500">Receive notifications via email</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, email: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                />
              </label>
              <label className="flex items-center justify-between p-3 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-900">Push Notifications</span>
                  <span className="text-xs text-neutral-500">Browser push notifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, push: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                />
              </label>
              <label className="flex items-center justify-between p-3 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-900">SMS Notifications</span>
                  <span className="text-xs text-neutral-500">Receive SMS alerts</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.sms}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, sms: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-brand-primary" />
              <CardTitle>Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Language"
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'hi', label: 'Hindi' },
                  { value: 'mr', label: 'Marathi' },
                ]}
                value={settings.preferences.language}
                onChange={(e) => setSettings({
                  ...settings,
                  preferences: { ...settings.preferences, language: e.target.value }
                })}
              />
              <Select
                label="Timezone"
                options={[
                  { value: 'Asia/Kolkata', label: 'IST (Asia/Kolkata)' },
                  { value: 'UTC', label: 'UTC' },
                ]}
                value={settings.preferences.timezone}
                onChange={(e) => setSettings({
                  ...settings,
                  preferences: { ...settings.preferences, timezone: e.target.value }
                })}
              />
              <Select
                label="Date Format"
                options={[
                  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
                  { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY' },
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                ]}
                value={settings.preferences.dateFormat}
                onChange={(e) => setSettings({
                  ...settings,
                  preferences: { ...settings.preferences, dateFormat: e.target.value }
                })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-brand-primary" />
              <CardTitle>Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-900">Two-Factor Authentication</span>
                  <span className="text-xs text-neutral-500">Add an extra layer of security</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.security.twoFactor}
                  onChange={(e) => setSettings({
                    ...settings,
                    security: { ...settings.security, twoFactor: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                />
              </label>
              <div>
                <label className="text-sm font-medium text-neutral-900 mb-2 block">Session Timeout (minutes)</label>
                <Input
                  type="number"
                  value={settings.security.sessionTimeout}
                  onChange={(e) => setSettings({
                    ...settings,
                    security: { ...settings.security, sessionTimeout: e.target.value }
                  })}
                  placeholder="30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
          <Button variant="primary" icon={SettingsIcon} onClick={handleSave} loading={loading}>
            Save Settings
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

