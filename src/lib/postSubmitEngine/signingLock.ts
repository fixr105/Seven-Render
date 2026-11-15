/**
 * Paid stamp / eSign steps are gated by Vite feature flags
 * (`VITE_STAMP_ORDER_ENABLED`, `VITE_ESIGN_ENABLED`) — see `featureFlags.ts`.
 * This module keeps legacy exports for tests that still reference the phase name.
 */

import { isEsignEnabled, isStampOrderEnabled } from '../featureFlags';

/** @deprecated Prefer isStampOrderEnabled / isEsignEnabled. */
export const SIGNING_PARTIES_CONFIRMED = true;

/** @deprecated Opti Pro pending phase removed; stamp_step replaces it. */
export const SIGNING_SETUP_PENDING_PHASE = 'stamp_step' as const;

export const SIGNING_SETUP_PENDING_MESSAGE = 'Stamp papers';

/** True when both paid stamp order and eSign flags are off (UI still shows ready states). */
export function isPaidSigningLocked(): boolean {
  return !isStampOrderEnabled() && !isEsignEnabled();
}
