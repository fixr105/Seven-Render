import { ProfileCompletionResult } from './profileCompletion';

export function getProfilePromptDismissKey(userId: string | null, authSessionId: string | null): string | null {
  if (!userId || !authSessionId) return null;
  return `profile_prompt_dismissed_${userId}_${authSessionId}`;
}

export function getIsPromptDismissedForSession(dismissKey: string | null): boolean {
  if (!dismissKey || typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(dismissKey) === 'true';
}

export function shouldShowProfilePrompt(params: {
  hasUser: boolean;
  loading: boolean;
  isAuthPage: boolean;
  completion: ProfileCompletionResult;
  dismissedForSession: boolean;
}): boolean {
  const { hasUser, loading, isAuthPage, completion, dismissedForSession } = params;
  return hasUser && !loading && !isAuthPage && !completion.isComplete && !dismissedForSession;
}
