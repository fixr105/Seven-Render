import { describe, expect, it } from 'vitest';
import {
  VKYC_STATUS_CHECK_MESSAGE,
  nextVkycPollFailureCount,
  shouldShowVkycStatusCheckError,
} from '../vkycPollFailures';

describe('vkycPollFailures', () => {
  it('increments on failure and resets on success', () => {
    expect(nextVkycPollFailureCount(0, false)).toBe(1);
    expect(nextVkycPollFailureCount(2, false)).toBe(3);
    expect(nextVkycPollFailureCount(3, true)).toBe(0);
  });

  it('shows message only after 3 consecutive failures', () => {
    expect(shouldShowVkycStatusCheckError(2)).toBe(false);
    expect(shouldShowVkycStatusCheckError(3)).toBe(true);
    expect(VKYC_STATUS_CHECK_MESSAGE).toBe("Can't check video KYC status. Retrying…");
  });
});
