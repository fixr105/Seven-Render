import { describe, expect, it } from 'vitest';
import {
  isPaidSigningLocked,
  SIGNING_SETUP_PENDING_MESSAGE,
  SIGNING_SETUP_PENDING_PHASE,
} from '../signingLock';

describe('signing lock', () => {
  it('gates paid steps via feature flags (default off)', () => {
    expect(isPaidSigningLocked()).toBe(true);
    expect(SIGNING_SETUP_PENDING_PHASE).toBe('stamp_step');
    expect(SIGNING_SETUP_PENDING_MESSAGE).toMatch(/Stamp papers/i);
  });
});
