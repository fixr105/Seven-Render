/**
 * Module 3: Status Utility Functions
 * Frontend utilities for status display and colors
 */

import i18n from '../i18n';

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
  qualified: 'in_negotiation',
  submitted: 'under_kam_review',
  dealer_unresponsive: 'query_with_client',
  under_finance_review: 'pending_credit_review',
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

export function normalizeStatus(status: string): string {
  const normalized = (status || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
  return STATUS_ALIASES[normalized] ?? normalized;
}

/** Empty/missing Airtable Status is treated as draft (see loanApplicationAirtableStatus). */
export function resolveApplicationStatus(status: string | null | undefined): string {
  const trimmed = String(status ?? '').trim();
  if (!trimmed) return 'draft';
  return normalizeStatus(trimmed);
}

export function isClientEditableApplication(status: string | null | undefined): boolean {
  const key = resolveApplicationStatus(status);
  return key === 'draft' || key === 'query_with_client';
}

function formatStatusFallback(normalized: string): string {
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => (part === 'kam' ? 'KAM' : part === 'nbfc' ? 'NBFC' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

export function getStatusDisplayName(status: string): string {
  const normalized = normalizeStatus(status);
  if (!normalized) return '';
  const technicalKey = `status.technical_${normalized}`;
  const technical = i18n.t(technicalKey);
  if (technical !== technicalKey) return technical;
  return formatStatusFallback(normalized);
}

export function getBusinessStatusDisplayName(status: string): string {
  const normalized = normalizeStatus(status);
  const key = `status.${normalized}`;
  const translated = i18n.t(key);
  if (translated !== key) return translated;
  return getStatusDisplayName(normalized);
}

export function getBusinessStatusOptions(): Array<{ key: string; label: string }> {
  return BUSINESS_STATUS_DROPDOWN_KEYS.map((key) => ({
    key,
    label: getBusinessStatusDisplayName(key),
  }));
}

export function getStatusDisplayNameForViewer(status: string, _viewerRole: string): string {
  return getBusinessStatusDisplayName(status);
}

export function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  const key = normalizeStatus(status);
  if (key === 'under_kam_review' || key === 'pending_credit_review' || key.includes('sent') || key.includes('negotiation')) return 'info';
  if (key.includes('query')) return 'warning';
  return 'neutral';
}

/** KAM-allowed next statuses per current status (mirrors backend state machine). */
const KAM_STATUS_TRANSITIONS: Record<string, LoanStatus[]> = {
  under_kam_review: ['query_with_client', 'pending_credit_review'],
  query_with_client: ['under_kam_review', 'pending_credit_review'],
  credit_query_with_kam: ['pending_credit_review'],
};

export function getAllowedNextStatusesForKam(currentStatus: string): LoanStatus[] {
  const key = normalizeStatus(currentStatus);
  return KAM_STATUS_TRANSITIONS[key] ?? [];
}
