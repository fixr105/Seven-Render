/**
 * Test POST Webhook Handler with Real Data
 * Fetches from GET webhook and tests POST sync
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

async function testPostHandler() {
  console.log('🧪 Testing POST Webhook Handler with Real Data\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Fetch from GET webhook
    console.log('📡 Step 1: Fetching data from GET webhook...');
    console.log(`   URL: ${GET_WEBHOOK_URL}\n`);
    
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
    console.log('✅ Received data from GET webhook:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    // Step 2: Parse the data
    console.log('🔄 Step 2: Parsing data structure...');
    
    let record;
    if (data.id && !data.fields) {
      // Flat format - extract fields
      const { id, createdTime, ...fields } = data;
      record = {
        id: id,
        fields: fields,
        createdTime: createdTime,
      };
    } else if (data.fields) {
      record = data;
    } else {
      throw new Error('Unknown data format');
    }

    console.log('✅ Parsed record structure:');
    console.log(JSON.stringify(record, null, 2));
    console.log('');

    // Step 3: Extract key fields
    console.log('📋 Step 3: Extracting key fields...');
    const fields = record.fields || {};
    const fileNumber = fields['Mapping ID'] || fields['File ID'] || fields['File Number'] || null;
    const clientIdentifier = fields['Client'] || fields['Client Name'] || null;
    const category = fields['Category'] || fields['Loan Product'] || fields['Loan Type'] || null;
    
    console.log(`   File Number (Mapping ID): ${fileNumber}`);
    console.log(`   Client: ${clientIdentifier}`);
    console.log(`   Category: ${category}`);
    console.log('');

    if (!fileNumber) {
      throw new Error('Missing Mapping ID/File ID - cannot sync without file_number');
    }

    // Step 4: Resolve client_id
    console.log('🔍 Step 4: Resolving client_id...');
    let clientId = null;
    if (clientIdentifier) {
      // Try to find by company name or code
      const { data: clientData, error: clientError } = await supabase
        .from('dsa_clients')
        .select('id, company_name')
        .or(`company_name.ilike.%${clientIdentifier}%,contact_person.ilike.%${clientIdentifier}%`)
        .maybeSingle();
      
      if (clientError) {
        console.warn(`   ⚠️  Error resolving client: ${clientError.message}`);
      } else if (clientData) {
        clientId = clientData.id;
        console.log(`   ✅ Found client: ${clientData.company_name} (ID: ${clientId})`);
      } else {
        console.warn(`   ⚠️  Client "${clientIdentifier}" not found in database`);
        console.log('   💡 You may need to create this client first');
      }
    } else {
      console.warn('   ⚠️  No client identifier in webhook data');
    }
    console.log('');

    // Step 5: Resolve loan_product_id
    console.log('🔍 Step 5: Resolving loan_product_id...');
    let loanProductId = null;
    if (category) {
      const { data: productData, error: productError } = await supabase
        .from('loan_products')
        .select('id, name, code')
        .or(`name.ilike.%${category}%,code.ilike.%${category}%`)
        .maybeSingle();
      
      if (productError) {
        console.warn(`   ⚠️  Error resolving loan product: ${productError.message}`);
      } else if (productData) {
        loanProductId = productData.id;
        console.log(`   ✅ Found loan product: ${productData.name} (ID: ${loanProductId})`);
      } else {
        console.warn(`   ⚠️  Loan product "${category}" not found in database`);
        console.log('   💡 You may need to create this loan product first');
      }
    } else {
      console.warn('   ⚠️  No category/loan product identifier in webhook data');
    }
    console.log('');

    // Step 6: Check if record exists
    console.log('🔍 Step 6: Checking if record exists in database...');
    const { data: existing, error: checkError } = await supabase
      .from('loan_applications')
      .select('id, file_number, client_id, status')
      .eq('file_number', fileNumber)
      .maybeSingle();
    
    if (checkError) {
      console.warn(`   ⚠️  Error checking existing record: ${checkError.message}`);
    } else if (existing) {
      console.log(`   ✅ Record exists: ${existing.id}`);
      console.log(`      File Number: ${existing.file_number}`);
      console.log(`      Client ID: ${existing.client_id}`);
      console.log(`      Status: ${existing.status}`);
    } else {
      console.log(`   ℹ️  Record does not exist - will be created`);
    }
    console.log('');

    // Step 7: Prepare database record
    console.log('📝 Step 7: Preparing database record...');
    
    if (!clientId) {
      console.error('❌ Cannot sync without client_id');
      console.log('\n💡 Solution: Create the client in the database first, or update the webhook data with a valid client identifier');
      return {
        success: false,
        message: 'Missing client_id - cannot sync without valid client',
        synced: 0,
        failed: 1,
      };
    }

    const dbRecord = {
      file_number: fileNumber,
      client_id: clientId,
      applicant_name: fields['Applicant Name'] || fields['Performed By'] || null,
      loan_product_id: loanProductId,
      requested_loan_amount: fields['Requested Loan Amount'] 
        ? parseFloat(fields['Requested Loan Amount'].toString().replace(/[^0-9.]/g, '')) 
        : null,
      status: 'draft', // Default status
      form_data: {
        ...fields,
        webhook_id: record.id,
        webhook_synced_at: new Date().toISOString(),
        original_data: data,
      },
      created_at: record.createdTime || fields['Creation Date'] || fields['Timestamp'] || new Date().toISOString(),
      updated_at: fields['Last Updated'] || record.createdTime || new Date().toISOString(),
    };

    console.log('✅ Database record prepared:');
    console.log(JSON.stringify(dbRecord, null, 2));
    console.log('');

    // Step 8: Sync to database
    console.log('💾 Step 8: Syncing to database...');
    
    if (existing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from('loan_applications')
        .update({
          ...dbRecord,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }
      console.log('✅ Record updated successfully!');
      console.log(`   ID: ${updated.id}`);
      return {
        success: true,
        message: 'Record updated successfully',
        synced: 1,
        failed: 0,
        action: 'updated',
        recordId: updated.id,
      };
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from('loan_applications')
        .insert(dbRecord)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }
      console.log('✅ Record inserted successfully!');
      console.log(`   ID: ${inserted.id}`);
      return {
        success: true,
        message: 'Record inserted successfully',
        synced: 1,
        failed: 0,
        action: 'inserted',
        recordId: inserted.id,
      };
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('   Error details:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.details) {
      console.error(`   Details: ${error.details}`);
    }
    return {
      success: false,
      message: error.message || 'Test failed',
      synced: 0,
      failed: 1,
      error: error,
    };
  }
}

// Run the test
testPostHandler()
  .then((result) => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Final Result:');
    console.log(`   Success: ${result.success ? '✅ Yes' : '❌ No'}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Synced: ${result.synced}`);
    console.log(`   Failed: ${result.failed}`);
    if (result.recordId) {
      console.log(`   Record ID: ${result.recordId}`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Unhandled error:', error);
    process.exit(1);
  });

