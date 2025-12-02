/**
 * Test POST to Client Webhook
 * Tests: https://fixrrahul.app.n8n.cloud/webhook/Client
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/Client';

// Test data with exact fields as specified
const testData = {
  id: 'CLIENT-TEST-' + Date.now(), // for matching
  'Client ID': 'CLIENT-TEST-' + Date.now(),
  'Client Name': 'Test Corporation Pvt Ltd',
  'Primary Contact Name': 'John Doe',
  'Contact Email / Phone': 'contact@testcorp.com / +91 9876543210',
  'Assigned KAM': 'KAM Manager 1',
  'Enabled Modules': 'ledger, queries, applications, form_builder',
  'Commission Rate': '1.5',
  'Status': 'Active',
  'Form Categories': 'Personal Information, Financial Information'
};

async function testClientPost() {
  try {
    console.log('🧪 Testing Client POST Webhook\n');
    console.log('URL:', WEBHOOK_URL);
    console.log('\n📤 Sending data:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('\n' + '-'.repeat(60) + '\n');

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const responseText = await response.text();
    
    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('\n📥 Response Body:');
    
    if (responseText.trim() === '') {
      console.log('(Empty response)');
    } else {
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log(JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log(responseText);
      }
    }

    console.log('\n' + '-'.repeat(60) + '\n');

    if (response.ok) {
      console.log('✅ SUCCESS: Client created successfully!');
      console.log('\nTest data sent (all 10 fields):');
      console.log('1. id:', testData.id);
      console.log('2. Client ID:', testData['Client ID']);
      console.log('3. Client Name:', testData['Client Name']);
      console.log('4. Primary Contact Name:', testData['Primary Contact Name']);
      console.log('5. Contact Email / Phone:', testData['Contact Email / Phone']);
      console.log('6. Assigned KAM:', testData['Assigned KAM']);
      console.log('7. Enabled Modules:', testData['Enabled Modules']);
      console.log('8. Commission Rate:', testData['Commission Rate']);
      console.log('9. Status:', testData['Status']);
      console.log('10. Form Categories:', testData['Form Categories']);
    } else {
      console.log('❌ FAILED:', response.status, response.statusText);
      console.log('Response:', responseText);
    }

    return {
      success: response.ok,
      status: response.status,
      data: responseText,
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run test
testClientPost()
  .then((result) => {
    console.log('\n📊 Test Result:', result.success ? '✅ PASS' : '❌ FAIL');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

