import {
  ENGINE_BASE_ID,
  airtableGet,
  qualifyApplicant,
  type QualifyResponse,
} from '../services/engineClient';
import {
  isBureauGuardFresh,
  readBureauGuardEntry,
  BUREAU_CACHE_DAYS_DEFAULT,
  type BureauGuardRole,
  type BureauGuardWrite,
} from './bureauGuard';
import {
  BUREAU_CACHE_TABLE,
  buildBureauCachePanFilter,
  extractBureauAddresses,
  mapBureauCacheFieldsToProfile,
  normalizeBureauCacheRecordFields,
  pickBureauCacheRecord,
} from './bureauCacheLookup';
import { mapStateCodeToName } from './indiaStateCodes';
import { isOnlyNtcBankStatementRequired } from './postSubmitEngine/ntcBankStatementGate';
import { normalizeQualifyPayload } from './postSubmitEngine/qualifyResult';
import { collectHumanQualifyReasons } from './qualifyKillCodes';

export type BureauFillPrefix = 'borrower' | 'coApplicant' | 'guarantor';

export type BureauOutcomeStatus = 'pass' | 'fail' | 'ntc' | 'error';

export type BureauMetaBlock = {
  status: BureauOutcomeStatus;
  is_ntc: boolean;
  bureau_ref: string;
  cached: boolean;
  failed_codes: string[];
  checked_at: string;
  pan: string;
};

export type QualifyApplicantAddress = {
  line1?: string | null;
  line2?: string | null;
  line3?: string | null;
  city?: string | null;
  state_code?: string | null;
  pin?: string | null;
};

export type QualifyApplicant = {
  name?: string | null;
  dob?: string | null;
  pan?: string | null;
  mobile?: string | null;
  email?: string | null;
  gender?: string | null;
  addresses?: QualifyApplicantAddress[] | null;
};

export type BureauOutcome = {
  status: BureauOutcomeStatus;
  raw: QualifyResponse;
  formDataPatch: Record<string, string>;
  reasons: string[];
  addresses: QualifyApplicantAddress[];
  autofilledKeys: string[];
  meta: BureauMetaBlock;
  metaKey: '_meta.borrowerBureau' | '_meta.coApplicantBureau' | '_meta.guarantorBureau';
  reused?: boolean;
  emptyApplicant?: boolean;
  errorMessage?: string;
  /** Set only after a live qualify call. Persist with applyBureauGuard. */
  guardWrite?: BureauGuardWrite;
};

export type RunBureauAndFillInput = {
  prefix: BureauFillPrefix;
  fullName: string;
  mobile: string;
  pan: string;
  consent_bureau_at: string;
  application_id: string;
  requested_amount: number;
  /** Typed values kept on form even when applicant has different pan/mobile. */
  keepPan?: string;
  keepMobile?: string;
  /** When set and equal to current PAN|mobile, skip network and return previous outcome. */
  lastVerifiedKey?: string | null;
  previousOutcome?: BureauOutcome | null;
  /** Block if equal to borrower PAN (support person only). */
  borrowerPan?: string | null;
  /** Persisted `_meta.bureauGuard`. When fresh, qualify is not called. */
  formData?: Record<string, unknown>;
  now?: Date;
  /** Window from Config `bureau_cache_days`. Defaults to 30. */
  cacheDays?: number;
  /** Bureau Cache read. Injected in tests. Defaults to an Airtable lookup. */
  lookupBureauCache?: (pan: string) => Promise<QualifyResponse | null>;
};

function guardRoleForPrefix(prefix: BureauFillPrefix): BureauGuardRole {
  return prefix === 'borrower' ? 'borrower' : 'support';
}

