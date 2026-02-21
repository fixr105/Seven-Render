/**
 * Module 3: Status State Machine
 * 
 * Defines valid status transitions and enforces state machine rules
 */

import { LoanStatus, UserRole } from '../../config/constants.js';

/**
 * Normalize request/API role string to UserRole for transition validation.
 * Ensures values like 'credit', 'creditteam' map to UserRole.CREDIT so allowed transitions are correct.
 */
export function toUserRole(role: string | undefined): UserRole {
  if (!role || typeof role !== 'string') return UserRole.CLIENT;
  const r = role.trim().toLowerCase().replace(/\s+/g, '_');
  if (r === 'kam') return UserRole.KAM;
  if (r === 'credit_team' || r === 'credit' || r === 'creditteam') return UserRole.CREDIT;
  if (r === 'nbfc') return UserRole.NBFC;
  if (r === 'admin') return UserRole.ADMIN;
  return UserRole.CLIENT;
}

/**
 * Status transition map
 * Defines which statuses can transition to which other statuses.
 * Credit and Admin may transition to CLOSED from any non-closed status (administrative close);
 * that rule is enforced in isValidTransition. All other transitions use this map and ROLE_STATUS_PERMISSIONS.
 */
export const STATUS_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  [LoanStatus.DRAFT]: [
    LoanStatus.UNDER_KAM_REVIEW, // Client submits
    LoanStatus.WITHDRAWN, // Client withdraws
  ],
  [LoanStatus.UNDER_KAM_REVIEW]: [
    LoanStatus.QUERY_WITH_CLIENT, // KAM raises query
    LoanStatus.PENDING_CREDIT_REVIEW, // KAM forwards to credit
    LoanStatus.WITHDRAWN, // Client withdraws
  ],
  [LoanStatus.QUERY_WITH_CLIENT]: [
    LoanStatus.UNDER_KAM_REVIEW, // Client responds, back to KAM
    LoanStatus.PENDING_CREDIT_REVIEW, // KAM satisfied, forwards to credit
    LoanStatus.WITHDRAWN, // Client withdraws
  ],
  [LoanStatus.PENDING_CREDIT_REVIEW]: [
    LoanStatus.CREDIT_QUERY_WITH_KAM, // Credit raises query to KAM
    LoanStatus.IN_NEGOTIATION, // Credit starts negotiation
    LoanStatus.SENT_TO_NBFC, // Credit can assign to NBFC directly
    LoanStatus.REJECTED, // Credit rejects
    LoanStatus.WITHDRAWN, // Client withdraws
  ],
  [LoanStatus.CREDIT_QUERY_WITH_KAM]: [
    LoanStatus.PENDING_CREDIT_REVIEW, // KAM responds, back to credit
    LoanStatus.REJECTED, // Credit rejects after query
  ],
  [LoanStatus.IN_NEGOTIATION]: [
    LoanStatus.SENT_TO_NBFC, // Credit assigns to NBFC
    LoanStatus.REJECTED, // Credit rejects
    LoanStatus.WITHDRAWN, // Client withdraws
  ],
  [LoanStatus.SENT_TO_NBFC]: [
    LoanStatus.APPROVED, // NBFC approves
    LoanStatus.REJECTED, // NBFC rejects
    LoanStatus.IN_NEGOTIATION, // Back to negotiation
  ],
  [LoanStatus.APPROVED]: [
    LoanStatus.DISBURSED, // Credit marks disbursed
    LoanStatus.REJECTED, // Credit rejects (rare, but possible)
  ],
  [LoanStatus.REJECTED]: [
    LoanStatus.CLOSED, // File closed
  ],
  [LoanStatus.DISBURSED]: [
    LoanStatus.CLOSED, // File closed after disbursement
  ],
  [LoanStatus.WITHDRAWN]: [
    LoanStatus.CLOSED, // File closed after withdrawal
  ],
  [LoanStatus.CLOSED]: [], // Terminal state - no transitions
};

/** Canonical LoanStatus values for lookup */
const CANONICAL_STATUSES = new Set<LoanStatus>(Object.values(LoanStatus));

/**
 * Map common aliases (frontend/Airtable) to canonical LoanStatus.
 * Use before calling validateTransition when status comes from DB or request.
 */
