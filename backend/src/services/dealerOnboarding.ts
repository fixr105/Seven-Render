const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[6-9][0-9]{9}$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLIENT_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const DEALER_MODULE_OPTIONS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] as const;

/** Names from the India state list used by the dealer form. */
export const INDIA_STATE_NAMES = [
  'Jammu and Kashmir',
  'Himachal Pradesh',
  'Punjab',
  'Chandigarh',
  'Uttarakhand',
  'Haryana',
  'Delhi',
  'Rajasthan',
  'Uttar Pradesh',
  'Bihar',
  'Sikkim',
  'Arunachal Pradesh',
  'Nagaland',
  'Manipur',
  'Mizoram',
  'Tripura',
  'Meghalaya',
  'Assam',
  'West Bengal',
  'Jharkhand',
  'Odisha',
  'Chhattisgarh',
  'Madhya Pradesh',
  'Gujarat',
  'Daman and Diu',
  'Dadra and Nagar Haveli',
  'Maharashtra',
  'Andhra Pradesh',
  'Karnataka',
  'Goa',
  'Lakshadweep',
  'Kerala',
  'Tamil Nadu',
  'Puducherry',
  'Andaman and Nicobar Islands',
  'Telangana',
] as const;

export type FieldError = { field: string; message: string };

export type DealerResume = {
  clientId: string;
  clientRecordId: string;
  kycRecordId: string;
};

export type DealerOnboardingInput = {
  email: string;
  password: string;
  clientName: string;
  primaryContactName: string;
  enabledModules: string;
  enabledModuleList: string[];
  products: string;
  commissionRate: number;
  status: string;
  tradeName: string;
  dealerName: string;
  dealerContact: string;
  gstNumber: string;
  dealerPan: string;
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
  resume: DealerResume;
};

export type ParseDealerOptions = {
  allowedProducts?: string[];
  now?: Date;
};

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function todayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function modulesToAirtable(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(', ');
  }
  return typeof value === 'string' ? value.trim() : '';
}

export function createClientId(now = Date.now()): string {
  let suffix = '';
  for (let index = 0; index < 10; index += 1) {
    suffix += CLIENT_ID_ALPHABET[Math.floor(Math.random() * CLIENT_ID_ALPHABET.length)];
  }
  return `USER-${now}-${suffix}`;
}

export function maskAccountNumber(account: string): string {
  const digits = account.replace(/\D/g, '');
  return digits.slice(-4);
}

export function maskPan(pan: string): string {
  const value = pan.trim().toUpperCase();
  if (!PAN_PATTERN.test(value)) return 'XXXXX';
  return `XXXXX${value.slice(5, 9)}X`;
}

