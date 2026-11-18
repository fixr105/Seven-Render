import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { STATE_BY_CODE } from '../../lib/indiaStateCodes';
import { apiService } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../ui/Modal';
import { Select } from '../ui/Select';
import { ToastContainer } from '../ui/Toast';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const MODULE_OPTIONS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
const DEFAULT_MODULES = ['M1', 'M3', 'M4', 'M5'];
const STATE_OPTIONS = Object.values(STATE_BY_CODE).map((name) => ({ value: name, label: name }));

interface AddDealerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

type AutofillKey =
  | 'primaryContactName'
  | 'tradeName'
  | 'dealerName'
  | 'nameInBank'
  | 'selectedDealerDisplay'
  | 'dealerEmail';

type FormState = {
  clientName: string;
  primaryContactName: string;
  email: string;
  password: string;
  enabledModules: string[];
  products: string;
  commissionRate: string;
  status: string;
  clientKycRecord: string;
  dealerId: string;
  dealerContact: string;
  gstNumber: string;
  dealerPan: string;
  tradeName: string;
  dealerName: string;
  dealerEmail: string;
  kycVerified: boolean;
  kycVerifiedDate: string;
  notes: string;
  dealerAddress: string;
  dealerCity: string;
  dealerState: string;
  dealerPincode: string;
  dealerBankName: string;
  dealerAccountNumber: string;
  dealerIfscCode: string;
  nameInBank: string;
  selectedDealerDisplay: string;
};

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function emptyForm(): FormState {
  return {
    clientName: '',
    primaryContactName: '',
    email: '',
    password: '',
    enabledModules: [...DEFAULT_MODULES],
    products: '',
    commissionRate: '0',
    status: 'Active',
    clientKycRecord: '',
    dealerId: '',
    dealerContact: '',
    gstNumber: '',
    dealerPan: '',
    tradeName: '',
    dealerName: '',
    dealerEmail: '',
    kycVerified: true,
    kycVerifiedDate: todayIsoDate(),
    notes: '',
    dealerAddress: '',
    dealerCity: '',
    dealerState: '',
    dealerPincode: '',
    dealerBankName: '',
    dealerAccountNumber: '',
    dealerIfscCode: '',
    nameInBank: '',
    selectedDealerDisplay: '',
  };
}

function isPermissionError(error: string): boolean {
  const text = error.toLowerCase();
  return text.includes('insufficient permissions') || text.includes('forbidden') || text.includes('403');
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-sm font-semibold text-neutral-900">{children}</h3>;
}

