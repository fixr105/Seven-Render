/**
 * Test Admin Activity Log POST
 * Tests POSTing admin activity to the activity log webhook
 */

import fetch from 'node-fetch';

const POST_LOG_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/POSTLOG';

async function testAdminLogPost() {
  console.log('🧪 Testing Admin Activity Log POST\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Test data for Admin Activity Log
    const activityData = {
      'Activity ID': 'ACT-' + Date.now(),
      'Timestamp': new Date().toISOString(),
      'Performed By': 'Test User',
      'Action Type': 'User Created',
      'Description/Details': 'Test admin activity log entry',
      'Target Entity': 'User Account',
    };

    console.log('📋 Step 1: Preparing admin activity data...');
    console.log(JSON.stringify(activityData, null, 2));
    console.log('');

    // Step 2: POST to n8n webhook
    console.log('📤 Step 2: POSTing to admin activity log webhook...');
    console.log(`   URL: ${POST_LOG_WEBHOOK_URL}\n`);
    
    const postResponse = await fetch(POST_LOG_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activityData),
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      throw new Error(`POST webhook returned status ${postResponse.status}: ${postResponse.statusText}. Response: ${errorText}`);
    }

    // Handle response
    const responseText = await postResponse.text();
    let postResult;
    
    if (responseText.trim() === '') {
      postResult = { success: true, message: 'Admin activity logged successfully (empty response from n8n)' };
    } else {
      try {
        postResult = JSON.parse(responseText);
      } catch (e) {
        postResult = { message: responseText, status: postResponse.status };
      }
    }
    
    console.log('✅ POST successful!');
    console.log('📊 n8n Response:');
    console.log(JSON.stringify(postResult, null, 2));
    console.log('');

    return {
      success: true,
      message: 'Successfully posted admin activity to log',
      activityData,
      postResult,
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('   Details:', error.message);
    return {
      success: false,
      message: error.message || 'Test failed',
      error: error,
    };
  }
}

// Run the test
testAdminLogPost()
  .then((result) => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Final Result:');
    console.log(`   Success: ${result.success ? '✅ Yes' : '❌ No'}`);
    console.log(`   Message: ${result.message}`);
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Unhandled error:', error);
    process.exit(1);
  });

