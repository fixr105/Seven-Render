function requiredN8nOrigin(name) {
  const raw = String(process.env[name] || '').trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
  if (!raw) {
    console.error(name + ' is required. Refusing to fall back to the old n8n host.');
    process.exit(1);
  }
  return raw;
}

/**
 * Macha Test - Reusable Webhook Test Script
 * Tests GET and POST webhooks with configurable URLs and data
 * 
 * Usage:
 *   GET:  node macha-test.js GET <webhook-url>
 *   POST: node macha-test.js POST <webhook-url> [test-data-file]
 * 
 * Examples:
 *   node macha-test.js GET ${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52
 *   node macha-test.js POST ${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/POSTLOG
 *   node macha-test.js POST ${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/POSTLOG test-data.json
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const METHOD = process.argv[2]?.toUpperCase();
const WEBHOOK_URL = process.argv[3];
const TEST_DATA_FILE = process.argv[4];

// Default test data for POST requests
const DEFAULT_POST_DATA = {
  id: `TEST-${Date.now()}`,
  'Activity ID': `ACT-TEST-${Date.now()}`,
  'Timestamp': new Date().toISOString(),
  'Performed By': 'Macha Test User',
  'Action Type': 'Test Action',
  'Description/Details': 'Macha test execution',
  'Target Entity': 'Test Entity',
};

/**
 * Test GET webhook
 */
async function testGetWebhook(url) {
  console.log('🧪 Macha Test - GET Webhook\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Webhook URL: ${url}\n`);

  try {
    console.log('📤 Sending GET request...');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GET returned status ${response.status}: ${errorText}`);
    }

    const responseText = await response.text();
    let result;

    if (responseText.trim() === '') {
      result = { success: true, message: 'Empty response received' };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { message: responseText, status: response.status };
      }
    }

    console.log('✅ GET request successful');
    console.log('\n📋 Response:');
    console.log(JSON.stringify(result, null, 2));

    // Check if fields are populated (for Airtable responses)
    if (result.fields && Object.keys(result.fields).length > 0) {
      console.log('\n✅ Fields populated:', Object.keys(result.fields).length, 'fields');
    } else if (result.fields && Object.keys(result.fields).length === 0) {
      console.log('\n⚠️  Warning: Fields object is empty');
    }

    return { success: true, result };
  } catch (error) {
    console.error('❌ GET request failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test POST webhook
 */
async function testPostWebhook(url, testData) {
  console.log('🧪 Macha Test - POST Webhook\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Webhook URL: ${url}\n`);

  try {
    console.log('📤 Sending POST request...');
    console.log('📋 Data:', JSON.stringify(testData, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`POST returned status ${response.status}: ${errorText}`);
    }

    const responseText = await response.text();
    let result;

    if (responseText.trim() === '') {
      result = { success: true, message: 'Empty response received' };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { message: responseText, status: response.status };
      }
    }

    console.log('\n✅ POST request successful');
    console.log('\n📋 Response:');
    console.log(JSON.stringify(result, null, 2));

    // Check if fields are populated (for Airtable responses)
    if (result.fields && Object.keys(result.fields).length > 0) {
      console.log('\n✅ Fields populated:', Object.keys(result.fields).length, 'fields');
      console.log('   Fields:', Object.keys(result.fields).join(', '));
    } else if (result.fields && Object.keys(result.fields).length === 0) {
      console.log('\n⚠️  Warning: Fields object is empty - check n8n field mapping');
    }

    return { success: true, result };
  } catch (error) {
    console.error('❌ POST request failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Load test data from file or use default
 */
function loadTestData() {
  if (TEST_DATA_FILE) {
    try {
      const filePath = path.resolve(TEST_DATA_FILE);
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        console.log(`📁 Loaded test data from: ${filePath}`);
        return data;
      } else {
        console.warn(`⚠️  Test data file not found: ${filePath}`);
        console.log('📋 Using default test data');
        return DEFAULT_POST_DATA;
      }
    } catch (error) {
      console.warn(`⚠️  Error loading test data file: ${error.message}`);
      console.log('📋 Using default test data');
      return DEFAULT_POST_DATA;
    }
  }
  return DEFAULT_POST_DATA;
}

/**
 * Main test function
 */
async function runMachaTest() {
  // Validate arguments
  if (!METHOD || (METHOD !== 'GET' && METHOD !== 'POST')) {
    console.error('❌ Invalid method. Use GET or POST');
    console.log('\nUsage:');
    console.log('  GET:  node macha-test.js GET <webhook-url>');
    console.log('  POST: node macha-test.js POST <webhook-url> [test-data-file]');
    process.exit(1);
  }

  if (!WEBHOOK_URL) {
    console.error('❌ Webhook URL is required');
    console.log('\nUsage:');
    console.log('  GET:  node macha-test.js GET <webhook-url>');
    console.log('  POST: node macha-test.js POST <webhook-url> [test-data-file]');
    process.exit(1);
  }

  let result;

  if (METHOD === 'GET') {
    result = await testGetWebhook(WEBHOOK_URL);
  } else {
    const testData = loadTestData();
    result = await testPostWebhook(WEBHOOK_URL, testData);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 Test Result:');
  console.log(`   ${result.success ? '✅ Success' : '❌ Failed'}`);

  if (!result.success) {
    console.log(`   Error: ${result.error}`);
  }

  process.exit(result.success ? 0 : 1);
}

// Run the test
runMachaTest().catch((error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});

