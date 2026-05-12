import { describe, expect, it, beforeEach } from 'vitest';
import {
  getIsPromptDismissedForSession,
  getProfilePromptDismissKey,
  shouldShowProfilePrompt,
} from '../profilePromptSession';

describe('profilePromptSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('builds dismiss key from user id and auth session id', () => {
    expect(getProfilePromptDismissKey('user-1', 'session-1')).toBe('profile_prompt_dismissed_user-1_session-1');
    expect(getProfilePromptDismissKey(null, 'session-1')).toBeNull();
  });

  it('checks session-only dismiss state', () => {
    const key = getProfilePromptDismissKey('user-2', 'session-2');
    expect(getIsPromptDismissedForSession(key)).toBe(false);
    sessionStorage.setItem(key!, 'true');
    expect(getIsPromptDismissedForSession(key)).toBe(true);
  });

  it('shows prompt only when profile incomplete and not dismissed', () => {
    expect(
      shouldShowProfilePrompt({
        hasUser: true,
        loading: false,
        isAuthPage: false,
        completion: { isComplete: false, missingFields: ['phone'] },
        dismissedForSession: false,
      })
    ).toBe(true);

    expect(
      shouldShowProfilePrompt({
        hasUser: true,
        loading: false,
        isAuthPage: false,
        completion: { isComplete: false, missingFields: ['phone'] },
        dismissedForSession: true,
      })
    ).toBe(false);
  });
});
