/**
 * Centralized n8n Webhook Endpoints Configuration
 * 
 * This file defines all n8n webhook paths and Airtable table mappings
 * as per SEVEN-DASHBOARD-2.json to ensure consistency across the codebase.
 * 
 * POST endpoints: Used for creating/updating records
 * GET endpoints: Used for searching/fetching records
 * 
 * LMS calls use N8N_LMS_BASE_URL (Hostinger). Calls with no Hostinger path use
 * N8N_LEGACY_BASE_URL. Neither base falls back to a hardcoded host.
 */

import dotenv from 'dotenv';

dotenv.config();

const LMS_BASE_MISSING =
  'N8N_LMS_BASE_URL is required. Set it to https://n8n-fvmj.srv1499064.hstgr.cloud (no /webhook suffix). Refusing to use the old n8n host.';

const LEGACY_BASE_MISSING =
  'N8N_LEGACY_BASE_URL is required for webhooks that are not on Hostinger yet. Refusing to use a hardcoded n8n host.';

/** Strip a trailing slash and a trailing /webhook so callers can pass either form. */
export function normalizeN8nOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
}

export function readLmsBaseUrl(): string {
  const raw = process.env.N8N_LMS_BASE_URL?.trim();
  if (!raw) {
    throw new Error(LMS_BASE_MISSING);
  }
  const base = normalizeN8nOrigin(raw);
  if (/app\.n8n\.cloud/i.test(base)) {
    throw new Error(
      'N8N_LMS_BASE_URL points at the old n8n host. Set it to https://n8n-fvmj.srv1499064.hstgr.cloud.'
    );
  }
  return base;
}

export function readLegacyBaseUrl(): string {
  const raw = process.env.N8N_LEGACY_BASE_URL?.trim();
  if (!raw) {
    throw new Error(LEGACY_BASE_MISSING);
  }
  return normalizeN8nOrigin(raw);
}

/** Log one error and throw when the LMS base is missing. Call at process startup. */
export function assertN8nLmsBaseUrl(): string {
  try {
    return readLmsBaseUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    throw error;
  }
}

export function lmsWebhook(path: string): string {
  return `${readLmsBaseUrl()}/webhook/${path}`;
}

export function legacyWebhook(path: string): string {
  return `${readLegacyBaseUrl()}/webhook/${path}`;
}

function envOr(envName: string, build: () => string): string {
  const override = process.env[envName]?.trim();
  return override || build();
}

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

  // Client KYC
  CLIENT_KYC: 'clientkyc',
  
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
/** POST paths that exist on the Hostinger LMS n8n. Everything else stays on the legacy base. */
const LMS_POST_PATHS = new Set<keyof typeof N8N_POST_WEBHOOK_PATHS>([
  'POST_LOG',
  'COMMISSION_LEDGER',
  'CREDIT_TEAM_USERS',
  'DAILY_SUMMARY',
  'FILE_AUDIT_LOG',
  'KAM_USERS',
  'LOAN_APPLICATIONS',
  'PRODUCT_DOCUMENTS',
  'NBFC_PARTNERS',
  'ADD_USER',
  'CLIENT',
  'NOTIFICATION',
  'VEHICLES',
]);

export function getPostWebhookUrl(path: keyof typeof N8N_POST_WEBHOOK_PATHS): string {
  const webhookPath = N8N_POST_WEBHOOK_PATHS[path];
  return LMS_POST_PATHS.has(path) ? lmsWebhook(webhookPath) : legacyWebhook(webhookPath);
}

/**
 * Helper function to build full GET webhook URL
 */
/** GET paths that exist on the Hostinger LMS n8n. formlink / Recordtitle stay on the legacy base. */
const LEGACY_GET_PATHS = new Set<keyof typeof N8N_GET_WEBHOOK_PATHS>([
  'CLIENT_FORM_MAPPING',
  'FORM_CATEGORIES',
  'FORM_FIELDS',
  'FORM_LINK',
  'RECORD_TITLES',
]);

export function getGetWebhookUrl(path: keyof typeof N8N_GET_WEBHOOK_PATHS): string {
  const webhookPath = N8N_GET_WEBHOOK_PATHS[path];
  return LEGACY_GET_PATHS.has(path) ? legacyWebhook(webhookPath) : lmsWebhook(webhookPath);
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
    [AIRTABLE_TABLE_NAMES.CLIENT_KYC]: 'CLIENT_KYC',
    [AIRTABLE_TABLE_NAMES.VEHICLES]: 'VEHICLES',
  };
}

