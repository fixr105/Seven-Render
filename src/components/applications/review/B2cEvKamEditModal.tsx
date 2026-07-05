import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { TextArea } from '../../ui/TextArea';
import { mergeFormDataPatch } from '../../../lib/mergeFormDataPatch';
import { apiService } from '../../../services/api';

const EDITABLE_KEYS: Array<{ key: string; label: string }> = [
  { key: 'borrower.firstName', label: 'Borrower First Name' },
  { key: 'borrower.lastName', label: 'Borrower Last Name' },
  { key: 'borrower.mobile', label: 'Borrower Mobile' },
  { key: 'borrower.email', label: 'Borrower Email' },
  { key: 'loan.amount', label: 'Loan Amount' },
  { key: 'loan.interestRate', label: 'Interest Rate (%)' },
  { key: 'loan.tenureMonths', label: 'Tenure (months)' },
  { key: 'loan.processingFee', label: 'Processing Fee' },
  { key: 'loan.gpsCharges', label: 'GPS Charges' },
];

export interface B2cEvKamEditModalProps {
  isOpen: boolean;
  applicationId: string;
  formData: Record<string, unknown>;
  remarks?: string;
  onClose: () => void;
  onSaved: () => void;
}

export const B2cEvKamEditModal: React.FC<B2cEvKamEditModalProps> = ({
  isOpen,
  applicationId,
  formData,
  remarks: initialRemarks = '',
  onClose,
  onSaved,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of EDITABLE_KEYS) {
      const raw = formData[field.key];
      initial[field.key] = raw == null ? '' : String(raw);
    }
    return initial;
  });
  const [remarks, setRemarks] = useState(initialRemarks);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const patch: Record<string, unknown> = { ...values };
      if (remarks.trim()) {
        patch.Remarks = remarks.trim();
      }
      const merged = mergeFormDataPatch(formData, patch);
      const response = await apiService.editApplication(applicationId, {
        formData: merged,
        notes: notes.trim() || undefined,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>Edit B2C EV Application</ModalHeader>
      <ModalBody>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {EDITABLE_KEYS.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
            />
          ))}
          <TextArea
            label="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
          />
          <TextArea
            label="Edit notes (audit log)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Reason for edit (optional)"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void handleSave()} loading={submitting} disabled={submitting}>
          Save Changes
        </Button>
      </ModalFooter>
    </Modal>
  );
};
