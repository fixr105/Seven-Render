import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Phone, Building } from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { UserContext } from '../auth/types';
import { ProfileRequiredField } from '../auth/profileCompletion';

interface BuildYourProfilePromptProps {
  isOpen: boolean;
  user: UserContext;
  missingFields: ProfileRequiredField[];
  onDismiss: () => void;
  onSave: (payload: { name?: string; phone?: string; company?: string }) => Promise<void>;
}

export const BuildYourProfilePrompt: React.FC<BuildYourProfilePromptProps> = ({
  isOpen,
  user,
  missingFields,
  onDismiss,
  onSave,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [company, setCompany] = useState(user.company || '');
  const [phoneError, setPhoneError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(user.name || '');
    setPhone(user.phone || '');
    setCompany(user.company || '');
    setPhoneError('');
    setSaveError('');
  }, [isOpen, user.id, user.name, user.phone, user.company]);

  const missingFieldSet = useMemo(() => new Set(missingFields), [missingFields]);

  const validatePhone = (value: string): boolean => {
    const digitsOnly = value.replace(/\D/g, '');
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
    if (!name.trim() || !phone.trim() || (missingFieldSet.has('company') && !company.trim())) {
      setSaveError(t('buildProfile.fillRequiredFields'));
      if (!phone.trim()) setPhoneError(t('buildProfile.phoneRequired'));
      return;
    }
    if (!validatePhone(phone)) return;
    setSaveError('');
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        ...(missingFieldSet.has('company') ? { company: company.trim() } : {}),
      });
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : t('buildProfile.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onDismiss} size="md" testId="build-profile-prompt">
      <ModalHeader onClose={onDismiss}>{t('buildProfile.title')}</ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-sm text-neutral-600">{t('buildProfile.description')}</p>
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        <Input
          label={t('buildProfile.fullName')}
          placeholder={t('buildProfile.fullNamePlaceholder')}
          icon={User}
          iconPosition="left"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="tel"
          label={t('buildProfile.phone')}
          placeholder={t('buildProfile.phonePlaceholder')}
          icon={Phone}
          iconPosition="left"
          value={phone}
          onChange={(e) => {
            const sanitized = e.target.value.replace(/[^0-9+\-\s()]/g, '');
            setPhone(sanitized);
            setPhoneError('');
          }}
          onBlur={() => phone && validatePhone(phone)}
          error={phoneError}
        />
        {missingFieldSet.has('company') && (
          <Input
            label={t('buildProfile.company')}
            placeholder={t('buildProfile.companyPlaceholder')}
            icon={Building}
            iconPosition="left"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onDismiss}>
          {t('buildProfile.maybeLater')}
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {t('buildProfile.saveProfile')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
