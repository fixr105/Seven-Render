/**
 * Webhook Data Importer
 * Fetches data from n8n webhook and maps it to Supabase schema
 */

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52';

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: Array<{
    type: string;
    id: string;
    name: string;
  }>;
  views: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

export interface WebhookResponse {
  tables?: AirtableTable[];
  [key: string]: any;
}

/**
 * Fetches all table structures from webhook
 */
export const fetchWebhookTables = async (): Promise<AirtableTable[]> => {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}`);
    }

    const data: WebhookResponse = await response.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data;
    } else if (data.tables && Array.isArray(data.tables)) {
      return data.tables;
    } else if (data.id && data.name) {
      // Single table response
      return [data as AirtableTable];
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching webhook tables:', error);
    throw error;
  }
};

/**
 * Maps Airtable table name to Supabase table name
 */
export const mapTableName = (airtableName: string): string => {
  const mapping: Record<string, string> = {
    'Admin Activity log': 'admin_activity_log',
    'Admin Activity Log': 'admin_activity_log',
    'Clients': 'dsa_clients',
    'KAM Users': 'user_roles', // Filter by role='kam'
    'Credit Team Users': 'user_roles', // Filter by role='credit_team'
    'NBFC Partners': 'nbfc_partners',
    'User Accounts': 'user_roles',
    'Loan Applications': 'loan_applications',
    'Loan Products': 'loan_products',
    'Commission Ledger': 'commission_ledger',
    'File Audit Log': 'audit_logs',
    'Daily Summary Reports': 'daily_summary_reports',
  };
  
  return mapping[airtableName] || airtableName.toLowerCase().replace(/\s+/g, '_');
};

/**
 * Maps Airtable field name to Supabase column name
 */
export const mapFieldName = (tableName: string, fieldName: string): string => {
  const mappings: Record<string, Record<string, string>> = {
    'admin_activity_log': {
      'Activity ID': 'id',
      'Timestamp': 'timestamp',
      'Performed By': 'performed_by',
      'Action Type': 'action_type',
      'Description/Details': 'description',
      'Target Entity': 'target_entity',
    },
    'dsa_clients': {
      'Client ID': 'id',
      'Client Name': 'company_name',
      'Primary Contact Name': 'contact_person',
      'Contact Email / Phone': 'email', // May need to split
      'Assigned KAM': 'kam_id',
      'Enabled Modules': 'modules_enabled',
      'Commission Rate': 'commission_rate',
      'Status': 'is_active',
    },
    'loan_applications': {
      'File ID': 'file_number',
      'Client': 'client_id',
      'Applicant Name': 'applicant_name',
      'Loan Product': 'loan_product_id',
      'Requested Loan Amount': 'requested_loan_amount',
      'Status': 'status',
      'Assigned Credit Analyst': 'assigned_credit_analyst',
      'Assigned NBFC': 'assigned_nbfc_id',
      'Lender Decision Status': 'lender_decision_status',
      'Lender Decision Date': 'lender_decision_date',
      'Lender Decision Remarks': 'lender_decision_remarks',
      'Approved Loan Amount': 'approved_loan_amount',
      'AI File Summary': 'ai_file_summary',
      'Creation Date': 'created_at',
      'Submitted Date': 'submitted_at',
      'Last Updated': 'updated_at',
    },
  };
  
  const tableMapping = mappings[tableName];
  if (tableMapping && tableMapping[fieldName]) {
    return tableMapping[fieldName];
  }
  
  // Default: convert to snake_case
  return fieldName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
};

/**
 * Analyzes webhook response and creates mapping report
 */
export const analyzeWebhookStructure = async (): Promise<{
  tables: AirtableTable[];
  mappings: Array<{
    airtableName: string;
    supabaseTable: string;
    fields: Array<{
      airtableField: string;
      supabaseColumn: string;
    }>;
  }>;
}> => {
  const tables = await fetchWebhookTables();
  
  const mappings = tables.map(table => ({
    airtableName: table.name,
    supabaseTable: mapTableName(table.name),
    fields: table.fields.map(field => ({
      airtableField: field.name,
      supabaseColumn: mapFieldName(mapTableName(table.name), field.name),
    })),
  }));
  
  return { tables, mappings };
};