export function nextSerialId(
  records: Array<Record<string, unknown>>,
  field: string,
  prefix: string
): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`, 'i');
  let max = 0;
  for (const record of records) {
    const raw = record[field];
    const value = typeof raw === 'string' ? raw.trim() : '';
    const match = value.match(pattern);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed)) max = Math.max(max, parsed);
  }
  return `${prefix}${max + 1}`;
}

export function readCreatedRecordId(result: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null;
    if (seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string' && record.id.startsWith('rec')) return record.id;
    for (const child of Object.values(record)) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(result);
}

export function airtableErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== 'object' || !('error' in result)) return null;
  const error = (result as { error?: unknown }).error;
  if (!error) return null;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return JSON.stringify(error);
}

function readModules(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function readResume(value: unknown): DealerResume {
  const resume = asRecord(value);
  return {
    clientId: readString(resume, 'clientId'),
    clientRecordId: readString(resume, 'clientRecordId'),
    kycRecordId: readString(resume, 'kycRecordId'),
  };
}

export function parseDealerOnboardingBody(
  body: Record<string, unknown> | null | undefined,
  options: ParseDealerOptions = {}
): { ok: true; value: DealerOnboardingInput } | { ok: false; errors: FieldError[] } {
  const source = asRecord(body);
  const kyc = Object.keys(asRecord(source.kyc)).length > 0 ? asRecord(source.kyc) : source;
  const now = options.now ?? new Date();
  const errors: FieldError[] = [];

  const email = (readString(source, 'email') || readString(source, 'username')).toLowerCase();
  const password = readString(source, 'password');
  const clientName = (readString(source, 'clientName') || readString(source, 'name')).toUpperCase();
  const primaryContactName = (
    readString(source, 'primaryContactName') || clientName
  ).toUpperCase();
  const tradeName = (readString(kyc, 'tradeName') || readString(source, 'tradeName') || clientName).toUpperCase();
  const dealerName = (readString(kyc, 'dealerName') || readString(source, 'dealerName') || clientName).toUpperCase();
  const nameInBank = (readString(kyc, 'nameInBank') || readString(source, 'nameInBank') || clientName).toUpperCase();
  const selectedDealerDisplay = (
    readString(kyc, 'selectedDealerDisplay') ||
    readString(source, 'selectedDealerDisplay') ||
    clientName
  ).toUpperCase();
  const dealerContact = readString(kyc, 'dealerContact') || readString(source, 'dealerContact');
  const gstNumber = (readString(kyc, 'gstNumber') || readString(source, 'gstNumber')).toUpperCase();
  const dealerPan = (readString(kyc, 'dealerPan') || readString(source, 'dealerPan')).toUpperCase();
  const dealerAddress = readString(kyc, 'address') || readString(source, 'dealerAddress');
  const dealerCity = readString(kyc, 'city') || readString(source, 'dealerCity');
  const dealerState = readString(kyc, 'state') || readString(source, 'dealerState');
  const dealerPincode = readString(kyc, 'pincode') || readString(source, 'dealerPincode');
  const dealerBankName = readString(kyc, 'bankName') || readString(source, 'dealerBankName');
  const dealerAccountNumber = readString(kyc, 'accountNumber') || readString(source, 'dealerAccountNumber');
  const dealerIfscCode = (readString(kyc, 'ifsc') || readString(source, 'dealerIfscCode')).toUpperCase();
  const notes = readString(kyc, 'notes') || readString(source, 'notes');
  const modules = readModules(source.enabledModules);
  const products = readString(source, 'products') || readString(source, 'productId');
  const status = readString(source, 'status') || 'Active';
  const kycVerified = kyc.kycVerified === false || kyc.kycVerified === 'false'
    || source.kycVerified === false || source.kycVerified === 'false'
    ? false
    : true;
  const kycVerifiedDate = readString(kyc, 'kycVerifiedDate') || readString(source, 'kycVerifiedDate') || (kycVerified ? todayIsoDate(now) : '');

  const commissionRaw = source.commissionRate;
  const commissionRate = commissionRaw == null || commissionRaw === ''
    ? 0
    : typeof commissionRaw === 'number'
      ? commissionRaw
      : Number(String(commissionRaw).trim());

  const push = (field: string, message: string) => {
    errors.push({ field, message });
  };

  if (clientName.length < 2) push('clientName', 'Client name must be at least 2 characters');
  if (primaryContactName.length < 2) push('primaryContactName', 'Primary contact name must be at least 2 characters');
  if (tradeName.length < 2) push('tradeName', 'Trade name must be at least 2 characters');
  if (dealerName.length < 2) push('dealerName', 'Dealer name must be at least 2 characters');
  if (nameInBank.length < 2) push('nameInBank', 'Name in bank must be at least 2 characters');
  if (!EMAIL_PATTERN.test(email)) push('email', 'A valid email is required');
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    push('password', 'Password must be 8 to 72 characters and include a letter and a digit');
  }
  if (modules.length === 0 || modules.some((module) => !DEALER_MODULE_OPTIONS.includes(module as typeof DEALER_MODULE_OPTIONS[number]))) {
    push('enabledModules', 'Choose at least one module from M1 to M7');
  }
  const allowed = options.allowedProducts;
  if (!products || (allowed && !allowed.includes(products))) {
    push('products', 'Choose a loan product');
  }
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    push('commissionRate', 'Commission rate must be a number from 0 to 100');
  }
  if (status !== 'Active') push('status', 'Status must be Active');
  if (!PHONE_PATTERN.test(dealerContact)) push('dealerContact', 'Dealer contact must be a 10-digit mobile number');
  if (!PAN_PATTERN.test(dealerPan)) push('dealerPan', 'Dealer PAN must be a 10-character PAN');
  if (gstNumber) {
    if (!GSTIN_PATTERN.test(gstNumber)) {
      push('gstNumber', 'GST number must be a 15-character GSTIN');
    } else if (gstNumber.slice(2, 12) !== dealerPan) {
      push('gstNumber', 'GST number does not match the dealer PAN');
    }
  }
  if (!dealerAddress) push('address', 'Dealer address is required');
  if (!dealerCity) push('city', 'Dealer city is required');
  if (!INDIA_STATE_NAMES.includes(dealerState as typeof INDIA_STATE_NAMES[number])) {
    push('state', 'Choose a dealer state');
  }
  if (!PINCODE_PATTERN.test(dealerPincode)) push('pincode', 'Dealer pincode must be 6 digits');
  if (!dealerBankName) push('bankName', 'Dealer bank name is required');
  if (!/^\d{9,18}$/.test(dealerAccountNumber)) {
    push('accountNumber', 'Dealer account number must be 9 to 18 digits');
  }
  if (!IFSC_PATTERN.test(dealerIfscCode)) push('ifsc', 'Dealer IFSC code must be 11 characters');
  if (kycVerified) {
    if (!DATE_PATTERN.test(kycVerifiedDate) || kycVerifiedDate > todayIsoDate(now)) {
      push('kycVerifiedDate', 'KYC verified date must be today or earlier');
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      email,
      password,
      clientName,
      primaryContactName,
      enabledModules: modules.join(', '),
      enabledModuleList: modules,
      products,
      commissionRate,
      status,
      tradeName,
      dealerName,
      dealerContact,
      gstNumber,
      dealerPan,
      kycVerified,
      kycVerifiedDate,
      notes,
      dealerAddress,
      dealerCity,
      dealerState,
      dealerPincode,
      dealerBankName,
      dealerAccountNumber,
      dealerIfscCode,
      nameInBank,
      selectedDealerDisplay,
      resume: readResume(source.resume),
    },
  };
}
