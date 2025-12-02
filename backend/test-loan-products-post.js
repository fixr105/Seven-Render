/**
 * Test POST to Loan Products Webhook
 * Tests: https://fixrrahul.app.n8n.cloud/webhook/loanproducts
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/loanproducts';

// Test data with exact fields as specified
const testData = {
  id: 'PROD-TEST-' + Date.now(), // for matching
  'Product ID': 'PROD-TEST-' + Date.now(),
  'Product Name': 'Test Loan Product',
  'Description': 'A short description of the test loan product.',
  'Active': 'True',
  'Required Documents/Fields': 'PAN, Aadhar, Bank Statement'
};

async function testLoanProductsPost() {
  try {
    console.log('🧪 Testing Loan Products POST Webhook\n');
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
      console.log('✅ SUCCESS: Loan Product created successfully!');
      console.log('\nTest data sent (all 6 fields):');
      console.log('1. id:', testData.id);
      console.log('2. Product ID:', testData['Product ID']);
      console.log('3. Product Name:', testData['Product Name']);
      console.log('4. Description:', testData['Description']);
      console.log('5. Active:', testData['Active']);
      console.log('6. Required Documents/Fields:', testData['Required Documents/Fields']);
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
testLoanProductsPost()
  .then((result) => {
    console.log('\n📊 Test Result:', result.success ? '✅ PASS' : '❌ FAIL');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