export function normalizeToCanonicalStatus(raw: string): LoanStatus {
  const key = (raw || '').toString().trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  const aliasMap: Record<string, LoanStatus> = {
    pending_kam_review: LoanStatus.UNDER_KAM_REVIEW,
    under_kam_review: LoanStatus.UNDER_KAM_REVIEW,
    kam_query_raised: LoanStatus.QUERY_WITH_CLIENT,
    query_with_client: LoanStatus.QUERY_WITH_CLIENT,
    forwarded_to_credit: LoanStatus.PENDING_CREDIT_REVIEW,
    pending_credit_review: LoanStatus.PENDING_CREDIT_REVIEW,
    credit_query_raised: LoanStatus.CREDIT_QUERY_WITH_KAM,
    credit_query_with_kam: LoanStatus.CREDIT_QUERY_WITH_KAM,
    in_negotiation: LoanStatus.IN_NEGOTIATION,
    sent_to_nbfc: LoanStatus.SENT_TO_NBFC,
    approved: LoanStatus.APPROVED,
    rejected: LoanStatus.REJECTED,
    disbursed: LoanStatus.DISBURSED,
    withdrawn: LoanStatus.WITHDRAWN,
    draft: LoanStatus.DRAFT,
    closed: LoanStatus.CLOSED,
  };
  const canonical = aliasMap[key];
  if (canonical) return canonical;
  if (CANONICAL_STATUSES.has(key as LoanStatus)) return key as LoanStatus;
  throw new Error(`Unknown or unsupported status: ${raw}`);
}

/**
 * Role-based status transition permissions
 * Defines which roles can perform which status transitions.
 * Credit must have SENT_TO_NBFC to transition from PENDING_CREDIT_REVIEW to Sent to NBFC.
 */
export const ROLE_STATUS_PERMISSIONS: Record<UserRole, LoanStatus[]> = {
  [UserRole.CLIENT]: [
    LoanStatus.UNDER_KAM_REVIEW, // Submit draft
    LoanStatus.WITHDRAWN, // Withdraw application
  ],
  [UserRole.KAM]: [
    LoanStatus.QUERY_WITH_CLIENT, // Raise query
    LoanStatus.PENDING_CREDIT_REVIEW, // Forward to credit
    LoanStatus.UNDER_KAM_REVIEW, // Return from query
  ],
  [UserRole.CREDIT]: [
    LoanStatus.CREDIT_QUERY_WITH_KAM, // Query KAM
    LoanStatus.IN_NEGOTIATION, // Mark in negotiation
    LoanStatus.SENT_TO_NBFC, // Assign to NBFC (required for PENDING_CREDIT_REVIEW → Sent to NBFC)
    LoanStatus.APPROVED, // Approve (after NBFC decision)
    LoanStatus.REJECTED, // Reject
    LoanStatus.DISBURSED, // Mark disbursed
    LoanStatus.CLOSED, // Close file
    LoanStatus.PENDING_CREDIT_REVIEW, // Return from query
  ],
  [UserRole.NBFC]: [
    // NBFC doesn't directly change status, but their decision affects status
    // Status changes are handled by Credit team based on NBFC decision
  ],
  [UserRole.ADMIN]: [
    // Admin can perform any transition (same as Credit for full access)
    LoanStatus.QUERY_WITH_CLIENT,
    LoanStatus.PENDING_CREDIT_REVIEW,
    LoanStatus.CREDIT_QUERY_WITH_KAM,
    LoanStatus.IN_NEGOTIATION,
    LoanStatus.SENT_TO_NBFC,
    LoanStatus.APPROVED,
    LoanStatus.REJECTED,
    LoanStatus.DISBURSED,
    LoanStatus.CLOSED,
    LoanStatus.UNDER_KAM_REVIEW,
    LoanStatus.WITHDRAWN,
  ],
};

/**
 * Check if a status transition is valid
 * 
 * @param fromStatus - Current status
 * @param toStatus - Target status
 * @param userRole - User role attempting the transition
 * @returns true if transition is valid, false otherwise
 */