export const AddDealerModal: React.FC<AddDealerModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [edited, setEdited] = useState<Partial<Record<AutofillKey, boolean>>>({});
  const [emailError, setEmailError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Array<{ productId: string; productName: string }>>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const assignedKam = user?.kamId || user?.id || '';

  const emailValid = EMAIL_PATTERN.test(form.email.trim());
  const nameValid = form.clientName.trim().length >= 2;
  const passwordValid = form.password.trim().length > 0;
  const contactValid = /^\d{10}$/.test(form.dealerContact);
  const gstValid = GSTIN_PATTERN.test(form.gstNumber.trim().toUpperCase());
  const panValid = PAN_PATTERN.test(form.dealerPan.trim().toUpperCase());
  const pincodeValid = /^\d{6}$/.test(form.dealerPincode);
  const ifscValid = IFSC_PATTERN.test(form.dealerIfscCode.trim().toUpperCase());
  const canSubmit =
    emailValid &&
    nameValid &&
    passwordValid &&
    contactValid &&
    gstValid &&
    panValid &&
    pincodeValid &&
    ifscValid &&
    !submitting;

  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(submitting);
  onCloseRef.current = onClose;
  submittingRef.current = submitting;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void apiService.listLoanProducts(true).then((response) => {
      if (cancelled || !response.success || !response.data) return;
      setProducts(
        response.data.map((product) => ({
          productId: product.productId,
          productName: product.productName || product.productId,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (form.products || products.length === 0) return;
    setForm((current) => ({ ...current, products: products[0].productId }));
  }, [form.products, products]);

  const pushToast = (type: ToastItem['type'], message: string) => {
    setToasts((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, message },
    ]);
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEdited({});
    setEmailError('');
    setShowPassword(false);
  };

  const handleClose = useCallback(() => {
    if (submittingRef.current) return;
    setForm(emptyForm());
    setEdited({});
    setEmailError('');
    setShowPassword(false);
    onCloseRef.current();
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const markEdited = (key: AutofillKey) => {
    setEdited((current) => ({ ...current, [key]: true }));
  };

  const handleClientName = (value: string) => {
    setForm((current) => ({
      ...current,
      clientName: value,
      primaryContactName: edited.primaryContactName ? current.primaryContactName : value,
      tradeName: edited.tradeName ? current.tradeName : value,
      dealerName: edited.dealerName ? current.dealerName : value,
      nameInBank: edited.nameInBank ? current.nameInBank : value,
      selectedDealerDisplay: edited.selectedDealerDisplay ? current.selectedDealerDisplay : value,
    }));
  };

  const handleEmail = (value: string) => {
    setForm((current) => ({
      ...current,
      email: value,
      dealerEmail: edited.dealerEmail ? current.dealerEmail : value,
    }));
    if (emailError) setEmailError('');
  };

  const toggleModule = (module: string) => {
    setForm((current) => {
      const selected = current.enabledModules.includes(module)
        ? current.enabledModules.filter((item) => item !== module)
        : [...current.enabledModules, module];
      return { ...current, enabledModules: selected };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setEmailError('');
    setSubmitting(true);
    try {
      const result = await apiService.createDealer({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        clientName: form.clientName.trim().toUpperCase(),
        primaryContactName: (form.primaryContactName || form.clientName).trim().toUpperCase(),
        dealerEmail: (form.dealerEmail || form.email).trim().toLowerCase(),
        enabledModules: form.enabledModules,
        products: form.products,
        commissionRate: form.commissionRate || '0',
        status: form.status || 'Active',
        clientKycRecord: form.clientKycRecord.trim(),
        dealerId: form.dealerId.trim(),
        dealerContact: form.dealerContact,
        gstNumber: form.gstNumber.trim().toUpperCase(),
        dealerPan: form.dealerPan.trim().toUpperCase(),
        tradeName: (form.tradeName || form.clientName).trim(),
        dealerName: (form.dealerName || form.clientName).trim(),
        kycVerified: form.kycVerified,
        kycVerifiedDate: form.kycVerifiedDate,
        notes: form.notes.trim(),
        dealerAddress: form.dealerAddress.trim(),
        dealerCity: form.dealerCity.trim(),
        dealerState: form.dealerState,
        dealerPincode: form.dealerPincode,
        dealerBankName: form.dealerBankName.trim(),
        dealerAccountNumber: form.dealerAccountNumber.trim(),
        dealerIfscCode: form.dealerIfscCode.trim().toUpperCase(),
        nameInBank: (form.nameInBank || form.clientName).trim(),
        selectedDealerDisplay: (form.selectedDealerDisplay || form.clientName).trim(),
      });

      if (result.success) {
        pushToast('success', 'Dealer added. They can log in with the password you set.');
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
      pushToast('error', message || 'Could not add dealer. Try again.');
    } catch {
      pushToast('error', 'Could not add dealer. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="xl" testId="add-dealer-modal">
        <form onSubmit={handleSubmit}>
          <ModalHeader onClose={handleClose}>Add Dealer</ModalHeader>
          <ModalBody className="space-y-4">
            <SectionTitle>Account and credentials</SectionTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Client Name"
                required
                aria-label="Client Name"
                value={form.clientName}
                autoComplete="off"
                onChange={(event) => handleClientName(event.target.value)}
              />
              <Input
                label="Primary Contact Name"
                aria-label="Primary Contact Name"
                value={form.primaryContactName}
                autoComplete="off"
                onChange={(event) => {
                  markEdited('primaryContactName');
                  setField('primaryContactName', event.target.value);
                }}
              />
              <Input
                label="Login Email"
                required
                type="email"
                aria-label="Login Email"
                value={form.email}
                autoComplete="off"
                error={emailError}
                onChange={(event) => handleEmail(event.target.value)}
              />
              <div className="relative">
                <Input
                  label="Password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  aria-label="Password"
                  value={form.password}
                  autoComplete="new-password"
                  className="pr-16"
                  onChange={(event) => setField('password', event.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-8 text-xs font-semibold text-neutral-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <Input label="Assigned KAM" aria-label="Assigned KAM" value={assignedKam} readOnly />
              <Input
                label="Commission Rate"
                type="number"
                aria-label="Commission Rate"
                value={form.commissionRate}
                min={0}
                step="0.01"
                onChange={(event) => setField('commissionRate', event.target.value)}
              />
              <Select
                label="Products"
                aria-label="Products"
                value={form.products}
                options={[
                  { value: '', label: 'Select a product' },
                  ...products.map((product) => ({
                    value: product.productId,
                    label: `${product.productId} — ${product.productName}`,
                  })),
                ]}
                onChange={(event) => setField('products', event.target.value)}
              />
              <Select
                label="Status"
                aria-label="Status"
                value={form.status}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' },
                ]}
                onChange={(event) => setField('status', event.target.value)}
              />
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-neutral-700">Enabled Modules</legend>
              <div className="flex flex-wrap gap-3">
                {MODULE_OPTIONS.map((module) => (
                  <label key={module} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={module}
                      checked={form.enabledModules.includes(module)}
                      onChange={() => toggleModule(module)}
                    />
                    {module}
                  </label>
                ))}
              </div>
            </fieldset>

            <SectionTitle>KYC and business</SectionTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Client KYC Record"
                aria-label="Client KYC Record"
                value={form.clientKycRecord}
                placeholder="Assigned on save"
                onChange={(event) => setField('clientKycRecord', event.target.value)}
              />
              <Input
                label="Dealer ID"
                aria-label="Dealer ID"
                value={form.dealerId}
                placeholder="Assigned on save"
                onChange={(event) => setField('dealerId', event.target.value)}
              />
              <Input
                label="Dealer Contact"
                required
                aria-label="Dealer Contact"
                inputMode="numeric"
                value={form.dealerContact}
                onChange={(event) =>
                  setField('dealerContact', event.target.value.replace(/\D/g, '').slice(0, 10))
                }
              />
              <Input
                label="GST Number"
                required
                aria-label="GST Number"
                value={form.gstNumber}
                onChange={(event) => setField('gstNumber', event.target.value.toUpperCase())}
              />
              <Input
                label="Dealer PAN"
                required
                aria-label="Dealer PAN"
                value={form.dealerPan}
                onChange={(event) => setField('dealerPan', event.target.value.toUpperCase())}
              />
              <Input
                label="Trade Name"
                aria-label="Trade Name"
                value={form.tradeName}
                onChange={(event) => {
                  markEdited('tradeName');
                  setField('tradeName', event.target.value);
                }}
              />
              <Input
                label="Dealer Name"
                aria-label="Dealer Name"
                value={form.dealerName}
                onChange={(event) => {
                  markEdited('dealerName');
                  setField('dealerName', event.target.value);
                }}
              />
              <Input
                label="Dealer Email"
                aria-label="Dealer Email"
                type="email"
                value={form.dealerEmail}
                onChange={(event) => {
                  markEdited('dealerEmail');
                  setField('dealerEmail', event.target.value);
                }}
              />
              <Input
                label="KYC Verified Date"
                type="date"
                aria-label="KYC Verified Date"
                value={form.kycVerifiedDate}
                onChange={(event) => setField('kycVerifiedDate', event.target.value)}
              />
              <label className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  aria-label="KYC Verified"
                  checked={form.kycVerified}
                  onChange={(event) => setField('kycVerified', event.target.checked)}
                />
                KYC Verified
              </label>
              <Input
                label="Name in Bank"
                aria-label="Name in Bank"
                value={form.nameInBank}
                onChange={(event) => {
                  markEdited('nameInBank');
                  setField('nameInBank', event.target.value);
                }}
              />
              <Input
                label="Selected Dealer Display"
                aria-label="Selected Dealer Display"
                value={form.selectedDealerDisplay}
                onChange={(event) => {
                  markEdited('selectedDealerDisplay');
                  setField('selectedDealerDisplay', event.target.value);
                }}
              />
            </div>
            <label className="block text-sm font-medium text-neutral-700">
              Notes
              <textarea
                aria-label="Notes"
                className="mt-1 min-h-20 w-full rounded border border-neutral-300 px-3 py-2 text-base"
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </label>

            <SectionTitle>Address</SectionTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Dealer Address"
                aria-label="Dealer Address"
                value={form.dealerAddress}
                onChange={(event) => setField('dealerAddress', event.target.value)}
              />
              <Input
                label="Dealer City"
                aria-label="Dealer City"
                value={form.dealerCity}
                onChange={(event) => setField('dealerCity', event.target.value)}
              />
              <Select
                label="Dealer State"
                aria-label="Dealer State"
                value={form.dealerState}
                options={[{ value: '', label: 'Select a state' }, ...STATE_OPTIONS]}
                onChange={(event) => setField('dealerState', event.target.value)}
              />
              <Input
                label="Dealer Pincode"
                required
                aria-label="Dealer Pincode"
                inputMode="numeric"
                value={form.dealerPincode}
                onChange={(event) =>
                  setField('dealerPincode', event.target.value.replace(/\D/g, '').slice(0, 6))
                }
              />
            </div>

            <SectionTitle>Bank</SectionTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Dealer Bank Name"
                aria-label="Dealer Bank Name"
                value={form.dealerBankName}
                onChange={(event) => setField('dealerBankName', event.target.value)}
              />
              <Input
                label="Dealer Account Number"
                aria-label="Dealer Account Number"
                value={form.dealerAccountNumber}
                onChange={(event) => setField('dealerAccountNumber', event.target.value)}
              />
              <Input
                label="Dealer IFSC Code"
                required
                aria-label="Dealer IFSC Code"
                value={form.dealerIfscCode}
                onChange={(event) => setField('dealerIfscCode', event.target.value.toUpperCase())}
              />
            </div>
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
