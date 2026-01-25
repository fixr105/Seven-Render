/**
 * Standalone Login Flow Test Runner
 * 
 * This script tests the complete login flow:
 * - Mocks webhook responses
 * - Verifies webhook is called exactly once
 * - Verifies Client ID extraction and mapping
 * - Verifies JWT token creation and HTTP-only cookie
 * - Verifies response structure and status codes
 * - Verifies timeout handling (under 3 seconds)
 * - Tests error handling (401 for empty/invalid responses)
 * 
 * Usage:
 *   npm run test:login
 *   or
 *   tsx src/controllers/__tests__/login.test.runner.ts
 */

import request from 'supertest';
import app from '../../server.js';
import bcrypt from 'bcryptjs';
import type fetchType from 'node-fetch';

// Track webhook calls
let webhookCallCount = 0;
let webhookCalls: Array<{ url: string; timestamp: number }> = [];
let originalFetch: typeof fetchType;

// Mock node-fetch to intercept webhook calls
function setupMockFetch(mockResponses: Record<string, any>) {
  // Mock node-fetch module
  const nodeFetch = await import('node-fetch');
  originalFetch = nodeFetch.default as typeof fetchType;
  
  // Replace the default export with our mock
  (nodeFetch as any).default = async (url: string | URL | Request, options?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    webhookCallCount++;
    webhookCalls.push({ url: urlStr, timestamp: Date.now() });
    
    console.log(`  [WEBHOOK] Call #${webhookCallCount}: ${urlStr}`);
    
    // Simulate network delay (50ms)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Find matching mock response
    for (const [pattern, response] of Object.entries(mockResponses)) {
      if (urlStr.includes(pattern)) {
        return {
          ok: response.ok !== false,
          status: response.status || 200,
          statusText: response.statusText || 'OK',
          json: async () => response.body,
          text: async () => JSON.stringify(response.body),
          headers: new Headers(),
        } as Response;
      }
    }
    
    // Default: 404
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
      text: async () => '{}',
      headers: new Headers(),
    } as Response;
  } as typeof global.fetch;
}

async function restoreFetch() {
  if (originalFetch) {
    const nodeFetch = await import('node-fetch');
    // Note: In a real scenario, we'd need to properly restore the module
    // For testing purposes, we'll just reset the counters
  }
  // Reset module cache would be needed for full restoration
  // For now, we'll rely on test isolation
}

function resetCounters() {
  webhookCallCount = 0;
  webhookCalls = [];
}

