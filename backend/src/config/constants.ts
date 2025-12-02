/**
 * System Constants
 * Enums and constants for roles, statuses, and modules
 */

export enum UserRole {
  CLIENT = 'client',
  KAM = 'kam',
  CREDIT = 'credit_team',
  NBFC = 'nbfc',
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

// Airtable Table IDs (from n8n flow)
export const AIRTABLE_BASE_ID = 'appzbyi8q7pJRl1cd';

export const AIRTABLE_TABLES = {
  ADMIN_ACTIVITY_LOG: 'tblz0e59ULgBcUvrY',
  CLIENT_FORM_MAPPING: 'tbl70C8uPKmoLkOQJ',
  COMMISSION_LEDGER: 'tblrBWFuPYBI4WWtn',
  CREDIT_TEAM_USERS: 'tbl1a1TmMUj918Byj',
  DAILY_SUMMARY_REPORTS: 'tbla3urDb8kCsO0Et',
  FILE_AUDITING_LOG: 'tblL1XJnqW3Q15ueZ',
  FORM_CATEGORIES: 'tblqCqXV0Hds0t0bH',
  FORM_FIELDS: 'tbl5oZ6zI0dc5eutw',
  KAM_USERS: 'tblpZFUQEJAvPsdOJ',
  LOAN_APPLICATIONS: 'tbl85RSGR1op38O3G',
  LOAN_PRODUCTS: 'tblNxvQVlzCfcj4e2',
  NBFC_PARTNERS: 'tblGvEp8Z1QvahwI0',
  USER_ACCOUNTS: 'tbl7RRcehD5xLiPv7',
} as const;