export function isValidTransition(
  fromStatus: LoanStatus,
  toStatus: LoanStatus,
  userRole: UserRole
): boolean {
  // Administrative close: Credit and Admin may close from any non-closed status
  if (
    toStatus === LoanStatus.CLOSED &&
    fromStatus !== LoanStatus.CLOSED &&
    (userRole === UserRole.CREDIT || userRole === UserRole.ADMIN)
  ) {
    return true;
  }

  // Check if transition is allowed in state machine
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  if (!allowedTransitions.includes(toStatus)) {
    return false;
  }

  // Check if role has permission for this transition
  const rolePermissions = ROLE_STATUS_PERMISSIONS[userRole] || [];
  if (!rolePermissions.includes(toStatus)) {
    return false;
  }

  return true;
}

/**
 * Get allowed next statuses for a given status and role
 * 
 * @param currentStatus - Current status
 * @param userRole - User role
 * @returns Array of allowed next statuses
 */
export function getAllowedNextStatuses(
  currentStatus: LoanStatus,
  userRole: UserRole
): LoanStatus[] {
  const allTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  const rolePermissions = ROLE_STATUS_PERMISSIONS[userRole] || [];
  const fromGraph = allTransitions.filter((status) => rolePermissions.includes(status));
  // Credit/Admin may close from any non-closed status; include CLOSED if they have permission
  if (
    currentStatus !== LoanStatus.CLOSED &&
    (userRole === UserRole.CREDIT || userRole === UserRole.ADMIN) &&
    rolePermissions.includes(LoanStatus.CLOSED) &&
    !fromGraph.includes(LoanStatus.CLOSED)
  ) {
    return [...fromGraph, LoanStatus.CLOSED];
  }
  return fromGraph;
}

/**
 * Validate status transition and throw error if invalid
 * 
 * @param fromStatus - Current status
 * @param toStatus - Target status
 * @param userRole - User role
 * @throws Error if transition is invalid
 */
export function validateTransition(
  fromStatus: LoanStatus,
  toStatus: LoanStatus,
  userRole: UserRole
): void {
  if (!isValidTransition(fromStatus, toStatus, userRole)) {
    const allowedStatuses = getAllowedNextStatuses(fromStatus, userRole);
    throw new Error(
      `Invalid status transition from ${fromStatus} to ${toStatus} for role ${userRole}. ` +
      `Allowed transitions: ${allowedStatuses.join(', ')}`
    );
  }
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: LoanStatus): string {
  const displayNames: Record<LoanStatus, string> = {
    [LoanStatus.DRAFT]: 'Draft',
    [LoanStatus.UNDER_KAM_REVIEW]: 'Under KAM Review',
    [LoanStatus.QUERY_WITH_CLIENT]: 'Query with Client',
    [LoanStatus.PENDING_CREDIT_REVIEW]: 'Pending Credit Review',
    [LoanStatus.CREDIT_QUERY_WITH_KAM]: 'Credit Query with KAM',
    [LoanStatus.IN_NEGOTIATION]: 'In Negotiation',
    [LoanStatus.SENT_TO_NBFC]: 'Sent to NBFC',
    [LoanStatus.APPROVED]: 'Approved',
    [LoanStatus.REJECTED]: 'Rejected',
    [LoanStatus.DISBURSED]: 'Disbursed',
    [LoanStatus.WITHDRAWN]: 'Withdrawn',
    [LoanStatus.CLOSED]: 'Closed',
  };
  return displayNames[status] || status;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: LoanStatus): string {
  const colors: Record<LoanStatus, string> = {
    [LoanStatus.DRAFT]: 'neutral',
    [LoanStatus.UNDER_KAM_REVIEW]: 'info',
    [LoanStatus.QUERY_WITH_CLIENT]: 'warning',
    [LoanStatus.PENDING_CREDIT_REVIEW]: 'info',
    [LoanStatus.CREDIT_QUERY_WITH_KAM]: 'warning',
    [LoanStatus.IN_NEGOTIATION]: 'info',
    [LoanStatus.SENT_TO_NBFC]: 'info',
    [LoanStatus.APPROVED]: 'success',
    [LoanStatus.REJECTED]: 'error',
    [LoanStatus.DISBURSED]: 'success',
    [LoanStatus.WITHDRAWN]: 'neutral',
    [LoanStatus.CLOSED]: 'neutral',
  };
  return colors[status] || 'neutral';
}