async function testSuccessfulLogin() {
  console.log('\n📋 Test 1: Successful Login with Client ID Extraction\n');
  console.log('  Testing: Webhook call, Client ID extraction, JWT creation, cookie setting\n');
  
  resetCounters();
  
  const testEmail = 'Sagar@gmail.com';
  const testPassword = 'pass@123';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  // Mock webhook response matching the format from user query
  const webhookResponse = [
    {
      id: 'recRUcnoAhb3oiPme',
      createdTime: '2025-01-29T12:00:00.000Z',
      fields: {
        Username: testEmail,
        Password: hashedPassword,
        Role: 'client',
        'Account Status': 'Active',
        'Associated Profile': 'TEST-CLIENT-1767006333410',
      },
    },
  ];

  const clientsResponse = [
    {
      id: 'client-rec-1',
      'Client ID': 'TEST-CLIENT-1767006333410',
      'Client Name': 'Test Client',
      'Contact Email / Phone': testEmail,
      Status: 'Active',
    },
  ];

  setupMockFetch({
    '/useraccount': {
      ok: true,
      status: 200,
      body: webhookResponse,
    },
    '/client': {
      ok: true,
      status: 200,
      body: clientsResponse,
    },
  });

  try {
    const startTime = Date.now();
    
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    const duration = Date.now() - startTime;

    // Verify webhook called exactly once
    const userAccountCalls = webhookCalls.filter(call => call.url.includes('/useraccount'));
    if (userAccountCalls.length === 1) {
      console.log('  ✅ Webhook called exactly once');
    } else {
      throw new Error(`Expected 1 webhook call, got ${userAccountCalls.length}`);
    }

    // Verify response status
    if (response.status === 200) {
      console.log('  ✅ Response status: 200 OK');
    } else {
      throw new Error(`Expected status 200, got ${response.status}. Response: ${JSON.stringify(response.body)}`);
    }

    // Verify user data and Client ID extraction
    const user = response.body.data?.user;
    if (!user) {
      throw new Error('User data not found in response');
    }
    
    if (user.clientId === 'TEST-CLIENT-1767006333410') {
      console.log('  ✅ Client ID extracted correctly:', user.clientId);
    } else {
      throw new Error(`Expected Client ID 'TEST-CLIENT-1767006333410', got '${user.clientId}'`);
    }

    if (user.id === 'recRUcnoAhb3oiPme') {
      console.log('  ✅ User ID mapped correctly:', user.id);
    } else {
      throw new Error(`Expected User ID 'recRUcnoAhb3oiPme', got '${user.id}'`);
    }

    if (user.email === testEmail) {
      console.log('  ✅ User email mapped correctly:', user.email);
    } else {
      throw new Error(`Expected email '${testEmail}', got '${user.email}'`);
    }

    if (user.role === 'client') {
      console.log('  ✅ User role mapped correctly:', user.role);
    } else {
      throw new Error(`Expected role 'client', got '${user.role}'`);
    }

    // Verify JWT token
    const token = response.body.data?.token;
    if (token && typeof token === 'string' && token.length > 0) {
      console.log('  ✅ JWT token created');
      console.log(`  Token preview: ${token.substring(0, 20)}...${token.substring(token.length - 10)}`);
    } else {
      throw new Error('JWT token not created or invalid');
    }

    // Verify HTTP-only cookie
    const cookies = response.headers['set-cookie'];
    if (!cookies || !Array.isArray(cookies)) {
      throw new Error('No cookies set in response');
    }
    
    const authCookie = cookies.find((c: string) => c.startsWith('auth_token='));
    if (!authCookie) {
      throw new Error('auth_token cookie not found');
    }
    
    if (authCookie.includes('HttpOnly')) {
      console.log('  ✅ HTTP-only cookie set');
      console.log(`  Cookie preview: ${authCookie.substring(0, 60)}...`);
    } else {
      throw new Error('Cookie is not HTTP-only');
    }

    if (authCookie.includes('Path=/')) {
      console.log('  ✅ Cookie path set to /');
    }

    // Verify timeout (under 3 seconds)
    if (duration < 3000) {
      console.log(`  ✅ Request completed in ${duration}ms (under 3 second limit)`);
    } else {
      throw new Error(`Request took ${duration}ms (exceeded 3 second limit)`);
    }

    // Verify response structure
    if (response.body.success === true && response.body.data) {
      console.log('  ✅ Response structure valid');
    } else {
      throw new Error('Invalid response structure');
    }

    console.log('\n✅ Test 1 PASSED\n');
    restoreFetch();
    return true;

  } catch (error: any) {
    console.error('\n❌ Test 1 FAILED');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    restoreFetch();
    return false;
  }
}

async function testEmptyWebhookResponse() {
  console.log('📋 Test 2: Error Handling - Empty Webhook Response\n');
  console.log('  Testing: Empty webhook response should return 401\n');
  
  resetCounters();
  
  setupMockFetch({
    '/useraccount': {
      ok: true,
      status: 200,
      body: [], // Empty array
    },
  });

  try {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'Test@123',
      });

    if (response.status === 401) {
      console.log('  ✅ Empty webhook response handled gracefully with 401');
    } else {
      throw new Error(`Expected status 401, got ${response.status}. Response: ${JSON.stringify(response.body)}`);
    }

    if (response.body.error && response.body.error.includes('Invalid email or password')) {
      console.log('  ✅ Error message is user-friendly');
    } else {
      throw new Error(`Expected error message about invalid credentials, got: ${response.body.error}`);
    }

    console.log('\n✅ Test 2 PASSED\n');
    restoreFetch();
    return true;

  } catch (error: any) {
    console.error('\n❌ Test 2 FAILED');
    console.error('Error:', error.message);
    restoreFetch();
    return false;
  }
}

