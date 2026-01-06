/**
 * Centralized n8n Webhook Endpoints Configuration
 * 
 * This file defines all n8n webhook paths and Airtable table mappings
 * as per SEVEN-DASHBOARD-2.json to ensure consistency across the codebase.
 * 
 * POST endpoints: Used for creating/updating records
 * GET endpoints: Used for searching/fetching records
 * 
 * Base URL: https://fixrrahul.app.n8n.cloud/webhook/
 */

import dotenv from 'dotenv';

dotenv.config();

if (!process.env.N8N_BASE_URL) {
  throw new Error('N8N_BASE_URL environment variable is required. Please set it in your environment configuration.');
}

const N8N_BASE_URL = process.env.N8N_BASE_URL;

/**
 * Airtable Table IDs from SEVEN-DASHBOARD-2.json
 */
export const AIRTABLE_TABLE_IDS = {
  ADMIN_ACTIVITY_LOG: 'tbl8qJ3xK5vF2hNpL', // Admin Activity log
  CLIENT_FORM_MAPPING: 'tbl70C8uPKmoLkOQJ', // Client Form Mapping
  CLIENTS: 'tblK8mN3pQvR5sT7u', // Clients
  COMMISSION_LEDGER: 'tblrBWFuPYBI4WWtn', // Commission Ledger
  CREDIT_TEAM_USERS: 'tblX9yZ2wV4nM6pQ8', // Credit Team Users
  DAILY_SUMMARY_REPORTS: 'tbla3urDb8kCsO0Et', // Daily summary Reports
  FILE_AUDITING_LOG: 'tblL1XJnqW3Q15ueZ', // File Auditing Log
  FORM_CATEGORIES: 'tblqCqXV0Hds0t0bH', // Form Categories
  FORM_FIELDS: 'tbl5oZ6zI0dc5eutw', // Form Fields
  KAM_USERS: 'tblM7nP4rS9tU2vW5', // KAM Users
  LOAN_APPLICATIONS: 'tblN8oQ5sT0vX3yZ6', // Loan Applications
  LOAN_PRODUCTS: 'tblO9pR6uU1wY4zA7', // Loan Products
  NBFC_PARTNERS: 'tblP0qS7vV2xZ5bB8', // NBFC Partners
  NOTIFICATIONS: 'tblmprms0l3yQjVdx', // Notifications
  USER_ACCOUNTS: 'tblQ1rT8wW3yA6cC9', // User Accounts
} as const;

/**
 * Airtable Table Names (as used in fetchTable calls)
 */
export const AIRTABLE_TABLE_NAMES = {
  ADMIN_ACTIVITY_LOG: 'Admin Activity Log',
  CLIENT_FORM_MAPPING: 'Client Form Mapping',
  CLIENTS: 'Clients',
  COMMISSION_LEDGER: 'Commission Ledger',
  CREDIT_TEAM_USERS: 'Credit Team Users',
  DAILY_SUMMARY_REPORTS: 'Daily Summary Report',
  FILE_AUDITING_LOG: 'File Auditing Log',
  FORM_CATEGORIES: 'Form Categories',
  FORM_FIELDS: 'Form Fields',
  KAM_USERS: 'KAM Users',
  LOAN_APPLICATIONS: 'Loan Application',
  LOAN_PRODUCTS: 'Loan Products',
  NBFC_PARTNERS: 'NBFC Partners',
  NOTIFICATIONS: 'Notifications',
  USER_ACCOUNTS: 'User Accounts',
} as const;

/**
 * n8n POST Webhook Paths (for creating/updating records)
 * These match the POST webhook node paths in SEVEN-DASHBOARD-2.json
 */
