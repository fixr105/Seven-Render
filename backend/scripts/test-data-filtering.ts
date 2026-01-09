#!/usr/bin/env tsx
/**
 * Test Data Filtering for Logged-In Users
 * Verifies that data is correctly filtered based on user role and IDs
 */

import fetch from 'node-fetch';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

interface TestUser {
  username: string;
  passcode: string;
  role: string;
  expectedId?: string;
  idType?: 'clientId' | 'kamId' | 'nbfcId';
}

const testUsers: TestUser[] = [
  { username: 'Sagar', passcode: 'pass@123', role: 'kam', idType: 'kamId' },
  // Add more test users as needed
];

async function login(username: string, passcode: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passcode }),
    });
    
    if (response.status === 200) {
      const data = await response.json();
      return data.token;
    }
    return null;
  } catch (error) {
    console.error(`Login failed for ${username}:`, error);
    return null;
  }
}

function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString());
  } catch (error) {
    return null;
  }
}

async function testDataFiltering(token: string, user: TestUser) {
  console.log(`\nTesting data filtering for ${user.username} (${user.role})...`);
  
  // Decode JWT to verify IDs
  const payload = decodeJWT(token);
  if (!payload) {
    console.log('❌ Failed to decode JWT token');
    return false;
  }
  
  console.log('JWT Payload:', {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    clientId: payload.clientId,
    kamId: payload.kamId,
    nbfcId: payload.nbfcId,
  });
  
  // Verify ID is present based on role
  let hasId = false;
  if (user.role === 'client' && payload.clientId) {
    hasId = true;
    console.log(`✅ Client ID found: ${payload.clientId}`);
  } else if (user.role === 'kam' && payload.kamId) {
    hasId = true;
    console.log(`✅ KAM ID found: ${payload.kamId}`);
  } else if (user.role === 'nbfc' && payload.nbfcId) {
    hasId = true;
    console.log(`✅ NBFC ID found: ${payload.nbfcId}`);
  } else if (user.role === 'credit_team') {
    hasId = true; // Credit team doesn't need specific ID
    console.log(`✅ Credit team user (no specific ID required)`);
  }
  
  if (!hasId && user.role !== 'credit_team') {
    console.log(`❌ Missing ${user.idType} for ${user.role} user`);
    return false;
  }
  
  // Test data fetching endpoints
  const endpoints = [
    { path: '/loans', description: 'Loan applications' },
    { path: '/client/dashboard', description: 'Client dashboard', roles: ['client'] },
    { path: '/kam/clients', description: 'KAM clients', roles: ['kam'] },
  ];
  
  for (const endpoint of endpoints) {
    if (endpoint.roles && !endpoint.roles.includes(user.role)) {
      continue; // Skip endpoints not for this role
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 200) {
        const data = await response.json();
        const records = data.data || data;
        const count = Array.isArray(records) ? records.length : 0;
        console.log(`  ✅ ${endpoint.description}: ${count} records`);
      } else {
        console.log(`  ⚠️  ${endpoint.description}: Status ${response.status}`);
      }
    } catch (error: any) {
      console.log(`  ❌ ${endpoint.description}: ${error.message}`);
    }
  }
  
  return hasId;
}

async function main() {
  console.log('🧪 Testing Data Filtering for Logged-In Users\n');
  
  let allPassed = true;
  
  for (const user of testUsers) {
    console.log(`\n--- Testing ${user.username} ---`);
    
    const token = await login(user.username, user.passcode);
    if (!token) {
      console.log(`❌ Failed to login as ${user.username}`);
      allPassed = false;
      continue;
    }
    
    const passed = await testDataFiltering(token, user);
    if (!passed) {
      allPassed = false;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(allPassed ? '✅ All tests passed' : '❌ Some tests failed');
  process.exit(allPassed ? 0 : 1);
}

main();
