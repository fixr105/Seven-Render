/** Basic Information fields: mobile, email, type of purchase (New Application). */

export type IndianMobileParseResult =
  | { ok: true; digits: string }
  | { ok: false; reason: 'empty' | 'invalid' };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseIndianMobile(input: string | undefined): IndianMobileParseResult {
  if (input == null || typeof input !== 'string' || input.trim().length === 0) {
    return { ok: false, reason: 'empty' };
  }
  let d = input.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length !== 10 || !/^[6-9]\d{9}$/.test(d)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, digits: d };
}

export function isValidEmailFormat(value: string | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  const s = value.trim();
  return s.length > 0 && EMAIL_REGEX.test(s);
}

export const TYPE_OF_PURCHASE_VALUES = ['Rental', 'EMI'] as const;
export type TypeOfPurchase = (typeof TYPE_OF_PURCHASE_VALUES)[number];

export function isValidTypeOfPurchase(value: unknown): value is TypeOfPurchase {
  return typeof value === 'string' && TYPE_OF_PURCHASE_VALUES.includes(value as TypeOfPurchase);
}