export const N8N_POST_WEBHOOK_PATHS = {
  // Admin Activity Log
  POST_LOG: 'POSTLOG',
  
  // Client Form Mapping
  POST_CLIENT_FORM_MAPPING: 'POSTCLIENTFORMMAPPING',
  
  // Commission Ledger
  COMMISSION_LEDGER: 'COMISSIONLEDGER',
  
  // Credit Team Users
  CREDIT_TEAM_USERS: 'CREDITTEAMUSERS',
  
  // Daily Summary Reports
  DAILY_SUMMARY: 'DAILYSUMMARY',
  
  // File Auditing Log
  FILE_AUDIT_LOG: 'Fileauditinglog',
  
  // Form Categories
  FORM_CATEGORY: 'FormCategory',
  
  // Form Fields
  FORM_FIELDS: 'FormFields',
  
  // KAM Users
  KAM_USERS: 'KAMusers',
  
  // Loan Applications (plural for POST)
  LOAN_APPLICATIONS: 'loanapplications',
  
  // Loan Products
  LOAN_PRODUCTS: 'loanproducts',
  
  // NBFC Partners
  NBFC_PARTNERS: 'NBFCPartners',
  
  // User Accounts (Add User)
  ADD_USER: 'adduser',
  
  // Clients
  CLIENT: 'Client',
  
  // Notifications
  NOTIFICATION: 'notification',
  
  // Email (Outlook Send a message)
  EMAIL: 'email',
} as const;

/**
 * n8n GET Webhook Paths (for searching/fetching records)
 * These match the GET webhook node paths in SEVEN-DASHBOARD-2.json
 */
export const N8N_GET_WEBHOOK_PATHS = {
  // Admin Activity Log (note: capital A in n8n workflow)
  ADMIN_ACTIVITY: 'Adminactivity',
  
  // Client Form Mapping
  CLIENT_FORM_MAPPING: 'clientformmapping',
  
  // Clients
  CLIENT: 'client',
  
  // Commission Ledger
  COMMISSION_LEDGER: 'commisionledger',
  
  // Credit Team Users
  CREDIT_TEAM_USER: 'creditteamuser',
  
  // Daily Summary Reports
  DAILY_SUMMARY_REPORT: 'dailysummaryreport',
  
  // File Auditing Log
  FILE_AUDITING_LOG: 'fileauditinglog',
  
  // Form Categories
  FORM_CATEGORIES: 'formcategories',
  
  // Form Fields
  FORM_FIELDS: 'formfields',
  
  // KAM Users
  KAM_USERS: 'kamusers',
  
  // Loan Applications (singular for GET)
  LOAN_APPLICATION: 'loanapplication',
  
  // Loan Products
  LOAN_PRODUCTS: 'loanproducts',
  
  // NBFC Partners
  NBFC_PARTNERS: 'nbfcpartners',
  
  // Notifications
  NOTIFICATIONS: 'notifications',
  
  // User Accounts
  USER_ACCOUNT: 'useraccount',
} as const;

/**
 * Helper function to build full POST webhook URL
 */
export function getPostWebhookUrl(path: keyof typeof N8N_POST_WEBHOOK_PATHS): string {
  const webhookPath = N8N_POST_WEBHOOK_PATHS[path];
  return `${N8N_BASE_URL}/webhook/${webhookPath}`;
}

/**
 * Helper function to build full GET webhook URL
 */
export function getGetWebhookUrl(path: keyof typeof N8N_GET_WEBHOOK_PATHS): string {
  const webhookPath = N8N_GET_WEBHOOK_PATHS[path];
  return `${N8N_BASE_URL}/webhook/${webhookPath}`;
}

/**
 * Map Airtable table name to GET webhook path
 */
