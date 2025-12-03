/**
 * Individual Webhook Configuration for Backend
 * Each table has its own dedicated GET webhook URL
 */

export interface WebhookTableConfig {
  url: string;
  tableName: string;
}

export const WEBHOOK_CONFIG: Record<string, WebhookTableConfig> = {
  'Admin Activity Log': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/Adminactivity',
    tableName: 'Admin Activity Log',
  },
  'Client Form Mapping': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/clientformmapping',
    tableName: 'Client Form Mapping',
  },
  'Clients': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/client',
    tableName: 'Clients',
  },
  'Commission Ledger': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/commisionledger',
    tableName: 'Commission Ledger',
  },
  'Credit Team Users': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/creditteamuser',
    tableName: 'Credit Team Users',
  },
  'Daily Summary Report': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/dailysummaryreport',
    tableName: 'Daily Summary Report',
  },
  'File Auditing Log': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/fileauditinglog',
    tableName: 'File Auditing Log',
  },
  'Form Categories': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/formcategories',
    tableName: 'Form Categories',
  },
  'Form Fields': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/formfields',
    tableName: 'Form Fields',
  },
  'KAM Users': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/kamusers',
    tableName: 'KAM Users',
  },
  'Loan Application': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/loanapplication',
    tableName: 'Loan Application',
  },
  'Loan Products': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/loanproducts',
    tableName: 'Loan Products',
  },
  'NBFC Partners': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/nbfcpartners',
    tableName: 'NBFC Partners',
  },
  'Notifications': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/notifications',
    tableName: 'Notifications',
  },
  'User Accounts': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/useraccount',
    tableName: 'User Accounts',
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

