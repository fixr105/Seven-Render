/**
 * Comprehensive QA Test Suite Runner
 * Executes all test cases for Seven Fincorp Dashboard
 * 
 * Usage:
 *   npm install axios
 *   node test-suite-runner.js
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const OUTPUT_FILE = 'test-results.json';

// Test tokens (will be obtained via login)
let clientToken = '';
let kamToken = '';
let creditToken = '';
let nbfcToken = '';

// Test data IDs (will be created during tests)
let testClientId = '';
let testApplicationId = '';
let testLedgerEntryId = '';
let testQueryId = '';

// Test results
const testResults = {
  passed: [],
  failed: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    passRate: 0,
  },
};

/**
 * Helper: Make API request
 */
async function apiRequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.response?.data?.error || error.message,
      data: error.response?.data,
    };
  }
}

/**
 * Helper: Record test result
 */
function recordTest(testCase, endpoint, method, expectedStatus, result, issueType = null) {
  const passed = result.status === expectedStatus;
  const testResult = {
    testCase,
    endpoint,
    method,
    expectedStatus,
    actualStatus: result.status,
    passed,
    issueType,
    error: result.error,
    timestamp: new Date().toISOString(),
  };

  if (passed) {
    testResults.passed.push(testResult);
    testResults.summary.passed++;
  } else {
    testResults.failed.push(testResult);
    testResults.summary.failed++;
  }

  testResults.summary.total++;
  testResults.summary.passRate = (
    (testResults.summary.passed / testResults.summary.total) * 100
  ).toFixed(2);

  return passed;
}

/**
 * Phase 1: Authentication Tests
 */
async function testAuthentication() {
  console.log('\n🔐 Phase 1: Authentication Tests\n');

  // Test AUTH-1.1: Login with valid CLIENT credentials
  const clientLogin = await apiRequest('POST', '/auth/login', {
    email: 'client@test.com',
    password: 'Test@123',
  });
  if (clientLogin.success && clientLogin.data?.data?.token) {
    clientToken = clientLogin.data.data.token;
    recordTest('AUTH-1.1', '/auth/login', 'POST', 200, clientLogin);
    console.log('✅ AUTH-1.1: CLIENT login successful');
  } else {
    recordTest('AUTH-1.1', '/auth/login', 'POST', 200, clientLogin, 'Missing Endpoint');
    console.log('❌ AUTH-1.1: CLIENT login failed');
  }

  // Test AUTH-1.2: Login with valid KAM credentials
  const kamLogin = await apiRequest('POST', '/auth/login', {
    email: 'kam@test.com',
    password: 'Test@123',
  });
  if (kamLogin.success && kamLogin.data?.data?.token) {
    kamToken = kamLogin.data.data.token;
    recordTest('AUTH-1.2', '/auth/login', 'POST', 200, kamLogin);
    console.log('✅ AUTH-1.2: KAM login successful');
  } else {
    recordTest('AUTH-1.2', '/auth/login', 'POST', 200, kamLogin, 'Missing Endpoint');
    console.log('❌ AUTH-1.2: KAM login failed');
  }

  // Test AUTH-1.3: Login with valid CREDIT credentials
  const creditLogin = await apiRequest('POST', '/auth/login', {
    email: 'credit@test.com',
    password: 'Test@123',
  });
  if (creditLogin.success && creditLogin.data?.data?.token) {
    creditToken = creditLogin.data.data.token;
    recordTest('AUTH-1.3', '/auth/login', 'POST', 200, creditLogin);
    console.log('✅ AUTH-1.3: CREDIT login successful');
  } else {
    recordTest('AUTH-1.3', '/auth/login', 'POST', 200, creditLogin, 'Missing Endpoint');
    console.log('❌ AUTH-1.3: CREDIT login failed');
  }

  // Test AUTH-1.4: Login with valid NBFC credentials
  const nbfcLogin = await apiRequest('POST', '/auth/login', {
    email: 'nbfc@test.com',
    password: 'Test@123',
  });
  if (nbfcLogin.success && nbfcLogin.data?.data?.token) {
    nbfcToken = nbfcLogin.data.data.token;
    recordTest('AUTH-1.4', '/auth/login', 'POST', 200, nbfcLogin);
    console.log('✅ AUTH-1.4: NBFC login successful');
  } else {
    recordTest('AUTH-1.4', '/auth/login', 'POST', 200, nbfcLogin, 'Missing Endpoint');
    console.log('❌ AUTH-1.4: NBFC login failed');
  }

  // Test AUTH-1.5: Login with invalid credentials
  const invalidLogin = await apiRequest('POST', '/auth/login', {
    email: 'invalid@test.com',
    password: 'wrong',
  });
  recordTest('AUTH-1.5', '/auth/login', 'POST', 401, invalidLogin);
  console.log(invalidLogin.status === 401 ? '✅ AUTH-1.5: Invalid login rejected' : '❌ AUTH-1.5: Should reject invalid login');

  // Test AUTH-2.1: Get current user (CLIENT)
  if (clientToken) {
    const meClient = await apiRequest('GET', '/auth/me', null, clientToken);
    recordTest('AUTH-2.1', '/auth/me', 'GET', 200, meClient);
    console.log(meClient.status === 200 ? '✅ AUTH-2.1: Get CLIENT user successful' : '❌ AUTH-2.1: Get CLIENT user failed');
  }

  // Test AUTH-3.1: Protected endpoint with valid token
  if (clientToken) {
    const dashboard = await apiRequest('GET', '/client/dashboard', null, clientToken);
    recordTest('AUTH-3.1', '/client/dashboard', 'GET', 200, dashboard);
    console.log(dashboard.status === 200 ? '✅ AUTH-3.1: Protected endpoint accessible' : '❌ AUTH-3.1: Protected endpoint failed');
  }

  // Test AUTH-3.2: Protected endpoint without token
  const noToken = await apiRequest('GET', '/client/dashboard');
  recordTest('AUTH-3.2', '/client/dashboard', 'GET', 401, noToken);
  console.log(noToken.status === 401 ? '✅ AUTH-3.2: Unauthorized access blocked' : '❌ AUTH-3.2: Should block unauthorized access');

  // Test AUTH-3.3: Wrong role access
  if (kamToken) {
    const wrongRole = await apiRequest('GET', '/client/dashboard', null, kamToken);
    recordTest('AUTH-3.3', '/client/dashboard', 'GET', 403, wrongRole);
    console.log(wrongRole.status === 403 ? '✅ AUTH-3.3: Wrong role blocked' : '❌ AUTH-3.3: Should block wrong role');
  }
}

