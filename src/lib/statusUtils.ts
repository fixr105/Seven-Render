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


