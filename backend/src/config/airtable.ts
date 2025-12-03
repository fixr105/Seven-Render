/**
 * Airtable/n8n Webhook Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

export const n8nConfig = {
  getWebhookUrl: process.env.N8N_GET_WEBHOOK_URL || 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52',
  getUserAccountsUrl: process.env.N8N_GET_USER_ACCOUNTS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52', // Same URL, but might need table parameter
  postLogUrl: process.env.N8N_POST_LOG_URL || 'https://fixrrahul.app.n8n.cloud/webhook/POSTLOG',
  postClientFormMappingUrl: process.env.N8N_POST_CLIENT_FORM_MAPPING_URL || 'https://fixrrahul.app.n8n.cloud/webhook/POSTCLIENTFORMMAPPING',
  postCommissionLedgerUrl: process.env.N8N_POST_COMMISSION_LEDGER_URL || 'https://fixrrahul.app.n8n.cloud/webhook/COMISSIONLEDGER',
  postCreditTeamUsersUrl: process.env.N8N_POST_CREDIT_TEAM_USERS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/CREDITTEAMUSERS',
  postDailySummaryUrl: process.env.N8N_POST_DAILY_SUMMARY_URL || 'https://fixrrahul.app.n8n.cloud/webhook/DAILYSUMMARY',
  postFileAuditLogUrl: process.env.N8N_POST_FILE_AUDIT_LOG_URL || 'https://fixrrahul.app.n8n.cloud/webhook/Fileauditinglog',
  postFormCategoryUrl: process.env.N8N_POST_FORM_CATEGORY_URL || 'https://fixrrahul.app.n8n.cloud/webhook/FormCategory',
  postFormFieldsUrl: process.env.N8N_POST_FORM_FIELDS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/FormFields',
  postKamUsersUrl: process.env.N8N_POST_KAM_USERS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/KAMusers',
  postApplicationsUrl: process.env.N8N_POST_APPLICATIONS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/applications',
  postLoanProductsUrl: process.env.N8N_POST_LOAN_PRODUCTS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/loanproducts',
  postNBFCPartnersUrl: process.env.N8N_POST_NBFC_PARTNERS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/NBFCPartners',
  postAddUserUrl: process.env.N8N_POST_ADD_USER_URL || 'https://fixrrahul.app.n8n.cloud/webhook/adduser',
  postClientUrl: process.env.N8N_POST_CLIENT_URL || 'https://fixrrahul.app.n8n.cloud/webhook/Client',
  postNotificationUrl: process.env.N8N_POST_NOTIFICATION_URL || 'https://fixrrahul.app.n8n.cloud/webhook/notification',
} as const;

