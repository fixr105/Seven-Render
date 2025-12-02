/**
 * Simple POST and Verify Test
 * POSTs data, then uses GET to find and verify the exact record
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://fixrrahul.app.n8n.cloud/webhook';
const GET_URL = 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52';

// Test one webhook at a time to verify retrieval
async function testSingleWebhook() {
  const testData = {
    id: 'VERIFY-TEST-' + Date.now(),
    'Activity ID': 'ACT-VERIFY-' + Date.now(),
    'Timestamp': new Date().toISOString(),
    'Performed By': 'Verification Test User',
    'Action Type': 'Verification Test',
    'Description/Details': 'Testing exact field retrieval',
    'Target Entity': 'Test Entity'
  };

  console.log('🧪 Step 1: POST data to POSTLOG');
  console.log('Data:', JSON.stringify(testData, null, 2));
  
  // POST
  const postResponse = await fetch(`${BASE_URL}/POSTLOG`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData),
  });

  const postResult = await postResponse.json();
  console.log('✅ POST Success:', postResult.id);
  console.log('Airtable Record ID:', postResult.id);
  
  // Wait a bit
  console.log('\n⏳ Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // GET and search
  console.log('\n🔍 Step 2: GET and verify');
  const getResponse = await fetch(GET_URL);
  const getData = await getResponse.json();
  
  console.log('GET Response type:', Array.isArray(getData) ? 'Array' : typeof getData);
  console.log('GET Response keys:', Object.keys(getData || {}).slice(0, 10));
  
  // Search for our record
  const searchId = testData['Activity ID'];
  console.log(`\nSearching for Activity ID: ${searchId}`);
  
  // Handle different response structures
  let found = false;
  if (Array.isArray(getData)) {
    found = getData.find(r => r['Activity ID'] === searchId);
  } else if (getData && typeof getData === 'object') {
    // Check if it's structured by table
    if (getData['Admin Activity log']) {
      found = getData['Admin Activity log'].find(r => r['Activity ID'] === searchId);
    } else if (getData['Activity ID'] === searchId) {
      found = getData;
    }
  }
  
  if (found) {
    console.log('✅ Record found!');
    console.log('\n📊 Field Comparison:');
    for (const [key, value] of Object.entries(testData)) {
      const retrieved = found[key];
      const match = String(value) === String(retrieved);
      console.log(`  ${match ? '✅' : '❌'} ${key}:`);
      console.log(`    Posted: "${value}"`);
      console.log(`    Retrieved: "${retrieved}"`);
    }
  } else {
    console.log('❌ Record not found in GET response');
    console.log('Sample of GET data:', JSON.stringify(getData, null, 2).substring(0, 500));
  }
}

testSingleWebhook().catch(console.error);

