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
  return (status || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: string): string {
  const normalized = normalizeStatus(status);
  if (!normalized) return '';
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  const key = normalizeStatus(status);
  if (key.includes('reject') || key.includes('error') || key.includes('fail')) return 'error';
  if (key.includes('approve') || key.includes('success') || key.includes('complete')) return 'success';
  if (key.includes('query') || key.includes('pending') || key.includes('review')) return 'warning';
  if (key.includes('sent') || key.includes('progress') || key.includes('negotiation')) return 'info';
  return 'neutral';
}










