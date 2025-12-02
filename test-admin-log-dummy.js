/**
 * Test Admin Activity Log POST with Dummy Data
 * POSTs dummy admin activity data to the activity log webhook
 */

import fetch from 'node-fetch';

const POST_LOG_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/POSTLOG';

// Dummy admin activity data samples
const dummyActivities = [
  {
    id: 'ACT-001', // Include id for matching
    'Activity ID': 'ACT-001',
    'Timestamp': new Date().toISOString(),
    'Performed By': 'KAM User - John Doe',
    'Action Type': 'User Created',
    'Description/Details': 'Created new client user account for ABC Corporation',
    'Target Entity': 'User Account',
  },
  {
    id: 'ACT-002',
    'Activity ID': 'ACT-002',
    'Timestamp': new Date().toISOString(),
    'Performed By': 'Credit Team - Jane Smith',
    'Action Type': 'Client Added',
    'Description/Details': 'Onboarded new DSA client: XYZ Enterprises',
    'Target Entity': 'DSA Client',
  },
  {
    id: 'ACT-003',
    'Activity ID': 'ACT-003',
    'Timestamp': new Date().toISOString(),
    'Performed By': 'System',
    'Action Type': 'Login Success',
    'Description/Details': 'User successfully logged in',
    'Target Entity': 'User Account',
  },
  {
    id: 'ACT-004',
    'Activity ID': 'ACT-004',
    'Timestamp': new Date().toISOString(),
    'Performed By': 'Admin',
    'Action Type': 'Modules Configuration Changed',
    'Description/Details': 'Updated enabled modules for client CL001',
    'Target Entity': 'DSA Client',
  },
  {
    id: 'ACT-005',
    'Activity ID': 'ACT-005',
    'Timestamp': new Date().toISOString(),
    'Performed By': 'KAM User - John Doe',
    'Action Type': 'User Role Changed',
    'Description/Details': 'Changed user role from client to kam',
    'Target Entity': 'User Account',
  },
];

async function postDummyAdminActivity(activityData) {
  try {
    console.log('📤 POSTing admin activity...');
    console.log('📋 Data:', JSON.stringify(activityData, null, 2));
    
    const response = await fetch(POST_LOG_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activityData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`POST returned status ${response.status}: ${errorText}`);
    }

    const responseText = await response.text();
    let result;
    
    if (responseText.trim() === '') {
      result = { success: true, message: 'Activity logged successfully' };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { message: responseText, status: response.status };
      }
    }
    
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testDummyData() {
  console.log('🧪 Testing Admin Activity Log POST with Dummy Data\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Post only the first activity for testing
  const activity = dummyActivities[0];
  console.log(`📝 Activity: ${activity['Action Type']}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const result = await postDummyAdminActivity(activity);
  
  if (result.success) {
    console.log('✅ Successfully posted');
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 Test Result:');
  console.log(`   ${result.success ? '✅ Success' : '❌ Failed'}`);

  return {
    success: result.success,
  };
}

// Run the test
testDummyData()
  .then((result) => {
    console.log('\n✅ Test complete!');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Unhandled error:', error);
    process.exit(1);
  });

