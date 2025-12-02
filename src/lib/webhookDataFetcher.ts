/**
 * Webhook Data Fetcher
 * Fetches table data from n8n webhook and analyzes compatibility
 */

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52';

export interface WebhookTableData {
  table?: string;
  data?: any[];
  [key: string]: any;
}

/**
 * Fetches data from webhook and returns it without processing
 */
export const fetchWebhookTableData = async (): Promise<WebhookTableData | null> => {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    // Check if it's an error response
    if (data.code !== undefined && data.code !== 200) {
      console.warn('Webhook returned error:', data);
      return null;
    }
    
    // Log the data structure for analysis
    console.log('Webhook data structure:', data);
    console.log('Data keys:', Object.keys(data));
    
    // Do nothing with the data - just return it
    return data;
  } catch (error) {
    console.error('Error fetching webhook data:', error);
    return null;
  }
};

/**
 * Analyzes webhook data structure and compares with system schema
 */
export const analyzeWebhookData = (data: WebhookTableData) => {
  if (!data) {
    console.log('No data to analyze');
    return;
  }

  console.log('=== Webhook Data Analysis ===');
  console.log('Data type:', Array.isArray(data) ? 'Array' : typeof data);
  console.log('Top-level keys:', Object.keys(data));
  
  // Check for common table structures
  if (Array.isArray(data)) {
    console.log('Data is an array with', data.length, 'items');
    if (data.length > 0) {
      console.log('First item structure:', Object.keys(data[0]));
    }
  } else if (data.tables) {
    console.log('Data contains "tables" key');
    console.log('Table names:', Object.keys(data.tables));
  } else if (data.table) {
    console.log('Data contains "table" key:', data.table);
    if (data.data) {
      console.log('Data array length:', data.data.length);
    }
  }
  
  // Check for expected table names
  const expectedTables = [
    'loan_applications',
    'Clients',
    'dsa_clients',
    'Loan Applications',
    'commission_ledger',
    'Commission Ledger',
    'queries',
    'Queries',
    'user_roles',
    'User Accounts',
  ];
  
  const foundTables = expectedTables.filter(table => 
    data[table] || data[table.toLowerCase()] || data[table.replace(' ', '_')]
  );
  
  if (foundTables.length > 0) {
    console.log('Found expected tables:', foundTables);
  }
};

/**
 * Test function to fetch and analyze webhook data
 */
export const testWebhookData = async () => {
  console.log('Fetching webhook data...');
  const data = await fetchWebhookTableData();
  
  if (data) {
    analyzeWebhookData(data);
    return data;
  } else {
    console.log('No data received from webhook');
    return null;
  }
};

