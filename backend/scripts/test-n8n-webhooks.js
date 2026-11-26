function requiredN8nOrigin(name) {
  const raw = String(process.env[name] || '').trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
  if (!raw) {
    console.error(name + ' is required. Refusing to fall back to the old n8n host.');
    process.exit(1);
  }
  return raw;
}

/**
 * Test n8n Webhook Connectivity
 * 
 * This script tests all webhook endpoints to verify they're properly wired up
 * and responding correctly.
 */

import fetch from 'node-fetch';

const LMS = requiredN8nOrigin('N8N_LMS_BASE_URL');
const LEGACY = requiredN8nOrigin('N8N_LMS_BASE_URL');

// Paths that exist on Hostinger use LMS. The rest stay on the legacy base.
const n8nEndpoints = {
  get: {
    userAccount: `${LMS}/webhook/useraccount`,
    client: `${LMS}/webhook/client`,
    kamUsers: `${LMS}/webhook/kamusers`,
    creditTeamUser: `${LMS}/webhook/creditteamuser`,
    loanApplication: `${LMS}/webhook/loanapplication`,
    loanProducts: `${LMS}/webhook/loanproducts`,
    nbfcPartners: `${LMS}/webhook/nbfcpartners`,
    formCategories: `${LEGACY}/webhook/formcategories`,
    formFields: `${LEGACY}/webhook/formfields`,
    commissionLedger: `${LMS}/webhook/commisionledger`,
    clientFormMapping: `${LEGACY}/webhook/clientformmapping`,
    adminActivity: `${LEGACY}/webhook/adminactivity`,
    dailySummaryReport: `${LMS}/webhook/dailysummaryreport`,
    fileAuditingLog: `${LMS}/webhook/fileauditinglog`,
    notifications: `${LMS}/webhook/notifications`,
  },
  post: {
    addUser: `${LMS}/webhook/adduser`,
    client: `${LMS}/webhook/Client`,
    log: `${LMS}/webhook/POSTLOG`,
    clientFormMapping: `${LEGACY}/webhook/POSTCLIENTFORMMAPPING`,
    commissionLedger: `${LMS}/webhook/COMISSIONLEDGER`,
    creditTeamUsers: `${LMS}/webhook/CREDITTEAMUSERS`,
    dailySummary: `${LMS}/webhook/DAILYSUMMARY`,
    fileAuditLog: `${LEGACY}/webhook/Fileauditinglog`,
    formCategory: `${LEGACY}/webhook/FormCategory`,
    formFields: `${LEGACY}/webhook/FormFields`,
    kamUsers: `${LMS}/webhook/KAMusers`,
    loanApplications: `${LEGACY}/webhook/loanapplications`,
    loanProducts: `${LEGACY}/webhook/loanproducts`,
    nbfcPartners: `${LEGACY}/webhook/NBFCPartners`,
    notification: `${LMS}/webhook/notification`,
    email: `${LEGACY}/webhook/email`,
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