async function testIncorrectPassword() {
  console.log('📋 Test 3: Error Handling - Incorrect Password\n');
  console.log('  Testing: Wrong password should return 401\n');
  
  resetCounters();
  
  const testEmail = 'Sagar@gmail.com';
  const correctPassword = 'pass@123';
  const wrongPassword = 'WrongPassword';
  const hashedPassword = await bcrypt.hash(correctPassword, 10);

  const webhookResponse = [
    {
      id: 'recRUcnoAhb3oiPme',
      createdTime: '2025-01-29T12:00:00.000Z',
      fields: {
        Username: testEmail,
        Password: hashedPassword,
        Role: 'client',
        'Account Status': 'Active',
      },
    },
  ];

  setupMockFetch({
    '/useraccount': {
      ok: true,
      status: 200,
      body: webhookResponse,
    },
  });

  try {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: testEmail,
        password: wrongPassword,
      });

    if (response.status === 401) {
      console.log('  ✅ Incorrect password handled gracefully with 401');
    } else {
      throw new Error(`Expected status 401, got ${response.status}`);
    }

    console.log('\n✅ Test 3 PASSED\n');
    restoreFetch();
    return true;

  } catch (error: any) {
    console.error('\n❌ Test 3 FAILED');
    console.error('Error:', error.message);
    restoreFetch();
    return false;
  }
}

async function testTimeout() {
  console.log('📋 Test 4: Timeout Handling\n');
  console.log('  Testing: Request completes within 3 seconds\n');
  
  resetCounters();
  
  const testEmail = 'Sagar@gmail.com';
  const testPassword = 'pass@123';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  const webhookResponse = [
    {
      id: 'recRUcnoAhb3oiPme',
      createdTime: '2025-01-29T12:00:00.000Z',
      fields: {
        Username: testEmail,
        Password: hashedPassword,
        Role: 'client',
        'Account Status': 'Active',
      },
    },
  ];

  const clientsResponse = [
    {
      id: 'client-rec-1',
      'Client ID': 'TEST-CLIENT-1767006333410',
      'Client Name': 'Test Client',
      'Contact Email / Phone': testEmail,
      Status: 'Active',
    },
  ];

  // Mock fetch with realistic delay (100ms)
  setupMockFetch({
    '/useraccount': {
      ok: true,
      status: 200,
      body: webhookResponse,
    },
    '/client': {
      ok: true,
      status: 200,
      body: clientsResponse,
    },
  });

  try {
    const startTime = Date.now();
    
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    const duration = Date.now() - startTime;

    if (response.status === 200 && duration < 3000) {
      console.log(`  ✅ Request completed in ${duration}ms (under 3 second limit)`);
      console.log('\n✅ Test 4 PASSED\n');
      restoreFetch();
      return true;
    } else {
      throw new Error(`Request took ${duration}ms or returned status ${response.status}`);
    }

  } catch (error: any) {
    console.error('\n❌ Test 4 FAILED');
    console.error('Error:', error.message);
    restoreFetch();
    return false;
  }
}

async function runAllTests() {
  console.log('\n🚀 ========== LOGIN FLOW TEST RUNNER ==========\n');
  console.log('This test suite verifies:');
  console.log('  ✓ Webhook is called exactly once');
  console.log('  ✓ Client ID is extracted and mapped correctly');
  console.log('  ✓ JWT token is created and set in HTTP-only cookie');
  console.log('  ✓ Response is 200 with valid user info');
  console.log('  ✓ Requests complete within 3 seconds');
  console.log('  ✓ Errors are handled gracefully with 401\n');

  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
  };

  try {
    results.test1 = await testSuccessfulLogin();
    results.test2 = await testEmptyWebhookResponse();
    results.test3 = await testIncorrectPassword();
    results.test4 = await testTimeout();

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    console.log('\n📊 ========== TEST SUMMARY ==========\n');
    console.log(`Passed: ${passed}/${total}`);
    console.log(`Failed: ${total - passed}/${total}\n`);

    if (passed === total) {
      console.log('🎉 ========== ALL TESTS PASSED ==========\n');
      process.exit(0);
    } else {
      console.log('❌ ========== SOME TESTS FAILED ==========\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n💥 Fatal error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { runAllTests, testSuccessfulLogin, testEmptyWebhookResponse, testIncorrectPassword, testTimeout };

