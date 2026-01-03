/**
 * Script to disable/delete the old Basavaraj record from Credit Team Users
 * Updates the record status to "Disabled" to effectively remove it
 * 
 * Usage: node backend/scripts/delete-old-basavaraj.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_POST_CREDIT_TEAM_USERS_URL = `${N8N_BASE_URL}/webhook/CREDITTEAMUSERS`;
const N8N_GET_CREDIT_TEAM_USER_URL = `${N8N_BASE_URL}/webhook/creditteamuser`;

// The old record ID to disable
const OLD_RECORD_ID = 'recZPfaXUbsdaRnXA';

/**
 * Helper to get field value from record (handles different formats)
 */
function getField(record, fieldName) {
  if (record.fields && record.fields[fieldName] !== undefined) {
    return record.fields[fieldName];
  }
  if (record[fieldName] !== undefined) {
    return record[fieldName];
  }
  // Try case variations
  const lowerField = fieldName.toLowerCase();
  for (const key in record) {
    if (key.toLowerCase() === lowerField) {
      return record[key];
    }
  }
  if (record.fields) {
    for (const key in record.fields) {
      if (key.toLowerCase() === lowerField) {
        return record.fields[key];
      }
    }
  }
  return null;
}

/**
 * Fetch the old Basavaraj record
 */
async function fetchOldRecord() {
  console.log('📥 Fetching Credit Team Users to find old Basavaraj record...\n');
  
  try {
    const response = await fetch(N8N_GET_CREDIT_TEAM_USER_URL);
    const result = await response.json();
    
    if (response.ok) {
      const records = Array.isArray(result) ? result : (result.records || [result] || []);
      const oldRecord = records.find(r => r.id === OLD_RECORD_ID);
      
      if (oldRecord) {
        console.log('✅ Found old Basavaraj record:');
        console.log(`   ID: ${oldRecord.id}`);
        console.log(`   Name: ${getField(oldRecord, 'Name')}`);
        console.log(`   Email: ${getField(oldRecord, 'Email')}`);
        console.log(`   Role: ${getField(oldRecord, 'Role')}`);
        console.log(`   Status: ${getField(oldRecord, 'Status')}`);
        console.log(`   Credit User ID: ${getField(oldRecord, 'Credit User ID')}`);
        return oldRecord;
      } else {
        console.log('❌ Old Basavaraj record not found with ID:', OLD_RECORD_ID);
        return null;
      }
    } else {
      console.error(`❌ Failed to fetch Credit Team Users: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching Credit Team Users:`, error.message);
    return null;
  }
}

/**
 * Disable the old record by updating its status
 */
async function disableRecord(record) {
  const creditUserId = getField(record, 'Credit User ID') || OLD_RECORD_ID;
  const name = getField(record, 'Name') || 'Basavaraj';
  const email = getField(record, 'Email') || '';
  const phone = getField(record, 'Phone') || '';
  const role = getField(record, 'Role') || 'Credit';
  
  const updateData = {
    id: OLD_RECORD_ID, // Use the record ID for matching
    'Credit User ID': creditUserId,
    'Name': name,
    'Email': email,
    'Phone': phone,
    'Role': role,
    'Status': 'Disabled', // Set status to Disabled
  };

  console.log('\n📝 Updating record status to "Disabled"...');
  console.log('   Request body:', JSON.stringify(updateData, null, 2));
  
  try {
    const response = await fetch(N8N_POST_CREDIT_TEAM_USERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const result = await response.json();
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`\n✅ Successfully disabled old Basavaraj record`);
      return { success: true, result };
    } else {
      console.error(`\n❌ Failed to disable record`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error(`\n❌ Error disabling record:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify the record was disabled
 */
async function verifyDisabled() {
  console.log('\n🔍 Verifying record was disabled...\n');
  
  try {
    const response = await fetch(N8N_GET_CREDIT_TEAM_USER_URL);
    const result = await response.json();
    
    if (response.ok) {
      const records = Array.isArray(result) ? result : (result.records || [result] || []);
      const record = records.find(r => r.id === OLD_RECORD_ID);
      
      if (record) {
        const status = getField(record, 'Status');
        if (status === 'Disabled') {
          console.log('✅ Record status is now "Disabled"');
          return true;
        } else {
          console.log(`⚠️  Record still has status: "${status}" (expected "Disabled")`);
          return false;
        }
      } else {
        console.log('⚠️  Record not found (may have been deleted or ID changed)');
        return false;
      }
    } else {
      console.error(`❌ Failed to verify: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error verifying:`, error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting script to disable old Basavaraj record...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);
  console.log(`🎯 Target record ID: ${OLD_RECORD_ID}\n`);
  
  // Step 1: Fetch the old record
  const oldRecord = await fetchOldRecord();
  
  if (!oldRecord) {
    console.log('\n❌ Cannot proceed: Old record not found');
    process.exit(1);
  }
  
  // Step 2: Disable the record
  const result = await disableRecord(oldRecord);
  
  if (!result.success) {
    console.log('\n❌ Failed to disable record');
    process.exit(1);
  }
  
  // Step 3: Verify
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for update to propagate
  const verified = await verifyDisabled();
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  if (verified) {
    console.log('✅ Old Basavaraj record successfully disabled!');
    console.log('   The record is now marked as "Disabled" and will be filtered out.');
    process.exit(0);
  } else {
    console.log('⚠️  Record update completed, but verification failed.');
    console.log('   The record may still be visible. Please check manually in Airtable.');
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

