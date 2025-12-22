/**
 * Webhook Data Importer
 * Fetches data from n8n webhook and maps it to Airtable schema
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
 * Maps Airtable table name to internal table identifier
 */
export const mapTableName = (airtableName: string): string => {
  // Return the Airtable table name as-is since we work directly with Airtable
  return airtableName;
};

/**
 * Maps Airtable field name to internal field identifier
 */
export const mapFieldName = (tableName: string, fieldName: string): string => {
  // Return the Airtable field name as-is since we work directly with Airtable
  return fieldName;
};

/**
 * Analyzes webhook response and creates mapping report
 */
export const analyzeWebhookStructure = async (): Promise<{
  tables: AirtableTable[];
  mappings: Array<{
    airtableName: string;
    internalTable: string;
    fields: Array<{
      airtableField: string;
      internalField: string;
    }>;
  }>;
}> => {
  const tables = await fetchWebhookTables();
  
  const mappings = tables.map(table => ({
    airtableName: table.name,
    internalTable: mapTableName(table.name),
    fields: table.fields.map(field => ({
      airtableField: field.name,
      internalField: mapFieldName(mapTableName(table.name), field.name),
    })),
  }));
  
  return { tables, mappings };
};

