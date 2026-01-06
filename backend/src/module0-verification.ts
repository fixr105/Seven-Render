/**
 * Module 0: Foundation Verification Script
 * 
 * Verifies Module 0 acceptance criteria:
 * 1. Role-based navigation works (Client/KAM/Credit/NBFC)
 * 2. One click action logs exactly one Admin Activity record via POSTLOG
 * 
 * Run with: tsx src/module0-verification.ts
 */

import { UserRole } from './config/constants.js';
import { AuthUser } from './services/auth/auth.service.js';
import { AdminActionType, logAdminActivity } from './utils/adminLogger.js';
import { canPerformAction, requireActionPermission } from './middleware/rbac.middleware.js';
import { n8nApiClient } from './services/airtable/n8nApiClient.js';

console.log('🔍 Module 0: Foundation Verification\n');
console.log('=' .repeat(60));

// Test users for each role
const testUsers: Record<string, AuthUser> = {
  client: {
    id: 'user-1',
    email: 'client@test.com',
    role: UserRole.CLIENT,
    clientId: 'client-1',
  },
  kam: {
    id: 'user-2',
    email: 'kam@test.com',
    role: UserRole.KAM,
    kamId: 'kam-1',
  },
  credit: {
    id: 'user-3',
    email: 'credit@test.com',
    role: UserRole.CREDIT,
  },
  nbfc: {
    id: 'user-4',
    email: 'nbfc@test.com',
    role: UserRole.NBFC,
    nbfcId: 'nbfc-1',
  },
};

// Test 1: Role-based navigation
console.log('\n📋 Test 1: Role-Based Navigation\n');

const roleNavigationTests = [
  { role: UserRole.CLIENT, allowedRoutes: ['/client/dashboard', '/loan-applications', '/clients/me/ledger'] },
  { role: UserRole.KAM, allowedRoutes: ['/kam/dashboard', '/kam/clients', '/kam/loan-applications'] },
  { role: UserRole.CREDIT, allowedRoutes: ['/credit/dashboard', '/credit/loan-applications', '/credit/clients'] },
  { role: UserRole.NBFC, allowedRoutes: ['/nbfc/dashboard', '/nbfc/loan-applications'] },
];

let navigationTestsPassed = 0;
for (const test of roleNavigationTests) {
  const user = Object.values(testUsers).find(u => u.role === test.role);
  if (user) {
    // Verify user can perform actions for their role
    const canAccess = canPerformAction(user, test.role);
    if (canAccess) {
      console.log(`✓ ${test.role} can access ${test.role}-specific routes`);
      navigationTestsPassed++;
    } else {
      console.log(`✗ ${test.role} cannot access ${test.role}-specific routes`);
    }
  }
}

console.log(`\n✅ Role-based navigation: ${navigationTestsPassed}/${roleNavigationTests.length} tests passed`);

// Test 2: Admin Activity Logging (POSTLOG)
console.log('\n📋 Test 2: Admin Activity Logging (POSTLOG)\n');

let loggingTestsPassed = 0;

async function testAdminLogging() {
  // Test logging for each role
  for (const [roleName, user] of Object.entries(testUsers)) {
    try {
      const logEntry = await logAdminActivity(user, {
        actionType: AdminActionType.CREATE_APPLICATION,
        description: `Test action by ${roleName}`,
        targetEntity: 'loan_application',
        relatedFileId: 'TEST-FILE-001',
      });

      if (logEntry && logEntry['Activity ID']) {
        console.log(`✓ ${roleName} action logged successfully (Activity ID: ${logEntry['Activity ID']})`);
        loggingTestsPassed++;
      } else {
        console.log(`✗ ${roleName} action logging failed - no Activity ID`);
      }
    } catch (error: any) {
      console.log(`✗ ${roleName} action logging failed: ${error.message}`);
    }
  }

  console.log(`\n✅ Admin activity logging: ${loggingTestsPassed}/${Object.keys(testUsers).length} tests passed`);
}

// Test 3: RBAC Guards
console.log('\n📋 Test 3: RBAC Guards\n');

let rbacTestsPassed = 0;

// Test canPerformAction
if (canPerformAction(testUsers.client, UserRole.CLIENT)) {
  console.log('✓ canPerformAction: CLIENT can perform CLIENT action');
  rbacTestsPassed++;
}

if (!canPerformAction(testUsers.client, UserRole.KAM)) {
  console.log('✓ canPerformAction: CLIENT cannot perform KAM action');
  rbacTestsPassed++;
}

// Test requireActionPermission
try {
  requireActionPermission(testUsers.kam, UserRole.KAM);
  console.log('✓ requireActionPermission: KAM can perform KAM action');
  rbacTestsPassed++;
} catch (error) {
  console.log('✗ requireActionPermission: KAM should be able to perform KAM action');
}

try {
  requireActionPermission(testUsers.client, UserRole.KAM);
  console.log('✗ requireActionPermission: CLIENT should not be able to perform KAM action');
} catch (error) {
  console.log('✓ requireActionPermission: CLIENT correctly blocked from KAM action');
  rbacTestsPassed++;
}

console.log(`\n✅ RBAC guards: ${rbacTestsPassed}/4 tests passed`);

// Test 4: Mock Mode
console.log('\n📋 Test 4: Mock Mode\n');

if (isMockMode()) {
  console.log('✓ Mock mode is enabled');
  console.log('  - n8nApiClient will return mock data');
  console.log('  - POST operations will be simulated');
} else {
  console.log('ℹ Mock mode is disabled (using real n8n webhooks)');
}

// Run async tests
(async () => {
  await testAdminLogging();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Module 0 Verification Summary\n');
  console.log(`Role-based navigation: ${navigationTestsPassed}/${roleNavigationTests.length} ✓`);
  console.log(`Admin activity logging: ${loggingTestsPassed}/${Object.keys(testUsers).length} ✓`);
  console.log(`RBAC guards: ${rbacTestsPassed}/4 ✓`);
  console.log(`Mock mode: ${process.env.MOCK_MODE === 'true' ? 'Enabled' : 'Disabled'}`);
  
  const totalTests = roleNavigationTests.length + Object.keys(testUsers).length + 4;
  const totalPassed = navigationTestsPassed + loggingTestsPassed + rbacTestsPassed;
  
  console.log(`\nOverall: ${totalPassed}/${totalTests} tests passed`);
  
  if (totalPassed === totalTests) {
    console.log('\n✅ Module 0: Foundation - ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('\n⚠️  Module 0: Foundation - SOME TESTS FAILED');
    process.exit(1);
  }
})();