async function defaultLookupBureauCache(pan: string): Promise<QualifyResponse | null> {
  const res = await airtableGet({
    table: BUREAU_CACHE_TABLE,
    filter_formula: buildBureauCachePanFilter(pan),
    max: 5,
  });
  const record = pickBureauCacheRecord(res);
  const fields = normalizeBureauCacheRecordFields(record);
  if (!fields) return null;
  const profile = mapBureauCacheFieldsToProfile(fields);
  if (!profile) return null;
  const extracted = extractBureauAddresses(fields);
  const addresses =
    extracted.length > 0
      ? extracted.map((address) => ({
          line1: address.line1,
          line2: address.line2,
          line3: address.line3,
          city: address.city,
          pin: address.pin,
          state_code: address.state_code,
        }))
      : [
          {
            line1: profile['address Line 1'],
            line2: profile['address Line 2'],
            city: profile['village/City'],
            pin: profile.pincode,
            state_code: profile.state,
          },
        ];
  return {
    ok: true,
    pass: true,
    cached: true,
    applicant: {
      name: profile.customer_name,
      dob: profile.date_of_birth,
      pan: profile.pan_card,
      mobile: profile.mobile_number,
      email: profile.email,
      gender: profile.gender,
      addresses,
    },
  };
}

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function isBlankOrEmptyToken(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim();
  if (!s) return true;
  return s.toLowerCase() === 'empty' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined';
}

export function buildBureauVerifyKey(pan: string, mobile: string): string {
  return `${normalizePan(pan)}|${readString(mobile)}`;
}

export function normalizePan(pan: string): string {
  return pan.replace(/\s+/g, '').replace(/-/g, '').trim().toUpperCase();
}

export function autoCapitalizeWords(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function isValidBureauMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(readString(mobile));
}

export function isValidBureauPan(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizePan(pan));
}

export function buildAddressLine(address: QualifyApplicantAddress | null | undefined): string {
  if (!address) return '';
  return [address.line1, address.line2, address.line3]
    .map((part) => (isBlankOrEmptyToken(part) ? '' : readString(part)))
    .filter(Boolean)
    .join(', ');
}

function metaKeyForPrefix(
  prefix: BureauFillPrefix
): '_meta.borrowerBureau' | '_meta.coApplicantBureau' | '_meta.guarantorBureau' {
  if (prefix === 'borrower') return '_meta.borrowerBureau';
  if (prefix === 'guarantor') return '_meta.guarantorBureau';
  return '_meta.coApplicantBureau';
}

function readFailedCodes(failed: unknown[]): string[] {
  const codes: string[] = [];
  for (const item of failed) {
    if (!item || typeof item !== 'object') continue;
    const code = (item as { rejection_code?: unknown }).rejection_code;
    if (typeof code === 'string' && code.trim()) codes.push(code.trim());
  }
  return codes;
}

function isNtcOnly(failed: unknown[]): boolean {
  return isOnlyNtcBankStatementRequired({ failed });
}

function asApplicant(raw: unknown): QualifyApplicant | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as QualifyApplicant;
}

function applicantHasAnyDetail(applicant: QualifyApplicant): boolean {
  if (!isBlankOrEmptyToken(applicant.name)) return true;
  if (!isBlankOrEmptyToken(applicant.dob)) return true;
  if (!isBlankOrEmptyToken(applicant.email)) return true;
  if (!isBlankOrEmptyToken(applicant.gender)) return true;
  const addresses = Array.isArray(applicant.addresses) ? applicant.addresses : [];
  return addresses.some((addr) => Boolean(buildAddressLine(addr) || readString(addr?.pin)));
}

/**
 * Map qualify `applicant` into form keys for the given prefix.
 * Keeps dealer-typed PAN/mobile. Never writes null / "empty".
 */
