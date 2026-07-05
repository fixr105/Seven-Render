/**
 * KAM application access helpers — RBAC and state-machine checks for mutations.
 */

import type { AuthUser } from '../types/auth.js';
import type { LoanStatus } from '../config/constants.js';
import {
  normalizeToCanonicalStatus,
  toUserRole,
  validateTransition,
} from '../services/statusTracking/statusStateMachine.js';

export class KamAccessError extends Error {
  constructor(
    message: string,
    readonly statusCode: 403 | 400 = 403
  ) {
    super(message);
    this.name = 'KamAccessError';
  }
}

/** Returns true when user may mutate this application (managed-client RBAC). */
export async function assertKAMCanMutateApplication(
  user: AuthUser,
  application: Record<string, unknown>
): Promise<void> {
  const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
  const filtered = await rbacFilterService.filterLoanApplications(
    [application as never],
    user
  );
  if (filtered.length === 0) {
    throw new KamAccessError('Access denied');
  }
}

/** Validates a status transition for the user's role; throws KamAccessError(400) on invalid. */
export function assertValidStatusTransition(
  fromStatusRaw: unknown,
  toStatusRaw: unknown,
  userRole: string
): { from: LoanStatus; to: LoanStatus } {
  const from = normalizeToCanonicalStatus(String(fromStatusRaw ?? ''));
  const to = normalizeToCanonicalStatus(String(toStatusRaw ?? ''));
  try {
    validateTransition(from, to, toUserRole(userRole));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid status transition';
    throw new KamAccessError(message, 400);
  }
  return { from, to };
}