/**
 * Phase 2: Client Capability Tests
 */
async function testClientCapabilities() {
  console.log('\n👤 Phase 2: Client Capability Tests\n');

  if (!clientToken) {
    console.log('⚠️  Skipping CLIENT tests - no token available');
    return;
  }

  // Test CLIENT-1.1: Get client dashboard
  const dashboard = await apiRequest('GET', '/client/dashboard', null, clientToken);
  recordTest('CLIENT-1.1', '/client/dashboard', 'GET', 200, dashboard);
  if (dashboard.success) {
    console.log('✅ CLIENT-1.1: Dashboard retrieved');
    // Verify structure
    const data = dashboard.data?.data;
    if (data && data.activeApplications && data.ledgerSummary && data.pendingQueries && data.payoutRequests) {
      console.log('✅ CLIENT-1.1: Dashboard structure correct');
    } else {
      console.log('⚠️  CLIENT-1.1: Dashboard structure incomplete');
    }
  } else {
    console.log('❌ CLIENT-1.1: Dashboard failed');
  }

  // Test CLIENT-2.1: Get form configuration
  const formConfig = await apiRequest('GET', '/client/form-config', null, clientToken);
  recordTest('CLIENT-2.1', '/client/form-config', 'GET', 200, formConfig);
  console.log(formConfig.status === 200 ? '✅ CLIENT-2.1: Form config retrieved' : '❌ CLIENT-2.1: Form config failed');

  // Test CLIENT-3.1: Create loan application
  const createApp = await apiRequest('POST', '/loan-applications', {
    productId: 'PROD001',
    borrowerIdentifiers: {
      pan: 'ABCDE1234F',
      name: 'Test Applicant',
    },
  }, clientToken);
  recordTest('CLIENT-3.1', '/loan-applications', 'POST', 200, createApp);
  if (createApp.success && createApp.data?.data?.fileId) {
    testApplicationId = createApp.data.data.loanApplicationId;
    console.log('✅ CLIENT-3.1: Application created');
  } else {
    console.log('❌ CLIENT-3.1: Application creation failed');
  }

  // Test CLIENT-4.1: Update application form
  if (testApplicationId) {
    const updateForm = await apiRequest('POST', `/loan-applications/${testApplicationId}/form`, {
      formData: {
        field_001: 'Test Value',
        field_002: 'Another Value',
      },
    }, clientToken);
    recordTest('CLIENT-4.1', '/loan-applications/:id/form', 'POST', 200, updateForm);
    console.log(updateForm.status === 200 ? '✅ CLIENT-4.1: Form updated' : '❌ CLIENT-4.1: Form update failed');
  }

  // Test CLIENT-5.1: Submit application
  if (testApplicationId) {
    const submitApp = await apiRequest('POST', `/loan-applications/${testApplicationId}/submit`, null, clientToken);
    recordTest('CLIENT-5.1', '/loan-applications/:id/submit', 'POST', 200, submitApp);
    console.log(submitApp.status === 200 ? '✅ CLIENT-5.1: Application submitted' : '❌ CLIENT-5.1: Submission failed');
  }

  // Test CLIENT-7.1: List applications
  const listApps = await apiRequest('GET', '/loan-applications', null, clientToken);
  recordTest('CLIENT-7.1', '/loan-applications', 'GET', 200, listApps);
  if (listApps.success) {
    console.log('✅ CLIENT-7.1: Applications listed');
    // Verify only client's applications
    const apps = listApps.data?.data || [];
    const allOwned = apps.every(app => app.Client === testClientId);
    if (allOwned) {
      console.log('✅ CLIENT-7.1: Data filtered correctly (RBAC)');
    } else {
      console.log('❌ CLIENT-7.1: Data filtering issue (RBAC violation)');
      recordTest('CLIENT-7.1-RBAC', '/loan-applications', 'GET', 200, { status: 200, error: 'RBAC violation' }, 'RBAC Violation');
    }
  } else {
    console.log('❌ CLIENT-7.1: List applications failed');
  }

  // Test CLIENT-10.1: Get ledger
  const ledger = await apiRequest('GET', '/clients/me/ledger', null, clientToken);
  recordTest('CLIENT-10.1', '/clients/me/ledger', 'GET', 200, ledger);
  console.log(ledger.status === 200 ? '✅ CLIENT-10.1: Ledger retrieved' : '❌ CLIENT-10.1: Ledger failed');
}

