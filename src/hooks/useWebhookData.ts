import { useState, useEffect, useRef } from 'react';
import { fetchTableData, fetchMultipleTables } from '../lib/webhookFetcher';
import { getTableFields } from '../lib/webhookConfig';

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
 * Fetch Loan Applications from individual webhook
 * Only fetches the Loan Application table
 */
const fetchLoanApplicationsFromWebhook = async (forceRefresh = false): Promise<LoanApplicationFromWebhook[]> => {
  try {
    // Fetch only Loan Application table
    const records = await fetchTableData('Loan Application', forceRefresh);
    
    // Transform records to application format
    const transformed = records
      .map((record) => {
        try {
          // Convert flat record to Airtable format for transformation
          const airtableRecord: AirtableRecord = {
            id: record.id || record['id'] || `record_${Date.now()}_${Math.random()}`,
            fields: record,
            createdTime: record['Creation Date'] || record['Created Time'] || new Date().toISOString(),
          };
          return transformAirtableRecord(airtableRecord);
        } catch (err) {
          console.error('Error transforming record:', err, record);
          return null;
        }
      })
      .filter((app): app is LoanApplicationFromWebhook => app !== null);
    
    console.log(`Successfully transformed ${transformed.length} applications from Loan Application webhook`);
    return transformed;
  } catch (err: any) {
    console.error('Error fetching Loan Applications from webhook:', err);
    throw err;
  }
};

/**
 * Hook to fetch loan applications from individual webhook
 * DOES NOT auto-execute - only fetches when explicitly requested via refetch()
 * or on page reload/refresh (F5 or browser refresh button)
 * 
 * Now uses individual "Loan Application" table webhook instead of single GET webhook
 */
export const useWebhookApplications = () => {
  const [applications, setApplications] = useState<LoanApplicationFromWebhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const hasCheckedReloadRef = useRef(false);

  // Check for page reload on mount (only once)
  useEffect(() => {
    mountedRef.current = true;
    hasCheckedReloadRef.current = true;
    
    // Check if this is a page reload using multiple methods for browser compatibility
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const isPageReload = 
      navEntry?.type === 'reload' ||
      (performance.navigation && (performance.navigation as any).type === 1) ||
      // Check if page was loaded via reload (not navigation)
      (document.referrer === '' && window.history.length === 1);
    
    // Only fetch on actual page reload (F5 or browser refresh button)
    // NOT on normal navigation or component mount
    if (isPageReload) {
      console.log('Page reload detected - fetching Loan Application data from individual webhook');
      setLoading(true);
      
      fetchLoanApplicationsFromWebhook(false)
        .then((data) => {
          if (mountedRef.current) {
            setApplications(data);
            setLoading(false);
            setError(null);
          }
        })
        .catch((err) => {
          if (mountedRef.current) {
            setError(err.message || 'Failed to fetch webhook data');
            setApplications([]);
            setLoading(false);
          }
        });
    } else {
      // Normal navigation - use empty array, no webhook call
      setApplications([]);
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchWebhookData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Force refresh on manual refetch
      const data = await fetchLoanApplicationsFromWebhook(true);
      
      if (mountedRef.current) {
        setApplications(data);
        setLoading(false);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch webhook data');
        setApplications([]);
        setLoading(false);
      }
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
 * Hook to fetch multiple tables from individual webhooks
 * Only fetches the tables specified in the tables array
 */
export const useWebhookTables = (tables: string[]) => {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchTables = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await fetchMultipleTables({
        tables,
        forceRefresh,
      });
      
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        console.error('Error fetching webhook tables:', err);
        setError(err.message || 'Failed to fetch webhook data');
        setData({});
        setLoading(false);
      }
    }
  };

  return { 
    data, 
    loading, 
    error, 
    refetch: () => fetchTables(true) 
  };
};

/**
 * Hook to fetch all webhook data (all tables)
 * @deprecated Use useWebhookTables with specific tables instead
 */
export const useWebhookAllData = () => {
  const { TABLE_NAMES } = require('../lib/webhookConfig');
  return useWebhookTables(TABLE_NAMES);
};

