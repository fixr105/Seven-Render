/**
 * Entity Type Definitions
 * Matching Airtable schema from n8n flow
 */

import { UserRole, LoanStatus, LenderDecisionStatus, DisputeStatus, AccountStatus, Module, PayoutRequestStatus } from '../config/constants.js';

// User Account
export interface UserAccount {
  id: string;
  Username: string;
  Password: string;
  Role: UserRole;
  'Associated Profile'?: string;
  'Last Login'?: string;
  'Account Status': AccountStatus;
}

// Client (DSA Partner) - stored in User Accounts with Role=client
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  kamId?: string; // KAM owner
  enabledModules?: Module[];
}

// KAM User
export interface KAMUser {
  id: string;
  'KAM ID': string;
  Name: string;
  Email: string;
  Phone?: string;
  'Managed Clients'?: string;
  Role: UserRole.KAM;
  Status: AccountStatus;
}

// Credit Team User
export interface CreditTeamUser {
  id: string;
  'Credit User ID': string;
  Name: string;
  Email: string;
  Phone?: string;
  Role: UserRole.CREDIT;
  Status: AccountStatus;
}

// NBFC Partner
export interface NBFCPartner {
  id: string;
  'Lender ID': string;
  'Lender Name': string;
  'Contact Person'?: string;
  'Contact Email/Phone'?: string;
  'Address/Region'?: string;
  Active: string; // 'True' | 'False'
}

// Loan Product
export interface LoanProduct {
  id: string;
  'Product ID': string;
  'Product Name': string;
  Description?: string;
  Active: string; // 'True' | 'False'
  'Required Documents/Fields'?: string;
}

// Form Category
export interface FormCategory {
  id: string;
  'Category ID': string;
  'Category Name': string;
  Description?: string;
  'Display Order'?: string;
  Active: string; // 'True' | 'False'
}

// Form Field
export interface FormField {
  id: string;
  'Field ID': string;
  Category: string;
  'Field Label': string;
  'Field Type': string;
  'Field Placeholder'?: string;
  'Field Options'?: string;
  'Is Mandatory': string; // 'True' | 'False'
  'Display Order'?: string;
  Active: string; // 'True' | 'False'
}

// Client Form Mapping
export interface ClientFormMapping {
  id: string;
  'Mapping ID': string;
  Client: string;
  Category: string;
  'Is Required': string; // 'True' | 'False'
  'Display Order'?: string;
}

// Loan Application
export interface LoanApplication {
  id: string;
  'File ID': string;
  Client: string;
  'Applicant Name'?: string;
  'Loan Product'?: string;
  'Requested Loan Amount'?: string;
  Documents?: string;
  Status: LoanStatus;
  'Assigned Credit Analyst'?: string;
  'Assigned NBFC'?: string;
  'Lender Decision Status'?: LenderDecisionStatus;
  'Lender Decision Date'?: string;
  'Lender Decision Remarks'?: string;
  'Approved Loan Amount'?: string;
  'AI File Summary'?: string;
  'Form Data'?: string; // JSON string
  'Creation Date'?: string;
  'Submitted Date'?: string;
  'Last Updated'?: string;
}

// Commission Ledger Entry
export interface CommissionLedgerEntry {
  id: string;
  'Ledger Entry ID': string;
  Client: string;
  'Loan File'?: string;
  Date: string;
  'Disbursed Amount'?: string;
  'Commission Rate'?: string;
  'Payout Amount': string;
  Description?: string;
  'Dispute Status': DisputeStatus;
  'Payout Request': string; // 'True' | 'False' | 'Requested' | 'Approved' | etc.
}

// File Audit Log Entry
export interface FileAuditLogEntry {
  id: string;
  'Log Entry ID': string;
  File: string;
  Timestamp: string;
  Actor: string;
  'Action/Event Type': string;
  'Details/Message': string;
  'Target User/Role'?: string;
  Resolved: string; // 'True' | 'False'
}

// Admin Activity Log Entry
export interface AdminActivityLogEntry {
  id: string;
  'Activity ID': string;
  Timestamp: string;
  'Performed By': string;
  'Action Type': string;
  'Description/Details': string;
  'Target Entity'?: string;
}

// Daily Summary Report
export interface DailySummaryReport {
  id: string;
  'Report Date': string;
  'Summary Content': string;
  'Generated Timestamp': string;
  'Delivered To'?: string | string[];
}

// Client entity (from Airtable Clients table)
export interface ClientEntity {
  id: string;
  'Client ID': string;
  'Client Name': string;
  'Primary Contact Name'?: string;
  'Contact Email / Phone'?: string;
  'Assigned KAM'?: string;
  'Enabled Modules'?: string;
  'Commission Rate'?: string; // e.g., "1.5" for 1.5%
  'Status'?: string;
  'Form Categories'?: string;
}

// Query Entry (stored in File Auditing Log or Queries table)
export interface QueryEntry {
  id: string;
  'Log Entry ID'?: string;
  File?: string;
  Timestamp: string;
  Actor: string;
  'Action/Event Type': string;
  'Details/Message': string; // Contains embedded metadata: [[parent:<id>]][[status:<open|resolved>]] message
  'Target User/Role'?: string;
  Resolved: string; // 'True' | 'False'
  // Alternative field names if stored in Queries table
  Content?: string;
  content?: string;
  file?: string;
}

// Notification Entry
export interface NotificationEntry {
  id: string;
  'Notification ID': string;
  'Recipient User'?: string;
  'Recipient Role'?: string;
  'Related File'?: string;
  'Related Client'?: string;
  'Related Ledger Entry'?: string;
  'Notification Type': string;
  'Title': string;
  'Message': string;
  'Channel': string; // 'email' | 'in_app' | 'both'
  'Is Read': string; // 'True' | 'False'
  'Created At': string;
  'Read At'?: string;
  'Action Link'?: string;
}

// n8n GET Response Structure (all tables in parallel)
export interface N8nGetResponse {
  'Admin Activity log'?: AdminActivityLogEntry[];
  'Client Form Mapping'?: ClientFormMapping[];
  'Clients'?: ClientEntity[]; // Added Clients table
  'Commission Ledger'?: CommissionLedgerEntry[];
  'Credit Team Users'?: CreditTeamUser[];
  'Daily summary Reports'?: DailySummaryReport[];
  'File Auditing Log'?: FileAuditLogEntry[];
  'Form Categories'?: FormCategory[];
  'Form Fields'?: FormField[];
  'KAM Users'?: KAMUser[];
  'Loan Applications'?: LoanApplication[];
  'Loan Products'?: LoanProduct[];
  'NBFC Partners'?: NBFCPartner[];
  'Notifications'?: NotificationEntry[]; // Notifications table
  'Queries'?: QueryEntry[]; // Queries table (if exists in Airtable)
  'User Accounts'?: UserAccount[];
}

