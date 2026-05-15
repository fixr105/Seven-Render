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

const STATUS_ALIASES: Record<string, string> = {
  pending_kam_review: 'under_kam_review',
  kam_query_raised: 'query_with_client',
  forwarded_to_credit: 'pending_credit_review',
  credit_query_raised: 'credit_query_with_kam',
  /** Match backend loanProductStatuses normalizeApplicableStatusKey / Airtable labels */
  qualified: 'in_negotiation',
  submitted: 'under_kam_review',
  dealer_unresponsive: 'query_with_client',
  under_finance_review: 'pending_credit_review',
};

const ACRONYM_PARTS: Record<string, string> = {
  kam: 'KAM',
  nbfc: 'NBFC',
};

const BUSINESS_STATUS_LABELS: Record<string, string> = {
  under_kam_review: 'Submitted',
  pending_credit_review: 'Under Finance Review',
  in_negotiation: 'Qualified',
  query_with_client: 'Dealer Unresponsive',
  approved: 'DO Issued',
  sent_to_nbfc: 'DO Issued',
  disbursed: 'Disbursed',
  rejected: 'Rejected',
};

const BUSINESS_STATUS_DROPDOWN_KEYS = [
  'under_kam_review',
  'in_negotiation',
  'query_with_client',
  'pending_credit_review',
  'approved',
  'disbursed',
  'rejected',
];

/**
 * Normalize status to canonical backend values.
 * Maps legacy/alias values from frontend or inconsistent sources to canonical values.
 */
export function normalizeStatus(status: string): string {
  const normalized = (status || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
  return STATUS_ALIASES[normalized] ?? normalized;
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
    .map((part) => ACRONYM_PARTS[part] ?? part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getBusinessStatusDisplayName(status: string): string {
  const normalized = normalizeStatus(status);
  return BUSINESS_STATUS_LABELS[normalized] ?? getStatusDisplayName(normalized);
}

export function getBusinessStatusOptions(): Array<{ key: string; label: string }> {
  return BUSINESS_STATUS_DROPDOWN_KEYS.map((key) => ({
    key,
    label: getBusinessStatusDisplayName(key),
  }));
}

/**
 * Get status display name for a given viewer role.
 */
export function getStatusDisplayNameForViewer(status: string, _viewerRole: string): string {
  return getBusinessStatusDisplayName(status);
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  const key = normalizeStatus(status);
  if (key === 'under_kam_review' || key === 'pending_credit_review' || key.includes('sent') || key.includes('negotiation')) return 'info';
  if (key.includes('query')) return 'warning';
  return 'neutral';
}










