import { matchIds } from './idMatcher.js';

export function findKamUserForAssignedValue(
  kamUsers: Array<Record<string, unknown>>,
  assignedKam: string
): Record<string, unknown> | null {
  const needle = String(assignedKam || '').trim();
  if (!needle) return null;
  return (
    kamUsers.find(
      (user) =>
        matchIds(user.id, needle) ||
        matchIds(user['KAM ID'], needle) ||
        matchIds(user.Email, needle) ||
        matchIds(user.email, needle)
    ) ?? null
  );
}

/** Email for the assigned KAM. An email stored on the client is used when no user row matches. */
export function resolveKamNotificationEmail(
  kamUsers: Array<Record<string, unknown>>,
  assignedKam: string
): string {
  const user = findKamUserForAssignedValue(kamUsers, assignedKam);
  const fromUser = String(user?.Email ?? user?.email ?? '').trim();
  if (fromUser) return fromUser;
  const raw = String(assignedKam || '').trim();
  return raw.includes('@') ? raw : '';
}
