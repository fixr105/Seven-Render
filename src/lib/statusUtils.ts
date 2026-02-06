/**
 * Module 3: Status Utility Functions
 * 
 * Frontend utilities for status display and colors
 */

export type LoanStatus = 
  | 'draft'
  | 'under_kam_review'
  | 'query_with_client'
  | 'pending_credit_review'
  | 'credit_query_with_kam'
  | 'in_negotiation'
  | 'sent_to_nbfc'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'withdrawn'
  | 'closed';

/**
 * Statuses that mean "client action required" (query raised to client or awaiting client response).
 * For client role these are shown as "Action required" instead of technical labels.
 */
const CLIENT_ACTION_REQUIRED_STATUSES = new Set([
  'query_with_client',
  'credit_query_raised',
  'kam_query_raised',
  'credit_query_with_kam', // if shown to client in some flows
]);

/**
 * Get status display name
 */
export function getStatusDisplayName(status: string): string {
  const displayNames: Record<string, string> = {
    draft: 'Draft',
    under_kam_review: 'Under KAM Review',
    query_with_client: 'Query with Client',
    pending_credit_review: 'Pending Credit Review',
    credit_query_with_kam: 'Credit Query with KAM',
    in_negotiation: 'In Negotiation',
    sent_to_nbfc: 'Sent to NBFC',
    approved: 'Approved',
    rejected: 'Rejected',
    disbursed: 'Disbursed',
    withdrawn: 'Withdrawn',
    closed: 'Closed',
  };
  return displayNames[status] || status;
}

/**
 * Get status display name for a given viewer role. For client role, query-related statuses
 * are shown as "Action required" for a simpler, user-friendly label.
 */
export function getStatusDisplayNameForViewer(status: string, viewerRole: string): string {
  const normalized = (status || '').toLowerCase();
  if (viewerRole === 'client' && CLIENT_ACTION_REQUIRED_STATUSES.has(normalized)) {
    return 'Action required';
  }
  return getStatusDisplayName(status);
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  const colors: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
    draft: 'neutral',
    under_kam_review: 'info',
    query_with_client: 'warning',
    pending_credit_review: 'info',
    credit_query_with_kam: 'warning',
    in_negotiation: 'info',
    sent_to_nbfc: 'info',
    approved: 'success',
    rejected: 'error',
    disbursed: 'success',
    withdrawn: 'neutral',
    closed: 'neutral',
  };
  return colors[status] || 'neutral';
}










