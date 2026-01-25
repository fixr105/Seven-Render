/**
 * Standalone Login Test Runner
 * 
 * This script can be run independently to test the login flow:
 * 
 * Usage:
 *   npm run test:login
 *   or
 *   tsx src/controllers/__tests__/auth.controller.test.runner.ts
 * 
 * This test:
 * - Mocks the webhook response
 * - Tests the complete login flow
 * - Verifies webhook calls, JWT creation, cookie setting
 * - Tests error handling and timeouts
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import bcrypt from 'bcryptjs';

// Mock fetch globally
const originalFetch = global.fetch;
let fetchCallCount = 0;
let webhookCalls: Array<{ url: string; timestamp: number }> = [];

// Mock n8nEndpoints
jest.mock('../../services/airtable/n8nEndpoints.js', () => ({
  n8nEndpoints: {
    get: {
      userAccount: 'https://test-webhook.example.com/webhook/useraccount',
    },
  },
}));

async function runLoginTests() {
  console.log('\n🚀 ========== LOGIN FLOW TEST RUNNER ==========\n');

  beforeEach(() => {
    fetchCallCount = 0;
    webhookCalls = [];
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // Test 1: Successful Login with Client ID
  console.log('📋 Test 1: Successful Login with Client ID Extraction\n');
  
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

  // Mock fetch
  global.fetch = jest.fn(async (url: string | URL | Request) => {
    fetchCallCount++;
    const urlStr = typeof url === 'string' ? url : url.toString();
    webhookCalls.push({ url: urlStr, timestamp: Date.now() });
    
    console.log(`  [WEBHOOK] Call #${fetchCallCount}: ${urlStr}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (urlStr.includes('/useraccount')) {
      return {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(webhookResponse),
        text: jest.fn().mockResolvedValue(JSON.stringify(webhookResponse)),
        headers: new Headers(),
      } as Response;
    }
    
    if (urlStr.includes('/client')) {
      return {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(clientsResponse),
        text: jest.fn().mockResolvedValue(JSON.stringify(clientsResponse)),
        headers: new Headers(),
      } as Response;
    }
    
    return {
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({}),
      headers: new Headers(),
    } as Response;
  }) as jest.Mock;

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
      console.error(`  ❌ Expected 1 webhook call, got ${userAccountCalls.length}`);
      process.exit(1);
    }

    // Verify response status
    if (response.status === 200) {
      console.log('  ✅ Response status: 200 OK');
    } else {
      console.error(`  ❌ Expected status 200, got ${response.status}`);
      console.error('  Response:', response.body);
      process.exit(1);
    }

    // Verify user data
    const user = response.body.data?.user;
    if (user && user.clientId === 'TEST-CLIENT-1767006333410') {
      console.log('  ✅ Client ID extracted correctly:', user.clientId);
    } else {
      console.error('  ❌ Client ID not extracted correctly');
      console.error('  User data:', user);
      process.exit(1);
    }

    // Verify JWT token
    const token = response.body.data?.token;
    if (token && typeof token === 'string' && token.length > 0) {
      console.log('  ✅ JWT token created');
      console.log(`  Token preview: ${token.substring(0, 20)}...`);
    } else {
      console.error('  ❌ JWT token not created');
      process.exit(1);
    }

    // Verify HTTP-only cookie
    const cookies = response.headers['set-cookie'];
    const authCookie = Array.isArray(cookies) 
      ? cookies.find((c: string) => c.startsWith('auth_token='))
      : null;
    
    if (authCookie && authCookie.includes('HttpOnly')) {
      console.log('  ✅ HTTP-only cookie set');
      console.log(`  Cookie preview: ${authCookie.substring(0, 50)}...`);
    } else {
      console.error('  ❌ HTTP-only cookie not set');
      process.exit(1);
    }

    // Verify timeout
    if (duration < 3000) {
      console.log(`  ✅ Request completed in ${duration}ms (under 3 second limit)`);
    } else {
      console.error(`  ❌ Request took ${duration}ms (exceeded 3 second limit)`);
      process.exit(1);
    }

    console.log('\n✅ Test 1 PASSED\n');

  } catch (error: any) {
    console.error('\n❌ Test 1 FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  // Test 2: Error Handling - Empty Webhook Response
  console.log('📋 Test 2: Error Handling - Empty Webhook Response\n');
  
  global.fetch = jest.fn(async (url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    
    if (urlStr.includes('/useraccount')) {
      return {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue([]), // Empty array
        headers: new Headers(),
      } as Response;
    }
    
    return {
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({}),
      headers: new Headers(),
    } as Response;
  }) as jest.Mock;

  try {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'Test@123',
      });

    if (response.status === 401 && response.body.error?.includes('Invalid email or password')) {
      console.log('  ✅ Empty webhook response handled gracefully with 401');
      console.log('\n✅ Test 2 PASSED\n');
    } else {
      console.error(`  ❌ Expected 401 with error message, got status ${response.status}`);
      console.error('  Response:', response.body);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Test 2 FAILED');
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('🎉 ========== ALL TESTS PASSED ==========\n');
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLoginTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runLoginTests };