/**
 * Complete n8n endpoint configuration with environment variable overrides.
 * Getters resolve the base at call time so a missing legacy base does not
 * block LMS calls such as login.
 */
export const n8nEndpoints = {
  post: {
    get log() { return envOr('N8N_POST_LOG_URL', () => getPostWebhookUrl('POST_LOG')); },
    /** @deprecated Form config now uses Form Link + Record Titles */
    get clientFormMapping() { return envOr('N8N_POST_CLIENT_FORM_MAPPING_URL', () => getPostWebhookUrl('POST_CLIENT_FORM_MAPPING')); },
    get commissionLedger() { return envOr('N8N_POST_COMMISSION_LEDGER_URL', () => getPostWebhookUrl('COMMISSION_LEDGER')); },
    get creditTeamUsers() { return envOr('N8N_POST_CREDIT_TEAM_USERS_URL', () => getPostWebhookUrl('CREDIT_TEAM_USERS')); },
    get dailySummary() { return envOr('N8N_POST_DAILY_SUMMARY_URL', () => getPostWebhookUrl('DAILY_SUMMARY')); },
    get fileAuditLog() { return envOr('N8N_POST_FILE_AUDIT_LOG_URL', () => getPostWebhookUrl('FILE_AUDIT_LOG')); },
    /** @deprecated Form config now uses Form Link + Record Titles */
    get formCategory() { return envOr('N8N_POST_FORM_CATEGORY_URL', () => getPostWebhookUrl('FORM_CATEGORY')); },
    /** @deprecated Form config now uses Form Link + Record Titles */
    get formFields() { return envOr('N8N_POST_FORM_FIELDS_URL', () => getPostWebhookUrl('FORM_FIELDS')); },
    get formLink() { return envOr('N8N_POST_FORM_LINK_URL', () => getPostWebhookUrl('FORM_LINK')); },
    get recordTitles() { return envOr('N8N_POST_RECORD_TITLES_URL', () => getPostWebhookUrl('RECORD_TITLES')); },
    get kamUsers() { return envOr('N8N_POST_KAM_USERS_URL', () => getPostWebhookUrl('KAM_USERS')); },
    get loanApplications() { return envOr('N8N_POST_APPLICATIONS_URL', () => getPostWebhookUrl('LOAN_APPLICATIONS')); },
    get loanProducts() { return envOr('N8N_POST_LOAN_PRODUCTS_URL', () => getPostWebhookUrl('LOAN_PRODUCTS')); },
    get productDocuments() { return envOr('N8N_POST_PRODUCT_DOCUMENTS_URL', () => getPostWebhookUrl('PRODUCT_DOCUMENTS')); },
    get nbfcPartners() { return envOr('N8N_POST_NBFC_PARTNERS_URL', () => getPostWebhookUrl('NBFC_PARTNERS')); },
    get addUser() { return envOr('N8N_POST_ADD_USER_URL', () => getPostWebhookUrl('ADD_USER')); },
    get client() { return envOr('N8N_POST_CLIENT_URL', () => getPostWebhookUrl('CLIENT')); },
    get clientKyc() { return envOr('N8N_POST_CLIENT_KYC_URL', () => getPostWebhookUrl('CLIENT_KYC')); },
    get notification() { return envOr('N8N_POST_NOTIFICATION_URL', () => getPostWebhookUrl('NOTIFICATION')); },
    get email() { return envOr('N8N_POST_EMAIL_URL', () => getPostWebhookUrl('EMAIL')); },
    get userAccountValidate() { return envOr('N8N_POST_USER_ACCOUNT_VALIDATE_URL', () => getGetWebhookUrl('USER_ACCOUNT')); },
    get link() { return envOr('N8N_LINK_WEBHOOK_URL', () => legacyWebhook('3212b705-b54a-4d4e-9648-e7a6bfb06d2b')); },
  },

  patch: {
    get formLink() { return envOr('N8N_PATCH_FORM_LINK_URL', () => legacyWebhook('formlink')); },
    get recordTitles() { return envOr('N8N_PATCH_RECORD_TITLES_URL', () => legacyWebhook('recordtitle')); },
    get productDocuments() { return envOr('N8N_PATCH_PRODUCT_DOCUMENTS_URL', () => lmsWebhook('productdocument')); },
    get loanProducts() { return envOr('N8N_PATCH_LOAN_PRODUCTS_URL', () => lmsWebhook('loanproducts')); },
  },

  delete: {
    get formLink() { return envOr('N8N_DELETE_FORM_LINK_URL', () => legacyWebhook('formlink')); },
    get recordTitles() { return envOr('N8N_DELETE_RECORD_TITLES_URL', () => legacyWebhook('recordtitle')); },
    get productDocuments() { return envOr('N8N_DELETE_PRODUCT_DOCUMENTS_URL', () => lmsWebhook('productdocument')); },
    /** DELETE loanproducts is not on the Hostinger path list. */
    get loanProducts() { return envOr('N8N_DELETE_LOAN_PRODUCTS_URL', () => legacyWebhook('loanproducts')); },
  },

  get: {
    get adminActivity() { return envOr('N8N_GET_ADMIN_ACTIVITY_URL', () => getGetWebhookUrl('ADMIN_ACTIVITY')); },
    /** @deprecated Form config now uses Form Link + Record Titles */
    get clientFormMapping() { return envOr('N8N_GET_CLIENT_FORM_MAPPING_URL', () => getGetWebhookUrl('CLIENT_FORM_MAPPING')); },
    get client() { return envOr('N8N_GET_CLIENT_URL', () => getGetWebhookUrl('CLIENT')); },
    get commissionLedger() { return envOr('N8N_GET_COMMISSION_LEDGER_URL', () => getGetWebhookUrl('COMMISSION_LEDGER')); },
    get creditTeamUser() { return envOr('N8N_GET_CREDIT_TEAM_USER_URL', () => getGetWebhookUrl('CREDIT_TEAM_USER')); },
    get dailySummaryReport() { return envOr('N8N_GET_DAILY_SUMMARY_REPORT_URL', () => getGetWebhookUrl('DAILY_SUMMARY_REPORT')); },
    get fileAuditingLog() { return envOr('N8N_GET_FILE_AUDITING_LOG_URL', () => getGetWebhookUrl('FILE_AUDITING_LOG')); },
    /** @deprecated Form config now uses Form Link + Record Titles */
    get formCategories() { return envOr('N8N_GET_FORM_CATEGORIES_URL', () => getGetWebhookUrl('FORM_CATEGORIES')); },
    /** @deprecated Form config now uses Form Link + Record Titles */
    get formFields() { return envOr('N8N_GET_FORM_FIELDS_URL', () => getGetWebhookUrl('FORM_FIELDS')); },
    get formLink() { return envOr('N8N_GET_FORM_LINK_URL', () => getGetWebhookUrl('FORM_LINK')); },
    get recordTitles() { return envOr('N8N_GET_RECORD_TITLES_URL', () => getGetWebhookUrl('RECORD_TITLES')); },
    get kamUsers() { return envOr('N8N_GET_KAM_USERS_URL', () => getGetWebhookUrl('KAM_USERS')); },
    get loanApplication() { return envOr('N8N_GET_LOAN_APPLICATION_URL', () => getGetWebhookUrl('LOAN_APPLICATION')); },
    get loanProducts() { return envOr('N8N_GET_LOAN_PRODUCTS_URL', () => getGetWebhookUrl('LOAN_PRODUCTS')); },
    get productDocuments() { return envOr('N8N_GET_PRODUCT_DOCUMENTS_URL', () => getGetWebhookUrl('PRODUCT_DOCUMENTS')); },
    get nbfcPartners() { return envOr('N8N_GET_NBFC_PARTNERS_URL', () => getGetWebhookUrl('NBFC_PARTNERS')); },
    get notifications() { return envOr('N8N_GET_NOTIFICATIONS_URL', () => getGetWebhookUrl('NOTIFICATIONS')); },
    get userAccount() { return envOr('N8N_GET_USER_ACCOUNTS_URL', () => getGetWebhookUrl('USER_ACCOUNT')); },
    get vehicles() { return envOr('N8N_GET_VEHICLES_URL', () => getGetWebhookUrl('VEHICLES')); },
    get clientKyc() { return envOr('N8N_GET_CLIENT_KYC_URL', () => getGetWebhookUrl('CLIENT_KYC')); },
    get cibilRateMatrix() { return envOr('CIBIL_RATE_MATRIX_WEBHOOK_URL', () => legacyWebhook('getmatrix')); },
    get nbfcBreConfig() { return envOr('N8N_GET_NBFC_BRE_CONFIG_URL', () => getGetWebhookUrl('LENDER_BRE')); },
    get lenderBreCheckpoints() { return envOr('N8N_GET_LENDER_BRE_CHECKPOINTS_URL', () => getGetWebhookUrl('LENDER_BRE_CHECKPOINTS')); },
  },
  vehicles: {
    get post() { return envOr('N8N_POST_VEHICLES_URL', () => getPostWebhookUrl('VEHICLES')); },
  },
};