export function getTableToGetWebhookPath(): Record<string, keyof typeof N8N_GET_WEBHOOK_PATHS> {
  return {
    [AIRTABLE_TABLE_NAMES.ADMIN_ACTIVITY_LOG]: 'ADMIN_ACTIVITY',
    [AIRTABLE_TABLE_NAMES.CLIENT_FORM_MAPPING]: 'CLIENT_FORM_MAPPING',
    [AIRTABLE_TABLE_NAMES.CLIENTS]: 'CLIENT',
    [AIRTABLE_TABLE_NAMES.COMMISSION_LEDGER]: 'COMMISSION_LEDGER',
    [AIRTABLE_TABLE_NAMES.CREDIT_TEAM_USERS]: 'CREDIT_TEAM_USER',
    [AIRTABLE_TABLE_NAMES.DAILY_SUMMARY_REPORTS]: 'DAILY_SUMMARY_REPORT',
    [AIRTABLE_TABLE_NAMES.FILE_AUDITING_LOG]: 'FILE_AUDITING_LOG',
    [AIRTABLE_TABLE_NAMES.FORM_CATEGORIES]: 'FORM_CATEGORIES',
    [AIRTABLE_TABLE_NAMES.FORM_FIELDS]: 'FORM_FIELDS',
    [AIRTABLE_TABLE_NAMES.KAM_USERS]: 'KAM_USERS',
    [AIRTABLE_TABLE_NAMES.LOAN_APPLICATIONS]: 'LOAN_APPLICATION',
    [AIRTABLE_TABLE_NAMES.LOAN_PRODUCTS]: 'LOAN_PRODUCTS',
    [AIRTABLE_TABLE_NAMES.NBFC_PARTNERS]: 'NBFC_PARTNERS',
    [AIRTABLE_TABLE_NAMES.NOTIFICATIONS]: 'NOTIFICATIONS',
    [AIRTABLE_TABLE_NAMES.USER_ACCOUNTS]: 'USER_ACCOUNT',
  };
}

/**
 * Map Airtable table name to POST webhook path
 */
export function getTableToPostWebhookPath(): Record<string, keyof typeof N8N_POST_WEBHOOK_PATHS> {
  return {
    [AIRTABLE_TABLE_NAMES.ADMIN_ACTIVITY_LOG]: 'POST_LOG',
    [AIRTABLE_TABLE_NAMES.CLIENT_FORM_MAPPING]: 'POST_CLIENT_FORM_MAPPING',
    [AIRTABLE_TABLE_NAMES.CLIENTS]: 'CLIENT',
    [AIRTABLE_TABLE_NAMES.COMMISSION_LEDGER]: 'COMMISSION_LEDGER',
    [AIRTABLE_TABLE_NAMES.CREDIT_TEAM_USERS]: 'CREDIT_TEAM_USERS',
    [AIRTABLE_TABLE_NAMES.DAILY_SUMMARY_REPORTS]: 'DAILY_SUMMARY',
    [AIRTABLE_TABLE_NAMES.FILE_AUDITING_LOG]: 'FILE_AUDIT_LOG',
    [AIRTABLE_TABLE_NAMES.FORM_CATEGORIES]: 'FORM_CATEGORY',
    [AIRTABLE_TABLE_NAMES.FORM_FIELDS]: 'FORM_FIELDS',
    [AIRTABLE_TABLE_NAMES.KAM_USERS]: 'KAM_USERS',
    [AIRTABLE_TABLE_NAMES.LOAN_APPLICATIONS]: 'LOAN_APPLICATIONS',
    [AIRTABLE_TABLE_NAMES.LOAN_PRODUCTS]: 'LOAN_PRODUCTS',
    [AIRTABLE_TABLE_NAMES.NBFC_PARTNERS]: 'NBFC_PARTNERS',
    [AIRTABLE_TABLE_NAMES.NOTIFICATIONS]: 'NOTIFICATION',
    [AIRTABLE_TABLE_NAMES.USER_ACCOUNTS]: 'ADD_USER',
  };
}

/**
 * Complete n8n endpoint configuration with environment variable overrides
 */
