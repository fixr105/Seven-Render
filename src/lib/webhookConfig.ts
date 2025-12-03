/**
 * Individual Webhook Configuration
 * Each table has its own dedicated GET webhook URL and field mappings
 */

export interface WebhookTableConfig {
  url: string;
  fields: {
    id: string; // Field used for matching
    [key: string]: string; // All other fields
  };
}

export const WEBHOOK_CONFIG: Record<string, WebhookTableConfig> = {
  'Admin Activity Log': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/Adminactivity',
    fields: {
      id: 'id',
      'Activity ID': 'Activity ID',
      'Timestamp': 'Timestamp',
      'Performed By': 'Performed By',
      'Action Type': 'Action Type',
      'Description/Details': 'Description/Details',
      'Target Entity': 'Target Entity',
    },
  },
  'Client Form Mapping': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/clientformmapping',
    fields: {
      id: 'id',
      'Mapping ID': 'Mapping ID',
      'Client': 'Client',
      'Category': 'Category',
      'Is Required': 'Is Required',
      'Display Order': 'Display Order',
    },
  },
  'Clients': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/client',
    fields: {
      id: 'id',
      'Client ID': 'Client ID',
      'Client Name': 'Client Name',
      'Primary Contact Name': 'Primary Contact Name',
      'Contact Email / Phone': 'Contact Email / Phone',
      'Assigned KAM': 'Assigned KAM',
      'Enabled Modules': 'Enabled Modules',
      'Commission Rate': 'Commission Rate',
      'Status': 'Status',
      'Form Categories': 'Form Categories',
    },
  },
  'Commission Ledger': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/commisionledger',
    fields: {
      id: 'id',
      'Ledger Entry ID': 'Ledger Entry ID',
      'Client': 'Client',
      'Loan File': 'Loan File',
      'Date': 'Date',
      'Disbursed Amount': 'Disbursed Amount',
      'Commission Rate': 'Commission Rate',
      'Payout Amount': 'Payout Amount',
      'Description': 'Description',
      'Dispute Status': 'Dispute Status',
      'Payout Request': 'Payout Request',
    },
  },
  'Credit Team Users': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/creditteamuser',
    fields: {
      id: 'id',
      'Credit User ID': 'Credit User ID',
      'Name': 'Name',
      'Email': 'Email',
      'Phone': 'Phone',
      'Role': 'Role',
      'Status': 'Status',
    },
  },
  'Daily Summary Report': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/dailysummaryreport',
    fields: {
      id: 'id',
      'Report Date': 'Report Date',
      'Summary Content': 'Summary Content',
      'Generated Timestamp': 'Generated Timestamp',
      'Delivered To': 'Delivered To',
    },
  },
  'File Auditing Log': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/fileauditinglog',
    fields: {
      id: 'id',
      'Log Entry ID': 'Log Entry ID',
      'File': 'File',
      'Timestamp': 'Timestamp',
      'Actor': 'Actor',
      'Action/Event Type': 'Action/Event Type',
      'Details/Message': 'Details/Message',
      'Target User/Role': 'Target User/Role',
      'Resolved': 'Resolved',
    },
  },
  'Form Categories': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/formcategories',
    fields: {
      id: 'id',
      'Category ID': 'Category ID',
      'Category Name': 'Category Name',
      'Description': 'Description',
      'Display Order': 'Display Order',
      'Active': 'Active',
    },
  },
  'Form Fields': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/formfields',
    fields: {
      id: 'id',
      'Field ID': 'Field ID',
      'Category': 'Category',
      'Field Label': 'Field Label',
      'Field Type': 'Field Type',
      'Field Placeholder': 'Field Placeholder',
      'Field Options': 'Field Options',
      'Is Mandatory': 'Is Mandatory',
      'Display Order': 'Display Order',
      'Active': 'Active',
    },
  },
  'KAM Users': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/kamusers',
    fields: {
      id: 'id',
      'KAM ID': 'KAM ID',
      'Name': 'Name',
      'Email': 'Email',
      'Phone': 'Phone',
      'Managed Clients': 'Managed Clients',
      'Role': 'Role',
      'Status': 'Status',
    },
  },
  'Loan Application': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/loanapplication',
    fields: {
      id: 'id',
      'File ID': 'File ID',
      'Client': 'Client',
      'Applicant Name': 'Applicant Name',
      'Loan Product': 'Loan Product',
      'Requested Loan Amount': 'Requested Loan Amount',
      'Documents': 'Documents',
      'Status': 'Status',
      'Assigned Credit Analyst': 'Assigned Credit Analyst',
      'Assigned NBFC': 'Assigned NBFC',
      'Lender Decision Status': 'Lender Decision Status',
      'Lender Decision Date': 'Lender Decision Date',
      'Lender Decision Remarks': 'Lender Decision Remarks',
      'Approved Loan Amount': 'Approved Loan Amount',
      'AI File Summary': 'AI File Summary',
      'Form Data': 'Form Data',
      'Creation Date': 'Creation Date',
      'Submitted Date': 'Submitted Date',
      'Last Updated': 'Last Updated',
    },
  },
  'Loan Products': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/loanproducts',
    fields: {
      id: 'id',
      'Product ID': 'Product ID',
      'Product Name': 'Product Name',
      'Description': 'Description',
      'Active': 'Active',
      'Required Documents/Fields': 'Required Documents/Fields',
    },
  },
  'NBFC Partners': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/nbfcpartners',
    fields: {
      id: 'id',
      'Lender ID': 'Lender ID',
      'Lender Name': 'Lender Name',
      'Contact Person': 'Contact Person',
      'Contact Email/Phone': 'Contact Email/Phone',
      'Address/Region': 'Address/Region',
      'Active': 'Active',
    },
  },
  'Notifications': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/notifications',
    fields: {
      id: 'id',
      'Notification ID': 'Notification ID',
      'Recipient User': 'Recipient User',
      'Recipient Role': 'Recipient Role',
      'Related File': 'Related File',
      'Related Client': 'Related Client',
      'Related Ledger Entry': 'Related Ledger Entry',
      'Notification Type': 'Notification Type',
      'Title': 'Title',
      'Message': 'Message',
      'Channel': 'Channel',
      'Is Read': 'Is Read',
      'Created At': 'Created At',
      'Read At': 'Read At',
      'Action Link': 'Action Link',
    },
  },
  'User Accounts': {
    url: 'https://fixrrahul.app.n8n.cloud/webhook/useraccount',
    fields: {
      id: 'id',
      'Username': 'Username',
      'Password': 'Password',
      'Role': 'Role',
      'Associated Profile': 'Associated Profile',
      'Last Login': 'Last Login',
      'Account Status': 'Account Status',
    },
  },
};

/**
 * Get webhook URL for a specific table
 */
export const getWebhookUrl = (tableName: string): string | null => {
  return WEBHOOK_CONFIG[tableName]?.url || null;
};

/**
 * Get field mapping for a specific table
 */
export const getTableFields = (tableName: string): Record<string, string> | null => {
  return WEBHOOK_CONFIG[tableName]?.fields || null;
};

/**
 * List of all available table names
 */
export const TABLE_NAMES = Object.keys(WEBHOOK_CONFIG);