/**
 * Phase 3: KAM Capability Tests
 */
async function testKAMCapabilities() {
  console.log('\n👔 Phase 3: KAM Capability Tests\n');

  if (!kamToken) {
    console.log('⚠️  Skipping KAM tests - no token available');
    return;
  }

  // Test KAM-1.1: Get KAM dashboard
  const dashboard = await apiRequest('GET', '/kam/dashboard', null, kamToken);
  recordTest('KAM-1.1', '/kam/dashboard', 'GET', 200, dashboard);
  console.log(dashboard.status === 200 ? '✅ KAM-1.1: Dashboard retrieved' : '❌ KAM-1.1: Dashboard failed');

  // Test KAM-2.1: Create client
  const createClient = await apiRequest('POST', '/kam/clients', {
    name: 'Test Client Company',
    email: 'testclient@example.com',
    phone: '1234567890',
    enabledModules: ['M1', 'M2', 'M3'],
    commissionRate: '1.5',
  }, kamToken);
  recordTest('KAM-2.1', '/kam/clients', 'POST', 200, createClient);
  if (createClient.success && createClient.data?.data?.clientId) {
    testClientId = createClient.data.data.clientId;
    console.log('✅ KAM-2.1: Client created');
  } else {
    console.log('❌ KAM-2.1: Client creation failed');
  }

  // Test KAM-2.6: List clients
  const listClients = await apiRequest('GET', '/kam/clients', null, kamToken);
  recordTest('KAM-2.6', '/kam/clients', 'GET', 200, listClients);
  console.log(listClients.status === 200 ? '✅ KAM-2.6: Clients listed' : '❌ KAM-2.6: List clients failed');

  // Test KAM-4.1: List applications
  const listApps = await apiRequest('GET', '/kam/loan-applications', null, kamToken);
  recordTest('KAM-4.1', '/kam/loan-applications', 'GET', 200, listApps);
  console.log(listApps.status === 200 ? '✅ KAM-4.1: Applications listed' : '❌ KAM-4.1: List applications failed');
}

/**
 * Phase 4: Credit Team Capability Tests
 */
async function testCreditCapabilities() {
  console.log('\n💼 Phase 4: Credit Team Capability Tests\n');

  if (!creditToken) {
    console.log('⚠️  Skipping CREDIT tests - no token available');
    return;
  }

  // Test CREDIT-1.1: Get credit dashboard
  const dashboard = await apiRequest('GET', '/credit/dashboard', null, creditToken);
  recordTest('CREDIT-1.1', '/credit/dashboard', 'GET', 200, dashboard);
  console.log(dashboard.status === 200 ? '✅ CREDIT-1.1: Dashboard retrieved' : '❌ CREDIT-1.1: Dashboard failed');

  // Test CREDIT-2.1: List all applications
  const listApps = await apiRequest('GET', '/credit/loan-applications', null, creditToken);
  recordTest('CREDIT-2.1', '/credit/loan-applications', 'GET', 200, listApps);
  console.log(listApps.status === 200 ? '✅ CREDIT-2.1: All applications listed' : '❌ CREDIT-2.1: List applications failed');

  // Test CREDIT-8.1: Get credit ledger
  const ledger = await apiRequest('GET', '/credit/ledger', null, creditToken);
  recordTest('CREDIT-8.1', '/credit/ledger', 'GET', 200, ledger);
  console.log(ledger.status === 200 ? '✅ CREDIT-8.1: Ledger retrieved' : '❌ CREDIT-8.1: Ledger failed');

  // Test CREDIT-7.1: Get payout requests
  const payoutRequests = await apiRequest('GET', '/credit/payout-requests', null, creditToken);
  recordTest('CREDIT-7.1', '/credit/payout-requests', 'GET', 200, payoutRequests);
  console.log(payoutRequests.status === 200 ? '✅ CREDIT-7.1: Payout requests listed' : '❌ CREDIT-7.1: List payout requests failed');
}

