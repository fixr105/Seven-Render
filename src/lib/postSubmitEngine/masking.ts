/** Display-only masking. Never log raw PAN/Aadhaar/score in production. */

export function maskPan(pan: string): string {
  const clean = pan.replace(/\s+/g, '').toUpperCase();
  if (clean.length < 10) return 'XXXXX••••X';
  return `XXXXX${clean.slice(5, 9)}X`;
}

export function maskAadhaar(aadhaarOrLast4: string): string {
  const digits = aadhaarOrLast4.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `XXXX XXXX ${digits.slice(-4)}`;
  }
  return 'XXXX XXXX ••••';
}

export function isProd(): boolean {
  return import.meta.env.PROD === true;
}

export function safeDevLog(message: string, meta?: Record<string, unknown>): void {
  if (isProd()) return;
  // Intentionally omit PAN / Aadhaar / score / account numbers even in dev payloads.
  const scrubbed = meta
    ? Object.fromEntries(
        Object.entries(meta).filter(
          ([key]) => !/pan|aadhaar|score|kill|bureau|account|enach/i.test(key)
        )
      )
    : undefined;
  // eslint-disable-next-line no-console
  console.info(`[post-submit] ${message}`, scrubbed);
}
