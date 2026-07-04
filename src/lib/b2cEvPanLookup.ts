import { isValidEmailFormat, parseIndianMobile } from '../utils/basicApplicationFieldsValidation';

const GENDER_VALUES = new Set(['Male', 'Female', 'Other']);

export const PAN_LOOKUP_TIMEOUT_SECONDS = 90;

export const PAN_LOOKUP_FIELD_KEYS = [
  '_meta.panLookup.mobileNumber',
  '_meta.panLookup.panNumber',
  '_meta.panLookup.fullName',
  '_meta.panLookup.borrowerEmail',
] as const;

export type PanLookupStatus = 'pending' | 'success' | 'failed';

export interface PanLookupWebhookOutput {
  first_name?: string;
  last_name?: string;
  customer_name?: string;
  gender?: string;
  date_of_birth?: string;
  father_name?: string;
  mobile_number?: string;
  email?: string;
  pan_card?: string;
  cibil_score?: string;
  'address Line 1'?: string;
  'address Line 2'?: string;
  'village/City'?: string;
  pincode?: string;
  district?: string;
  state?: string;
  [key: string]: string | undefined;
}

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/** Normalize keys so "address Line 1", "Address_Line_1", "addressline1" all match. */
export function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[\s_/\\-]+/g, '');
}

/**
 * Read first non-empty string from record using exact keys, then case/separator-insensitive match.
 */
export function readFirstStringFlexible(record: Record<string, unknown>, aliases: string[]): string {
  for (const key of aliases) {
    const value = readString(record[key]);
    if (value) return value;
  }

  const normalizedAliases = new Set(aliases.map(normalizeFieldKey));
  for (const [key, value] of Object.entries(record)) {
    if (!normalizedAliases.has(normalizeFieldKey(key))) continue;
    const trimmed = readString(value);
    if (trimmed) return trimmed;
  }

  return '';
}

export function convertDobToIsoDate(value: string): string {
  const trimmed = value.trim();
  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
}

export function normalizeWebhookMobile(value: string): string {
  const parsed = parseIndianMobile(value);
  return parsed.ok ? parsed.digits : '';
}

export function normalizeWebhookGender(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return GENDER_VALUES.has(normalized) ? normalized : '';
}

export function mapPanLookupOutputToFormDataPatch(
  output: PanLookupWebhookOutput
): Record<string, string> {
  const patch: Record<string, string> = {};
  const record = output as Record<string, unknown>;

  const firstName = readFirstStringFlexible(record, ['first_name', 'firstName', 'First_Name']);
  const lastName = readFirstStringFlexible(record, ['last_name', 'lastName', 'Last_Name']);
  const customerName = readFirstStringFlexible(record, [
    'customer_name',
    'customerName',
    'Customer_Name',
  ]);
  const gender = normalizeWebhookGender(
    readFirstStringFlexible(record, ['gender', 'Gender'])
  );
  const dob = convertDobToIsoDate(
    readFirstStringFlexible(record, ['date_of_birth', 'dateOfBirth', 'Date_Of_Birth', 'dob'])
  );
  const fatherName = readFirstStringFlexible(record, [
    'father_name',
    'fatherName',
    'Father_Name',
  ]);
  const mobile = normalizeWebhookMobile(
    readFirstStringFlexible(record, ['mobile_number', 'mobileNumber', 'Mobile_Number', 'mobile'])
  );
  const emailRaw = readFirstStringFlexible(record, ['email', 'Email', 'Email_Address']);
  const email = emailRaw && isValidEmailFormat(emailRaw) ? emailRaw : '';
  const pan = readFirstStringFlexible(record, ['pan_card', 'panCard', 'PAN_Card', 'pan']).toUpperCase();

  const addressLine1 = readFirstStringFlexible(record, [
    'address Line 1',
    'Address Line 1',
    'address_line_1',
    'address_line1',
    'addressline1',
    'address',
  ]);
  const addressLine2 = readFirstStringFlexible(record, [
    'address Line 2',
    'Address Line 2',
    'address_line_2',
    'address_line2',
    'addressline2',
  ]);
  const village = readFirstStringFlexible(record, [
    'village/City',
    'Village/City',
    'village_city',
    'village',
    'city',
  ]);
  const pincode = readFirstStringFlexible(record, ['pincode', 'pin_code', 'postal_code', 'Pincode']);
  const district = readFirstStringFlexible(record, ['district', 'District']);
  const state = readFirstStringFlexible(record, ['state', 'State']);

  if (firstName) patch['borrower.firstName'] = firstName;
  if (lastName) patch['borrower.lastName'] = lastName;
  if (customerName) patch['borrower.customerName'] = customerName;
  if (gender) patch['borrower.gender'] = gender;
  if (dob) patch['borrower.dob'] = dob;
  if (fatherName) patch['borrower.fatherName'] = fatherName;
  if (mobile) patch['borrower.mobile'] = mobile;
  if (email) patch['borrower.email'] = email;
  if (pan) patch['borrower.pan'] = pan;
  if (addressLine1) patch['borrower.address.line1'] = addressLine1;
  if (addressLine2) patch['borrower.address.line2'] = addressLine2;
  if (village) patch['borrower.address.village'] = village;
  if (pincode) patch['borrower.address.pincode'] = pincode;
  if (district) patch['borrower.address.district'] = district;
  if (state) patch['borrower.address.state'] = state;

  return patch;
}

export function buildPanLookupInputHash(formData: Record<string, unknown>): string {
  return PAN_LOOKUP_FIELD_KEYS.map((key) => readString(formData[key])).join('|');
}

export function clearBorrowerFields(formData: Record<string, unknown>): Record<string, unknown> {
  const next = { ...formData };
  for (const key of Object.keys(next)) {
    if (key.startsWith('borrower.')) {
      delete next[key];
    }
  }
  return next;
}

export function isPanLookupSuccessful(formData: Record<string, unknown>): boolean {
  return readString(formData['_meta.panLookup.status']) === 'success';
}

/** Migrate legacy draft key recipientEmail → borrowerEmail. */
export function migratePanLookupDraftFields(
  formData: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...formData };
  const borrowerEmail = readString(next['_meta.panLookup.borrowerEmail']);
  const legacyEmail = readString(next['_meta.panLookup.recipientEmail']);
  if (!borrowerEmail && legacyEmail) {
    next['_meta.panLookup.borrowerEmail'] = legacyEmail;
  }
  delete next['_meta.panLookup.recipientEmail'];
  return next;
}

export function getPanLookupPayload(formData: Record<string, unknown>): {
  mobileNumber: string;
  panNumber: string;
  fullName: string;
  borrowerEmail?: string;
} {
  const borrowerEmail =
    readString(formData['_meta.panLookup.borrowerEmail']) ||
    readString(formData['_meta.panLookup.recipientEmail']);
  return {
    mobileNumber: readString(formData['_meta.panLookup.mobileNumber']),
    panNumber: readString(formData['_meta.panLookup.panNumber']),
    fullName: readString(formData['_meta.panLookup.fullName']),
    ...(borrowerEmail ? { borrowerEmail } : {}),
  };
}

export function shouldRefetchPanLookup(
  formData: Record<string, unknown>,
  cachedHash: string | undefined
): boolean {
  if (!isPanLookupSuccessful(formData)) return true;
  return buildPanLookupInputHash(formData) !== (cachedHash ?? '');
}
