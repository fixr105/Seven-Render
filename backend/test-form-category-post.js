/**
 * Test POST to Form Category Webhook
 * Tests: https://fixrrahul.app.n8n.cloud/webhook/FormCategory
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/FormCategory';

// Test data with exact fields
const testData = {
  id: 'CAT-TEST-' + Date.now(), // for matching
  'Category ID': 'CAT-TEST-' + Date.now(),
  'Category Name': 'Test Category - ' + new Date().toISOString(),
  'Description': 'This is a test form category created for QA testing',
  'Display Order': '1',
  'Active': 'True'
};

async function testFormCategoryPost() {
  try {
    console.log('🧪 Testing Form Category POST Webhook\n');
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
      console.log('✅ SUCCESS: Form Category created successfully!');
      console.log('\nTest data sent:');
      console.log('- id:', testData.id);
      console.log('- Category ID:', testData['Category ID']);
      console.log('- Category Name:', testData['Category Name']);
      console.log('- Description:', testData['Description']);
      console.log('- Display Order:', testData['Display Order']);
      console.log('- Active:', testData['Active']);
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
testFormCategoryPost()
  .then((result) => {
    console.log('\n📊 Test Result:', result.success ? '✅ PASS' : '❌ FAIL');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

