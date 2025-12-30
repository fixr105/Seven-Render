/**
 * Comprehensive Login Flow Test
 * 
 * Tests the complete login process:
 * - Webhook call and response handling
 * - Client ID extraction and mapping
 * - JWT token creation and cookie setting
 * - Response validation
 * - Timeout handling
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import * as n8nEndpointsModule from '../../services/airtable/n8nEndpoints.js';
import bcrypt from 'bcryptjs';

// Mock node-fetch (used by auth service)
let fetchCallCount = 0;
let fetchCallUrl: string | null = null;
let mockFetchResponse: any = null;

// Mock node-fetch module
jest.mock('node-fetch', () => {
  return jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
    fetchCallCount++;
    fetchCallUrl = typeof url === 'string' ? url : url.toString();
    
    console.log(`[TEST] Fetch called #${fetchCallCount}: ${fetchCallUrl}`);
    
    // Simulate network delay (50ms)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (mockFetchResponse === null) {
      throw new Error('Mock fetch response not set');
    }
    
    return {
      ok: mockFetchResponse.ok !== false,
      status: mockFetchResponse.status || 200,
      statusText: mockFetchResponse.statusText || 'OK',
      json: jest.fn().mockResolvedValue(mockFetchResponse.body),
      text: jest.fn().mockResolvedValue(JSON.stringify(mockFetchResponse.body)),
      headers: new Headers(),
    } as Response;
  });
});

// Mock n8nEndpoints to return a test URL
jest.mock('../../services/airtable/n8nEndpoints.js', () => ({
  n8nEndpoints: {
    get: {
      userAccount: 'https://test-webhook.example.com/webhook/useraccount',
    },
  },
}));

describe('Login Flow - Comprehensive Test', () => {
  beforeEach(() => {
    // Reset counters and mocks
    fetchCallCount = 0;
    fetchCallUrl = null;
    mockFetchResponse = null;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Login Flow', () => {
    it('should complete login flow with webhook response containing Client ID', async () => {
      const testEmail = 'test@example.com';
      const testPassword = 'Test@123';
      const hashedPassword = await bcrypt.hash(testPassword, 10);

      // Mock webhook response with Client ID
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

      // Mock Clients table response for client lookup
      const clientsResponse = [
        {
          id: 'client-rec-1',
          'Client ID': 'TEST-CLIENT-1767006333410',
          'Client Name': 'Test Client',
          'Contact Email / Phone': testEmail,
          Status: 'Active',
        },
      ];

      // Set mock response
      mockFetchResponse = {
        ok: true,
        status: 200,
        body: webhookResponse,
      };

      // Set mock response for useraccount webhook
      mockFetchResponse = {
        ok: true,
        status: 200,
        body: webhookResponse,
      };
      
      // Import the mocked node-fetch to access the mock function
      const nodeFetch = await import('node-fetch');
      const mockFetch = nodeFetch.default as jest.Mock;
      
      // Configure mock to return different responses based on URL
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        fetchCallCount++;
        fetchCallUrl = urlStr;
        
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
      });

      console.log('[TEST] ========== Starting Login Test ==========');
      console.log('[TEST] Email:', testEmail);
      console.log('[TEST] Password:', '***REDACTED***');

      const startTime = Date.now();

      // Make login request
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const duration = Date.now() - startTime;

      console.log(`[TEST] Request completed in ${duration}ms`);
      console.log('[TEST] Response status:', response.status);
      console.log('[TEST] Response body:', JSON.stringify(response.body, null, 2));

      // Verify webhook was called exactly once for useraccount
      const mockFetch = (await import('node-fetch')).default as jest.Mock;
      const userAccountCalls = mockFetch.mock.calls.filter((call: any[]) => {
        const url = call[0];
        const urlStr = typeof url === 'string' ? url : url.toString();
        return urlStr.includes('/useraccount');
      });
      expect(userAccountCalls.length).toBe(1);
      console.log('[TEST] ✅ Webhook called exactly once');

      // Verify response structure
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      console.log('[TEST] ✅ Response structure valid');

      // Verify user data
      const user = response.body.data.user;
      expect(user).toHaveProperty('id', 'recRUcnoAhb3oiPme');
      expect(user).toHaveProperty('email', testEmail);
      expect(user).toHaveProperty('role', 'client');
      expect(user).toHaveProperty('clientId', 'TEST-CLIENT-1767006333410');
      console.log('[TEST] ✅ User data extracted correctly');
      console.log('[TEST] Client ID:', user.clientId);

      // Verify JWT token exists
      const token = response.body.data.token;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      console.log('[TEST] ✅ JWT token created');
      console.log('[TEST] Token preview:', token.substring(0, 20) + '...');

      // Verify HTTP-only cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);
      
      const authCookie = cookies.find((cookie: string) => 
        cookie.startsWith('auth_token=')
      );
      expect(authCookie).toBeDefined();
      expect(authCookie).toContain('HttpOnly');
      expect(authCookie).toContain('Path=/');
      console.log('[TEST] ✅ HTTP-only cookie set');
      console.log('[TEST] Cookie:', authCookie?.substring(0, 50) + '...');

      // Verify request completed within 3 seconds
      expect(duration).toBeLessThan(3000);
      console.log('[TEST] ✅ Request completed within 3 seconds');

      console.log('[TEST] ========== Login Test Completed Successfully ==========');
    }, 10000); // 10 second timeout for test

    it('should handle Client ID extraction from webhook response fields', async () => {
      const testEmail = 'client@test.com';
      const testPassword = 'Test@123';
      const hashedPassword = await bcrypt.hash(testPassword, 10);

      // Mock webhook response with Client ID in fields
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

      mockFetchResponse = {
        ok: true,
        status: 200,
        body: webhookResponse,
      };

      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        if (urlStr.includes('/useraccount')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(webhookResponse),
            headers: new Headers(),
          } as Response;
        }
        
        if (urlStr.includes('/client')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(clientsResponse),
            headers: new Headers(),
          } as Response;
        }
        
        return {
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({}),
          headers: new Headers(),
        } as Response;
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      // Verify Client ID was extracted and mapped
      expect(response.body.data.user.clientId).toBe('TEST-CLIENT-1767006333410');
      console.log('[TEST] ✅ Client ID extracted from webhook response:', response.body.data.user.clientId);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should return 401 when webhook returns empty array', async () => {
      const testEmail = 'nonexistent@example.com';
      const testPassword = 'Test@123';

      // Mock empty webhook response
      const webhookResponse: any[] = [];

      mockFetchResponse = {
        ok: true,
        status: 200,
        body: webhookResponse,
      };

      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        if (urlStr.includes('/useraccount')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(webhookResponse),
            headers: new Headers(),
          } as Response;
        }
        
        return {
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({}),
          headers: new Headers(),
        } as Response;
      });

      console.log('[TEST] Testing empty webhook response...');

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
      console.log('[TEST] ✅ Empty webhook response handled gracefully with 401');
    }, 10000);

    it('should return 401 when user not found in webhook response', async () => {
      const testEmail = 'notfound@example.com';
      const testPassword = 'Test@123';
      const hashedPassword = await bcrypt.hash('DifferentPassword', 10);

      // Mock webhook response with different user
      const webhookResponse = [
        {
          id: 'recDifferentUser',
          createdTime: '2025-01-29T12:00:00.000Z',
          fields: {
            Username: 'other@example.com',
            Password: hashedPassword,
            Role: 'client',
            'Account Status': 'Active',
          },
        },
      ];

      mockFetchResponse = {
        ok: true,
        status: 200,
        body: webhookResponse,
      };

      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        if (urlStr.includes('/useraccount')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(webhookResponse),
            headers: new Headers(),
          } as Response;
        }
        
        return {
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({}),
          headers: new Headers(),
        } as Response;
      });

      console.log('[TEST] Testing user not found scenario...');

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
      console.log('[TEST] ✅ User not found handled gracefully with 401');
    }, 10000);

    it('should return 401 when password is incorrect', async () => {
      const testEmail = 'test@example.com';
      const testPassword = 'WrongPassword';
      const correctPassword = 'Test@123';
      const hashedPassword = await bcrypt.hash(correctPassword, 10);

      // Mock webhook response with correct user but wrong password
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

      mockFetchResponse = {
        ok: true,
        status: 200,
        body: webhookResponse,
      };

      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        if (urlStr.includes('/useraccount')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(webhookResponse),
            headers: new Headers(),
          } as Response;
        }
        
        return {
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({}),
          headers: new Headers(),
        } as Response;
      });

      console.log('[TEST] Testing incorrect password scenario...');

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
      console.log('[TEST] ✅ Incorrect password handled gracefully with 401');
    }, 10000);
  });

  describe('Timeout Handling', () => {
    it('should complete request within 3 seconds', async () => {
      const testEmail = 'test@example.com';
      const testPassword = 'Test@123';
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
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (urlStr.includes('/useraccount')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(webhookResponse),
            headers: new Headers(),
          } as Response;
        }
        
        if (urlStr.includes('/client')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(clientsResponse),
            headers: new Headers(),
          } as Response;
        }
        
        return {
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({}),
          headers: new Headers(),
        } as Response;
      });

      const startTime = Date.now();

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000);
      console.log(`[TEST] ✅ Request completed in ${duration}ms (under 3 second limit)`);
    }, 10000);
  });

  describe('Webhook Response Format Validation', () => {
    it('should handle webhook response with Client ID in fields', async () => {
      const testEmail = 'test@example.com';
      const testPassword = 'Test@123';
      const hashedPassword = await bcrypt.hash(testPassword, 10);

      // Mock webhook response matching the exact format from user query
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

      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        if (urlStr.includes('/useraccount')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(webhookResponse),
            headers: new Headers(),
          } as Response;
        }
        
        if (urlStr.includes('/client')) {
          return {
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(clientsResponse),
            headers: new Headers(),
          } as Response;
        }
        
        return {
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({}),
          headers: new Headers(),
        } as Response;
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      // Verify the response structure matches expected format
      expect(response.body.data.user).toHaveProperty('clientId', 'TEST-CLIENT-1767006333410');
      expect(response.body.data.user).toHaveProperty('id', 'recRUcnoAhb3oiPme');
      console.log('[TEST] ✅ Webhook response format validated correctly');
    }, 10000);
  });
});

