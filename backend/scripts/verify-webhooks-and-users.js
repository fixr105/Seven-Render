/**
 * Verification Script: Webhook Paths and Test Users
 * 
 * This script verifies:
 * 1. All webhook paths match the n8n configuration
 * 2. Test users exist and are properly configured
 * 3. Test users have associated profile records (KAM Users, Credit Team Users, NBFC Partners, Clients)
 * 
 * Usage:
 *   node scripts/verify-webhooks-and-users.js
 */

import fetch from 'node-fetch';
import { n8nEndpoints } from '../src/services/airtable/n8nEndpoints.js';
import { n8nClient } from '../src/services/airtable/n8nClient.js';

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Expected webhook paths from n8n configuration
const EXPECTED_WEBHOOK_PATHS = {
  'Adminactivity': 'adminactivity',
  'useraccount': 'useraccount',
  'clientformmapping': 'clientformmapping',
  'client': 'client',
  'commisionledger': 'commisionledger',
  'creditteamuser': 'creditteamuser',
  'dailysummaryreport': 'dailysummaryreport',
  'fileauditinglog': 'fileauditinglog',
  'formcategories': 'formcategories',
  'formfields': 'formfields',
  'kamusers': 'kamusers',
  'loanapplication': 'loanapplication',
  'loanproducts': 'loanproducts',
  'nbfcpartners': 'nbfcpartners',
  'notifications': 'notifications',
};

// Test user: Sagar@gmail.com / pass@123 (one user may have one role in Airtable)
const TEST_USERS = [
  { email: 'Sagar@gmail.com', password: 'pass@123', role: 'client', name: 'Sagar', needsProfile: 'Clients' },
  { email: 'Sagar@gmail.com', password: 'pass@123', role: 'kam', name: 'Sagar', needsProfile: 'KAM Users' },
  { email: 'Sagar@gmail.com', password: 'pass@123', role: 'credit_team', name: 'Sagar', needsProfile: 'Credit Team Users' },
  { email: 'Sagar@gmail.com', password: 'pass@123', role: 'nbfc', name: 'Sagar', needsProfile: 'NBFC Partners' },
];

/**
 * Test a webhook endpoint
 */
