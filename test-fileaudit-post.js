/**
 * Test POST File Auditing Log webhook
 */

import fetch from 'node-fetch';

const N8N_BASE_URL = 'https://fixrrahul.app.n8n.cloud';
const POST_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/Fileauditinglog`;

async function testPostFileAuditLog() {
  const testData = {
    id: `AUDIT-TEST-${Date.now()}`,
    'Log Entry ID': `AUDIT-TEST-${Date.now()}`,
    'File': 'SF20250101001',
    'Timestamp': new Date().toISOString(),
    'Actor': 'Test User',
    'Action/Event Type': 'test_action',
    'Details/Message': 'Test file audit log entry',
    'Target User/Role': 'test',
    'Resolved': 'False',
  };

  console.log('🧪 Testing POST File Auditing Log webhook');
  console.log(`📡 URL: ${POST_WEBHOOK_URL}`);
  console.log(`📋 Data:`, JSON.stringify(testData, null, 2));

  try {
    const response = await fetch(POST_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const responseText = await response.text();
    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📄 Response Body: ${responseText}`);

    if (!response.ok) {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
      return { success: false, error: responseText };
    }

    let result;
    if (responseText.trim() === '') {
      result = { success: true, message: 'Empty response (may be OK)' };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { message: responseText };
      }
    }

    console.log(`✅ Success`);
    console.log(`Response:`, JSON.stringify(result, null, 2));
    return { success: true, result };
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

testPostFileAuditLog().catch(console.error);
