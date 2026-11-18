const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DealerOnboardingInput = {
  email: string;
  password: string;
  clientName: string;
  primaryContactName: string;
  dealerEmail: string;
  enabledModules: string;
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

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
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

export function parseDealerOnboardingBody(
  body: Record<string, unknown> | null | undefined
): { ok: true; value: DealerOnboardingInput } | { ok: false; error: string } {
  const source = body && typeof body === 'object' ? body : {};
  const email = (readString(source, 'email') || readString(source, 'username')).toLowerCase();
  const password = readString(source, 'password');
  const clientName = (readString(source, 'clientName') || readString(source, 'name')).toUpperCase();
  const primaryContactName = (
    readString(source, 'primaryContactName') || clientName
  ).toUpperCase();
  const dealerEmail = (readString(source, 'dealerEmail') || email).toLowerCase();
  const dealerContact = readString(source, 'dealerContact').replace(/\D/g, '');
  const gstNumber = readString(source, 'gstNumber').toUpperCase();
  const dealerPan = readString(source, 'dealerPan').toUpperCase();
  const dealerPincode = readString(source, 'dealerPincode');
  const dealerIfscCode = readString(source, 'dealerIfscCode').toUpperCase();
  const commissionRaw = source.commissionRate;
  const commissionRate =
    commissionRaw == null || commissionRaw === ''
      ? '0'
      : String(commissionRaw).trim();
  const status = readString(source, 'status') || 'Active';
  const kycVerified = source.kycVerified === false || source.kycVerified === 'false' ? false : true;
  const kycVerifiedDate = readString(source, 'kycVerifiedDate') || todayIsoDate();

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'A valid email is required' };
  }
  if (!password) {
    return { ok: false, error: 'Password is required' };
  }
  if (clientName.length < 2) {
    return { ok: false, error: 'Dealer name must be at least 2 characters' };
  }
  if (!/^\d{10}$/.test(dealerContact)) {
    return { ok: false, error: 'Dealer contact must be a 10-digit mobile number' };
  }
  if (!GSTIN_PATTERN.test(gstNumber)) {
    return { ok: false, error: 'GST number must be a 15-character GSTIN' };
  }
  if (!PAN_PATTERN.test(dealerPan)) {
    return { ok: false, error: 'Dealer PAN must be a 10-character PAN' };
  }
  if (!/^\d{6}$/.test(dealerPincode)) {
    return { ok: false, error: 'Dealer pincode must be 6 digits' };
  }
  if (!IFSC_PATTERN.test(dealerIfscCode)) {
    return { ok: false, error: 'Dealer IFSC code must be 11 characters' };
  }

  return {
    ok: true,
    value: {
      email,
      password,
      clientName,
      primaryContactName,
      dealerEmail,
      enabledModules: modulesToAirtable(source.enabledModules),
      products: readString(source, 'products') || readString(source, 'productId'),
      commissionRate,
      status,
      clientKycRecord: readString(source, 'clientKycRecord'),
      dealerId: readString(source, 'dealerId'),
      dealerContact,
      gstNumber,
      dealerPan,
      tradeName: readString(source, 'tradeName') || clientName,
      dealerName: readString(source, 'dealerName') || clientName,
      kycVerified,
      kycVerifiedDate,
      notes: readString(source, 'notes'),
      dealerAddress: readString(source, 'dealerAddress'),
      dealerCity: readString(source, 'dealerCity'),
      dealerState: readString(source, 'dealerState'),
      dealerPincode,
      dealerBankName: readString(source, 'dealerBankName'),
      dealerAccountNumber: readString(source, 'dealerAccountNumber'),
      dealerIfscCode,
      nameInBank: readString(source, 'nameInBank') || clientName,
      selectedDealerDisplay: readString(source, 'selectedDealerDisplay') || clientName,
    },
  };
}