export function mapQualifyApplicantToFormPatch(
  prefix: BureauFillPrefix,
  applicant: QualifyApplicant | null | undefined,
  options: { keepPan: string; keepMobile: string; addressIndex?: number }
): { patch: Record<string, string>; autofilledKeys: string[]; addresses: QualifyApplicantAddress[] } {
  const patch: Record<string, string> = {};
  const autofilledKeys: string[] = [];
  const addresses = Array.isArray(applicant?.addresses)
    ? applicant!.addresses!.filter((a): a is QualifyApplicantAddress => !!a && typeof a === 'object')
    : [];

  const setIfPresent = (key: string, value: unknown) => {
    if (isBlankOrEmptyToken(value)) return;
    patch[key] = readString(value);
    autofilledKeys.push(key);
  };

  // Always keep what the dealer typed for pan/mobile.
  if (options.keepPan) patch[`${prefix}.pan`] = normalizePan(options.keepPan);
  if (options.keepMobile) patch[`${prefix}.mobile`] = readString(options.keepMobile);

  if (!applicant) {
    return { patch, autofilledKeys, addresses };
  }

  if (prefix === 'borrower') {
    const fullName = readString(applicant.name);
    if (fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      const first = parts[0] || '';
      const last = parts.slice(1).join(' ');
      if (first) {
        patch['borrower.firstName'] = first;
        autofilledKeys.push('borrower.firstName');
      }
      if (last) {
        patch['borrower.lastName'] = last;
        autofilledKeys.push('borrower.lastName');
      }
      patch['borrower.customerName'] = fullName;
      autofilledKeys.push('borrower.customerName');
    }
  } else {
    setIfPresent(`${prefix}.name`, applicant.name);
  }

  setIfPresent(`${prefix}.dob`, applicant.dob);
  setIfPresent(`${prefix}.email`, applicant.email);
  setIfPresent(`${prefix}.gender`, applicant.gender);

  const idx = Math.max(0, options.addressIndex ?? 0);
  const address = addresses[idx];
  if (address) {
    const line = buildAddressLine(address);
    if (line) {
      patch[`${prefix}.address.line1`] = line;
      autofilledKeys.push(`${prefix}.address.line1`);
    }
    setIfPresent(`${prefix}.address.village`, address.city);
    setIfPresent(`${prefix}.address.pincode`, address.pin);
    const stateName = mapStateCodeToName(readString(address.state_code));
    if (stateName) {
      patch[`${prefix}.address.state`] = stateName;
      autofilledKeys.push(`${prefix}.address.state`);
    }
  }

  return { patch, autofilledKeys, addresses };
}

export function applyAddressIndexToPatch(
  prefix: BureauFillPrefix,
  addresses: QualifyApplicantAddress[],
  addressIndex: number,
  basePatch: Record<string, string>
): Record<string, string> {
  const next = { ...basePatch };
  delete next[`${prefix}.address.line1`];
  delete next[`${prefix}.address.village`];
  delete next[`${prefix}.address.pincode`];
  delete next[`${prefix}.address.state`];
  const address = addresses[addressIndex];
  if (!address) return next;
  const line = buildAddressLine(address);
  if (line) next[`${prefix}.address.line1`] = line;
  if (!isBlankOrEmptyToken(address.city)) next[`${prefix}.address.village`] = readString(address.city);
  if (!isBlankOrEmptyToken(address.pin)) next[`${prefix}.address.pincode`] = readString(address.pin);
  const stateName = mapStateCodeToName(readString(address.state_code));
  if (stateName) next[`${prefix}.address.state`] = stateName;
  return next;
}

function buildMeta(
  status: BureauOutcomeStatus,
  raw: QualifyResponse,
  pan: string
): BureauMetaBlock {
  const failed = Array.isArray(raw.failed) ? raw.failed : [];
  return {
    status,
    is_ntc: Boolean(raw.is_ntc) || status === 'ntc',
    bureau_ref: typeof raw.bureau_ref === 'string' ? raw.bureau_ref : '',
    cached: Boolean(raw.cached),
    failed_codes: readFailedCodes(failed),
    checked_at: new Date().toISOString(),
    pan: normalizePan(pan),
  };
}

/**
 * Merge bureau meta into form_data without wiping other `_meta.*` keys.
 * Meta is stored as flat keys matching the rest of the wizard form_data style
 * under `_meta.coApplicantBureau.*` etc., plus a JSON blob for Airtable round-trip.
 */
