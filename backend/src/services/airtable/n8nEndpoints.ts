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

/** Old n8n origin. Paths that are not in the 32-path LMS set stay here. */
const DEFAULT_N8N_BASE_URL = 'https://fixrrahul.app.n8n.cloud';
/** LMS webhook base. Includes /webhook. No trailing slash. */
const DEFAULT_N8N_LMS_BASE_URL = 'https://n8n-fvmj.srv1499064.hstgr.cloud/webhook';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Origin only (no /webhook). Email, qualify, PAN, CIBIL, and dropped paths use this. */
const N8N_LEGACY_ORIGIN = stripTrailingSlash(
  (process.env.N8N_LEGACY_BASE_URL || process.env.N8N_BASE_URL || DEFAULT_N8N_BASE_URL).replace(
    /\/webhook$/i,
    ''
  )
);

/** Webhook base for the 32 LMS paths. Exactly one slash is added before the path. */
const N8N_LMS_BASE_URL = stripTrailingSlash(process.env.N8N_LMS_BASE_URL || DEFAULT_N8N_LMS_BASE_URL);

function lmsWebhook(path: string): string {
  return `${N8N_LMS_BASE_URL}/${path.replace(/^\/+/, '')}`;
}

const N8N_BASE_URL = N8N_LEGACY_ORIGIN;

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
  FORM_LINK: 'FormLinkTable', // Form Link (Client ID, Form link, Product ID, Mapping ID)
  RECORD_TITLES: 'RecordTitlesTable', // Record Titles (Mapping ID, Record Title, Display Order)
  KAM_USERS: 'tblM7nP4rS9tU2vW5', // KAM Users
  LOAN_APPLICATIONS: 'tblN8oQ5sT0vX3yZ6', // Loan Applications
  LOAN_PRODUCTS: 'tblVukvj8kn5gWBta', // Loan Products
  PRODUCT_DOCUMENTS: 'tblProductDocuments', // Product Documents (Product ID, Record Title, Display Order, Is Required)
  NBFC_PARTNERS: 'tblP0qS7vV2xZ5bB8', // NBFC Partners
  NOTIFICATIONS: 'tblmprms0l3yQjVdx', // Notifications
  USER_ACCOUNTS: 'tblQ1rT8wW3yA6cC9', // User Accounts
  VEHICLES: 'tblVehicles', // Vehicles (Make/Model/Loan Amount catalog)
  CLIENT_KYC: 'tblClientKYC', // Client KYC (dealer profile for B2C EV form auto-fill)
  NBFC_BRE_CONFIG: 'tblNbfcBreConfig', // NBFC BRE Config (CIBIL chances / lender bands)
  NBFC_BRE_CHECKPOINTS: 'tblNbfcBreCheckpoints', // NBFC BRE Checkpoints (pass/fail rules)
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
  FORM_LINK: 'Form Link',
  RECORD_TITLES: 'Record Titles',
  KAM_USERS: 'KAM Users',
  LOAN_APPLICATIONS: 'Loan Application',
  LOAN_PRODUCTS: 'Loan Products',
  PRODUCT_DOCUMENTS: 'Product Documents',
  NBFC_PARTNERS: 'NBFC Partners',
  NOTIFICATIONS: 'Notifications',
  USER_ACCOUNTS: 'User Accounts',
  VEHICLES: 'Vehicles',
  CLIENT_KYC: 'Client KYC',
  NBFC_BRE_CONFIG: 'NBFC BRE Config',
  NBFC_BRE_CHECKPOINTS: 'NBFC BRE Checkpoints',
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
  
  // File Auditing Log (standalone workflow path in n8n)
  FILE_AUDIT_LOG: 'Fileauditinglog1',
  
  // Form Categories
  FORM_CATEGORY: 'FormCategory',
  
  // Form Fields
  FORM_FIELDS: 'FormFields',
  
  // Form Link (new simple config) — n8n path: Formlink
  FORM_LINK: 'Formlink',
  
  // Record Titles (new simple config) — n8n path: Recordtitle (same as GET)
  RECORD_TITLES: 'Recordtitle',
  
  // KAM Users
  KAM_USERS: 'KAMusers',
  
  // Loan Applications (standalone workflow path in n8n)
  LOAN_APPLICATIONS: 'loanapplications1',
  
  // Loan Products (standalone workflow path in n8n)
  LOAN_PRODUCTS: 'loanproducts1',
  
  // Product Documents (product-centric form config)
  PRODUCT_DOCUMENTS: 'productdocument',
  
  // NBFC Partners (standalone workflow path in n8n)
  NBFC_PARTNERS: 'NBFCPartners1',
  
  // User Accounts (Add User)
  ADD_USER: 'adduser',
  
  // Clients
  CLIENT: 'Client',
  
  // Notifications
  NOTIFICATION: 'notification',
  
  // Email (Outlook Send a message)
  EMAIL: 'email',
  // Vehicles
  VEHICLES: 'VehiclesPOST1',
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
  
  // Form Link (new simple config) — n8n path: formlink
  FORM_LINK: 'formlink',
  
  // Record Titles (new simple config) — n8n path: Recordtitle
  RECORD_TITLES: 'Recordtitle',
  
  // KAM Users
  KAM_USERS: 'kamusers',
  
  // Loan Applications (singular for GET)
  LOAN_APPLICATION: 'loanapplication',
  
  // Loan Products
  LOAN_PRODUCTS: 'loanproducts',
  
  // Product Documents (product-centric form config)
  PRODUCT_DOCUMENTS: 'productdocument',
  
  // NBFC Partners
  NBFC_PARTNERS: 'nbfcpartners',
  
  // Notifications
  NOTIFICATIONS: 'notifications',
  
  // User Accounts
  USER_ACCOUNT: 'useraccount',
  VEHICLES: 'VehiclesGET1',
  CLIENT_KYC: 'getclientKYC',
  /** Lender BRE pricing bands. Alias of NBFC_BRE_CONFIG. */
  LENDER_BRE: 'lenderbre',
  NBFC_BRE_CONFIG: 'lenderbre',
  /** Lender BRE pass/fail checkpoints. */
  LENDER_BRE_CHECKPOINTS: 'lenderbreconfig',
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
    [AIRTABLE_TABLE_NAMES.FORM_LINK]: 'FORM_LINK',
    [AIRTABLE_TABLE_NAMES.RECORD_TITLES]: 'RECORD_TITLES',
    [AIRTABLE_TABLE_NAMES.KAM_USERS]: 'KAM_USERS',
    [AIRTABLE_TABLE_NAMES.LOAN_APPLICATIONS]: 'LOAN_APPLICATION',
    [AIRTABLE_TABLE_NAMES.LOAN_PRODUCTS]: 'LOAN_PRODUCTS',
    [AIRTABLE_TABLE_NAMES.PRODUCT_DOCUMENTS]: 'PRODUCT_DOCUMENTS',
    [AIRTABLE_TABLE_NAMES.NBFC_PARTNERS]: 'NBFC_PARTNERS',
    [AIRTABLE_TABLE_NAMES.NOTIFICATIONS]: 'NOTIFICATIONS',
    [AIRTABLE_TABLE_NAMES.USER_ACCOUNTS]: 'USER_ACCOUNT',
    [AIRTABLE_TABLE_NAMES.VEHICLES]: 'VEHICLES',
    [AIRTABLE_TABLE_NAMES.CLIENT_KYC]: 'CLIENT_KYC',
    [AIRTABLE_TABLE_NAMES.NBFC_BRE_CONFIG]: 'NBFC_BRE_CONFIG',
    [AIRTABLE_TABLE_NAMES.NBFC_BRE_CHECKPOINTS]: 'LENDER_BRE_CHECKPOINTS',
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
    [AIRTABLE_TABLE_NAMES.FORM_LINK]: 'FORM_LINK',
    [AIRTABLE_TABLE_NAMES.RECORD_TITLES]: 'RECORD_TITLES',
    [AIRTABLE_TABLE_NAMES.KAM_USERS]: 'KAM_USERS',
    [AIRTABLE_TABLE_NAMES.LOAN_APPLICATIONS]: 'LOAN_APPLICATIONS',
    [AIRTABLE_TABLE_NAMES.LOAN_PRODUCTS]: 'LOAN_PRODUCTS',
    [AIRTABLE_TABLE_NAMES.PRODUCT_DOCUMENTS]: 'PRODUCT_DOCUMENTS',
    [AIRTABLE_TABLE_NAMES.NBFC_PARTNERS]: 'NBFC_PARTNERS',
    [AIRTABLE_TABLE_NAMES.NOTIFICATIONS]: 'NOTIFICATION',
    [AIRTABLE_TABLE_NAMES.USER_ACCOUNTS]: 'ADD_USER',
    [AIRTABLE_TABLE_NAMES.VEHICLES]: 'VEHICLES',
  };
}