export const n8nEndpoints = {
  // POST Webhook URLs (with env var overrides)
  post: {
    log: process.env.N8N_POST_LOG_URL || getPostWebhookUrl('POST_LOG'),
    clientFormMapping: process.env.N8N_POST_CLIENT_FORM_MAPPING_URL || getPostWebhookUrl('POST_CLIENT_FORM_MAPPING'),
    commissionLedger: process.env.N8N_POST_COMMISSION_LEDGER_URL || getPostWebhookUrl('COMMISSION_LEDGER'),
    creditTeamUsers: process.env.N8N_POST_CREDIT_TEAM_USERS_URL || getPostWebhookUrl('CREDIT_TEAM_USERS'),
    dailySummary: process.env.N8N_POST_DAILY_SUMMARY_URL || getPostWebhookUrl('DAILY_SUMMARY'),
    fileAuditLog: process.env.N8N_POST_FILE_AUDIT_LOG_URL || getPostWebhookUrl('FILE_AUDIT_LOG'),
    formCategory: process.env.N8N_POST_FORM_CATEGORY_URL || getPostWebhookUrl('FORM_CATEGORY'),
    formFields: process.env.N8N_POST_FORM_FIELDS_URL || getPostWebhookUrl('FORM_FIELDS'),
    kamUsers: process.env.N8N_POST_KAM_USERS_URL || getPostWebhookUrl('KAM_USERS'),
    loanApplications: process.env.N8N_POST_APPLICATIONS_URL || getPostWebhookUrl('LOAN_APPLICATIONS'),
    loanProducts: process.env.N8N_POST_LOAN_PRODUCTS_URL || getPostWebhookUrl('LOAN_PRODUCTS'),
    nbfcPartners: process.env.N8N_POST_NBFC_PARTNERS_URL || getPostWebhookUrl('NBFC_PARTNERS'),
    addUser: process.env.N8N_POST_ADD_USER_URL || getPostWebhookUrl('ADD_USER'),
    client: process.env.N8N_POST_CLIENT_URL || getPostWebhookUrl('CLIENT'),
    notification: process.env.N8N_POST_NOTIFICATION_URL || getPostWebhookUrl('NOTIFICATION'),
    email: process.env.N8N_POST_EMAIL_URL || getPostWebhookUrl('EMAIL'),
  },
  
  // GET Webhook URLs (with env var overrides)
  get: {
    adminActivity: process.env.N8N_GET_ADMIN_ACTIVITY_URL || getGetWebhookUrl('ADMIN_ACTIVITY'),
    clientFormMapping: process.env.N8N_GET_CLIENT_FORM_MAPPING_URL || getGetWebhookUrl('CLIENT_FORM_MAPPING'),
    client: process.env.N8N_GET_CLIENT_URL || getGetWebhookUrl('CLIENT'),
    commissionLedger: process.env.N8N_GET_COMMISSION_LEDGER_URL || getGetWebhookUrl('COMMISSION_LEDGER'),
    creditTeamUser: process.env.N8N_GET_CREDIT_TEAM_USER_URL || getGetWebhookUrl('CREDIT_TEAM_USER'),
    dailySummaryReport: process.env.N8N_GET_DAILY_SUMMARY_REPORT_URL || getGetWebhookUrl('DAILY_SUMMARY_REPORT'),
    fileAuditingLog: process.env.N8N_GET_FILE_AUDITING_LOG_URL || getGetWebhookUrl('FILE_AUDITING_LOG'),
    formCategories: process.env.N8N_GET_FORM_CATEGORIES_URL || getGetWebhookUrl('FORM_CATEGORIES'),
    formFields: process.env.N8N_GET_FORM_FIELDS_URL || getGetWebhookUrl('FORM_FIELDS'),
    kamUsers: process.env.N8N_GET_KAM_USERS_URL || getGetWebhookUrl('KAM_USERS'),
    loanApplication: process.env.N8N_GET_LOAN_APPLICATION_URL || getGetWebhookUrl('LOAN_APPLICATION'),
    loanProducts: process.env.N8N_GET_LOAN_PRODUCTS_URL || getGetWebhookUrl('LOAN_PRODUCTS'),
    nbfcPartners: process.env.N8N_GET_NBFC_PARTNERS_URL || getGetWebhookUrl('NBFC_PARTNERS'),
    notifications: process.env.N8N_GET_NOTIFICATIONS_URL || getGetWebhookUrl('NOTIFICATIONS'),
    userAccount: process.env.N8N_GET_USER_ACCOUNTS_URL || getGetWebhookUrl('USER_ACCOUNT'),
  },
} as const;

