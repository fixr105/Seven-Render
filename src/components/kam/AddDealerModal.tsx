import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { STATE_BY_CODE } from '../../lib/indiaStateCodes';
import { apiService } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ToastContainer } from '../ui/Toast';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PHONE_PATTERN = /^[6-9][0-9]{9}$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const MODULE_OPTIONS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
const DEFAULT_MODULES = ['M1', 'M3', 'M4', 'M5'];
const STATE_OPTIONS = Object.values(STATE_BY_CODE).map((name) => ({ value: name, label: name }));
const STEP_TITLES = ['Account', 'Business and KYC', 'Address', 'Bank'];
const NAME_FIELDS = ['primaryContactName', 'tradeName', 'dealerName', 'nameInBank', 'selectedDealerDisplay'] as const;

type NameField = (typeof NAME_FIELDS)[number];
type Resume = { clientId: string; clientRecordId: string; kycRecordId: string };

interface AddDealerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

type FormState = {
  clientName: string;
  primaryContactName: string;
  email: string;
  password: string;
  enabledModules: string[];
  products: string;
  commissionRate: string;
  status: string;
  tradeName: string;
  dealerName: string;
  dealerContact: string;
  dealerPan: string;
  gstNumber: string;
  kycVerified: boolean;
  kycVerifiedDate: string;
  notes: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  bankName: string;
  accountNumber: string;
  accountConfirm: string;
  ifsc: string;
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
    tradeName: '',
    dealerName: '',
    dealerContact: '',
    dealerPan: '',
    gstNumber: '',
    kycVerified: true,
    kycVerifiedDate: todayIsoDate(),
    notes: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    bankName: '',
    accountNumber: '',
    accountConfirm: '',
    ifsc: '',
    nameInBank: '',
    selectedDealerDisplay: '',
  };
}

function nameError(value: string, label: string): string | null {
  return value.trim().length >= 2 ? null : `${label} must be at least 2 characters`;
}

function stepErrors(form: FormState, step: number): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 0) {
    const clientName = nameError(form.clientName, 'Client name');
    const contact = nameError(form.primaryContactName, 'Primary contact name');
    if (clientName) errors.clientName = clientName;
    if (contact) errors.primaryContactName = contact;
    if (!EMAIL_PATTERN.test(form.email.trim().toLowerCase())) errors.email = 'A valid email is required';
    if (form.password.length < 8 || form.password.length > 72 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      errors.password = 'Password must be 8 to 72 characters and include a letter and a digit';
    }
    if (form.enabledModules.length === 0) errors.enabledModules = 'Choose at least one module';
    if (!form.products) errors.products = 'Choose a loan product';
    const commission = Number(form.commissionRate);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      errors.commissionRate = 'Commission rate must be a number from 0 to 100';
    }
  }
  if (step === 1) {
    const trade = nameError(form.tradeName, 'Trade name');
    const dealer = nameError(form.dealerName, 'Dealer name');
    if (trade) errors.tradeName = trade;
    if (dealer) errors.dealerName = dealer;
    if (!PHONE_PATTERN.test(form.dealerContact)) errors.dealerContact = 'Dealer contact must be a 10-digit mobile number';
    if (!PAN_PATTERN.test(form.dealerPan.trim().toUpperCase())) errors.dealerPan = 'Dealer PAN must be a 10-character PAN';
    const gst = form.gstNumber.trim().toUpperCase();
    const pan = form.dealerPan.trim().toUpperCase();
    if (gst && (!GSTIN_PATTERN.test(gst) || gst.slice(2, 12) !== pan)) {
      errors.gstNumber = 'GST number does not match the dealer PAN';
    }
    if (form.kycVerified && (!/^\d{4}-\d{2}-\d{2}$/.test(form.kycVerifiedDate) || form.kycVerifiedDate > todayIsoDate())) {
      errors.kycVerifiedDate = 'KYC verified date must be today or earlier';
    }
  }
  if (step === 2) {
    if (!form.address.trim()) errors.address = 'Dealer address is required';
    if (!form.city.trim()) errors.city = 'Dealer city is required';
    if (!STATE_OPTIONS.some((option) => option.value === form.state)) errors.state = 'Choose a dealer state';
    if (!PINCODE_PATTERN.test(form.pincode)) errors.pincode = 'Dealer pincode must be 6 digits';
  }
  if (step === 3) {
    if (!form.bankName.trim()) errors.bankName = 'Dealer bank name is required';
    if (!/^\d{9,18}$/.test(form.accountNumber)) errors.accountNumber = 'Dealer account number must be 9 to 18 digits';
    if (form.accountNumber !== form.accountConfirm) errors.accountConfirm = 'Account numbers must match';
    if (!IFSC_PATTERN.test(form.ifsc.trim().toUpperCase())) errors.ifsc = 'Dealer IFSC code must be 11 characters';
    const bankName = nameError(form.nameInBank, 'Name in bank');
    if (bankName) errors.nameInBank = bankName;
  }
  return errors;
}

