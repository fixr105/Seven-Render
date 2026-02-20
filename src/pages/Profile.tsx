import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Save, User, Mail, Phone, Building, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const userRole = user?.role || null;
  const userRoleId = user?.clientId || user?.kamId || user?.nbfcId || user?.creditTeamId || user?.id || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string>('');
  const [profileData, setProfileData] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    company: '',
  });

  const sidebarItems = useSidebarItems();

  React.useEffect(() => {
    fetchProfileData();
  }, [user?.id, user?.name, user?.email, user?.phone, user?.company]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      // Profile data comes from the user context
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user?.phone || '',
        company: user?.company || '',
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
      const response = await apiService.updateProfile({
        name: profileData.name || undefined,
        phone: profileData.phone || undefined,
        company: profileData.company || undefined,
      });
      if (response.success) {
        await refreshUser();
        // Show success feedback (could use toast/notification instead)
        alert('Profile updated successfully');
      } else {
        alert(response.error || 'Failed to update profile');
      }
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
      userName={profileData.name || user?.email?.split('@')[0] || ''}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
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
                  <h3 className="text-lg font-semibold text-neutral-900">{profileData.name || user?.email?.split('@')[0] || ''}</h3>
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

        {/* AI features - available for all profile types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-primary" />
              AI Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600">
              AI-powered application summaries are available for all roles. Open any application from the Applications list and use the <strong>AI File Summary</strong> section to generate or view an AI summary with applicant profile, loan details, strengths, and risks.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/applications')}
            >
              Go to Applications
            </Button>
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

