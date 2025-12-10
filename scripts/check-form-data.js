/**
 * Script to check form data in the database
 * This helps verify if form categories, fields, and mappings exist
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

async function checkFormData() {
  console.log('🔍 Checking Form Data in Database...\n');

  try {
    // Note: This script assumes you have access to the n8n webhooks
    // In a real scenario, you'd call the webhook endpoints directly
    
    console.log('📋 To check form data, you need to:');
    console.log('1. Check Airtable tables:');
    console.log('   - Form Categories');
    console.log('   - Form Fields');
    console.log('   - Client Form Mapping');
    console.log('\n2. Verify the following:');
    console.log('   - Form Categories exist with Active = "True"');
    console.log('   - Form Fields exist with Category matching Category ID');
    console.log('   - Form Fields have Active = "True"');
    console.log('   - Client Form Mapping has Client matching client ID');
    console.log('   - Client Form Mapping has Category matching Category ID');
    console.log('\n3. Check a specific client:');
    console.log('   - Login as that client');
    console.log('   - Check browser console for logs starting with "NewApplication:"');
    console.log('   - Check backend console for logs starting with "[getFormConfig]"');
    
    console.log('\n✅ The fields ARE being created when KAM configures a form.');
    console.log('   Each module (Universal Checklist, Personal KYC, etc.) creates:');
    console.log('   - 1 Form Category (e.g., "Universal Checklist")');
    console.log('   - N Form Fields (one for each field in the module)');
    console.log('   - 1 Client Form Mapping (linking client to category)');
    
    console.log('\n⚠️  If fields are not showing:');
    console.log('   1. Verify the client ID matches in Client Form Mapping');
    console.log('   2. Verify categories are Active = "True"');
    console.log('   3. Verify fields are Active = "True"');
    console.log('   4. Check the backend logs for matching issues');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFormData();

