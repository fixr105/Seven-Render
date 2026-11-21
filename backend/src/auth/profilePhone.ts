/**
 * Phone shown on the session user.
 * User Accounts usually has no phone. The role profile table does.
 */

export const EMPTY_PHONE = '—';

export function readField(record: unknown, ...names: string[]): unknown {
  if (!record || typeof record !== 'object') return undefined;
  const sources: Record<string, unknown>[] = [record as Record<string, unknown>];
  const nested = (record as { fields?: unknown }).fields;
  if (nested && typeof nested === 'object') sources.push(nested as Record<string, unknown>);
  for (const source of sources) {
    for (const name of names) {
      const value = source[name];
      if (value != null && value !== '') return value;
    }
  }
  return undefined;
}

export function idValues(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap((item) => idValues(item));
  return [String(value).trim()].filter(Boolean);
}

export function sameId(left: unknown, right: unknown): boolean {
  const wanted = new Set(idValues(left).map((value) => value.toLowerCase()));
  if (wanted.size === 0) return false;
  return idValues(right).some((value) => wanted.has(value.toLowerCase()));
}

/** Indian mobile as +91 XXXXX XXXXX, or null when the text has none. */
export function formatIndianMobile(raw: unknown): string | null {
  if (raw == null) return null;
  const text = Array.isArray(raw) ? raw.map((part) => String(part)).join(' ') : String(raw);
  const match = text.match(/(?:\+?91|0)?[\s-]*([6-9](?:[\s-]*\d){9})(?!\d)/);
  if (!match) return null;
  const digits = match[1].replace(/\D/g, '');
  if (digits.length !== 10) return null;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function displayPhone(raw: unknown): string {
  return formatIndianMobile(raw) ?? EMPTY_PHONE;
}
