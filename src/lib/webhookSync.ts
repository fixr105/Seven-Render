/**
 * Webhook Data Sync Utility
 * Syncs webhook data to Supabase database
 */

import { supabase } from './supabase';

export interface WebhookRecord {
  id: string;
  [key: string]: any;
}

/**
 * Maps webhook field names to database column names
 */
const mapWebhookFieldToDB = (webhookField: string): string => {
  const fieldMap: Record<string, string> = {
    // File/Application Identifiers
    'File ID': 'file_number',
    'File Number': 'file_number',
    'Mapping ID': 'file_number', // Maps to file_number
    'Activity ID': 'file_number',
    
    // Applicant Information
    'Applicant Name': 'applicant_name',
    'Performed By': 'applicant_name', // Fallback
    
    // Financial Fields
    'Requested Loan Amount': 'requested_loan_amount',
    'Approved Loan Amount': 'approved_loan_amount',
    
    // Status and Workflow
    'Status': 'status',
    
    // Client/Company
    'Client': 'client_id', // Will resolve to client_id
    'Client Name': 'client_id',
    
    // Loan Product
    'Loan Product': 'loan_product_id', // Will resolve to loan_product_id
    'Loan Type': 'loan_product_id',
    'Category': 'loan_product_id', // Category can map to loan product or be stored separately
    
    // Timestamps
    'Creation Date': 'created_at',
    'Created Time': 'created_at',
    'Timestamp': 'created_at',
    'Last Updated': 'updated_at',
    
    // Assignment Fields
    'Assigned Credit Analyst': 'assigned_credit_analyst',
    'Assigned NBFC': 'assigned_nbfc_id',
    
    // Lender Decision
    'Lender Decision Status': 'lender_decision_status',
    'Lender Decision Date': 'lender_decision_date',
    'Lender Decision Remarks': 'lender_decision_remarks',
    
    // Additional Fields
    'AI File Summary': 'ai_file_summary',
    'Is Required': 'is_required', // Additional field
    'Display Order': 'display_order', // Additional field
  };

  return fieldMap[webhookField] || webhookField.toLowerCase().replace(/\s+/g, '_');
};

/**
 * Resolves client name/code to client_id
 */
const resolveClientId = async (clientIdentifier: string): Promise<string | null> => {
  if (!clientIdentifier) return null;

  // Try to find by company name (case-insensitive, partial match)
  const { data: byName } = await supabase
    .from('dsa_clients')
    .select('id, company_name')
    .ilike('company_name', `%${clientIdentifier}%`)
    .maybeSingle();

  if (byName) {
    console.log(`✅ Resolved client "${clientIdentifier}" to: ${byName.company_name} (${byName.id})`);
    return byName.id;
  }

  // Try to find by contact person
  const { data: byContact } = await supabase
    .from('dsa_clients')
    .select('id, company_name')
    .ilike('contact_person', `%${clientIdentifier}%`)
    .maybeSingle();

  if (byContact) {
    console.log(`✅ Resolved client "${clientIdentifier}" to: ${byContact.company_name} (${byContact.id})`);
    return byContact.id;
  }

  // Try to find by email
  const { data: byEmail } = await supabase
    .from('dsa_clients')
    .select('id, company_name')
    .ilike('email', `%${clientIdentifier}%`)
    .maybeSingle();

  if (byEmail) {
    console.log(`✅ Resolved client "${clientIdentifier}" to: ${byEmail.company_name} (${byEmail.id})`);
    return byEmail.id;
  }

  console.warn(`⚠️  Could not resolve client identifier: "${clientIdentifier}"`);
  return null;
};

/**
 * Resolves loan product name/code to loan_product_id
 */
const resolveLoanProductId = async (productName: string): Promise<string | null> => {
  if (!productName) return null;

  // Try to find by code first (exact match)
  const { data: byCode } = await supabase
    .from('loan_products')
    .select('id, name, code')
    .eq('code', productName)
    .maybeSingle();

  if (byCode) {
    console.log(`✅ Resolved loan product "${productName}" to: ${byCode.name} (${byCode.code})`);
    return byCode.id;
  }

  const { data } = await supabase
    .from('loan_products')
    .select('id')
    .ilike('name', `%${productName}%`)
    .maybeSingle();

  return data?.id || null;
};