/**
 * Phase 5: NBFC Capability Tests
 */
async function testNBFCCapabilities() {
  console.log('\n🏦 Phase 5: NBFC Capability Tests\n');

  if (!nbfcToken) {
    console.log('⚠️  Skipping NBFC tests - no token available');
    return;
  }

  // Test NBFC-1.1: Get NBFC dashboard
  const dashboard = await apiRequest('GET', '/nbfc/dashboard', null, nbfcToken);
  recordTest('NBFC-1.1', '/nbfc/dashboard', 'GET', 200, dashboard);
  console.log(dashboard.status === 200 ? '✅ NBFC-1.1: Dashboard retrieved' : '❌ NBFC-1.1: Dashboard failed');

  // Test NBFC-2.1: List assigned applications
  const listApps = await apiRequest('GET', '/nbfc/loan-applications', null, nbfcToken);
  recordTest('NBFC-2.1', '/nbfc/loan-applications', 'GET', 200, listApps);
  console.log(listApps.status === 200 ? '✅ NBFC-2.1: Applications listed' : '❌ NBFC-2.1: List applications failed');
}

/**
 * Phase 8: RBAC Tests
 */
async function testRBAC() {
  console.log('\n🔒 Phase 8: RBAC Enforcement Tests\n');

  // Test RBAC-1.1: CLIENT cannot access KAM endpoint
  if (clientToken) {
    const wrongAccess = await apiRequest('GET', '/kam/dashboard', null, clientToken);
    recordTest('RBAC-1.1', '/kam/dashboard', 'GET', 403, wrongAccess);
    console.log(wrongAccess.status === 403 ? '✅ RBAC-1.1: Wrong role blocked' : '❌ RBAC-1.1: RBAC violation');
  }

  // Test RBAC-1.2: KAM cannot access CLIENT endpoint
  if (kamToken) {
    const wrongAccess = await apiRequest('GET', '/client/dashboard', null, kamToken);
    recordTest('RBAC-1.2', '/client/dashboard', 'GET', 403, wrongAccess);
    console.log(wrongAccess.status === 403 ? '✅ RBAC-1.2: Wrong role blocked' : '❌ RBAC-1.2: RBAC violation');
  }

  // Test RBAC-1.3: KAM cannot access CREDIT endpoint
  if (kamToken) {
    const wrongAccess = await apiRequest('GET', '/credit/dashboard', null, kamToken);
    recordTest('RBAC-1.3', '/credit/dashboard', 'GET', 403, wrongAccess);
    console.log(wrongAccess.status === 403 ? '✅ RBAC-1.3: Wrong role blocked' : '❌ RBAC-1.3: RBAC violation');
  }

  // Test RBAC-1.4: CLIENT cannot access CREDIT endpoint
  if (clientToken) {
    const wrongAccess = await apiRequest('POST', '/credit/payout-requests/123/approve', null, clientToken);
    recordTest('RBAC-1.4', '/credit/payout-requests/:id/approve', 'POST', 403, wrongAccess);
    console.log(wrongAccess.status === 403 ? '✅ RBAC-1.4: Wrong role blocked' : '❌ RBAC-1.4: RBAC violation');
  }
}

/**
 * Generate Test Report
 */
function generateReport() {
  console.log('\n📊 Test Results Summary\n');
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`Passed: ${testResults.summary.passed}`);
  console.log(`Failed: ${testResults.summary.failed}`);
  console.log(`Pass Rate: ${testResults.summary.passRate}%`);

  console.log('\n❌ Failed Tests:\n');
  testResults.failed.forEach(test => {
    console.log(`- ${test.testCase}: ${test.endpoint} (Expected: ${test.expectedStatus}, Got: ${test.actualStatus})`);
    if (test.error) {
      console.log(`  Error: ${test.error}`);
    }
    if (test.issueType) {
      console.log(`  Issue Type: ${test.issueType}`);
    }
  });

  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Detailed results saved to ${OUTPUT_FILE}`);
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Comprehensive QA Test Suite\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    await testAuthentication();
    await testClientCapabilities();
    await testKAMCapabilities();
    await testCreditCapabilities();
    await testNBFCCapabilities();
    await testRBAC();

    generateReport();
  } catch (error) {
    console.error('❌ Test suite error:', error);
  }
}

// Run tests
runAllTests();
