/**
 * Airtable/n8n Webhook Configuration
 * 
 * @deprecated This file is maintained for backward compatibility.
 * New code should use n8nEndpoints from backend/src/services/airtable/n8nEndpoints.ts
 * 
 * This file now re-exports from the centralized n8nEndpoints configuration
 * to ensure all paths match SEVEN-DASHBOARD-2.json exactly.
 */

import { n8nEndpoints } from '../services/airtable/n8nEndpoints.js';

/**
 * n8n Webhook Configuration
 * Maps to SEVEN-DASHBOARD-2.json webhook paths
 * 
 * GET Webhooks: Individual paths defined in webhookConfig.ts
 * POST Webhooks: Defined here, match n8n workflow POST webhook nodes
 * 
 * See WEBHOOK_MAPPING_TABLE.md for complete frontend → backend → webhook → Airtable mapping
 * See n8nEndpoints.ts for centralized endpoint configuration
 */
export const n8nConfig = {
  // GET: Dedicated webhook for user accounts (used for authentication)
  // n8n path: /useraccount → Airtable: User Accounts
  get getUserAccountsUrl() { return n8nEndpoints.get.userAccount; },
  
  // POST: Admin Activity Log
  // n8n path: /POSTLOG → Airtable: Admin Activity log
  get postLogUrl() { return n8nEndpoints.post.log; },
  
  // POST: Client Form Mapping (DEPRECATED - form config now uses Form Link + Record Titles)
  // n8n path: /POSTCLIENTFORMMAPPING → Airtable: Client Form Mapping
  get postClientFormMappingUrl() { return n8nEndpoints.post.clientFormMapping; },
  
  // POST: Commission Ledger
  // n8n path: /COMISSIONLEDGER → Airtable: Commission Ledger
  get postCommissionLedgerUrl() { return n8nEndpoints.post.commissionLedger; },
  
  // POST: Credit Team Users
  // n8n path: /CREDITTEAMUSERS → Airtable: Credit Team Users
  get postCreditTeamUsersUrl() { return n8nEndpoints.post.creditTeamUsers; },
  
  // POST: Daily Summary Reports
  // n8n path: /DAILYSUMMARY → Airtable: Daily summary Reports
  get postDailySummaryUrl() { return n8nEndpoints.post.dailySummary; },
  
  // POST: File Audit Log
  // n8n path: /Fileauditinglog → Airtable: File Auditing Log
  get postFileAuditLogUrl() { return n8nEndpoints.post.fileAuditLog; },
  
  // POST: Form Categories (DEPRECATED - form config now uses Form Link + Record Titles)
  // n8n path: /FormCategory → Airtable: Form Categories
  get postFormCategoryUrl() { return n8nEndpoints.post.formCategory; },
  
  // POST: Form Fields (DEPRECATED - form config now uses Form Link + Record Titles)
  // n8n path: /FormFields → Airtable: Form Fields
  get postFormFieldsUrl() { return n8nEndpoints.post.formFields; },
  
  // POST: Form Link (new simple config)
  // n8n path: /Formlink → Airtable: Form Link
  get postFormLinkUrl() { return n8nEndpoints.post.formLink; },
  
  // POST: Record Titles (new simple config)
  // n8n path: /Recordtitle → Airtable: Record Titles
  get postRecordTitlesUrl() { return n8nEndpoints.post.recordTitles; },
  
  // PATCH: Form Link, Record Titles, Loan Products (same path, different method)
  get patchFormLinkUrl() { return n8nEndpoints.patch.formLink; },
  get patchRecordTitlesUrl() { return n8nEndpoints.patch.recordTitles; },
  get patchLoanProductsUrl() { return n8nEndpoints.patch.loanProducts; },
  
  // DELETE: Form Link, Record Titles, Product Documents, Loan Products (same path, different method)
  get deleteFormLinkUrl() { return n8nEndpoints.delete.formLink; },
  get deleteRecordTitlesUrl() { return n8nEndpoints.delete.recordTitles; },
  get deleteProductDocumentsUrl() { return n8nEndpoints.delete.productDocuments; },
  get deleteLoanProductsUrl() { return n8nEndpoints.delete.loanProducts; },

  // Product Documents (product-centric form config)
  get postProductDocumentsUrl() { return n8nEndpoints.post.productDocuments; },
  get patchProductDocumentsUrl() { return n8nEndpoints.patch.productDocuments; },
  
  // POST: KAM Users
  // n8n path: /KAMusers → Airtable: KAM Users
  get postKamUsersUrl() { return n8nEndpoints.post.kamUsers; },
  
  // POST: Loan Applications
  // n8n path: /loanapplications (Webhook11) → Airtable: Loan Applications
  // POST create/update operations use /loanapplications (plural)
  get postApplicationsUrl() { return n8nEndpoints.post.loanApplications; },
  
  // POST: Loan Products
  // n8n path: /loanproducts → Airtable: Loan Products
  get postLoanProductsUrl() { return n8nEndpoints.post.loanProducts; },
  
  // POST: NBFC Partners
  // n8n path: /NBFCPartners → Airtable: NBFC Partners
  get postNBFCPartnersUrl() { return n8nEndpoints.post.nbfcPartners; },
  
  // POST: User Accounts (Add User)
  // n8n path: /adduser → Airtable: User Accounts
  get postAddUserUrl() { return n8nEndpoints.post.addUser; },
  
  // POST: Clients
  // n8n path: /Client → Airtable: Clients
  get postClientUrl() { return n8nEndpoints.post.client; },
  get postClientKycUrl() { return n8nEndpoints.post.clientKyc; },
  
  // POST: Notifications
  // n8n path: /notification → Airtable: Notifications
  get postNotificationUrl() { return n8nEndpoints.post.notification; },
  
  // POST: Email (Outlook Send a message)
  // n8n path: /email → Outlook email sending
  get postEmailUrl() { return n8nEndpoints.post.email; },

  // POST: Link (custom webhook for document/share links)
  get postLinkUrl() { return n8nEndpoints.post.link; },
} as const;

