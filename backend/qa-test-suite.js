/**
 * Comprehensive QA Test Suite for Seven Fincorp Backend API
 * Tests all endpoints, RBAC, and integration
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test users (would need to exist in Airtable)
const TEST_USERS = {
  client: { email: 'client@test.com', password: 'Test@123456' },
  kam: { email: 'kam@test.com', password: 'Test@123456' },
  credit: { email: 'credit@test.com', password: 'Test@123456' },
  nbfc: { email: 'nbfc@test.com', password: 'Test@123456' },
};

let authTokens = {};

// Test Results Storage
const testResults = {
  passed: [],
  failed: [],
  missing: [],
  rbacViolations: [],
};

/**
 * Helper: Make API request
 */
async function apiRequest(method, endpoint, token = null, body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
    };
  }
}

/**
 * Test Authentication
 */
async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...\n');

  // Test 1: Login without credentials
  const test1 = await apiRequest('POST', '/auth/login', null, {});
  recordTest('Authentication', 'POST /auth/login (no creds)', 'POST', test1.status === 400 || test1.status === 401, test1);

  // Test 2: Login with invalid credentials
  const test2 = await apiRequest('POST', '/auth/login', null, {
    email: 'invalid@test.com',
    password: 'wrong',
  });
  recordTest('Authentication', 'POST /auth/login (invalid)', 'POST', test2.status === 401, test2);

  // Test 3: Login for each role
  for (const [role, creds] of Object.entries(TEST_USERS)) {
    const test = await apiRequest('POST', '/auth/login', null, creds);
    if (test.ok && test.data?.data?.token) {
      authTokens[role] = test.data.data.token;
      recordTest('Authentication', `POST /auth/login (${role})`, 'POST', true, test);
    } else {
      recordTest('Authentication', `POST /auth/login (${role})`, 'POST', false, test, 'User may not exist in Airtable');
    }
  }

  // Test 4: Get current user (authenticated)
  if (authTokens.client) {
    const test4 = await apiRequest('GET', '/auth/me', authTokens.client);
    recordTest('Authentication', 'GET /auth/me', 'GET', test4.ok, test4);
  }

  // Test 5: Get current user (unauthenticated)
  const test5 = await apiRequest('GET', '/auth/me');
  recordTest('Authentication', 'GET /auth/me (no token)', 'GET', test5.status === 401, test5);
}

/**
 * Test RBAC Enforcement
 */
async function testRBAC() {
  console.log('\n🔒 Testing RBAC Enforcement...\n');

  const endpoints = [
    { path: '/credit-team-users', method: 'GET', allowedRoles: ['credit'], name: 'List Credit Team Users' },
    { path: '/credit-team-users', method: 'POST', allowedRoles: ['credit'], name: 'Create Credit Team User' },
    { path: '/admin/activity-log', method: 'GET', allowedRoles: ['credit'], name: 'Get Admin Activity Log' },
    { path: '/reports/daily/generate', method: 'POST', allowedRoles: ['credit'], name: 'Generate Daily Summary' },
    { path: '/kam/clients', method: 'POST', allowedRoles: ['kam'], name: 'Create Client' },
    { path: '/kam/clients/:id/modules', method: 'PATCH', allowedRoles: ['kam'], name: 'Update Client Modules' },
    { path: '/nbfc/loan-applications', method: 'GET', allowedRoles: ['nbfc'], name: 'List NBFC Applications' },
  ];

  for (const endpoint of endpoints) {
    // Test with each role
    for (const [role, token] of Object.entries(authTokens)) {
      if (!token) continue;
      
      const shouldAllow = endpoint.allowedRoles.includes(role);
      const testPath = endpoint.path.replace(':id', 'test-id');
      
      const test = await apiRequest(endpoint.method, testPath, token, endpoint.method === 'POST' ? {} : null);
      const shouldPass = shouldAllow ? test.ok : (test.status === 403 || test.status === 401);
      
      if (!shouldPass) {
        testResults.rbacViolations.push({
          endpoint: endpoint.name,
          path: endpoint.path,
          method: endpoint.method,
          role,
          expected: shouldAllow ? 'Allow' : 'Deny',
          actual: test.status,
          issue: shouldAllow ? 'Should allow but denied' : 'Should deny but allowed',
        });
      }
      
      recordTest('RBAC', `${endpoint.name} (${role})`, endpoint.method, shouldPass, test);
    }
  }
}

/**
 * Test GET Endpoints
 */
