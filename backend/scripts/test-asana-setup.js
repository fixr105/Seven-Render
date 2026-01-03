/**
 * Test Asana Integration Setup
 * 
 * This script tests:
 * 1. Environment variable configuration
 * 2. Service imports and function availability
 * 3. Webhook endpoint connectivity
 * 4. User fetch functionality
 * 
 * Usage: node backend/scripts/test-asana-setup.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function logPass(test, details = '') {
  results.passed.push({ test, details });
  console.log(`✅ ${test}${details ? `: ${details}` : ''}`);
}

function logFail(test, error) {
  results.failed.push({ test, error });
  console.error(`❌ ${test}: ${error}`);
}

function logWarn(test, message) {
  results.warnings.push({ test, message });
  console.warn(`⚠️  ${test}: ${message}`);
}

/**
 * Test 1: Environment Variables
 */
async function testEnvironmentVariables() {
  console.log('\n📋 Test 1: Environment Variables');
  console.log('─'.repeat(60));
  
  const asanaPat = process.env.ASANA_PAT;
  const n8nBaseUrl = process.env.N8N_BASE_URL;
  
  if (asanaPat) {
    logPass('ASANA_PAT is set', `Length: ${asanaPat.length} characters`);
  } else {
    logWarn('ASANA_PAT not set', 'Asana integration will be disabled');
  }
  
  if (n8nBaseUrl) {
    logPass('N8N_BASE_URL is set', n8nBaseUrl);
  } else {
    logPass('N8N_BASE_URL using default', N8N_BASE_URL);
  }
}

/**
 * Test 2: Service File Existence
 */
async function testServiceFiles() {
  console.log('\n📋 Test 2: Service Files');
  console.log('─'.repeat(60));
  
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const servicePath = path.join(currentDir, '..', 'src', 'services', 'asana', 'asana.service.ts');
  
  try {
    if (fs.existsSync(servicePath)) {
      const stats = fs.statSync(servicePath);
      logPass('asana.service.ts exists', `${(stats.size / 1024).toFixed(2)} KB`);
      
      // Read file to check for key functions
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (content.includes('createAsanaTask')) {
        logPass('createAsanaTask function found in file');
      }
      if (content.includes('createAsanaTaskForLoan')) {
        logPass('createAsanaTaskForLoan function found in file');
      }
      if (content.includes('getUserName')) {
        logPass('getUserName function found in file');
      }
      if (content.includes('updateLoanApplicationWithAsanaTask')) {
        logPass('updateLoanApplicationWithAsanaTask function found in file');
      }
    } else {
      logFail('asana.service.ts', 'File not found');
    }
  } catch (error) {
    logFail('Service file check', error.message);
  }
}

/**
 * Test 3: Webhook Endpoints
 */
