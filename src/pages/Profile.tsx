import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Save, User, Mail, Phone, Building } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { supabase } from '../lib/supabase';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, userRole, userRoleId } = useAuthSafe();
  const { unreadCount } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    company: '',
  });

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  React.useEffect(() => {
    fetchProfileData();
  }, [userRoleId]);

  const fetchProfileData = async () => {
    if (!userRoleId) return;

    try {
      if (userRole === 'client') {
        const { data } = await supabase
          .from('dsa_clients')
          .select('company_name, contact_person, email, phone')
          .eq('user_id', userRoleId)
          .maybeSingle();

        if (data) {
          setProfileData({
            name: data.contact_person || '',
            email: data.email || user?.email || '',
            phone: data.phone || '',
            company: data.company_name || '',
          });
        }
      } else {
        // For other roles, fetch from user metadata or other sources
        setProfileData({
          name: user?.user_metadata?.name || '',
          email: user?.email || '',
          phone: user?.user_metadata?.phone || '',
          company: '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (userRole === 'client' && userRoleId) {
        const { error } = await supabase
          .from('dsa_clients')
          .update({
            contact_person: profileData.name,
            phone: profileData.phone,
            company_name: profileData.company,
          })
          .eq('user_id', userRoleId);

        if (error) throw error;
      }

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          name: profileData.name,
          phone: profileData.phone,
        },
      });

      if (updateError) throw updateError;

      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(`Failed to update profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Profile"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={profileData.name || 'User'}
      notificationCount={unreadCount}
    >
      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 bg-brand-primary rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">{profileData.name || 'User'}</h3>
                  <p className="text-sm text-neutral-500">{profileData.email}</p>
                  <p className="text-xs text-neutral-400 mt-1">{userRole?.replace('_', ' ').toUpperCase()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="Enter your full name"
                  icon={User}
                  iconPosition="left"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                />
                <Input
                  type="email"
                  label="Email Address"
                  placeholder="Enter your email"
                  icon={Mail}
                  iconPosition="left"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  disabled
                  helperText="Email cannot be changed"
                />
                <Input
                  type="tel"
                  label="Phone Number"
                  placeholder="Enter your phone number"
                  icon={Phone}
                  iconPosition="left"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
                {userRole === 'client' && (
                  <Input
                    label="Company Name"
                    placeholder="Enter company name"
                    icon={Building}
                    iconPosition="left"
                    value={profileData.company}
                    onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
          <Button variant="primary" icon={Save} onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

