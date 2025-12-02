/**
 * Test POST to Form Fields Webhook
 * Tests: https://fixrrahul.app.n8n.cloud/webhook/FormFields
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/FormFields';

// Test data with exact fields as specified
const testData = {
  id: 'FIELD-TEST-' + Date.now(), // for matching
  'Field ID': 'FIELD-TEST-' + Date.now(),
  'Category': 'Personal Information',
  'Field Label': 'Full Name',
  'Field Type': 'text',
  'Field Placeholder': 'Enter your full name',
  'Field Options': '', // empty
  'Is Mandatory': 'True',
  'Display Order': '1',
  'Active': 'True'
};

async function testFormFieldsPost() {
  try {
    console.log('🧪 Testing Form Fields POST Webhook\n');
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
      console.log('✅ SUCCESS: Form Field created successfully!');
      console.log('\nTest data sent:');
      console.log('- id:', testData.id);
      console.log('- Field ID:', testData['Field ID']);
      console.log('- Category:', testData['Category']);
      console.log('- Field Label:', testData['Field Label']);
      console.log('- Field Type:', testData['Field Type']);
      console.log('- Field Placeholder:', testData['Field Placeholder']);
      console.log('- Field Options:', testData['Field Options'] || '(empty)');
      console.log('- Is Mandatory:', testData['Is Mandatory']);
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
testFormFieldsPost()
  .then((result) => {
    console.log('\n📊 Test Result:', result.success ? '✅ PASS' : '❌ FAIL');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