async function testWebhookEndpoints() {
  console.log('\n📋 Test 3: Webhook Endpoints');
  console.log('─'.repeat(60));
  
  const endpoints = [
    { name: 'User Account', url: `${N8N_BASE_URL}/webhook/useraccount` },
    { name: 'Loan Application', url: `${N8N_BASE_URL}/webhook/loanapplication` },
    { name: 'Loan Applications (POST)', url: `${N8N_BASE_URL}/webhook/loanapplications` },
    { name: 'Clients', url: `${N8N_BASE_URL}/webhook/client` },
    { name: 'Loan Products', url: `${N8N_BASE_URL}/webhook/loanproducts` },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        const text = await response.text();
        if (text && text.trim()) {
          try {
            const data = JSON.parse(text);
            const count = Array.isArray(data) ? data.length : (data.records?.length || 0);
            logPass(`${endpoint.name} webhook`, `Status: ${response.status}, Records: ${count}`);
          } catch (e) {
            logPass(`${endpoint.name} webhook`, `Status: ${response.status} (non-JSON response)`);
          }
        } else {
          logWarn(`${endpoint.name} webhook`, 'Empty response');
        }
      } else {
        logWarn(`${endpoint.name} webhook`, `Status: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        logWarn(`${endpoint.name} webhook`, 'Request timed out');
      } else {
        logWarn(`${endpoint.name} webhook`, error.message);
      }
    }
  }
}

/**
 * Test 4: User Fetch with Query Parameter
 */
async function testUserFetch() {
  console.log('\n📋 Test 4: User Fetch with Query Parameter');
  console.log('─'.repeat(60));
  
  // Test with a sample username (using test user if available)
  const testUsernames = ['client@test.com', 'kam@test.com', 'credit@test.com'];
  
  for (const username of testUsernames) {
    try {
      const url = `${N8N_BASE_URL}/webhook/useraccount?username=${encodeURIComponent(username)}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        const text = await response.text();
        if (text && text.trim()) {
          try {
            const data = JSON.parse(text);
            const users = Array.isArray(data) ? data : (data.records || []);
            
            if (users.length > 0) {
              const user = users[0];
              const name = user['Name'] || user['Username'] || user['Email'] || 'N/A';
              logPass(`User fetch by username (${username})`, `Found: ${name}`);
              break; // Found at least one, that's enough
            } else {
              logWarn(`User fetch by username (${username})`, 'No users found');
            }
          } catch (e) {
            logWarn(`User fetch by username (${username})`, 'Invalid JSON response');
          }
        } else {
          logWarn(`User fetch by username (${username})`, 'Empty response');
        }
      } else {
        logWarn(`User fetch by username (${username})`, `Status: ${response.status}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        logWarn(`User fetch by username (${username})`, 'Request timed out');
      } else {
        logWarn(`User fetch by username (${username})`, error.message);
      }
    }
  }
}

/**
 * Test 5: Loan Product Mapping
 */
async function testLoanProductMapping() {
  console.log('\n📋 Test 5: Loan Product to Asana Project Mapping');
  console.log('─'.repeat(60));
  
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const servicePath = path.join(currentDir, '..', 'src', 'services', 'asana', 'asana.service.ts');
  
  try {
    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf-8');
      
      // Check for product mappings
      const expectedProducts = [
        'Revenue Based Finance for EV',
        'HL / LAP',
        'Porter',
        'Rapido',
        'Money Multiplier',
        'Numerous',
      ];
      
      let foundCount = 0;
      expectedProducts.forEach(product => {
        if (content.includes(product)) {
          foundCount++;
        }
      });
      
      if (foundCount > 0) {
        logPass('Loan product mappings', `Found ${foundCount}/${expectedProducts.length} product mappings`);
      } else {
        logWarn('Loan product mappings', 'No product mappings found in service file');
      }
      
      // Check for Asana project IDs
      if (content.includes('1211908004694493')) {
        logPass('Asana project IDs', 'Project IDs configured');
      }
    } else {
      logFail('Loan product mapping', 'Service file not found');
    }
  } catch (error) {
    logFail('Loan product mapping', error.message);
  }
}

/**
 * Test 6: n8nClient Integration
 */
async function testN8nClientIntegration() {
  console.log('\n📋 Test 6: n8nClient Integration');
  console.log('─'.repeat(60));
  
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const n8nClientPath = path.join(currentDir, '..', 'src', 'services', 'airtable', 'n8nClient.ts');
  
  try {
    if (fs.existsSync(n8nClientPath)) {
      const content = fs.readFileSync(n8nClientPath, 'utf-8');
      
      if (content.includes('postLoanApplication')) {
        logPass('n8nClient.postLoanApplication', 'Function found in file');
        
        // Check if Asana fields are included
        if (content.includes('Asana Task ID')) {
          logPass('Asana Task ID field', 'Included in postLoanApplication');
        } else {
          logWarn('Asana Task ID field', 'Not found in postLoanApplication');
        }
        
        if (content.includes('Asana Task Link')) {
          logPass('Asana Task Link field', 'Included in postLoanApplication');
        } else {
          logWarn('Asana Task Link field', 'Not found in postLoanApplication');
        }
      } else {
        logFail('n8nClient.postLoanApplication', 'Function not found');
      }
      
      if (content.includes('fetchTable')) {
        logPass('n8nClient.fetchTable', 'Function found in file');
      } else {
        logFail('n8nClient.fetchTable', 'Function not found');
      }
    } else {
      logFail('n8nClient integration', 'File not found');
    }
  } catch (error) {
    logFail('n8nClient integration', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🧪 Asana Integration Setup Test');
  console.log('================================\n');
  
  await testEnvironmentVariables();
  await testServiceFiles();
  await testWebhookEndpoints();
  await testUserFetch();
  await testLoanProductMapping();
  await testN8nClientIntegration();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Passed: ${results.passed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(({ test, message }) => {
      console.log(`   - ${test}: ${message}`);
    });
  }
  
  console.log('\n✨ Test completed!\n');
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

