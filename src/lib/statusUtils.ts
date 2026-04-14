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
 * Normalize status to canonical backend values.
 * Maps legacy/alias values from frontend or inconsistent sources to canonical values.
 */
export function normalizeStatus(status: string): string {
  const s = (status || '').toLowerCase().trim();
  const aliasMap: Record<string, string> = {
    forwarded_to_credit: 'pending_credit_review',
    credit_query_raised: 'credit_query_with_kam',
    pending_kam_review: 'under_kam_review',
    kam_query_raised: 'query_with_client',
  };
  return (aliasMap[s] ?? s) || 'draft';
}

/** Status values shown as raw canonical ids until dedicated status UX ships. */
const RAW_LABEL_STATUSES = new Set(['draft', 'approved', 'rejected', 'disbursed']);

/**
 * Get status display name
 */
export function getStatusDisplayName(status: string): string {
  const normalized = (status || '').toLowerCase();
  if (RAW_LABEL_STATUSES.has(normalized)) {
    return normalized;
  }
  const displayNames: Record<string, string> = {
    under_kam_review: 'Under KAM Review',
    query_with_client: 'Query with Client',
    pending_credit_review: 'Pending Credit Review',
    credit_query_with_kam: 'Credit Query with KAM',
    in_negotiation: 'In Negotiation',
    sent_to_nbfc: 'Sent to NBFC',
    withdrawn: 'Withdrawn',
    closed: 'Closed',
  };
  return displayNames[normalized] || status;
}

/**
 * Get status display name for a given viewer role.
 */
export function getStatusDisplayNameForViewer(status: string, _viewerRole: string): string {
  return getStatusDisplayName(status);
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  const key = (status || '').toLowerCase();
  const colors: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
    under_kam_review: 'info',
    query_with_client: 'warning',
    pending_credit_review: 'info',
    credit_query_with_kam: 'warning',
    in_negotiation: 'info',
    sent_to_nbfc: 'info',
    draft: 'neutral',
    approved: 'neutral',
    rejected: 'neutral',
    disbursed: 'neutral',
    withdrawn: 'neutral',
    closed: 'neutral',
  };
  return colors[key] || 'neutral';
}










