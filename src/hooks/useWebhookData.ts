import { useState, useEffect } from 'react';

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52';

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime?: string;
}

export interface WebhookResponse {
  records?: AirtableRecord[];
  data?: AirtableRecord[];
  [key: string]: any;
}

export interface LoanApplicationFromWebhook {
  id: string;
  file_number: string;
  client_id?: string;
  applicant_name: string;
  loan_product_id?: string | null;
  requested_loan_amount: number | null;
  status: string;
  client?: { company_name: string };
  loan_product?: { name: string; code: string };
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

/**
 * Maps Airtable status to system status
 */
const mapStatus = (airtableStatus: string): string => {
  const statusMap: Record<string, string> = {
    'Draft': 'draft',
    'Submitted / Pending KAM Review': 'pending_kam_review',
    'Pending KAM Review': 'pending_kam_review',
    'KAM Query Raised': 'kam_query_raised',
    'Approved by KAM / Forwarded to Credit': 'forwarded_to_credit',
    'Forwarded to Credit': 'forwarded_to_credit',
    'Credit Query Raised': 'credit_query_raised',
    'In Negotiation': 'in_negotiation',
    'Sent to NBFC': 'sent_to_nbfc',
    'NBFC Approved': 'approved',
    'Approved': 'approved',
    'NBFC Rejected': 'rejected',
    'Rejected': 'rejected',
    'Disbursed': 'disbursed',
    'Closed/Archived': 'closed',
    'Closed': 'closed',
  };
  
  return statusMap[airtableStatus] || airtableStatus.toLowerCase().replace(/\s+/g, '_');
};

/**
 * Transforms Airtable record to LoanApplication format
 */
const transformAirtableRecord = (record: AirtableRecord): LoanApplicationFromWebhook | null => {
  const fields = record.fields || {};
  
  // Check if this looks like a loan application record
  // If it doesn't have typical loan application fields, still include it but mark appropriately
  const hasLoanFields = fields['File ID'] || fields['File Number'] || fields['Applicant Name'] || 
                       fields['Requested Loan Amount'] || fields['Status'] || 
                       fields['Client'] || fields['Loan Product'];
  
  // Map Airtable fields to our format
  const application: LoanApplicationFromWebhook = {
    id: record.id || fields['File ID'] || fields['Activity ID'] || fields['Mapping ID'] || `webhook_${Date.now()}_${Math.random()}`,
    file_number: fields['File ID'] || fields['File Number'] || fields['Activity ID'] || fields['Mapping ID'] || '',
    applicant_name: fields['Applicant Name'] || fields['Performed By'] || fields['Client'] || 'N/A',
    requested_loan_amount: parseFloat(fields['Requested Loan Amount']?.toString().replace(/[^0-9.]/g, '') || '0') || null,
    status: mapStatus(fields['Status'] || 'draft'),
    created_at: record.createdTime || fields['Creation Date'] || fields['Timestamp'] || fields['Created Time'] || new Date().toISOString(),
    updated_at: fields['Last Updated'] || fields['Timestamp'] || record.createdTime || new Date().toISOString(),
  };
  
  // Add client info if available
  if (fields['Client'] || fields['Client Name']) {
    application.client = {
      company_name: fields['Client'] || fields['Client Name'] || 'Unknown',
    };
  }
  
  // Add loan product info if available
  if (fields['Loan Product'] || fields['Loan Type']) {
    application.loan_product = {
      name: fields['Loan Product'] || fields['Loan Type'] || 'N/A',
      code: fields['Loan Product Code'] || '',
    };
  }
  
  // Include ALL other fields in the object - remap everything
  Object.keys(fields).forEach(key => {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
    // Skip already mapped fields
    if (!['file_id', 'file_number', 'applicant_name', 'requested_loan_amount', 'status', 
          'creation_date', 'last_updated', 'client', 'loan_product', 'client_name', 
          'loan_type', 'loan_product_code', 'performed_by', 'activity_id', 'mapping_id'].includes(normalizedKey)) {
      // Store all fields - both normalized and original key
      application[normalizedKey] = fields[key];
      application[`${normalizedKey}_original`] = fields[key];
    }
  });
  
  // Explicitly map current webhook fields
  if (fields['Category']) {
    application.category = fields['Category'];
    application.category_original = fields['Category'];
  }
  if (fields['Is Required']) {
    application.is_required = fields['Is Required'];
    application.is_required_bool = fields['Is Required']?.toLowerCase() === 'true';
  }
  if (fields['Display Order']) {
    application.display_order = fields['Display Order'];
    const orderNum = parseInt(fields['Display Order'] || '0', 10);
    if (!isNaN(orderNum)) {
      application.display_order_num = orderNum;
    }
  }
  if (fields['Mapping ID']) {
    application.mapping_id = fields['Mapping ID'];
    application.mapping_id_original = fields['Mapping ID'];
  }
  
  // If this doesn't look like a loan application, still return it but with a note
  if (!hasLoanFields) {
    application.status = 'draft';
    application.file_number = application.file_number || `WEBHOOK_${application.id.slice(0, 8)}`;
  }
  
  return application;
};

/**
 * Hook to fetch loan applications from webhook
 */
export const useWebhookApplications = () => {
  const [applications, setApplications] = useState<LoanApplicationFromWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhookData();
  }, []);

  const fetchWebhookData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching webhook data from:', WEBHOOK_URL);
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
      }

      const data: WebhookResponse = await response.json();
      
      console.log('Webhook response:', data);
      
      // Check for error responses from n8n
      if (data.code !== undefined && data.code !== 200 && data.message) {
        const errorMsg = data.message || 'Unknown error from webhook';
        console.error('Webhook returned error:', errorMsg, data);
        setError(`Webhook error: ${errorMsg}. Please check the n8n workflow configuration.`);
        setApplications([]);
        setLoading(false);
        return;
      }
      
      // Handle different response formats
      let records: AirtableRecord[] = [];
      
      if (Array.isArray(data)) {
        // Check if array contains records or table structures
        if (data.length > 0 && data[0].fields && Array.isArray(data[0].fields)) {
          // Array of table structures - extract records from each
          data.forEach((table: any) => {
            if (table.records && Array.isArray(table.records)) {
              records.push(...table.records);
            }
          });
        } else {
          // Array of records - check if they have fields property or are flat
          records = data.map((item: any) => {
            if (item.fields) {
              return item; // Already in Airtable format
            } else {
              // Flat format - wrap in fields
              return {
                id: item.id || `record_${Date.now()}_${Math.random()}`,
                fields: item,
                createdTime: item.createdTime,
              };
            }
          });
        }
      } else if (data.records && Array.isArray(data.records)) {
        records = data.records;
      } else if (data.data && Array.isArray(data.data)) {
        records = data.data;
      } else if (data.fields && Array.isArray(data.fields)) {
        // Table structure metadata - check if records are nested
        if (data.records && Array.isArray(data.records)) {
          records = data.records;
        } else {
          // This is just table structure metadata - log warning
          console.warn('Webhook returned table structure metadata without records. Response:', data);
          console.warn('Please configure n8n to return actual records from the table.');
          setError('Webhook returned table structure but no records. Please configure n8n to return actual data.');
          setApplications([]);
          setLoading(false);
          return;
        }
      } else if (data.fields && typeof data.fields === 'object' && !Array.isArray(data.fields)) {
        // Single record with nested fields - Airtable format
        records = [{
          id: data.id || `record_${Date.now()}`,
          fields: data.fields,
          createdTime: data.createdTime,
        }];
      } else if (data.id && !data.fields) {
        // Single record in flat format (fields directly on object) - current webhook format
        // Extract id and createdTime, rest goes to fields
        const { id, createdTime, ...fields } = data;
        records = [{
          id: id || `record_${Date.now()}`,
          fields: fields, // All other properties become fields
          createdTime: createdTime,
        }];
        console.log('Handled flat format record:', { id, createdTime, fieldCount: Object.keys(fields).length });
      } else {
        // Unknown format - log for debugging
        console.warn('Unknown webhook response format:', data);
        setError('Unknown webhook response format. Check console for details.');
        setApplications([]);
        setLoading(false);
        return;
      }
      
      console.log(`Found ${records.length} records from webhook`);
      console.log('Sample record structure:', records[0]);
      
      // Transform records to application format
      const transformed = records
        .map((record, index) => {
          try {
            const app = transformAirtableRecord(record);
            if (app) {
              console.log(`Record ${index + 1} transformed:`, app);
            }
            return app;
          } catch (err) {
            console.error(`Error transforming record ${index + 1}:`, err, record);
            return null;
          }
        })
        .filter((app): app is LoanApplicationFromWebhook => app !== null);
      
      console.log(`Successfully transformed ${transformed.length} applications`);
      if (transformed.length > 0) {
        console.log('First transformed application:', transformed[0]);
      }
      
      setApplications(transformed);
    } catch (err: any) {
      console.error('Error fetching webhook data:', err);
      setError(err.message || 'Failed to fetch webhook data');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  return { 
    applications, 
    loading, 
    error, 
    refetch: fetchWebhookData 
  };
};

/**
 * Hook to fetch all webhook data (all tables)
 */
export const useWebhookAllData = () => {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}`);
      }

      const webhookData: any = await response.json();
      
      // Organize data by table name
      const organizedData: Record<string, any[]> = {};
      
      if (Array.isArray(webhookData)) {
        // Multiple tables
        webhookData.forEach((table: any) => {
          if (table.name && table.records) {
            organizedData[table.name] = table.records;
          }
        });
      } else if (webhookData.records) {
        // Single table with records
        organizedData[webhookData.name || 'default'] = webhookData.records;
      } else if (webhookData.name) {
        // Table structure only
        organizedData[webhookData.name] = [];
      }
      
      setData(organizedData);
    } catch (err: any) {
      console.error('Error fetching webhook data:', err);
      setError(err.message || 'Failed to fetch webhook data');
      setData({});
    } finally {
      setLoading(false);
    }
  };

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchAllData 
  };
};