/**
 * Complete n8n endpoint configuration with environment variable overrides
 */
export const n8nEndpoints = {
  // POST Webhook URLs (with env var overrides)
  post: {
    log: lmsWebhook('POSTLOG'),
    /** @deprecated Form config now uses Form Link + Record Titles */
    clientFormMapping: process.env.N8N_POST_CLIENT_FORM_MAPPING_URL || getPostWebhookUrl('POST_CLIENT_FORM_MAPPING'),
    commissionLedger: lmsWebhook('COMISSIONLEDGER'),
    creditTeamUsers: lmsWebhook('CREDITTEAMUSERS'),
    dailySummary: lmsWebhook('DAILYSUMMARY'),
    fileAuditLog: process.env.N8N_POST_FILE_AUDIT_LOG_URL || getPostWebhookUrl('FILE_AUDIT_LOG'),
    /** @deprecated Form config now uses Form Link + Record Titles */
    formCategory: process.env.N8N_POST_FORM_CATEGORY_URL || getPostWebhookUrl('FORM_CATEGORY'),
    /** @deprecated Form config now uses Form Link + Record Titles */
    formFields: process.env.N8N_POST_FORM_FIELDS_URL || getPostWebhookUrl('FORM_FIELDS'),
    formLink: process.env.N8N_POST_FORM_LINK_URL || getPostWebhookUrl('FORM_LINK'),
    recordTitles: process.env.N8N_POST_RECORD_TITLES_URL || getPostWebhookUrl('RECORD_TITLES'),
    kamUsers: lmsWebhook('KAMusers'),
    loanApplications: process.env.N8N_POST_APPLICATIONS_URL || getPostWebhookUrl('LOAN_APPLICATIONS'),
    loanProducts: process.env.N8N_POST_LOAN_PRODUCTS_URL || getPostWebhookUrl('LOAN_PRODUCTS'),
    productDocuments: lmsWebhook('productdocument'),
    nbfcPartners: process.env.N8N_POST_NBFC_PARTNERS_URL || getPostWebhookUrl('NBFC_PARTNERS'),
    addUser: lmsWebhook('adduser'),
    client: lmsWebhook('Client'),
    notification: lmsWebhook('notification'),
    email: process.env.N8N_POST_EMAIL_URL || getPostWebhookUrl('EMAIL'),
    userAccountValidate: process.env.N8N_POST_USER_ACCOUNT_VALIDATE_URL || getGetWebhookUrl('USER_ACCOUNT'),
    link: process.env.N8N_LINK_WEBHOOK_URL || `${N8N_BASE_URL}/webhook/3212b705-b54a-4d4e-9648-e7a6bfb06d2b`,
  },

  // PATCH Webhook URLs (Form Link, Record Titles, Product Documents, Loan Products)
  patch: {
    formLink: process.env.N8N_PATCH_FORM_LINK_URL || `${N8N_BASE_URL}/webhook/formlink` as string,
    recordTitles: process.env.N8N_PATCH_RECORD_TITLES_URL || `${N8N_BASE_URL}/webhook/recordtitle` as string,
    productDocuments: lmsWebhook('productdocument'),
    loanProducts: lmsWebhook('loanproducts'),
  },

  // DELETE Webhook URLs (Form Link, Record Titles, Product Documents, Loan Products)
  delete: {
    formLink: process.env.N8N_DELETE_FORM_LINK_URL || `${N8N_BASE_URL}/webhook/formlink`,
    recordTitles: process.env.N8N_DELETE_RECORD_TITLES_URL || `${N8N_BASE_URL}/webhook/recordtitle`,
    productDocuments: lmsWebhook('productdocument'),
    loanProducts: process.env.N8N_DELETE_LOAN_PRODUCTS_URL || `${N8N_BASE_URL}/webhook/loanproducts`,
  },

  // GET Webhook URLs (with env var overrides)
  get: {
    adminActivity: lmsWebhook('Adminactivity'),
    /** @deprecated Form config now uses Form Link + Record Titles */
    clientFormMapping: process.env.N8N_GET_CLIENT_FORM_MAPPING_URL || getGetWebhookUrl('CLIENT_FORM_MAPPING'),
    client: lmsWebhook('client'),
    commissionLedger: lmsWebhook('commisionledger'),
    creditTeamUser: lmsWebhook('creditteamuser'),
    dailySummaryReport: lmsWebhook('dailysummaryreport'),
    fileAuditingLog: lmsWebhook('fileauditinglog'),
    /** @deprecated Form config now uses Form Link + Record Titles */
    formCategories: process.env.N8N_GET_FORM_CATEGORIES_URL || getGetWebhookUrl('FORM_CATEGORIES'),
    /** @deprecated Form config now uses Form Link + Record Titles */
    formFields: process.env.N8N_GET_FORM_FIELDS_URL || getGetWebhookUrl('FORM_FIELDS'),
    formLink: process.env.N8N_GET_FORM_LINK_URL || getGetWebhookUrl('FORM_LINK'),
    recordTitles: process.env.N8N_GET_RECORD_TITLES_URL || getGetWebhookUrl('RECORD_TITLES'),
    kamUsers: lmsWebhook('kamusers'),
    loanApplication: lmsWebhook('loanapplication'),
    loanProducts: lmsWebhook('loanproducts'),
    productDocuments: lmsWebhook('productdocument'),
    nbfcPartners: lmsWebhook('nbfcpartners'),
    notifications: lmsWebhook('notifications'),
    userAccount: lmsWebhook('useraccount'),
    vehicles: lmsWebhook('VehiclesGET1'),
    clientKyc: lmsWebhook('getclientKYC'),
    cibilRateMatrix:
      process.env.CIBIL_RATE_MATRIX_WEBHOOK_URL ||
      'https://fixrrahul.app.n8n.cloud/webhook/getmatrix',
    nbfcBreConfig: lmsWebhook('lenderbre'),
    lenderBreCheckpoints: lmsWebhook('lenderbreconfig'),
  },
  vehicles: {
    post: lmsWebhook('VehiclesPOST1'),
    patch: lmsWebhook('VehiclesPatch1'),
    delete: lmsWebhook('VehiclesDelete1'),
  },
} as const;