export function mergeBureauMetaIntoFormData(
  formData: Record<string, unknown>,
  metaKey: BureauOutcome['metaKey'],
  meta: BureauMetaBlock
): Record<string, unknown> {
  return {
    ...formData,
    [metaKey]: JSON.stringify(meta),
    [`${metaKey}.status`]: meta.status,
    [`${metaKey}.is_ntc`]: meta.is_ntc ? 'true' : 'false',
    [`${metaKey}.bureau_ref`]: meta.bureau_ref,
    [`${metaKey}.cached`]: meta.cached ? 'true' : 'false',
    [`${metaKey}.failed_codes`]: meta.failed_codes.join(','),
    [`${metaKey}.checked_at`]: meta.checked_at,
    [`${metaKey}.pan`]: meta.pan,
  };
}

export function readBureauMetaFromFormData(
  formData: Record<string, unknown>,
  metaKey: BureauOutcome['metaKey']
): BureauMetaBlock | null {
  const blob = formData[metaKey];
  if (typeof blob === 'string' && blob.trim()) {
    try {
      return JSON.parse(blob) as BureauMetaBlock;
    } catch {
      // fall through to flat keys
    }
  }
  const status = readString(formData[`${metaKey}.status`]) as BureauOutcomeStatus;
  if (!status) return null;
  return {
    status,
    is_ntc: readString(formData[`${metaKey}.is_ntc`]) === 'true',
    bureau_ref: readString(formData[`${metaKey}.bureau_ref`]),
    cached: readString(formData[`${metaKey}.cached`]) === 'true',
    failed_codes: readString(formData[`${metaKey}.failed_codes`])
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    checked_at: readString(formData[`${metaKey}.checked_at`]),
    pan: readString(formData[`${metaKey}.pan`]),
  };
}

function classifyOutcome(raw: QualifyResponse): BureauOutcomeStatus {
  if (raw.ok === false) return 'error';
  if (raw.pass === true) return 'pass';
  const failed = Array.isArray(raw.failed) ? raw.failed : [];
  if (isNtcOnly(failed)) return 'ntc';
  if (raw.ok === true && raw.pass === false) return 'fail';
  if (raw.ok == null && raw.pass == null) return 'error';
  return 'fail';
}

function isEngineErrorShape(raw: QualifyResponse): boolean {
  if (raw.ok === false) return true;
  if (typeof raw.state === 'string' && /ERROR/i.test(raw.state)) return true;
  if (raw.ok == null && raw.pass == null && !raw.applicant) return true;
  return false;
}

/**
 * Shared bureau pipeline for borrower / co-applicant / guarantor.
 * Calls `/engine/qualify` only — never reads Bureau Cache from the client.
 */
