/**
 * Test n8n Webhook Connectivity
 * 
 * This script tests all webhook endpoints to verify they're properly wired up
 * and responding correctly.
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://fixrrahul.app.n8n.cloud';

// Webhook paths from n8n flow (SEVEN-DASHBOARD-2.json)
const n8nEndpoints = {
  get: {
    userAccount: `${BASE_URL}/webhook/useraccount`,
    client: `${BASE_URL}/webhook/client`,
    kamUsers: `${BASE_URL}/webhook/kamusers`,
    creditTeamUser: `${BASE_URL}/webhook/creditteamuser`,
    loanApplication: `${BASE_URL}/webhook/loanapplication`,
    loanProducts: `${BASE_URL}/webhook/loanproducts`,
    nbfcPartners: `${BASE_URL}/webhook/nbfcpartners`,
    formCategories: `${BASE_URL}/webhook/formcategories`,
    formFields: `${BASE_URL}/webhook/formfields`,
    commissionLedger: `${BASE_URL}/webhook/commisionledger`,
    clientFormMapping: `${BASE_URL}/webhook/clientformmapping`,
    adminActivity: `${BASE_URL}/webhook/adminactivity`,
    dailySummaryReport: `${BASE_URL}/webhook/dailysummaryreport`,
    fileAuditingLog: `${BASE_URL}/webhook/fileauditinglog`,
    notifications: `${BASE_URL}/webhook/notifications`,
  },
  post: {
    addUser: `${BASE_URL}/webhook/adduser`,
    client: `${BASE_URL}/webhook/Client`,
    log: `${BASE_URL}/webhook/POSTLOG`,
    clientFormMapping: `${BASE_URL}/webhook/POSTCLIENTFORMMAPPING`,
    commissionLedger: `${BASE_URL}/webhook/COMISSIONLEDGER`,
    creditTeamUsers: `${BASE_URL}/webhook/CREDITTEAMUSERS`,
    dailySummary: `${BASE_URL}/webhook/DAILYSUMMARY`,
    fileAuditLog: `${BASE_URL}/webhook/Fileauditinglog`,
    formCategory: `${BASE_URL}/webhook/FormCategory`,
    formFields: `${BASE_URL}/webhook/FormFields`,
    kamUsers: `${BASE_URL}/webhook/KAMusers`,
    loanApplications: `${BASE_URL}/webhook/loanapplications`,
    loanProducts: `${BASE_URL}/webhook/loanproducts`,
    nbfcPartners: `${BASE_URL}/webhook/NBFCPartners`,
    notification: `${BASE_URL}/webhook/notification`,
    email: `${BASE_URL}/webhook/email`,
  },
};

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

/**
 * Test a GET webhook
 */
async function testGetWebhook(name, url) {
  try {
    console.log(`\n🔍 Testing GET: ${name}`);
    console.log(`   URL: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📦 Response type: ${Array.isArray(data) ? 'Array' : typeof data}`);
      if (Array.isArray(data)) {
        console.log(`   📊 Records: ${data.length}`);
      }
      results.passed.push({ name, url, status: response.status });
      return true;
    } else {
      console.log(`   ❌ Status: ${response.status} ${response.statusText}`);
      results.failed.push({ name, url, status: response.status, error: response.statusText });
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`   ⏱️  Timeout after 10 seconds`);
      results.failed.push({ name, url, error: 'Timeout' });
    } else {
      console.log(`   ❌ Error: ${error.message}`);
      results.failed.push({ name, url, error: error.message });
    }
    return false;
  }
}

/**
 * Test a POST webhook
 */
async function testPostWebhook(name, url, testData) {
  try {
    console.log(`\n🔍 Testing POST: ${name}`);
    console.log(`   URL: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok || response.status === 200 || response.status === 201) {
      const text = await response.text();
      console.log(`   ✅ Status: ${response.status}`);
      if (text) {
        try {
          const data = JSON.parse(text);
          console.log(`   📦 Response: ${JSON.stringify(data).substring(0, 100)}...`);
        } catch {
          console.log(`   📦 Response: ${text.substring(0, 100)}...`);
        }
      }
      results.passed.push({ name, url, status: response.status });
      return true;
    } else {
      console.log(`   ❌ Status: ${response.status} ${response.statusText}`);
      const text = await response.text().catch(() => '');
      console.log(`   📦 Response: ${text.substring(0, 200)}`);
      results.failed.push({ name, url, status: response.status, error: response.statusText });
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`   ⏱️  Timeout after 10 seconds`);
      results.failed.push({ name, url, error: 'Timeout' });
    } else {
      console.log(`   ❌ Error: ${error.message}`);
      results.failed.push({ name, url, error: error.message });
    }
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Testing n8n Webhook Connectivity\n');
  console.log('=' .repeat(60));
  
  // Test GET webhooks
  console.log('\n📥 Testing GET Webhooks (Read Operations)');
  console.log('-'.repeat(60));
  
  await testGetWebhook('User Accounts', n8nEndpoints.get.userAccount);
  await testGetWebhook('Clients', n8nEndpoints.get.client);
  await testGetWebhook('KAM Users', n8nEndpoints.get.kamUsers);
  await testGetWebhook('Credit Team Users', n8nEndpoints.get.creditTeamUser);
  await testGetWebhook('Loan Applications', n8nEndpoints.get.loanApplication);
  await testGetWebhook('Loan Products', n8nEndpoints.get.loanProducts);
  await testGetWebhook('NBFC Partners', n8nEndpoints.get.nbfcPartners);
  await testGetWebhook('Form Categories', n8nEndpoints.get.formCategories);
  await testGetWebhook('Form Fields', n8nEndpoints.get.formFields);
  await testGetWebhook('Commission Ledger', n8nEndpoints.get.commissionLedger);
  
  // Test POST webhooks with minimal test data
  console.log('\n\n📤 Testing POST Webhooks (Write Operations)');
  console.log('-'.repeat(60));
  
  // Test add user (most critical for login)
  await testPostWebhook('Add User', n8nEndpoints.post.addUser, {
    id: `TEST-${Date.now()}`,
    Username: 'test@example.com',
    Password: 'Test@123',
    Role: 'client',
    'Account Status': 'Active',
  });
  
  // Test other POST endpoints
  await testPostWebhook('Client', n8nEndpoints.post.client, {
    id: `TEST-CLIENT-${Date.now()}`,
    'Client ID': `TEST-CLIENT-${Date.now()}`,
    'Client Name': 'Test Client',
    'Status': 'Active',
  });
  
  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.forEach(r => {
      console.log(`   ✓ ${r.name} (${r.status})`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(r => {
      console.log(`   ✗ ${r.name}: ${r.error || r.status}`);
      console.log(`     URL: ${r.url}`);
    });
  }
  
  // Critical check: User Accounts webhook (needed for login)
  const userAccountTest = results.passed.find(r => r.name === 'User Accounts') || 
                         results.failed.find(r => r.name === 'User Accounts');
  
  if (!userAccountTest || results.failed.includes(userAccountTest)) {
    console.log('\n⚠️  CRITICAL: User Accounts webhook is not working!');
    console.log('   Login functionality will not work without this.');
  } else {
    console.log('\n✅ CRITICAL: User Accounts webhook is working!');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});

