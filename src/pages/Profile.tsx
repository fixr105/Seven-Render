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
import { apiService } from '../services/api';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, userRole, userRoleId } = useAuthSafe();
  const { unreadCount } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string>('');
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
    if (!user) return;

    try {
      // Profile data comes from the user context
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: '', // TODO: Fetch from backend API if available
        company: '', // TODO: Fetch from backend API if available
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Allow only numbers, +, -, spaces, and parentheses
    value = value.replace(/[^0-9+\-\s()]/g, '');
    setProfileData({ ...profileData, phone: value });
    setPhoneError('');
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true; // Phone is optional
    // Basic validation: should contain at least 10 digits
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setPhoneError('Phone number must contain at least 10 digits');
      return false;
    }
    if (digitsOnly.length > 15) {
      setPhoneError('Phone number cannot exceed 15 digits');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSave = async () => {
    // Validate phone number before saving
    if (!validatePhone(profileData.phone)) {
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement profile update via backend API
      // For now, just show a message
      alert('Profile update functionality will be implemented via backend API');
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
                  placeholder="+91 9876543210"
                  icon={Phone}
                  iconPosition="left"
                  value={profileData.phone}
                  onChange={handlePhoneChange}
                  onBlur={() => validatePhone(profileData.phone)}
                  pattern="[0-9+\-\s()]*"
                  error={phoneError}
                  helperText="Enter phone number with country code (e.g., +91 9876543210)"
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