export async function runBureauAndFill(input: RunBureauAndFillInput): Promise<BureauOutcome> {
  const pan = normalizePan(input.pan);
  const mobile = readString(input.mobile);
  const fullName = readString(input.fullName);
  const keepPan = normalizePan(input.keepPan || pan);
  const keepMobile = readString(input.keepMobile || mobile);
  const verifyKey = buildBureauVerifyKey(pan, mobile);
  const metaKey = metaKeyForPrefix(input.prefix);

  if (input.borrowerPan) {
    const borrowerPan = normalizePan(input.borrowerPan);
    if (borrowerPan && borrowerPan === pan) {
      const emptyRaw = { ok: false, state: 'INPUT_ERROR' } as QualifyResponse;
      return {
        status: 'error',
        raw: emptyRaw,
        formDataPatch: {},
        reasons: ['Co-applicant cannot be the same person as the borrower'],
        addresses: [],
        autofilledKeys: [],
        meta: buildMeta('error', emptyRaw, pan),
        metaKey,
        errorMessage: 'Co-applicant cannot be the same person as the borrower',
      };
    }
  }

  // Reuse only successful prior outcomes — never cache network/engine errors
  // (retry must hit the network again).
  if (
    input.lastVerifiedKey &&
    input.lastVerifiedKey === verifyKey &&
    input.previousOutcome &&
    input.previousOutcome.status !== 'error'
  ) {
    return { ...input.previousOutcome, reused: true };
  }

  const now = input.now ?? new Date();
  const cacheDays = input.cacheDays ?? BUREAU_CACHE_DAYS_DEFAULT;
  const guardRole = guardRoleForPrefix(input.prefix);
  const guardFresh = isBureauGuardFresh(
    readBureauGuardEntry(input.formData, guardRole),
    pan,
    mobile,
    now,
    cacheDays
  );

  let raw: QualifyResponse;
  let fromCache = false;
  if (guardFresh) {
    const lookup = input.lookupBureauCache ?? defaultLookupBureauCache;
    try {
      const cached = await lookup(pan);
      if (!cached) {
        const emptyRaw = { ok: false, state: 'CACHE_MISS', cached: true } as QualifyResponse;
        return {
          status: 'error',
          raw: emptyRaw,
          formDataPatch: {},
          reasons: ['No cached bureau profile — enter details manually below.'],
          addresses: [],
          autofilledKeys: [],
          meta: buildMeta('error', emptyRaw, pan),
          metaKey,
          errorMessage: 'No cached bureau profile — enter details manually below.',
        };
      }
      raw = cached;
      fromCache = true;
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Could not verify right now.';
      const emptyRaw = { ok: false, state: 'BUREAU_ERROR', error: message } as QualifyResponse;
      return {
        status: 'error',
        raw: emptyRaw,
        formDataPatch: {},
        reasons: [message],
        addresses: [],
        autofilledKeys: [],
        meta: buildMeta('error', emptyRaw, pan),
        metaKey,
        errorMessage: 'Could not verify right now.',
      };
    }
  } else {
    try {
      raw = await qualifyApplicant({
        Full_Name: fullName,
        Mobile_Number: mobile,
        PAN_Number: pan,
        consent_bureau_at: input.consent_bureau_at,
        application_id: input.application_id || '',
        requested_amount: Number.isFinite(input.requested_amount) ? input.requested_amount : 0,
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not verify right now.';
      const emptyRaw = { ok: false, state: 'BUREAU_ERROR', error: message } as QualifyResponse;
      return {
        status: 'error',
        raw: emptyRaw,
        formDataPatch: {},
        reasons: [message],
        addresses: [],
        autofilledKeys: [],
        meta: buildMeta('error', emptyRaw, pan),
        metaKey,
        errorMessage: 'Could not verify right now.',
      };
    }
  }

  raw = normalizeQualifyPayload(raw) as QualifyResponse;

  if (isEngineErrorShape(raw)) {
    return {
      status: 'error',
      raw,
      formDataPatch: {},
      reasons: ['Could not verify right now.'],
      addresses: [],
      autofilledKeys: [],
      meta: buildMeta('error', raw, pan),
      metaKey,
      errorMessage: 'Could not verify right now.',
    };
  }

  const status = classifyOutcome(raw);
  const applicant = asApplicant(raw.applicant);
  const emptyApplicant = !applicant || !applicantHasAnyDetail(applicant);
  const { patch, autofilledKeys, addresses } = mapQualifyApplicantToFormPatch(
    input.prefix,
    emptyApplicant ? null : applicant,
    { keepPan, keepMobile }
  );

  const reasons =
    status === 'fail' || status === 'ntc' ? collectHumanQualifyReasons(raw) : [];

  const guardWrite: BureauGuardWrite | undefined = fromCache
    ? undefined
    : {
        role: guardRole,
        pan,
        mobile,
        calledAt: now.toISOString(),
      };

  return {
    status,
    raw,
    formDataPatch: patch,
    reasons,
    addresses,
    autofilledKeys,
    meta: buildMeta(status, raw, pan),
    metaKey,
    emptyApplicant,
    reused: fromCache ? true : undefined,
    guardWrite,
  };
}

/** Build the exact qualify POST body used by support + post-submit co_qualify. */
export function buildSupportQualifyPayload(input: {
  fullName: string;
  mobile: string;
  pan: string;
  consent_bureau_at: string;
  application_id: string;
  requested_amount: number;
}): Record<string, unknown> {
  return {
    base_id: ENGINE_BASE_ID,
    Full_Name: readString(input.fullName),
    Mobile_Number: readString(input.mobile),
    PAN_Number: normalizePan(input.pan),
    consent_bureau_at: input.consent_bureau_at,
    application_id: input.application_id || '',
    requested_amount: Number.isFinite(input.requested_amount) ? input.requested_amount : 0,
  };
}
