function requiredN8nOrigin(name) {
  const raw = String(process.env[name] || '').trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
  if (!raw) {
    console.error(name + ' is required. Refusing to fall back to the old n8n host.');
    process.exit(1);
  }
  return raw;
}

/**
 * Test NBFC Partners POST Webhook
 * URL: ${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/NBFCPartners
 * 
 * Fields:
 * - id (using to match)
 * - Lender ID
 * - Lender Name
 * - Contact Person
 * - Contact Email/Phone
 * - Address/Region
 * - Active
 */

const WEBHOOK_URL = `${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/NBFCPartners`;

const testData = {
  id: 'APP-TEST-' + Date.now(),
  'Lender ID': 'NBFC-TEST-001',
  'Lender Name': 'Test NBFC Partner',
  'Contact Person': 'John Doe',
  'Contact Email/Phone': 'john.doe@nbfc.com / +91-9876543210',
  'Address/Region': 'Mumbai, Maharashtra',
  'Active': 'True',
};

async function testNBFCWebhook() {
  console.log('🧪 Testing NBFC Partners POST Webhook');
  console.log('URL:', WEBHOOK_URL);
  console.log('');

  try {
    console.log('📤 Sending POST request...');
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('');

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('');

    const responseText = await response.text();
    console.log('📥 Response Body:', responseText);
    console.log('');

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('📥 Parsed Response:', JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.log('⚠️  Response is not valid JSON');
    }

    if (response.ok) {
      console.log('✅ Webhook test PASSED');
      console.log('');
      
      // Check if we got an Airtable record ID
      if (responseData && (responseData.id || responseData.recordId)) {
        const recordId = responseData.id || responseData.recordId;
        console.log('✅ Record created in Airtable:', recordId);
      }
    } else {
      console.log('❌ Webhook test FAILED');
      console.log('Status:', response.status);
      console.log('Response:', responseText);
    }

    return {
      success: response.ok,
      status: response.status,
      data: responseData,
      rawResponse: responseText,
    };
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run test
testNBFCWebhook()
  .then((result) => {
    console.log('');
    console.log('📊 Test Result Summary:');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

