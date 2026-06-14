import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHero } from '../components/layout/PageHero';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Save, User, Mail, Phone, Building, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { getRequiredProfileFields } from '../auth/profileCompletion';

export const Profile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const userRole = user?.role || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [profileData, setProfileData] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    company: '',
  });

  const sidebarItems = useSidebarItems();
  const requiredFields = getRequiredProfileFields(user);

  React.useEffect(() => {
    fetchProfileData();
  }, [user?.id, user?.name, user?.email, user?.phone, user?.company]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
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
    value = value.replace(/[^0-9+\-\s()]/g, '');
    setProfileData({ ...profileData, phone: value });
    setPhoneError('');
    setFormError('');
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true;
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setPhoneError(t('buildProfile.phoneMinDigits'));
      return false;
    }
    if (digitsOnly.length > 15) {
      setPhoneError(t('buildProfile.phoneMaxDigits'));
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSave = async () => {
    if (requiredFields.includes('name') && !profileData.name.trim()) {
      setFormError(t('pages.profile.fullNameRequired'));
      return;
    }
    if (requiredFields.includes('phone') && !profileData.phone.trim()) {
      setPhoneError(t('buildProfile.phoneRequired'));
      return;
    }
    if (requiredFields.includes('company') && !profileData.company.trim()) {
      setFormError(t('pages.profile.companyNameRequired'));
      return;
    }

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
        alert(t('pages.profile.profileUpdatedSuccess'));
      } else {
        alert(response.error || t('buildProfile.updateFailed'));
      }
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      const message = error instanceof Error ? error.message : t('buildProfile.updateFailed');
      alert(`${t('buildProfile.updateFailed')}: ${message}`);
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
      pageTitle={t('pages.profile.pageTitle')}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={profileData.name || user?.email?.split('@')[0] || ''}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHero title={t('pages.profile.title')} />
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.profile.profileInformation')}</CardTitle>
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
                {formError && (
                  <div className="md:col-span-2 text-sm text-red-600">{formError}</div>
                )}
                <Input
                  label={t('common.fullName')}
                  placeholder={t('pages.profile.fullNamePlaceholder')}
                  icon={User}
                  iconPosition="left"
                  value={profileData.name}
                  onChange={(e) => {
                    setProfileData({ ...profileData, name: e.target.value });
                    setFormError('');
                  }}
                />
                <Input
                  type="email"
                  label={t('common.emailAddress')}
                  placeholder={t('pages.profile.emailPlaceholder')}
                  icon={Mail}
                  iconPosition="left"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  disabled
                  helperText={t('pages.profile.emailCannotChange')}
                />
                <Input
                  type="tel"
                  label={t('common.phoneNumber')}
                  placeholder={t('buildProfile.phonePlaceholder')}
                  icon={Phone}
                  iconPosition="left"
                  value={profileData.phone}
                  onChange={handlePhoneChange}
                  onBlur={() => validatePhone(profileData.phone)}
                  pattern="[0-9+\-\s()]*"
                  error={phoneError}
                  helperText={t('pages.profile.phoneHelper')}
                />
                {(userRole === 'client' || userRole === 'nbfc') && (
                  <Input
                    label={t('common.companyName')}
                    placeholder={t('pages.profile.companyPlaceholder')}
                    icon={Building}
                    iconPosition="left"
                    value={profileData.company}
                    onChange={(e) => {
                      setProfileData({ ...profileData, company: e.target.value });
                      setFormError('');
                    }}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-primary" />
              {t('pages.profile.aiFeatures')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600">
              {t('pages.profile.aiFeaturesDescription')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/applications')}
            >
              {t('pages.profile.goToApplications')}
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" icon={Save} onClick={handleSave} loading={loading}>
            {t('common.saveChanges')}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};
