import { airtableGet } from '../services/engineClient';

function normalizePan(pan: string): string {
  return pan.replace(/\s+/g, '').replace(/-/g, '').trim().toUpperCase();
}

export const BUREAU_CACHE_DAYS_DEFAULT = 30;

export type BureauGuardRole = 'borrower' | 'support';

export type BureauGuardEntry = {
  pan: string;
  mobile: string;
  calledAt: string;
};

export type BureauGuardWrite = BureauGuardEntry & {
  role: BureauGuardRole;
};

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readBureauGuardEntry(
  formData: Record<string, unknown> | undefined,
  role: BureauGuardRole
): BureauGuardEntry | null {
  const root = asRecord(formData?.['_meta.bureauGuard']);
  const entry = asRecord(root?.[role]);
  if (!entry) return null;
  const pan = normalizePan(readString(entry.pan));
  const mobile = readString(entry.mobile);
  const calledAt = readString(entry.calledAt);
  if (!pan || !mobile || !calledAt) return null;
  return { pan, mobile, calledAt };
}

/** True when pan and mobile match and calledAt is strictly younger than cacheDays. */
export function isBureauGuardFresh(
  entry: BureauGuardEntry | null,
  pan: string,
  mobile: string,
  now: Date,
  cacheDays: number
): boolean {
  if (!entry) return false;
  if (entry.pan !== normalizePan(pan)) return false;
  if (entry.mobile !== readString(mobile)) return false;
  const called = Date.parse(entry.calledAt);
  if (!Number.isFinite(called)) return false;
  const ageMs = now.getTime() - called;
  if (ageMs < 0) return false;
  const windowMs = cacheDays * 24 * 60 * 60 * 1000;
  return ageMs < windowMs;
}

export function applyBureauGuard(
  formData: Record<string, unknown>,
  write: BureauGuardWrite
): Record<string, unknown> {
  const current = asRecord(formData['_meta.bureauGuard']) ?? {};
  return {
    ...formData,
    '_meta.bureauGuard': {
      ...current,
      [write.role]: {
        pan: normalizePan(write.pan),
        mobile: readString(write.mobile),
        calledAt: write.calledAt,
      },
    },
  };
}

export async function loadBureauCacheDays(
  get: typeof airtableGet = airtableGet
): Promise<number> {
  try {
    const res = await get({
      table: 'Config',
      filter_formula: "{key} = 'bureau_cache_days'",
      max: 1,
    });
    const row = res.records?.[0] as Record<string, unknown> | undefined;
    const days = Number(row?.value ?? row?.Value);
    if (Number.isFinite(days) && days > 0) return days;
  } catch {
    // Config is optional. 30 days matches the bureau cache window.
  }
  return BUREAU_CACHE_DAYS_DEFAULT;
}
