import React, { useCallback, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../ui/Modal';
import { ToastContainer } from '../ui/Toast';
import { apiService } from '../../services/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AddDealerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

function isPermissionError(error: string): boolean {
  const text = error.toLowerCase();
  return text.includes('insufficient permissions') || text.includes('forbidden') || text.includes('403');
}

export const AddDealerModal: React.FC<AddDealerModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const nameValid = name.trim().length >= 2;
  const canSubmit = emailValid && nameValid && !submitting;
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(submitting);
  onCloseRef.current = onClose;
  submittingRef.current = submitting;

  const pushToast = (type: ToastItem['type'], message: string) => {
    setToasts((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, message },
    ]);
  };

  const resetForm = () => {
    setEmail('');
    setName('');
    setEmailError('');
  };

  const handleClose = useCallback(() => {
    if (submittingRef.current) return;
    setEmail('');
    setName('');
    setEmailError('');
    onCloseRef.current();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setEmailError('');
    setSubmitting(true);
    try {
      const result = await apiService.createDealer({
        email: email.trim().toLowerCase(),
        name: name.trim().toUpperCase(),
      });

      if (result.success) {
        pushToast('success', 'Dealer added. They can log in with pass@123.');
        resetForm();
        onClose();
        return;
      }

      const message = result.error || '';
      if (message.toLowerCase().includes('already exists')) {
        setEmailError('A dealer with this email already exists');
        return;
      }
      if (isPermissionError(message)) {
        pushToast('error', "You don't have permission to add dealers.");
        return;
      }
      pushToast('error', 'Could not add dealer. Try again.');
    } catch {
      pushToast('error', 'Could not add dealer. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="sm" testId="add-dealer-modal">
        <form onSubmit={handleSubmit}>
          <ModalHeader onClose={handleClose}>Add Dealer</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Email"
              required
              type="email"
              aria-label="Email"
              value={email}
              autoComplete="off"
              error={emailError}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError('');
              }}
            />
            <Input
              label="Dealer Name"
              required
              type="text"
              aria-label="Dealer Name"
              value={name}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </ModalBody>
          <ModalFooter className="justify-between">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit} loading={submitting}>
              Add Dealer
            </Button>
          </ModalFooter>
        </form>
      </Modal>
      <div className="relative z-[60]">
        <ToastContainer
          toasts={toasts}
          onRemove={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
        />
      </div>
    </>
  );
};
