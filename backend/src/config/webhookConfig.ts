/**
 * Individual Webhook Configuration for Backend
 * Each table has its own dedicated GET webhook URL
 * 
 * These GET webhooks map to n8n workflow paths from SEVEN-DASHBOARD-2.json
 * POST webhooks are configured in airtable.ts
 * 
 * @deprecated This file is maintained for backward compatibility.
 * New code should use n8nEndpoints from backend/src/services/airtable/n8nEndpoints.ts
 * 
 * See WEBHOOK_MAPPING_TABLE.md for complete frontend → backend → webhook → Airtable mapping
 * See n8nEndpoints.ts for centralized endpoint configuration
 */

import { n8nEndpoints, AIRTABLE_TABLE_NAMES } from '../services/airtable/n8nEndpoints.js';

export interface WebhookTableConfig {
  url: string;
  tableName: string;
}

export const WEBHOOK_CONFIG: Record<string, WebhookTableConfig> = {
  [AIRTABLE_TABLE_NAMES.ADMIN_ACTIVITY_LOG]: {
    get url() { return n8nEndpoints.get.adminActivity; },
    tableName: AIRTABLE_TABLE_NAMES.ADMIN_ACTIVITY_LOG,
  },
  // DEPRECATED: Form config now uses Form Link + Record Titles
  [AIRTABLE_TABLE_NAMES.CLIENT_FORM_MAPPING]: {
    get url() { return n8nEndpoints.get.clientFormMapping; },
    tableName: AIRTABLE_TABLE_NAMES.CLIENT_FORM_MAPPING,
  },
  [AIRTABLE_TABLE_NAMES.CLIENTS]: {
    get url() { return n8nEndpoints.get.client; },
    tableName: AIRTABLE_TABLE_NAMES.CLIENTS,
  },
  [AIRTABLE_TABLE_NAMES.COMMISSION_LEDGER]: {
    get url() { return n8nEndpoints.get.commissionLedger; },
    tableName: AIRTABLE_TABLE_NAMES.COMMISSION_LEDGER,
  },
  [AIRTABLE_TABLE_NAMES.CREDIT_TEAM_USERS]: {
    get url() { return n8nEndpoints.get.creditTeamUser; },
    tableName: AIRTABLE_TABLE_NAMES.CREDIT_TEAM_USERS,
  },
  [AIRTABLE_TABLE_NAMES.DAILY_SUMMARY_REPORTS]: {
    get url() { return n8nEndpoints.get.dailySummaryReport; },
    tableName: AIRTABLE_TABLE_NAMES.DAILY_SUMMARY_REPORTS,
  },
  [AIRTABLE_TABLE_NAMES.FILE_AUDITING_LOG]: {
    get url() { return n8nEndpoints.get.fileAuditingLog; },
    tableName: AIRTABLE_TABLE_NAMES.FILE_AUDITING_LOG,
  },
  // DEPRECATED: Form config now uses Form Link + Record Titles
  [AIRTABLE_TABLE_NAMES.FORM_CATEGORIES]: {
    get url() { return n8nEndpoints.get.formCategories; },
    tableName: AIRTABLE_TABLE_NAMES.FORM_CATEGORIES,
  },
  [AIRTABLE_TABLE_NAMES.FORM_FIELDS]: {
    get url() { return n8nEndpoints.get.formFields; },
    tableName: AIRTABLE_TABLE_NAMES.FORM_FIELDS,
  },
  [AIRTABLE_TABLE_NAMES.FORM_LINK]: {
    get url() { return n8nEndpoints.get.formLink; },
    tableName: AIRTABLE_TABLE_NAMES.FORM_LINK,
  },
  [AIRTABLE_TABLE_NAMES.RECORD_TITLES]: {
    get url() { return n8nEndpoints.get.recordTitles; },
    tableName: AIRTABLE_TABLE_NAMES.RECORD_TITLES,
  },
  [AIRTABLE_TABLE_NAMES.KAM_USERS]: {
    get url() { return n8nEndpoints.get.kamUsers; },
    tableName: AIRTABLE_TABLE_NAMES.KAM_USERS,
  },
  [AIRTABLE_TABLE_NAMES.LOAN_APPLICATIONS]: {
    get url() { return n8nEndpoints.get.loanApplication; },
    tableName: AIRTABLE_TABLE_NAMES.LOAN_APPLICATIONS,
  },
  [AIRTABLE_TABLE_NAMES.LOAN_PRODUCTS]: {
    get url() { return n8nEndpoints.get.loanProducts; },
    tableName: AIRTABLE_TABLE_NAMES.LOAN_PRODUCTS,
  },
  [AIRTABLE_TABLE_NAMES.PRODUCT_DOCUMENTS]: {
    get url() { return n8nEndpoints.get.productDocuments; },
    tableName: AIRTABLE_TABLE_NAMES.PRODUCT_DOCUMENTS,
  },
  [AIRTABLE_TABLE_NAMES.NBFC_PARTNERS]: {
    get url() { return n8nEndpoints.get.nbfcPartners; },
    tableName: AIRTABLE_TABLE_NAMES.NBFC_PARTNERS,
  },
  [AIRTABLE_TABLE_NAMES.NOTIFICATIONS]: {
    get url() { return n8nEndpoints.get.notifications; },
    tableName: AIRTABLE_TABLE_NAMES.NOTIFICATIONS,
  },
  [AIRTABLE_TABLE_NAMES.USER_ACCOUNTS]: {
    get url() { return n8nEndpoints.get.userAccount; },
    tableName: AIRTABLE_TABLE_NAMES.USER_ACCOUNTS,
  },
  [AIRTABLE_TABLE_NAMES.VEHICLES]: {
    get url() { return n8nEndpoints.get.vehicles; },
    tableName: AIRTABLE_TABLE_NAMES.VEHICLES,
  },
  [AIRTABLE_TABLE_NAMES.CLIENT_KYC]: {
    get url() { return n8nEndpoints.get.clientKyc; },
    tableName: AIRTABLE_TABLE_NAMES.CLIENT_KYC,
  },
  [AIRTABLE_TABLE_NAMES.NBFC_BRE_CONFIG]: {
    get url() { return n8nEndpoints.get.nbfcBreConfig; },
    tableName: AIRTABLE_TABLE_NAMES.NBFC_BRE_CONFIG,
  },
  [AIRTABLE_TABLE_NAMES.NBFC_BRE_CHECKPOINTS]: {
    get url() { return n8nEndpoints.get.lenderBreCheckpoints; },
    tableName: AIRTABLE_TABLE_NAMES.NBFC_BRE_CHECKPOINTS,
  },
};

/**
 * Get webhook URL for a specific table
 */
export const getWebhookUrl = (tableName: string): string | null => {
  return WEBHOOK_CONFIG[tableName]?.url || null;
};

/**
 * List of all available table names
 */
export const TABLE_NAMES = Object.keys(WEBHOOK_CONFIG);

