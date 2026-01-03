/**
 * Module 3: Status State Machine
 * 
 * Defines valid status transitions and enforces state machine rules
 */

import { LoanStatus } from '../../config/constants.js';
import { UserRole } from '../../config/constants.js';

/**
 * Status transition map
 * Defines which statuses can transition to which other statuses
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
    LoanStatus.WITHDRAWN, // Client withdraws
  ],
  [LoanStatus.PENDING_CREDIT_REVIEW]: [
    LoanStatus.CREDIT_QUERY_WITH_KAM, // Credit raises query to KAM
    LoanStatus.IN_NEGOTIATION, // Credit starts negotiation
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

/**
 * Role-based status transition permissions
 * Defines which roles can perform which status transitions
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
    LoanStatus.SENT_TO_NBFC, // Assign to NBFC
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
  
  // Return intersection: statuses that are both allowed by state machine AND by role
  return allTransitions.filter(status => rolePermissions.includes(status));
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










