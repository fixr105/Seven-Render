/**
 * System Constants
 * Enums and constants for roles, statuses, and modules
 */

export enum UserRole {
  CLIENT = 'client',
  KAM = 'kam',
  CREDIT = 'credit_team',
  NBFC = 'nbfc',
  ADMIN = 'admin',
}

export enum LoanStatus {
  DRAFT = 'draft',
  UNDER_KAM_REVIEW = 'under_kam_review',
  QUERY_WITH_CLIENT = 'query_with_client',
  PENDING_CREDIT_REVIEW = 'pending_credit_review',
  CREDIT_QUERY_WITH_KAM = 'credit_query_with_kam',
  IN_NEGOTIATION = 'in_negotiation',
  SENT_TO_NBFC = 'sent_to_nbfc',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISBURSED = 'disbursed',
  WITHDRAWN = 'withdrawn',
  CLOSED = 'closed',
}

export enum LenderDecisionStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  NEEDS_CLARIFICATION = 'Needs Clarification',
}

export enum DisputeStatus {
  NONE = 'None',
  UNDER_QUERY = 'Under Query',
  RESOLVED = 'Resolved',
}

export enum AccountStatus {
  ACTIVE = 'Active',
  LOCKED = 'Locked',
  DISABLED = 'Disabled',
}

export enum Module {
  M1 = 'M1', // Pay In/Out Ledger
  M2 = 'M2', // Master Form Builder
  M3 = 'M3', // File Status Tracking
  M4 = 'M4', // Audit Log & Query Dialog
  M5 = 'M5', // Action Center
  M6 = 'M6', // Daily Summary Reports
  M7 = 'M7', // File Summary Insights
}

export enum PayoutRequestStatus {
  REQUESTED = 'Requested',
  APPROVED = 'Approved',
  PARTIALLY_APPROVED = 'Partially Approved',
  REJECTED = 'Rejected',
  PAID = 'Paid',
}

/** SLA: days after "Sent to NBFC" before considered past due for follow-up */
export const SLA_SENT_TO_NBFC_DAYS = 7;

// Note: Airtable table IDs are now managed in n8nEndpoints.ts
// All database operations go through n8n webhooks, not direct Airtable API calls