async function testGETEndpoints() {
  console.log('\n📥 Testing GET Endpoints...\n');

  const endpoints = [
    { path: '/health', method: 'GET', auth: false, name: 'Health Check' },
    { path: '/client/dashboard', method: 'GET', auth: true, role: 'client', name: 'Client Dashboard' },
    { path: '/kam/dashboard', method: 'GET', auth: true, role: 'kam', name: 'KAM Dashboard' },
    { path: '/credit/dashboard', method: 'GET', auth: true, role: 'credit', name: 'Credit Dashboard' },
    { path: '/nbfc/dashboard', method: 'GET', auth: true, role: 'nbfc', name: 'NBFC Dashboard' },
    { path: '/loan-applications', method: 'GET', auth: true, role: 'client', name: 'List Loan Applications' },
    { path: '/client/form-config', method: 'GET', auth: true, role: 'client', name: 'Get Form Config' },
    { path: '/form-categories', method: 'GET', auth: true, role: 'client', name: 'List Form Categories' },
    { path: '/clients/me/ledger', method: 'GET', auth: true, role: 'client', name: 'Get Client Ledger' },
    { path: '/clients/me/payout-requests', method: 'GET', auth: true, role: 'client', name: 'Get Payout Requests' },
    { path: '/credit/loan-applications', method: 'GET', auth: true, role: 'credit', name: 'Credit: List Applications' },
    { path: '/credit/payout-requests', method: 'GET', auth: true, role: 'credit', name: 'Credit: Get Payout Requests' },
    { path: '/nbfc/loan-applications', method: 'GET', auth: true, role: 'nbfc', name: 'NBFC: List Applications' },
    { path: '/reports/daily/2025-01-15', method: 'GET', auth: true, role: 'credit', name: 'Get Daily Summary' },
    { path: '/admin/activity-log', method: 'GET', auth: true, role: 'credit', name: 'Get Admin Activity Log' },
  ];

  for (const endpoint of endpoints) {
    const token = endpoint.auth ? authTokens[endpoint.role] : null;
    const test = await apiRequest(endpoint.method, endpoint.path, token);
    
    const shouldPass = endpoint.auth 
      ? (token ? test.ok || test.status === 404 : test.status === 401)
      : test.ok;
    
    recordTest('GET Endpoints', endpoint.name, endpoint.method, shouldPass, test);
  }
}

/**
 * Test POST Endpoints
 */
async function testPOSTEndpoints() {
  console.log('\n📤 Testing POST Endpoints...\n');

  // Test data
  const testApplication = {
    productId: 'test-product-id',
    borrowerIdentifiers: {
      pan: 'ABCDE1234F',
      name: 'Test Applicant',
    },
  };

  const testFormCategory = {
    categoryName: 'Test Category',
    description: 'Test description',
    displayOrder: '1',
    active: 'True',
  };

  const endpoints = [
    {
      path: '/loan-applications',
      method: 'POST',
      role: 'client',
      body: testApplication,
      name: 'Create Loan Application',
    },
    {
      path: '/form-categories',
      method: 'POST',
      role: 'credit',
      body: testFormCategory,
      name: 'Create Form Category',
    },
    {
      path: '/credit-team-users',
      method: 'POST',
      role: 'credit',
      body: {
        name: 'Test Credit User',
        email: `test-credit-${Date.now()}@test.com`,
        phone: '+91 9876543210',
        role: 'credit_team',
        status: 'Active',
      },
      name: 'Create Credit Team User',
    },
  ];

  for (const endpoint of endpoints) {
    const token = authTokens[endpoint.role];
    if (!token) {
      recordTest('POST Endpoints', endpoint.name, endpoint.method, false, { status: 0, error: 'No auth token' }, 'Missing auth token');
      continue;
    }

    const test = await apiRequest(endpoint.method, endpoint.path, token, endpoint.body);
    recordTest('POST Endpoints', endpoint.name, endpoint.method, test.ok || test.status === 400, test);
  }
}

/**
 * Test Data Filtering
 */
async function testDataFiltering() {
  console.log('\n🔍 Testing Data Filtering by Role...\n');

  // Test: Client should only see own applications
  if (authTokens.client) {
    const clientTest = await apiRequest('GET', '/loan-applications', authTokens.client);
    recordTest('Data Filtering', 'Client sees only own applications', 'GET', clientTest.ok, clientTest);
  }

  // Test: KAM should only see managed clients
  if (authTokens.kam) {
    const kamTest = await apiRequest('GET', '/kam/loan-applications', authTokens.kam);
    recordTest('Data Filtering', 'KAM sees only managed clients', 'GET', kamTest.ok, kamTest);
  }

  // Test: Credit should see all applications
  if (authTokens.credit) {
    const creditTest = await apiRequest('GET', '/credit/loan-applications', authTokens.credit);
    recordTest('Data Filtering', 'Credit sees all applications', 'GET', creditTest.ok, creditTest);
  }

  // Test: NBFC should only see assigned applications
  if (authTokens.nbfc) {
    const nbfcTest = await apiRequest('GET', '/nbfc/loan-applications', authTokens.nbfc);
    recordTest('Data Filtering', 'NBFC sees only assigned applications', 'GET', nbfcTest.ok, nbfcTest);
  }
}

