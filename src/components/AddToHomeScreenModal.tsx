import React from 'react';
import { useTranslation } from 'react-i18next';
import { Share, Smartphone } from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';
import { Button } from './ui/Button';
import type { AddToHomeScreenResult } from '../hooks/useAddToHomeScreen';

interface AddToHomeScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: Extract<AddToHomeScreenResult, 'ios-instructions' | 'android-instructions' | 'unavailable'>;
}

export const AddToHomeScreenModal: React.FC<AddToHomeScreenModalProps> = ({
  isOpen,
  onClose,
  mode,
}) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" testId="add-to-home-screen-modal">
      <ModalHeader onClose={onClose}>{t('topbar.addToHomeScreen')}</ModalHeader>
      <ModalBody className="space-y-4">
        <div className="flex justify-center">
          <img
            src="/icons/app-icon.png"
            alt=""
            className="w-16 h-16 rounded-2xl shadow-level-1"
            width={64}
            height={64}
          />
        </div>

        {mode === 'ios-instructions' && (
          <ol className="space-y-3 text-sm text-neutral-700 list-none">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold flex items-center justify-center">
                1
              </span>
              <span className="flex items-center gap-1.5 flex-wrap">
                {t('topbar.addToHomeScreenIosStep1')}
                <Share className="w-4 h-4 text-brand-primary inline-flex flex-shrink-0" aria-hidden />
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold flex items-center justify-center">
                2
              </span>
              <span>{t('topbar.addToHomeScreenIosStep2')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold flex items-center justify-center">
                3
              </span>
              <span>{t('topbar.addToHomeScreenIosStep3')}</span>
            </li>
          </ol>
        )}

        {mode === 'android-instructions' && (
          <ol className="space-y-3 text-sm text-neutral-700 list-none">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold flex items-center justify-center">
                1
              </span>
              <span>{t('topbar.addToHomeScreenAndroidStep1')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold flex items-center justify-center">
                2
              </span>
              <span className="flex items-center gap-1.5 flex-wrap">
                {t('topbar.addToHomeScreenAndroidStep2')}
                <Smartphone className="w-4 h-4 text-brand-primary inline-flex flex-shrink-0" aria-hidden />
              </span>
            </li>
          </ol>
        )}

        {mode === 'unavailable' && (
          <p className="text-sm text-neutral-600">{t('topbar.addToHomeScreenUnavailable')}</p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
