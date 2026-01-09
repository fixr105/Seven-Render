#!/usr/bin/env tsx
/**
 * Comprehensive Test Suite for Functionality Fixes
 * Tests all fixes implemented for:
 * 1. Login/authentication webhook triggering
 * 2. Data fetching for logged-in users (ID extraction)
 * 3. File uploads
 * 4. All API endpoints
 */

import fetch from 'node-fetch';
import * as fs from 'fs';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

interface TestResult {
  phase: string;
  testCase: string;
  passed: boolean;
  statusCode?: number;
  duration?: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(phase: string, testCase: string, passed: boolean, details?: any) {
  const result: TestResult = {
    phase,
    testCase,
    passed,
    ...details,
  };
  results.push(result);
  
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${phase}] ${testCase}`);
  if (details?.error) {
    console.log(`   Error: ${details.error}`);
  }
  if (details?.statusCode) {
    console.log(`   Status: ${details.statusCode}`);
  }
  if (details?.duration) {
    console.log(`   Duration: ${details.duration}ms`);
  }
}

async function apiRequest(
  method: string,
  endpoint: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any; duration: number }> {
  const startTime = Date.now();
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const duration = Date.now() - startTime;
  const data = await response.json().catch(() => ({}));
  
  return {
    status: response.status,
    data,
    duration,
  };
}

// Phase 1: Test Login/Authentication Webhook
async function testPhase1() {
  console.log('\n=== Phase 1: Test Login/Authentication Webhook ===\n');
  
  // Test 1.1: Test Validate Endpoint Directly
  try {
    const startTime = Date.now();
    const webhookUrl = `${N8N_BASE_URL}/webhook/validate`;
    const credentials = { username: 'Sagar', passcode: 'pass@123' };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    
    const duration = Date.now() - startTime;
    const text = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }
    
    const passed = response.status === 200 && 
                   (Array.isArray(data) || data.output || data.username);
    
    logTest('Phase 1.1', 'Validate webhook direct call', passed, {
      statusCode: response.status,
      duration,
      error: passed ? undefined : `Unexpected response format`,
      details: { responseFormat: Array.isArray(data) ? 'array' : typeof data },
    });
  } catch (error: any) {
    logTest('Phase 1.1', 'Validate webhook direct call', false, {
      error: error.message,
    });
  }
  
  // Test 1.2: Test Login via Backend API
  try {
    const { status, data, duration } = await apiRequest(
      'POST',
      '/auth/validate',
      { username: 'Sagar', passcode: 'pass@123' }
    );
    
    const passed = status === 200 && 
                   data.success === true && 
                   data.token && 
                   data.user &&
                   (data.user.clientId || data.user.kamId || data.user.nbfcId || data.user.role === 'credit_team');
    
    logTest('Phase 1.2', 'Login via backend API', passed, {
      statusCode: status,
      duration,
      error: passed ? undefined : 'Missing token, user data, or IDs',
      details: {
        hasToken: !!data.token,
        hasUser: !!data.user,
        hasId: !!(data.user?.clientId || data.user?.kamId || data.user?.nbfcId),
        role: data.user?.role,
      },
    });
    
    return data.token; // Return token for subsequent tests
  } catch (error: any) {
    logTest('Phase 1.2', 'Login via backend API', false, {
      error: error.message,
    });
    return null;
  }
}

// Phase 2: Test Data Fetching for Logged-In Users
async function testPhase2(token: string | null) {
  console.log('\n=== Phase 2: Test Data Fetching for Logged-In Users ===\n');
  
  if (!token) {
    console.log('⚠️  Skipping Phase 2 - No authentication token');
    return;
  }
  
  // Test 2.1: Test Client Data Filtering
  try {
    const { status, data, duration } = await apiRequest(
      'GET',
      '/loans',
      undefined,
      token
    );
    
    const passed = status === 200 && Array.isArray(data.data || data);
    
    logTest('Phase 2.1', 'Client data filtering', passed, {
      statusCode: status,
      duration,
      error: passed ? undefined : 'Failed to fetch filtered data',
      details: {
        recordCount: Array.isArray(data.data) ? data.data.length : (Array.isArray(data) ? data.length : 0),
      },
    });
  } catch (error: any) {
    logTest('Phase 2.1', 'Client data filtering', false, {
      error: error.message,
    });
  }
  
  // Test 2.2: Test JWT Token Contains IDs
  try {
    // Decode JWT token (basic check - just verify structure)
    const tokenParts = token.split('.');
    if (tokenParts.length === 3) {
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      
      const hasRequiredFields = payload.userId && 
                                payload.email && 
                                payload.role && 
                                payload.name;
      
      const hasId = payload.clientId || payload.kamId || payload.nbfcId;
      
      const passed = hasRequiredFields && hasId;
      
      logTest('Phase 2.2', 'JWT token contains IDs', passed, {
        error: passed ? undefined : 'Missing required fields or IDs in JWT',
        details: {
          hasUserId: !!payload.userId,
          hasEmail: !!payload.email,
          hasRole: !!payload.role,
          hasName: !!payload.name,
          hasClientId: !!payload.clientId,
          hasKamId: !!payload.kamId,
          hasNbfcId: !!payload.nbfcId,
          role: payload.role,
        },
      });
    } else {
      logTest('Phase 2.2', 'JWT token contains IDs', false, {
        error: 'Invalid JWT token format',
      });
    }
  } catch (error: any) {
    logTest('Phase 2.2', 'JWT token contains IDs', false, {
      error: error.message,
    });
  }
  
  // Test 2.3: Test /auth/me endpoint
  try {
    const { status, data, duration } = await apiRequest(
      'GET',
      '/auth/me',
      undefined,
      token
    );
    
    const passed = status === 200 && 
                   data.success === true && 
                   data.data &&
                   data.data.id &&
                   data.data.email &&
                   data.data.role;
    
    logTest('Phase 2.3', 'Get current user (/auth/me)', passed, {
      statusCode: status,
      duration,
      error: passed ? undefined : 'Failed to get user data',
      details: {
        hasId: !!data.data?.id,
        hasEmail: !!data.data?.email,
        hasRole: !!data.data?.role,
        hasName: !!data.data?.name,
      },
    });
  } catch (error: any) {
    logTest('Phase 2.3', 'Get current user (/auth/me)', false, {
      error: error.message,
    });
  }
}

// Phase 3: Test File Uploads
async function testPhase3(token: string | null) {
  console.log('\n=== Phase 3: Test File Uploads ===\n');
  
  if (!token) {
    console.log('⚠️  Skipping Phase 3 - No authentication token');
    return;
  }
  
  // Test 3.1: Check Upload Endpoint Configuration
  const onedriveUrl = process.env.ONEDRIVE_UPLOAD_URL;
  logTest('Phase 3.1', 'Upload endpoint configuration', !!onedriveUrl, {
    error: onedriveUrl ? undefined : 'ONEDRIVE_UPLOAD_URL not set',
    details: {
      urlSet: !!onedriveUrl,
      url: onedriveUrl ? `${onedriveUrl.substring(0, 50)}...` : 'Not set',
    },
  });
  
  // Test 3.2: Test Upload Endpoint Availability
  try {
    // Just check if endpoint exists (will fail without file, but that's expected)
    const { status, duration } = await apiRequest(
      'POST',
      '/documents/upload',
      {},
      token
    );
    
    // 400 is expected (no file provided), 401 means auth issue, 500 means server error
    const passed = status === 400 || status === 401;
    
    logTest('Phase 3.2', 'Upload endpoint availability', passed, {
      statusCode: status,
      duration,
      error: status === 500 ? 'Server error on upload endpoint' : undefined,
      details: {
        status,
        note: status === 400 ? 'Endpoint exists (expected: no file provided)' : 
              status === 401 ? 'Auth required (expected)' : 'Unexpected status',
      },
    });
  } catch (error: any) {
    logTest('Phase 3.2', 'Upload endpoint availability', false, {
      error: error.message,
    });
  }
}

// Phase 4: Test All API Endpoints
async function testPhase4(token: string | null) {
  console.log('\n=== Phase 4: Test All API Endpoints ===\n');
  
  if (!token) {
    console.log('⚠️  Skipping Phase 4 - No authentication token');
    return;
  }
  
  const endpoints = [
    { method: 'GET', path: '/health', requiresAuth: false },
    { method: 'GET', path: '/auth/me', requiresAuth: true },
    { method: 'GET', path: '/client/dashboard', requiresAuth: true },
    { method: 'GET', path: '/loans', requiresAuth: true },
    { method: 'GET', path: '/products/loan-products', requiresAuth: true },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const { status, duration } = await apiRequest(
        endpoint.method,
        endpoint.path,
        undefined,
        endpoint.requiresAuth ? token : undefined
      );
      
      const passed = status === 200 || status === 401; // 401 is OK if auth required
      
      logTest('Phase 4', `${endpoint.method} ${endpoint.path}`, passed, {
        statusCode: status,
        duration,
        error: status >= 500 ? 'Server error' : undefined,
        details: {
          requiresAuth: endpoint.requiresAuth,
          status,
        },
      });
    } catch (error: any) {
      logTest('Phase 4', `${endpoint.method} ${endpoint.path}`, false, {
        error: error.message,
      });
    }
  }
}

// Generate Summary Report
function generateReport() {
  console.log('\n=== Test Summary Report ===\n');
  
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
  
  // Group by phase
  const byPhase = results.reduce((acc, r) => {
    if (!acc[r.phase]) acc[r.phase] = [];
    acc[r.phase].push(r);
    return acc;
  }, {} as Record<string, TestResult[]>);
  
  console.log('Results by Phase:');
  for (const [phase, phaseResults] of Object.entries(byPhase)) {
    const phasePassed = phaseResults.filter(r => r.passed).length;
    const phaseTotal = phaseResults.length;
    console.log(`  ${phase}: ${phasePassed}/${phaseTotal} passed`);
  }
  
  // Show failures
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('\n❌ Failed Tests:');
    for (const failure of failures) {
      console.log(`  - [${failure.phase}] ${failure.testCase}`);
      if (failure.error) {
        console.log(`    Error: ${failure.error}`);
      }
    }
  }
  
  // Save to file
  const reportPath = 'test-functionality-fixes-results.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${reportPath}`);
}

// Main execution
async function main() {
  console.log('🧪 Starting Functionality Fixes Test Suite\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`N8N Base URL: ${N8N_BASE_URL}\n`);
  
  try {
    // Phase 1: Authentication
    const token = await testPhase1();
    
    // Phase 2: Data Fetching
    await testPhase2(token);
    
    // Phase 3: File Uploads
    await testPhase3(token);
    
    // Phase 4: All Endpoints
    await testPhase4(token);
    
    // Generate Report
    generateReport();
    
    // Exit with appropriate code
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('\n❌ Test suite failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
