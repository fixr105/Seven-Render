/**
 * Test POST to File Audit Log Webhook
 * Tests: https://fixrrahul.app.n8n.cloud/webhook/Fileauditinglog
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/Fileauditinglog';

// Test data with exact fields as specified
const testData = {
  id: 'AUDIT-TEST-' + Date.now(), // for matching
  'Log Entry ID': 'AUDIT-TEST-' + Date.now(),
  'File': 'SF20250115001',
  'Timestamp': new Date().toISOString(),
  'Actor': 'KAM User - John Doe',
  'Action/Event Type': 'status_change',
  'Details/Message': 'Status changed from pending_kam_review to forwarded_to_credit',
  'Target User/Role': 'credit_team',
  'Resolved': 'False'
};

async function testFileAuditLogPost() {
  try {
    console.log('🧪 Testing File Audit Log POST Webhook\n');
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
      console.log('✅ SUCCESS: File Audit Log created successfully!');
      console.log('\nTest data sent (all 9 fields):');
      console.log('1. id:', testData.id);
      console.log('2. Log Entry ID:', testData['Log Entry ID']);
      console.log('3. File:', testData['File']);
      console.log('4. Timestamp:', testData['Timestamp']);
      console.log('5. Actor:', testData['Actor']);
      console.log('6. Action/Event Type:', testData['Action/Event Type']);
      console.log('7. Details/Message:', testData['Details/Message']);
      console.log('8. Target User/Role:', testData['Target User/Role']);
      console.log('9. Resolved:', testData['Resolved']);
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
testFileAuditLogPost()
  .then((result) => {
    console.log('\n📊 Test Result:', result.success ? '✅ PASS' : '❌ FAIL');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