/**
 * Maps status from webhook format to database format
 */
const mapStatus = (status: string): string => {
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

  return statusMap[status] || status.toLowerCase().replace(/\s+/g, '_');
};

/**
 * Converts webhook record to database format
 */
export const convertWebhookToDBFormat = async (webhookRecord: WebhookRecord): Promise<any> => {
  const dbRecord: any = {
    form_data: {}, // Store all additional fields here
  };

  // Handle flat format (fields directly on object)
  const fields = webhookRecord.id ? { ...webhookRecord } : webhookRecord;

  // Process each field - remap ALL fields
  for (const [key, value] of Object.entries(fields)) {
    // Skip metadata fields that are handled separately
    if (key === 'id' || key === 'createdTime') continue;

    const dbField = mapWebhookFieldToDB(key);
    const normalizedValue = value !== null && value !== undefined ? String(value) : null;

    // Handle special fields with specific logic
    if (dbField === 'file_number') {
      dbRecord.file_number = normalizedValue || `WEBHOOK_${webhookRecord.id?.slice(0, 8) || Date.now()}`;
    } else if (dbField === 'applicant_name') {
      dbRecord.applicant_name = normalizedValue || 'N/A';
    } else if (dbField === 'requested_loan_amount') {
      dbRecord.requested_loan_amount = parseFloat(String(value).replace(/[^0-9.]/g, '')) || null;
    } else if (dbField === 'approved_loan_amount') {
      dbRecord.approved_loan_amount = parseFloat(String(value).replace(/[^0-9.]/g, '')) || null;
    } else if (dbField === 'status') {
      dbRecord.status = mapStatus(normalizedValue || 'draft');
    } else if (dbField === 'client_id') {
      // Resolve client identifier to client_id
      const clientId = await resolveClientId(normalizedValue || '');
      if (clientId) {
        dbRecord.client_id = clientId;
        // Also store original identifier in form_data
        dbRecord.form_data['client_identifier_original'] = normalizedValue;
      } else {
        // Store in form_data if can't resolve
        dbRecord.form_data['client_identifier'] = normalizedValue;
        dbRecord.form_data['client_code'] = normalizedValue; // Store as client_code too
      }
    } else if (dbField === 'loan_product_id') {
      // Resolve loan product - check if it's Category field mapping to product
      const productId = await resolveLoanProductId(normalizedValue || '');
      if (productId) {
        dbRecord.loan_product_id = productId;
        // Store original value
        dbRecord.form_data['loan_product_identifier_original'] = normalizedValue;
      } else {
        // Store in form_data if can't resolve
        dbRecord.form_data['loan_product_identifier'] = normalizedValue;
        // If it's Category field, store it separately too
        if (key === 'Category') {
          dbRecord.form_data['category'] = normalizedValue;
        }
      }
    } else if (dbField === 'created_at' || dbField === 'updated_at') {
      dbRecord[dbField] = normalizedValue || new Date().toISOString();
    } else if (dbField === 'category') {
      // Category field - store in form_data
      dbRecord.form_data['category'] = normalizedValue;
      dbRecord.form_data['category_original'] = normalizedValue;
    } else if (dbField === 'is_required') {
      // Is Required field - convert to boolean if possible
      dbRecord.form_data['is_required'] = normalizedValue;
      dbRecord.form_data['is_required_bool'] = normalizedValue?.toLowerCase() === 'true';
    } else if (dbField === 'display_order') {
      // Display Order - convert to number if possible
      dbRecord.form_data['display_order'] = normalizedValue;
      const orderNum = parseInt(normalizedValue || '0', 10);
      if (!isNaN(orderNum)) {
        dbRecord.form_data['display_order_num'] = orderNum;
      }
    } else if (['assigned_credit_analyst', 'assigned_nbfc_id', 'lender_decision_status', 
                'lender_decision_date', 'lender_decision_remarks', 'ai_file_summary'].includes(dbField)) {
      // Direct database fields
      dbRecord[dbField] = normalizedValue;
    } else {
      // Store all other fields in form_data with original key preserved
      dbRecord.form_data[dbField] = normalizedValue;
      dbRecord.form_data[`${key.toLowerCase().replace(/\s+/g, '_')}_original`] = normalizedValue;
    }
  }

  // Set defaults
  if (!dbRecord.status) dbRecord.status = 'draft';
  if (!dbRecord.created_at) dbRecord.created_at = webhookRecord.createdTime || new Date().toISOString();
  if (!dbRecord.updated_at) dbRecord.updated_at = webhookRecord.createdTime || new Date().toISOString();
  if (!dbRecord.file_number) dbRecord.file_number = `WEBHOOK_${webhookRecord.id?.slice(0, 8) || Date.now()}`;

  return dbRecord;
};

