import React, { useEffect, useMemo, useState } from 'react';
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
    if (!name.trim() || !phone.trim() || (missingFieldSet.has('company') && !company.trim())) {
      setSaveError('Please fill all required fields.');
      if (!phone.trim()) setPhoneError('Phone number is required');
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
      setSaveError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onDismiss} size="md" testId="build-profile-prompt">
      <ModalHeader onClose={onDismiss}>Build Your Profile</ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-sm text-neutral-600">
          Please complete your profile to continue using all features.
        </p>
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        <Input
          label="Full Name"
          placeholder="Enter your full name"
          icon={User}
          iconPosition="left"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="tel"
          label="Phone Number"
          placeholder="+91 9876543210"
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
            label="Company Name"
            placeholder="Enter company name"
            icon={Building}
            iconPosition="left"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onDismiss}>
          Maybe Later
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Save Profile
        </Button>
      </ModalFooter>
    </Modal>
  );
};