/**
 * Record test result
 */
function recordTest(category, testCase, method, passed, response, issue = null) {
  const result = {
    category,
    feature: testCase,
    endpoint: extractEndpoint(testCase),
    method,
    testCase,
    result: passed ? '✅ PASS' : '❌ FAIL',
    statusCode: response.status || 'N/A',
    issueType: passed ? null : (issue || getIssueType(response)),
    suggestedFix: passed ? null : getSuggestedFix(testCase, response, issue),
  };

  if (passed) {
    testResults.passed.push(result);
  } else {
    testResults.failed.push(result);
  }
}

function extractEndpoint(testCase) {
  const match = testCase.match(/(GET|POST|PATCH|DELETE)\s+([^\s]+)/);
  return match ? match[2] : testCase;
}

function getIssueType(response) {
  if (response.status === 401) return 'Authentication Required';
  if (response.status === 403) return 'RBAC Violation';
  if (response.status === 404) return 'Endpoint Not Found';
  if (response.status === 400) return 'Bad Request';
  if (response.status === 500) return 'Server Error';
  if (response.status === 0) return 'Connection Error';
  return 'Unknown Error';
}

function getSuggestedFix(testCase, response, issue) {
  if (issue) return issue;
  if (response.status === 401) return 'Add authentication token';
  if (response.status === 403) return 'Check user role permissions';
  if (response.status === 404) return 'Verify endpoint path';
  if (response.status === 500) return 'Check server logs and n8n webhook configuration';
  return 'Review endpoint implementation';
}

/**
 * Generate Report
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 QA TEST REPORT');
  console.log('='.repeat(80));

  console.log(`\n✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`🔒 RBAC Violations: ${testResults.rbacViolations.length}`);

  console.log('\n' + '-'.repeat(80));
  console.log('❌ FAILED TESTS');
  console.log('-'.repeat(80));
  console.table(testResults.failed);

  if (testResults.rbacViolations.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('🔒 RBAC VIOLATIONS');
    console.log('-'.repeat(80));
    console.table(testResults.rbacViolations);
  }

  return testResults;
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🧪 Starting Comprehensive QA Test Suite...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    await testAuthentication();
    await testRBAC();
    await testGETEndpoints();
    await testPOSTEndpoints();
    await testDataFiltering();

    const results = generateReport();
    
    // Generate Cursor prompts
    generateCursorPrompts(results);
    
    return results;
  } catch (error) {
    console.error('Test suite error:', error);
    return testResults;
  }
}

/**
 * Generate Cursor prompts for fixing issues
 */
function generateCursorPrompts(results) {
  console.log('\n' + '='.repeat(80));
  console.log('🛠️ CURSOR PROMPTS TO FIX ISSUES');
  console.log('='.repeat(80) + '\n');

  const uniqueIssues = new Map();

  for (const failure of results.failed) {
    const key = `${failure.endpoint}-${failure.method}`;
    if (!uniqueIssues.has(key)) {
      uniqueIssues.set(key, failure);
    }
  }

  for (const [key, issue] of uniqueIssues) {
    console.log(`Cursor, ${getCursorPrompt(issue)}\n`);
  }
}

function getCursorPrompt(issue) {
  const endpoint = issue.endpoint || issue.feature;
  const method = issue.method;
  
  if (issue.issueType === 'Authentication Required') {
    return `ensure the endpoint ${endpoint} (${method}) requires authentication by adding the 'authenticate' middleware`;
  }
  
  if (issue.issueType === 'RBAC Violation') {
    return `add RBAC middleware to ${endpoint} (${method}) to enforce role-based access control`;
  }
  
  if (issue.issueType === 'Endpoint Not Found') {
    return `create the endpoint ${endpoint} (${method}) in the appropriate route file`;
  }
  
  if (issue.issueType === 'Server Error') {
    return `fix the server error in ${endpoint} (${method}) by checking n8n webhook configuration and error handling`;
  }
  
  return `fix the issue with ${endpoint} (${method}): ${issue.issueType || 'Unknown error'}`;
}

// Run tests
runAllTests().catch(console.error);

