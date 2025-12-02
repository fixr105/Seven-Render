/**
 * Standalone POST Webhook Handler Script
 * Can be called from n8n or run directly
 * 
 * Usage:
 *   node scripts/webhook-post.js
 * 
 * Or from n8n HTTP Request node:
 *   POST to your server endpoint that runs this script
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const GET_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetches data from GET webhook
 */
async function fetchFromGetWebhook() {
  try {
    console.log('📡 Fetching data from GET webhook:', GET_WEBHOOK_URL);
    
    const response = await fetch(GET_WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GET webhook returned status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Received data from GET webhook');
    
    // Handle different response formats
    let records = [];
    
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0].fields && Array.isArray(data[0].fields)) {
        data.forEach((table) => {
          if (table.records && Array.isArray(table.records)) {
            records.push(...table.records);
          }
        });
      } else {
        records = data.map((item) => {
          if (item.fields) {
            return item;
          } else {
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
    } else if (data.fields && typeof data.fields === 'object' && !Array.isArray(data.fields)) {
      records = [{
        id: data.id || `record_${Date.now()}`,
        fields: data.fields,
        createdTime: data.createdTime,
      }];
    } else if (data.id && !data.fields) {
      const { id, createdTime, ...fields } = data;
      records = [{
        id: id || `record_${Date.now()}`,
        fields: fields,
        createdTime: createdTime,
      }];
    } else {
      throw new Error('Unknown webhook response format');
    }
    
    console.log(`📊 Found ${records.length} records`);
    return records;
  } catch (error) {
    console.error('❌ Error fetching from GET webhook:', error);
    throw error;
  }
}

/**
 * Resolves client name/code to client_id
 */
async function resolveClientId(clientIdentifier) {
  if (!clientIdentifier) return null;

  const { data: byName } = await supabase
    .from('dsa_clients')
    .select('id')
    .ilike('company_name', `%${clientIdentifier}%`)
    .maybeSingle();

  if (byName) return byName.id;

  const { data: byContact } = await supabase
    .from('dsa_clients')
    .select('id')
    .ilike('contact_person', `%${clientIdentifier}%`)
    .maybeSingle();

  return byContact?.id || null;
}

/**
 * Resolves loan product name to loan_product_id
 */
async function resolveLoanProductId(productName) {
  if (!productName) return null;

  const { data } = await supabase
    .from('loan_products')
    .select('id')
    .ilike('name', `%${productName}%`)
    .maybeSingle();

  return data?.id || null;
}

/**
 * Maps Airtable status to database status
 */
function mapStatus(airtableStatus) {
  const statusMap = {
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
  
  return statusMap[airtableStatus] || airtableStatus?.toLowerCase().replace(/\s+/g, '_') || 'draft';
}

/**
 * Syncs a single record to database
 */
async function syncRecord(record) {
  try {
    const fields = record.fields || {};
    
    // Get file_number
    const fileNumber = fields['File ID'] || fields['File Number'] || fields['Mapping ID'] || fields['Activity ID'] || null;
    if (!fileNumber) {
      throw new Error('Missing File ID/Mapping ID');
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('loan_applications')
      .select('id')
      .eq('file_number', fileNumber)
      .maybeSingle();

    // Resolve client_id
    const clientIdentifier = fields['Client'] || fields['Client Name'] || null;
    const clientId = clientIdentifier ? await resolveClientId(clientIdentifier) : null;
    
    if (!clientId && clientIdentifier) {
      console.warn(`⚠️  Could not resolve client: ${clientIdentifier}`);
    }

    // Resolve loan_product_id
    const productName = fields['Loan Product'] || fields['Loan Type'] || fields['Category'] || null;
    const loanProductId = productName ? await resolveLoanProductId(productName) : null;

    // Build database record
    const dbRecord = {
      file_number: fileNumber,
      client_id: clientId,
      applicant_name: fields['Applicant Name'] || fields['Performed By'] || null,
      loan_product_id: loanProductId,
      requested_loan_amount: fields['Requested Loan Amount'] 
        ? parseFloat(fields['Requested Loan Amount'].toString().replace(/[^0-9.]/g, '')) 
        : null,
      status: mapStatus(fields['Status']),
      form_data: {
        ...fields,
        webhook_id: record.id,
        webhook_synced_at: new Date().toISOString(),
      },
      created_at: record.createdTime || fields['Creation Date'] || fields['Timestamp'] || new Date().toISOString(),
      updated_at: fields['Last Updated'] || record.createdTime || new Date().toISOString(),
    };

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('loan_applications')
        .update({
          ...dbRecord,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
      console.log(`✅ Updated: ${fileNumber}`);
      return { success: true, action: 'updated', fileNumber };
    } else {
      // Insert new
      if (!clientId) {
        throw new Error(`Cannot insert without client_id for file: ${fileNumber}`);
      }

      const { error } = await supabase
        .from('loan_applications')
        .insert(dbRecord);

      if (error) throw error;
      console.log(`✅ Inserted: ${fileNumber}`);
      return { success: true, action: 'inserted', fileNumber };
    }
  } catch (error) {
    console.error(`❌ Error syncing record ${record.id}:`, error.message);
    return { success: false, error: error.message, recordId: record.id };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting POST webhook handler...\n');

  try {
    // Fetch from GET webhook
    const records = await fetchFromGetWebhook();

    if (records.length === 0) {
      console.log('ℹ️  No records to sync');
      return {
        success: true,
        message: 'No records to sync',
        synced: 0,
        failed: 0,
      };
    }

    console.log(`\n📝 Syncing ${records.length} records to database...\n`);

    // Sync each record
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const record of records) {
      const result = await syncRecord(record);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(result);
      }
    }

    console.log(`\n✨ Sync complete!`);
    console.log(`   ✅ Success: ${results.success}`);
    console.log(`   ❌ Failed: ${results.failed}`);

    return {
      success: results.failed === 0,
      message: `Synced ${results.success} records, ${results.failed} failed`,
      synced: results.success,
      failed: results.failed,
      errors: results.errors,
    };
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

export { main as handleWebhookPost };

