import { isValidEmailFormat, parseIndianMobile } from '../../utils/basicApplicationFields.validation.js';

const GENDER_VALUES = new Set(['Male', 'Female', 'Other']);

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

const PROFILE_KEYS = [
  'first_name',
  'last_name',
  'customer_name',
  'gender',
  'date_of_birth',
  'father_name',
  'mobile_number',
  'email',
  'pan_card',
  'address Line 1',
  'village/City',
  'pincode',
  'district',
  'state',
] as const;

function objectHasProfileKeys(obj: Record<string, unknown>): boolean {
  const hasProfileKey = PROFILE_KEYS.some((key) => key in obj);
  const hasNormalizedAddress = Object.keys(obj).some((key) => {
    const n = normalizeFieldKey(key);
    return (
      n === 'addressline1' ||
      n === 'villagecity' ||
      n === 'pincode' ||
      n === 'district' ||
      n === 'state' ||
      n === 'firstname' ||
      n === 'pancard'
    );
  });
  return hasProfileKey || hasNormalizedAddress;
}

/** Attempt to parse a JSON string; returns undefined when not JSON-like or invalid. */
function tryParseJsonString(value: string): unknown | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"'))) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

export function parseWebhookOutput(payload: unknown): PanLookupWebhookOutput | null {
  if (payload == null) return null;

  const visit = (value: unknown): PanLookupWebhookOutput | null => {
    if (value == null) return null;

    if (typeof value === 'string') {
      const parsed = tryParseJsonString(value);
      return parsed === undefined ? null : visit(parsed);
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      if ('output' in obj) {
        const outputVal = obj.output;
        if (typeof outputVal === 'string') {
          const fromString = visit(outputVal);
          if (fromString) return fromString;
        } else if (outputVal != null && typeof outputVal === 'object') {
          if (!Array.isArray(outputVal) && objectHasProfileKeys(outputVal as Record<string, unknown>)) {
            return outputVal as PanLookupWebhookOutput;
          }
          const nestedOutput = visit(outputVal);
          if (nestedOutput) return nestedOutput;
        }
      }

      if (objectHasProfileKeys(obj)) {
        return obj as PanLookupWebhookOutput;
      }

      for (const nested of [obj.json, obj.data, obj.body]) {
        const found = visit(nested);
        if (found) return found;
      }
    }

    return null;
  };

  return visit(payload);
}

/** Non-PII summary of webhook JSON shape for EMPTY_RESPONSE diagnostics. */
export function describeWebhookResponseShape(parsed: unknown): string {
  if (parsed === null) return 'null';
  if (Array.isArray(parsed)) return `array(len=${parsed.length})`;
  const t = typeof parsed;
  if (t === 'string') return `string(len=${String(parsed).length})`;
  if (t === 'object') {
    const keys = Object.keys(parsed as Record<string, unknown>).slice(0, 8).join(',');
    return `object(keys=${keys || 'none'})`;
  }
  return t;
}

export function convertDobToIsoDate(value: string): string {
  const trimmed = value.trim();
  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  // DD-MM-YYYY with hyphens (live n8n format); must run before ISO check is unnecessary
  // because ISO is YYYY-MM-DD and does not match this pattern.
  const hyphenMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (hyphenMatch) {
    const [, dd, mm, yyyy] = hyphenMatch;
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
  const normalized =
    trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return GENDER_VALUES.has(normalized) ? normalized : '';
}

export type PanLookupFieldPrefix = 'borrower' | 'coApplicant' | 'guarantor';

export function parsePanLookupTarget(value: unknown): PanLookupFieldPrefix {
  const normalized = String(value ?? '').trim();
  if (normalized === 'coApplicant' || normalized === 'guarantor') return normalized;
  return 'borrower';
}

export function mapPanLookupOutputToFormDataPatch(
  output: PanLookupWebhookOutput,
  prefix: PanLookupFieldPrefix = 'borrower'
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

  if (prefix === 'borrower') {
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
    return { ...patch, ...mapCibilScoreToMetaPatch(extractCibilScore(record)) };
  }

  const displayName =
    customerName || [firstName, lastName].filter(Boolean).join(' ').trim();
  if (displayName) patch[`${prefix}.name`] = displayName;
  if (dob) patch[`${prefix}.dob`] = dob;
  if (email) patch[`${prefix}.email`] = email;
  if (pan) patch[`${prefix}.pan`] = pan;
  if (mobile) patch[`${prefix}.mobile`] = mobile;
  if (addressLine1) patch[`${prefix}.address.line1`] = addressLine1;
  if (addressLine2) patch[`${prefix}.address.line2`] = addressLine2;
  if (village) patch[`${prefix}.address.village`] = village;
  if (pincode) patch[`${prefix}.address.pincode`] = pincode;
  if (district) patch[`${prefix}.address.district`] = district;
  if (state) patch[`${prefix}.address.state`] = state;

  return patch;
}

export function hasBorrowerPatchData(patch: Record<string, string>): boolean {
  return Boolean(
    patch['borrower.firstName']?.trim() ||
      patch['borrower.customerName']?.trim() ||
      patch['borrower.address.line1']?.trim()
  );
}

export function hasSupportPersonPatchData(
  patch: Record<string, string>,
  prefix: 'coApplicant' | 'guarantor'
): boolean {
  return Boolean(
    patch[`${prefix}.name`]?.trim() || patch[`${prefix}.address.line1`]?.trim()
  );
}

export function extractCibilScore(record: Record<string, unknown>): string {
  return readFirstStringFlexible(record, [
    'cibil_score',
    'cibilScore',
    'CIBIL_Score',
    'CIBIL Score',
    'cibil',
  ]);
}

export function mapCibilScoreToMetaPatch(score: string): Record<string, string> {
  const trimmed = score.trim();
  if (!trimmed) return {};
  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric) || numeric < 0) return {};
  return { '_meta.panLookup.cibilScore': String(numeric) };
}
