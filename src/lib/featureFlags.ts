/** Paid stamp ordering — exact string "true" required. Default off. */
export function isStampOrderEnabled(): boolean {
  return String(import.meta.env?.VITE_STAMP_ORDER_ENABLED ?? '') === 'true';
}

/** Paid eSign send — exact string "true" required. Default off. */
export function isEsignEnabled(): boolean {
  return String(import.meta.env?.VITE_ESIGN_ENABLED ?? '') === 'true';
}