function stepForField(field: string): number {
  if (['tradeName', 'dealerName', 'dealerContact', 'dealerPan', 'gstNumber', 'kycVerifiedDate'].includes(field)) return 1;
  if (['address', 'city', 'state', 'pincode'].includes(field)) return 2;
  if (['bankName', 'accountNumber', 'ifsc', 'nameInBank'].includes(field)) return 3;
  return 0;
}

function isRawKamId(value: string, user: { id?: string | null; kamId?: string | null }): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed === user.id || trimmed === user.kamId) return true;
  return /^USER-/.test(trimmed);
}

export function assignedKamLabel(user: {
  role?: string;
  name?: string | null;
  associatedProfile?: string | null;
  id?: string | null;
  kamId?: string | null;
} | null): string {
  if (!user || user.role === 'admin') return 'Unassigned';
  const name = [user.name, user.associatedProfile]
    .map((value) => (value ?? '').trim())
    .find((value) => value && !isRawKamId(value, user));
  if (!name) return 'Unassigned';
  const kamId = (user.kamId ?? '').trim();
  return kamId ? `${name} (${kamId})` : name;
}

export const AddDealerModal: React.FC<AddDealerModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [edited, setEdited] = useState<Record<NameField, boolean>>({
    primaryContactName: false,
    tradeName: false,
    dealerName: false,
    nameInBank: false,
    selectedDealerDisplay: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Array<{ value: string; label: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resume, setResume] = useState<Resume | null>(null);
  const [stepFailure, setStepFailure] = useState<{ step: string; error: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    apiService.listLoanProducts(true).then((response) => {
      if (cancelled || !response.success || !response.data) return;
      const options = response.data.map((product) => ({
        value: product.productId,
        label: product.productName || product.productId,
      }));
      setProducts(options);
      setForm((current) => current.products ? current : { ...current, products: options[0]?.value || '' });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const currentErrors = useMemo(() => stepErrors(form, step), [form, step]);
  const canAdvance = Object.keys(currentErrors).length === 0;
  const assignedKam = assignedKamLabel(user);

  const setField = (field: keyof FormState, value: string | boolean | string[]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const onClientName = (value: string) => {
    setForm((current) => {
      const next = { ...current, clientName: value };
      for (const field of NAME_FIELDS) {
        if (!edited[field]) next[field] = value;
      }
      return next;
    });
  };

  const onNameField = (field: NameField, value: string) => {
    setEdited((current) => ({ ...current, [field]: true }));
    setField(field, value);
  };

  const showToast = (type: ToastItem['type'], message: string) => {
    setToasts((current) => [...current, { id: `${Date.now()}`, type, message }]);
  };

  const closeSheet = () => {
    setStep(0);
    setForm(emptyForm());
    setEdited({
      primaryContactName: false,
      tradeName: false,
      dealerName: false,
      nameInBank: false,
      selectedDealerDisplay: false,
    });
    setErrors({});
    setResume(null);
    setStepFailure(null);
    setShowPassword(false);
    setShowAccount(false);
    onClose();
  };

  const submit = async (nextResume: Resume | null) => {
    setSubmitting(true);
    setStepFailure(null);
    const response = await apiService.createDealer({
      clientName: form.clientName.trim().toUpperCase(),
      primaryContactName: form.primaryContactName.trim().toUpperCase(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      enabledModules: form.enabledModules,
      products: form.products,
      commissionRate: Number(form.commissionRate),
      status: 'Active',
      kyc: {
        tradeName: form.tradeName.trim().toUpperCase(),
        dealerName: form.dealerName.trim().toUpperCase(),
        dealerContact: form.dealerContact,
        gstNumber: form.gstNumber.trim().toUpperCase(),
        dealerPan: form.dealerPan.trim().toUpperCase(),
        kycVerified: form.kycVerified,
        kycVerifiedDate: form.kycVerified ? form.kycVerifiedDate : '',
        notes: form.notes,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode,
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber,
        ifsc: form.ifsc.trim().toUpperCase(),
        nameInBank: form.nameInBank.trim().toUpperCase(),
        selectedDealerDisplay: form.selectedDealerDisplay.trim().toUpperCase(),
      },
      ...(nextResume ? { resume: nextResume } : {}),
    });
    setSubmitting(false);

    if (response.success) {
      window.dispatchEvent(new CustomEvent('dealer-created'));
      showToast('success', 'Dealer created. Share the login email and password with the dealer.');
      closeSheet();
      return;
    }

    if (response.error_type === 'VALIDATION_ERROR' && response.errors?.length) {
      const mapped: Record<string, string> = {};
      response.errors.forEach((item) => {
        mapped[item.field] = item.message;
      });
      setErrors(mapped);
      setStep(Math.min(...response.errors.map((item) => stepForField(item.field))));
      return;
    }

    if (response.error_type === 'DUPLICATE_EMAIL') {
      setErrors({ email: response.error || 'A user with this email already exists' });
      setStep(0);
      return;
    }

    if (response.error_type === 'DUPLICATE_PAN') {
      setErrors({ dealerPan: response.error || 'A dealer with this PAN already exists' });
      setStep(1);
      return;
    }

    if (response.error_type === 'STEP_FAILED') {
      if (response.resume) setResume(response.resume);
      setStepFailure({
        step: response.step || '',
        error: response.error || 'The write did not finish',
      });
    }
  };

  const maskedAccount = form.accountNumber.length >= 4
    ? `••••${form.accountNumber.slice(-4)}`
    : '';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add dealer">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden bg-sf-surface text-sf-text">
            <div className="shrink-0 px-6 pt-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Add dealer</h2>
                <Button type="button" variant="tertiary" onClick={closeSheet}>Close</Button>
              </div>
              <ol className="mb-6 flex gap-4 text-sm">
                {STEP_TITLES.map((title, index) => (
                  <li key={title} className={index === step ? 'font-semibold text-sf-navy' : 'text-neutral-500'}>
                    {index + 1}. {title}
                  </li>
                ))}
              </ol>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {step === 0 && (
              <div className="grid max-w-3xl gap-4">
                <Input label="Client Name" aria-label="Client Name" required value={form.clientName} error={errors.clientName} onChange={(event) => onClientName(event.target.value)} onBlur={() => setErrors((current) => ({ ...current, ...stepErrors(form, 0) }))} />
                <Input label="Primary Contact Name" aria-label="Primary Contact Name" required value={form.primaryContactName} error={errors.primaryContactName} onChange={(event) => onNameField('primaryContactName', event.target.value)} />
                <Input label="Login Email" aria-label="Login Email" required type="email" value={form.email} error={errors.email} onChange={(event) => setField('email', event.target.value)} />
                <Input label="Password" aria-label="Password" required type={showPassword ? 'text' : 'password'} value={form.password} error={errors.password} helperText="8–72 characters, with a letter and a digit." onChange={(event) => setField('password', event.target.value)} />
                <Button type="button" variant="tertiary" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Hide password' : 'Show password'}</Button>
                <fieldset>
                  <legend className="mb-1 text-sm font-medium">Enabled Modules</legend>
                  <div className="flex flex-wrap gap-3">
                    {MODULE_OPTIONS.map((module) => (
                      <label key={module} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.enabledModules.includes(module)}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...form.enabledModules, module]
                              : form.enabledModules.filter((item) => item !== module);
                            setField('enabledModules', next);
                          }}
                        />
                        {module}
                      </label>
                    ))}
                  </div>
                  {errors.enabledModules && <p className="mt-1 text-sm text-error">{errors.enabledModules}</p>}
                </fieldset>
                <Select label="Products" aria-label="Products" required options={[{ value: '', label: 'Select a product' }, ...products]} value={form.products} error={errors.products} onChange={(event) => setField('products', event.target.value)} />
                <Input label="Commission Rate" aria-label="Commission Rate" required value={form.commissionRate} error={errors.commissionRate} onChange={(event) => setField('commissionRate', event.target.value)} />
                <Input label="Status" aria-label="Status" value="Active" readOnly />
                <Input label="Assigned KAM" aria-label="Assigned KAM" value={assignedKam} readOnly />
              </div>
            )}

            {step === 1 && (
              <div className="grid max-w-3xl gap-4">
                <Input label="Trade Name" aria-label="Trade Name" required value={form.tradeName} error={errors.tradeName} onChange={(event) => onNameField('tradeName', event.target.value)} />
                <Input label="Dealer Name" aria-label="Dealer Name" required value={form.dealerName} error={errors.dealerName} onChange={(event) => onNameField('dealerName', event.target.value)} />
                <Input label="Dealer Contact" aria-label="Dealer Contact" required value={form.dealerContact} error={errors.dealerContact} onChange={(event) => setField('dealerContact', event.target.value.replace(/\D/g, '').slice(0, 10))} />
                <Input label="Dealer PAN" aria-label="Dealer PAN" required value={form.dealerPan} error={errors.dealerPan} onChange={(event) => setField('dealerPan', event.target.value.toUpperCase())} />
                <Input label="GST Number" aria-label="GST Number" value={form.gstNumber} error={errors.gstNumber} onChange={(event) => setField('gstNumber', event.target.value.toUpperCase())} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.kycVerified} onChange={(event) => setField('kycVerified', event.target.checked)} />
                  KYC Verified
                </label>
                {form.kycVerified && (
                  <Input label="KYC Verified Date" aria-label="KYC Verified Date" type="date" value={form.kycVerifiedDate} error={errors.kycVerifiedDate} onChange={(event) => setField('kycVerifiedDate', event.target.value)} />
                )}
                <Input label="Notes" aria-label="Notes" value={form.notes} onChange={(event) => setField('notes', event.target.value)} />
              </div>
            )}

            {step === 2 && (
              <div className="grid max-w-3xl gap-4">
                <Input label="Dealer Address" aria-label="Dealer Address" required value={form.address} error={errors.address} onChange={(event) => setField('address', event.target.value)} />
                <Input label="Dealer City" aria-label="Dealer City" required value={form.city} error={errors.city} onChange={(event) => setField('city', event.target.value)} />
                <Select label="Dealer State" aria-label="Dealer State" required options={[{ value: '', label: 'Select a state' }, ...STATE_OPTIONS]} value={form.state} error={errors.state} onChange={(event) => setField('state', event.target.value)} />
                <Input label="Dealer Pincode" aria-label="Dealer Pincode" required value={form.pincode} error={errors.pincode} onChange={(event) => setField('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
            )}

            {step === 3 && (
              <div className="grid max-w-3xl gap-4">
                <Input label="Dealer Bank Name" aria-label="Dealer Bank Name" required value={form.bankName} error={errors.bankName} onChange={(event) => setField('bankName', event.target.value)} />
                <Input label="Dealer Account Number" aria-label="Dealer Account Number" required type={showAccount ? 'text' : 'password'} value={form.accountNumber} error={errors.accountNumber} onChange={(event) => setField('accountNumber', event.target.value.replace(/\D/g, '').slice(0, 18))} />
                <Input label="Confirm Account Number" aria-label="Confirm Account Number" required type={showAccount ? 'text' : 'password'} value={form.accountConfirm} error={errors.accountConfirm} onChange={(event) => setField('accountConfirm', event.target.value.replace(/\D/g, '').slice(0, 18))} />
                <Button type="button" variant="tertiary" onClick={() => setShowAccount((current) => !current)}>{showAccount ? 'Hide account number' : 'Show account number'}</Button>
                <Input label="Dealer IFSC" aria-label="Dealer IFSC" required value={form.ifsc} error={errors.ifsc} onChange={(event) => setField('ifsc', event.target.value.toUpperCase())} />
                <Input label="Name in Bank" aria-label="Name in Bank" required value={form.nameInBank} error={errors.nameInBank} onChange={(event) => onNameField('nameInBank', event.target.value)} />
                <section aria-label="Review" className="rounded border border-sf-border bg-sf-soft p-4 text-sm">
                  <h3 className="mb-2 font-semibold">Review</h3>
                  <p>Client: {form.clientName}</p>
                  <p>Email: {form.email}</p>
                  <p>Trade name: {form.tradeName}</p>
                  <p>PAN: {form.dealerPan}</p>
                  <p>Address: {form.address}, {form.city}, {form.state} {form.pincode}</p>
                  <p>Account: {maskedAccount}</p>
                  <p>IFSC: {form.ifsc}</p>
                  <p>Name in bank: {form.nameInBank}</p>
                </section>
              </div>
            )}

            {stepFailure && (
              <div className="mt-4 max-w-3xl text-sm" role="alert">
                <p>Could not finish creating the dealer (step {stepFailure.step}). Try again.</p>
                <p>{stepFailure.error}</p>
              </div>
            )}
            </div>

            <div className="flex shrink-0 gap-3 border-t border-sf-border px-6 py-4">
              {step > 0 && (
                <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)} disabled={submitting}>Back</Button>
              )}
              {step < 3 ? (
                <Button type="button" onClick={() => { setErrors(currentErrors); if (canAdvance) setStep((current) => current + 1); }} disabled={!canAdvance || submitting}>Next</Button>
              ) : (
                <Button type="button" onClick={() => { setErrors(currentErrors); if (canAdvance) void submit(resume); }} disabled={!canAdvance || submitting} loading={submitting}>Create dealer</Button>
              )}
              {stepFailure && (
                <Button type="button" variant="secondary" onClick={() => void submit(resume)} disabled={submitting}>Try again</Button>
              )}
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </>
  );
};
