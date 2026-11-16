/**
 * Bureau Cache → wizard autofill.
 * Supports:
 * - Structured `applicant` JSON (qualify-shaped)
 * - Live n8n flat records (no `fields` wrapper) with Experian `raw_response`
 */

import {
  mapPanLookupOutputToFormDataPatch,
  splitFullNameForManualPrefill,
  type PanLookupFieldPrefix,
  type PanLookupWebhookOutput,
  hasMeaningfulBorrowerAutofill,
  hasMeaningfulSupportPersonAutofill,
} from './b2cEvPanLookup';
import { mapStateCodeToName } from './indiaStateCodes';

/** Minimal shape of `/engine/airtable_get` responses (avoids circular import with engineClient). */
export type BureauCacheAirtableResponse = {
  records?: Array<{ id?: string; fields?: Record<string, unknown> }>;
  id?: string;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
};

export const BUREAU_CACHE_TABLE = 'Bureau Cache';
export const BUREAU_CACHE_MISS_MESSAGE =
  'No cached bureau profile — enter details manually below.';

const RECORD_META_KEYS = new Set(['id', 'createdTime', 'fields']);

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function normalizePan(value: string): string {
  return value.replace(/\s+/g, '').replace(/-/g, '').trim().toUpperCase();
}

export function buildBureauCachePanFilter(pan: string): string {
  const normalized = normalizePan(pan).replace(/'/g, "\\'");
  return `{pan} = '${normalized}'`;
}

function parseApplicant(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function readApplicantString(applicant: Record<string, unknown>, aliases: string[]): string {
  for (const key of aliases) {
    const value = readString(applicant[key]);
    if (value) return value;
  }
  const normalized = new Set(aliases.map((a) => a.toLowerCase().replace(/[\s_/\\-]+/g, '')));
  for (const [key, value] of Object.entries(applicant)) {
    if (!normalized.has(key.toLowerCase().replace(/[\s_/\\-]+/g, ''))) continue;
    const trimmed = readString(value);
    if (trimmed) return trimmed;
  }
  return '';
}

function pickAddress(applicant: Record<string, unknown>): Record<string, unknown> | null {
  const addresses = applicant.addresses ?? applicant.Addresses ?? applicant.address;
  if (Array.isArray(addresses) && addresses.length > 0) {
    const first = addresses[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return first as Record<string, unknown>;
    }
    return null;
  }
  if (addresses && typeof addresses === 'object' && !Array.isArray(addresses)) {
    return addresses as Record<string, unknown>;
  }
  return null;
}

function readAddressString(address: Record<string, unknown>, aliases: string[]): string {
  return readApplicantString(address, aliases);
}

/** n8n often returns Airtable rows flattened (no `fields` object). */
export function normalizeBureauCacheRecordFields(
  record: BureauCacheRecord | null | undefined
): Record<string, unknown> | null {
  if (!record || typeof record !== 'object') return null;
  if (record.fields && typeof record.fields === 'object' && !Array.isArray(record.fields)) {
    return record.fields;
  }
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (RECORD_META_KEYS.has(key)) continue;
    flat[key] = value;
  }
  return Object.keys(flat).length > 0 ? flat : null;
}

function formatExperianDob(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return raw.trim();
}

function mapGenderCode(code: string): string {
  switch (code.trim()) {
    case '1':
      return 'Male';
    case '2':
      return 'Female';
    default:
      return code.trim();
  }
}

function mapStateCode(code: string): string {
  return mapStateCodeToName(code);
}

/**
 * Build a qualify-shaped applicant object from Experian `raw_response` dumps
 * stored on Bureau Cache rows.
 */
export function applicantFromBureauRawResponse(
  rawResponse: unknown
): Record<string, unknown> | null {
  const parsed =
    typeof rawResponse === 'string'
      ? (() => {
          try {
            return JSON.parse(rawResponse) as unknown;
          } catch {
            return null;
          }
        })()
      : rawResponse;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const root = parsed as Record<string, unknown>;
  const result =
    root.result && typeof root.result === 'object' && !Array.isArray(root.result)
      ? (root.result as Record<string, unknown>)
      : root;

  const creditReport =
    result.credit_report && typeof result.credit_report === 'object'
      ? (result.credit_report as Record<string, unknown>)
      : null;
  const currentApp =
    creditReport?.Current_Application && typeof creditReport.Current_Application === 'object'
      ? (creditReport.Current_Application as Record<string, unknown>)
      : null;
  const details =
    currentApp?.Current_Application_Details &&
    typeof currentApp.Current_Application_Details === 'object'
      ? (currentApp.Current_Application_Details as Record<string, unknown>)
      : null;
  const cad =
    details?.Current_Applicant_Details && typeof details.Current_Applicant_Details === 'object'
      ? (details.Current_Applicant_Details as Record<string, unknown>)
      : null;
  const addr =
    details?.Current_Applicant_Address_Details &&
    typeof details.Current_Applicant_Address_Details === 'object'
      ? (details.Current_Applicant_Address_Details as Record<string, unknown>)
      : null;

  const firstName = readString(cad?.First_Name);
  const lastName = readString(cad?.Last_Name);
  const fullName =
    readString(result.name) ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    firstName;
  const dobRaw = readString(cad?.Date_Of_Birth_Applicant);
  const genderCode = readString(cad?.Gender_Code);

  const line1 = addr
    ? [readString(addr.FlatNoPlotNoHouseNo), readString(addr.BldgNoSocietyName)]
        .filter(Boolean)
        .join(' ')
        .trim()
    : '';
  const line2 = addr ? readString(addr.RoadNoNameAreaLocality) : '';
  const city = addr ? readString(addr.City) || readString(addr.Landmark) : '';
  const pincode = addr ? readString(addr.PINCode) || readString(addr.PinCode) : '';
  const state = addr ? mapStateCode(readString(addr.State)) : '';

  const hasIdentity = Boolean(fullName || firstName || line1);
  if (!hasIdentity) return null;

  const applicant: Record<string, unknown> = {};
  if (fullName) applicant.name = fullName;
  if (firstName) applicant.first_name = firstName;
  if (lastName) applicant.last_name = lastName;
  if (dobRaw) applicant.dob = formatExperianDob(dobRaw);
  if (genderCode) applicant.gender = mapGenderCode(genderCode);
  if (readString(result.pan)) applicant.pan = normalizePan(readString(result.pan));
  if (readString(result.mobile)) applicant.mobile = readString(result.mobile);
  if (readString(result.credit_score)) applicant.score = readString(result.credit_score);
  if (line1 || line2 || city || pincode || state) {
    applicant.addresses = [
      {
        line1,
        line2,
        city,
        village: city,
        pincode,
        pin: pincode,
        district: city,
        state,
      },
    ];
  }
  return applicant;
}

/**
 * Normalize Bureau Cache fields into the flat profile shape expected by
 * mapPanLookupOutputToFormDataPatch.
 */
export function mapBureauCacheFieldsToProfile(
  fields: Record<string, unknown>
): PanLookupWebhookOutput | null {
  let applicant = parseApplicant(fields.applicant ?? fields.Applicant);
  if (!applicant) {
    applicant = applicantFromBureauRawResponse(
      fields.raw_response ?? fields.rawResponse ?? fields['Raw Response']
    );
  }
  if (!applicant) {
    const wrapped = parseApplicant(
      fields.result_json ?? fields.resultJson ?? fields['Result JSON']
    );
    const inner = wrapped ? parseApplicant(wrapped.applicant) : null;
    if (inner) {
      applicant = inner.score == null && wrapped?.score != null ? { ...inner, score: wrapped.score } : inner;
    } else if (wrapped && readApplicantString(wrapped, ['name', 'full_name', 'customer_name'])) {
      applicant = wrapped;
    }
  }
  if (!applicant) {
    // Last resort: top-level name/pan/mobile only (still better than a hard miss).
    const topName = readString(fields.name ?? fields.Name);
    if (!topName) return null;
    applicant = {
      name: topName,
      pan: fields.pan,
      mobile: fields.mobile,
      score: fields.score,
    };
  }

  const fullName = readApplicantString(applicant, [
    'name',
    'full_name',
    'fullName',
    'customer_name',
    'customerName',
  ]);
  let firstName = readApplicantString(applicant, ['first_name', 'firstName', 'First_Name']);
  let lastName = readApplicantString(applicant, ['last_name', 'lastName', 'Last_Name']);
  if ((!firstName || !lastName) && fullName) {
    const split = splitFullNameForManualPrefill(fullName);
    if (!firstName) firstName = split.firstName;
    if (!lastName) lastName = split.lastName;
  }
  const customerName = fullName || [firstName, lastName].filter(Boolean).join(' ').trim();

  const dob = readApplicantString(applicant, [
    'dob',
    'date_of_birth',
    'dateOfBirth',
    'Date_Of_Birth',
  ]);
  const gender = readApplicantString(applicant, ['gender', 'Gender']);
  const fatherName = readApplicantString(applicant, [
    'father_name',
    'fatherName',
    'Father_Name',
  ]);
  const email = readApplicantString(applicant, ['email', 'Email', 'Email_Address']);

  const address = pickAddress(applicant);
  const addressLine1 = address
    ? readAddressString(address, [
        'line1',
        'address_line_1',
        'addressLine1',
        'address Line 1',
        'Address Line 1',
        'address',
      ])
    : '';
  const addressLine2 = address
    ? readAddressString(address, [
        'line2',
        'address_line_2',
        'addressLine2',
        'address Line 2',
        'Address Line 2',
      ])
    : '';
  const village = address
    ? readAddressString(address, [
        'village',
        'city',
        'village/City',
        'Village/City',
        'village_city',
      ])
    : '';
  const pincode = address
    ? readAddressString(address, ['pincode', 'pin_code', 'postal_code', 'Pincode', 'pin'])
    : '';
  const district = address ? readAddressString(address, ['district', 'District']) : '';
  const state = address ? readAddressString(address, ['state', 'State']) : '';

  const hasIdentity = Boolean(customerName || firstName || addressLine1);
  if (!hasIdentity) return null;

  const pan =
    normalizePan(readString(fields.pan ?? fields.PAN ?? fields.Pan)) ||
    normalizePan(readApplicantString(applicant, ['pan', 'pan_card', 'panCard']));
  const mobile =
    readString(fields.mobile ?? fields.Mobile ?? fields.mobile_number) ||
    readApplicantString(applicant, ['mobile', 'mobile_number', 'mobileNumber']);
  const scoreRaw =
    fields.score ?? fields.Score ?? fields.cibil_score ?? applicant.score ?? applicant.credit_score;
  const score =
    scoreRaw == null || scoreRaw === ''
      ? ''
      : String(Number.isFinite(Number(scoreRaw)) ? Number.parseInt(String(scoreRaw), 10) : scoreRaw);

  const profile: PanLookupWebhookOutput = {};
  if (firstName) profile.first_name = firstName;
  if (lastName) profile.last_name = lastName;
  if (customerName) profile.customer_name = customerName;
  if (dob) profile.date_of_birth = dob;
  if (gender) profile.gender = gender;
  if (fatherName) profile.father_name = fatherName;
  if (email) profile.email = email;
  if (mobile) profile.mobile_number = mobile;
  if (pan) profile.pan_card = pan;
  if (score) profile.cibil_score = score;
  if (addressLine1) profile['address Line 1'] = addressLine1;
  if (addressLine2) profile['address Line 2'] = addressLine2;
  if (village) profile['village/City'] = village;
  if (pincode) profile.pincode = pincode;
  if (district) profile.district = district;
  if (state) profile.state = state;
  return profile;
}

export type BureauCacheRecord = {
  id?: string;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
};

export function mapBureauCacheRecordToFormDataPatch(
  record: BureauCacheRecord | null | undefined,
  prefix: PanLookupFieldPrefix = 'borrower'
): Record<string, string> | null {
  const fields = normalizeBureauCacheRecordFields(record);
  if (!fields) return null;
  const profile = mapBureauCacheFieldsToProfile(fields);
  if (!profile) return null;
  const patch = mapPanLookupOutputToFormDataPatch(profile, prefix);
  const meaningful =
    prefix === 'borrower'
      ? hasMeaningfulBorrowerAutofill(patch)
      : hasMeaningfulSupportPersonAutofill(patch, prefix);
  return meaningful ? patch : null;
}

export function pickBureauCacheRecord(
  response: BureauCacheAirtableResponse | null | undefined
): BureauCacheRecord | null {
  if (!response) return null;
  const records: BureauCacheRecord[] = Array.isArray(response.records)
    ? (response.records as BureauCacheRecord[])
    : response.id || response.fields
      ? [{ id: typeof response.id === 'string' ? response.id : undefined, fields: response.fields }]
      : [];

  for (const record of records) {
    if (mapBureauCacheRecordToFormDataPatch(record, 'borrower')) {
      return record;
    }
  }
  return null;
}