/**
 * Syncs a webhook record to the database
 * Returns the database record ID
 */
export const syncWebhookRecordToDB = async (
  webhookRecord: WebhookRecord,
  options: { upsert?: boolean; updateExisting?: boolean } = {}
): Promise<string | null> => {
  try {
    const dbRecord = await convertWebhookToDBFormat(webhookRecord);

    // Check if record already exists (by file_number or webhook id)
    let existingRecord = null;
    
    if (webhookRecord.id) {
      // Try to find by webhook ID stored in form_data
      const { data: byWebhookId } = await supabase
        .from('loan_applications')
        .select('id')
        .eq('form_data->>webhook_id', webhookRecord.id)
        .maybeSingle();
      
      existingRecord = byWebhookId;
    }

    if (!existingRecord && dbRecord.file_number) {
      // Try to find by file_number
      const { data: byFileNumber } = await supabase
        .from('loan_applications')
        .select('id')
        .eq('file_number', dbRecord.file_number)
        .maybeSingle();
      
      existingRecord = byFileNumber;
    }

    // Store webhook ID in form_data for future lookups
    dbRecord.form_data = {
      ...dbRecord.form_data,
      webhook_id: webhookRecord.id,
      webhook_synced_at: new Date().toISOString(),
    };

    if (existingRecord && options.updateExisting) {
      // Update existing record
      const { data, error } = await supabase
        .from('loan_applications')
        .update({
          ...dbRecord,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } else if (existingRecord && !options.upsert) {
      // Record exists but we don't want to update
      console.log('Record already exists, skipping:', existingRecord.id);
      return existingRecord.id;
    } else {
      // Insert new record
      // Check if client_id is set (required for RLS policies)
      if (!dbRecord.client_id) {
        console.warn('Cannot insert application without client_id. Webhook record:', webhookRecord);
        throw new Error('Missing client_id: Cannot sync application without a valid client. Please ensure the webhook data includes client information.');
      }

      const { data, error } = await supabase
        .from('loan_applications')
        .insert(dbRecord)
        .select()
        .single();

      if (error) {
        // Provide more helpful error messages
        if (error.code === '42501') {
          console.error('RLS Policy Error: User does not have permission to insert this record. Error:', error);
          throw new Error(`Permission denied: Unable to create application. This may be due to row-level security policies. Please ensure you have proper access or contact an administrator.`);
        } else if (error.code === '23503') {
          console.error('Foreign Key Error: Referenced record does not exist. Error:', error);
          throw new Error(`Invalid reference: One or more referenced records (client, loan product, etc.) do not exist in the database.`);
        } else {
          throw error;
        }
      }
      return data.id;
    }
  } catch (error) {
    console.error('Error syncing webhook record to DB:', error);
    throw error;
  }
};

/**
 * Syncs multiple webhook records to the database
 */
export const syncWebhookRecordsToDB = async (
  webhookRecords: WebhookRecord[],
  options: { upsert?: boolean; updateExisting?: boolean } = {}
): Promise<{ success: number; failed: number; errors: any[] }> => {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as any[],
  };

  for (const record of webhookRecords) {
    try {
      await syncWebhookRecordToDB(record, options);
      results.success++;
    } catch (error: any) {
      results.failed++;
      results.errors.push({
        recordId: record.id,
        error: error.message,
      });
    }
  }

  return results;
};