async function testWebhook(path, expectedPath) {
  const url = `${N8N_BASE_URL}/webhook/${path}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        path,
        expectedPath,
        status: response.status,
        recordCount: Array.isArray(data) ? data.length : (data.records ? data.records.length : 0),
      };
    } else {
      return {
        success: false,
        path,
        expectedPath,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      path,
      expectedPath,
      error: error.message,
    };
  }
}

/**
 * Verify webhook paths match configuration
 */
async function verifyWebhookPaths() {
  console.log('🔍 Verifying webhook paths...\n');

  const results = [];
  let passed = 0;
  let failed = 0;

  // Check each expected path
  for (const [configName, expectedPath] of Object.entries(EXPECTED_WEBHOOK_PATHS)) {
    const result = await testWebhook(expectedPath, expectedPath);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${configName}: ${expectedPath} - OK (${result.recordCount || 0} records)`);
      passed++;
    } else {
      console.log(`❌ ${configName}: ${expectedPath} - FAILED (${result.error})`);
      failed++;
    }
  }

  console.log(`\n📊 Webhook Verification Summary:`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📝 Total: ${results.length}\n`);

  return { results, passed, failed };
}

/**
 * Verify test user exists and has correct configuration
 */
async function verifyTestUser(user) {
  console.log(`\n🔍 Verifying test user: ${user.email} (${user.role})...`);

  try {
    // Check if user exists in User Accounts
    const userAccounts = await n8nClient.fetchTable('User Accounts', false, undefined, 10000);
    const userAccount = userAccounts.find(
      (u) => (u.Username || u.Email || '').toLowerCase() === user.email.toLowerCase()
    );

    if (!userAccount) {
      console.log(`  ❌ User account not found in User Accounts table`);
      return { exists: false, hasProfile: false, issues: ['User account missing'] };
    }

    console.log(`  ✅ User account found: ${userAccount.id}`);
    
    // Verify role matches
    const userRole = userAccount.Role || userAccount.role || '';
    if (userRole.toLowerCase() !== user.role.toLowerCase()) {
      console.log(`  ⚠️  Role mismatch: Expected ${user.role}, found ${userRole}`);
    } else {
      console.log(`  ✅ Role correct: ${userRole}`);
    }

    // Check if profile record exists
    let hasProfile = false;
    let profileRecord = null;

    if (user.needsProfile === 'Clients') {
      const clients = await n8nClient.fetchTable('Clients', false, undefined, 10000);
      profileRecord = clients.find(
        (c) => (c['Client ID'] || c.id || '') === userAccount.id
      );
      hasProfile = !!profileRecord;
    } else if (user.needsProfile === 'KAM Users') {
      const kamUsers = await n8nClient.fetchTable('KAM Users', false, undefined, 10000);
      profileRecord = kamUsers.find(
        (k) => (k.Email || k['Email'] || '').toLowerCase() === user.email.toLowerCase()
      );
      hasProfile = !!profileRecord;
    } else if (user.needsProfile === 'Credit Team Users') {
      const creditUsers = await n8nClient.fetchTable('Credit Team Users', false, undefined, 10000);
      profileRecord = creditUsers.find(
        (c) => (c.Email || c['Email'] || '').toLowerCase() === user.email.toLowerCase()
      );
      hasProfile = !!profileRecord;
    } else if (user.needsProfile === 'NBFC Partners') {
      const nbfcPartners = await n8nClient.fetchTable('NBFC Partners', false, undefined, 10000);
      profileRecord = nbfcPartners.find(
        (n) => (n.Email || n['Email'] || '').toLowerCase() === user.email.toLowerCase()
      );
      hasProfile = !!profileRecord;
    }

    if (hasProfile) {
      console.log(`  ✅ Profile record found in ${user.needsProfile}`);
    } else {
      console.log(`  ⚠️  Profile record missing in ${user.needsProfile}`);
      console.log(`     This may cause RBAC filtering issues`);
    }

    // Check account status
    const accountStatus = userAccount['Account Status'] || userAccount.accountStatus || '';
    if (accountStatus.toLowerCase() !== 'active') {
      console.log(`  ⚠️  Account status: ${accountStatus} (should be Active)`);
    } else {
      console.log(`  ✅ Account status: Active`);
    }

    return {
      exists: true,
      hasProfile,
      userAccount,
      profileRecord,
      issues: [],
    };
  } catch (error) {
    console.log(`  ❌ Error verifying user: ${error.message}`);
    return { exists: false, hasProfile: false, issues: [error.message] };
  }
}

/**
 * Verify all test users
 */
async function verifyAllTestUsers() {
  console.log('\n🔍 Verifying test users configuration...\n');

  const results = [];
  let allPassed = true;

  for (const user of TEST_USERS) {
    const result = await verifyTestUser(user);
    results.push({ user, ...result });

    if (!result.exists || !result.hasProfile) {
      allPassed = false;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 Test Users Verification Summary:`);
  console.log(`  ✅ All users exist: ${results.every(r => r.exists) ? 'Yes' : 'No'}`);
  console.log(`  ✅ All profiles exist: ${results.every(r => r.hasProfile) ? 'Yes' : 'No'}`);
  
  if (!allPassed) {
    console.log(`\n⚠️  Issues found:`);
    results.forEach(({ user, exists, hasProfile, issues }) => {
      if (!exists || !hasProfile) {
        console.log(`  - ${user.email}:`);
        if (!exists) console.log(`    • User account missing`);
        if (!hasProfile) console.log(`    • Profile record missing in ${user.needsProfile}`);
        issues.forEach(issue => console.log(`    • ${issue}`));
      }
    });
  }

  return { results, allPassed };
}

/**
 * Main verification function
 */
async function main() {
  console.log('🚀 Starting Webhook and Test User Verification\n');
  console.log('=' .repeat(60));

  // Verify webhook paths
  const webhookResults = await verifyWebhookPaths();

  console.log('\n' + '='.repeat(60));

  // Verify test users
  const userResults = await verifyAllTestUsers();

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Final Summary:\n');

  if (webhookResults.failed === 0 && userResults.allPassed) {
    console.log('✅ All webhooks and test users are configured correctly!');
    console.log('\nYou can proceed with testing.');
  } else {
    console.log('⚠️  Some issues found:');
    if (webhookResults.failed > 0) {
      console.log(`  - ${webhookResults.failed} webhook path(s) failed`);
    }
    if (!userResults.allPassed) {
      console.log(`  - Some test users are missing or incomplete`);
      console.log(`\nTo fix test users, run:`);
      console.log(`  node scripts/ensure-test-users.js`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('verify-webhooks-and-users.js')) {
  main().catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
}

export { verifyWebhookPaths, verifyAllTestUsers };



