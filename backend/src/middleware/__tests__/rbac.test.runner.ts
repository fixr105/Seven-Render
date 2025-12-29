/**
 * Module 0: RBAC Guard Test Runner
 * 
 * Simple test runner for RBAC guards (can be run with: tsx src/middleware/__tests__/rbac.test.runner.ts)
 */

import { UserRole } from '../../config/constants.js';
import { AuthUser } from '../../services/auth/auth.service.js';
import {
  canPerformAction,
  requireActionPermission,
  canAccessResource,
} from '../rbac.middleware.js';

// Test utilities
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ Test passed: ${name}`);
  } catch (error: any) {
    console.error(`❌ Test failed: ${name}`);
    console.error(`   Error: ${error.message}`);
    throw error;
  }
}

// Test data
const clientUser: AuthUser = {
  id: 'user-1',
  email: 'client@test.com',
  role: UserRole.CLIENT,
  clientId: 'client-1',
};

const kamUser: AuthUser = {
  id: 'user-2',
  email: 'kam@test.com',
  role: UserRole.KAM,
  kamId: 'kam-1',
};

const creditUser: AuthUser = {
  id: 'user-3',
  email: 'credit@test.com',
  role: UserRole.CREDIT,
};

const nbfcUser: AuthUser = {
  id: 'user-4',
  email: 'nbfc@test.com',
  role: UserRole.NBFC,
  nbfcId: 'nbfc-1',
};

// Run tests
console.log('🧪 Running RBAC Guard Tests...\n');

test('canPerformAction - user has required role', () => {
  assert(canPerformAction(clientUser, UserRole.CLIENT) === true, 'CLIENT can perform CLIENT action');
  assert(canPerformAction(kamUser, UserRole.KAM) === true, 'KAM can perform KAM action');
  assert(canPerformAction(creditUser, UserRole.CREDIT) === true, 'CREDIT can perform CREDIT action');
  assert(canPerformAction(nbfcUser, UserRole.NBFC) === true, 'NBFC can perform NBFC action');
});

test('canPerformAction - user does not have required role', () => {
  assert(canPerformAction(clientUser, UserRole.KAM) === false, 'CLIENT cannot perform KAM action');
  assert(canPerformAction(kamUser, UserRole.CLIENT) === false, 'KAM cannot perform CLIENT action');
  assert(canPerformAction(creditUser, UserRole.NBFC) === false, 'CREDIT cannot perform NBFC action');
});

test('canPerformAction - undefined user', () => {
  assert(canPerformAction(undefined, UserRole.CLIENT) === false, 'Undefined user cannot perform action');
});

test('canPerformAction - multiple allowed roles', () => {
  assert(canPerformAction(kamUser, UserRole.KAM, UserRole.CREDIT) === true, 'KAM can perform KAM or CREDIT action');
  assert(canPerformAction(creditUser, UserRole.KAM, UserRole.CREDIT) === true, 'CREDIT can perform KAM or CREDIT action');
  assert(canPerformAction(clientUser, UserRole.KAM, UserRole.CREDIT) === false, 'CLIENT cannot perform KAM or CREDIT action');
});

test('requireActionPermission - user has required role', () => {
  requireActionPermission(clientUser, UserRole.CLIENT);
  requireActionPermission(kamUser, UserRole.KAM);
  console.log('✓ requireActionPermission does not throw when user has required role');
});

test('requireActionPermission - user does not have required role', () => {
  try {
    requireActionPermission(clientUser, UserRole.KAM);
    throw new Error('Should have thrown');
  } catch (error: any) {
    assert(error.message.includes('Insufficient permissions'), 'Throws Insufficient permissions error');
  }
});

test('requireActionPermission - undefined user', () => {
  try {
    requireActionPermission(undefined, UserRole.CLIENT);
    throw new Error('Should have thrown');
  } catch (error: any) {
    assert(error.message.includes('Authentication required'), 'Throws Authentication required error');
  }
});

test('canAccessResource - CLIENT accesses own resource', () => {
  assert(canAccessResource(clientUser, 'client-1') === true, 'CLIENT can access own resource');
  assert(canAccessResource(clientUser, clientUser.clientId) === true, 'CLIENT can access own resource by ID');
});

test('canAccessResource - CLIENT accesses other resource', () => {
  assert(canAccessResource(clientUser, 'client-2') === false, 'CLIENT cannot access other client resource');
});

test('canAccessResource - resource owner not specified', () => {
  assert(canAccessResource(clientUser, undefined) === true, 'Can access resource when owner not specified');
  assert(canAccessResource(kamUser, undefined) === true, 'KAM can access resource when owner not specified');
});

test('canAccessResource - KAM has broader access', () => {
  assert(canAccessResource(kamUser, 'client-1') === true, 'KAM can access any client resource');
  assert(canAccessResource(kamUser, 'client-2') === true, 'KAM can access any client resource');
});

test('canAccessResource - CREDIT has broader access', () => {
  assert(canAccessResource(creditUser, 'client-1') === true, 'CREDIT can access any resource');
});

test('canAccessResource - undefined user', () => {
  assert(canAccessResource(undefined, 'client-1') === false, 'Undefined user cannot access resource');
});

console.log('\n✅ All RBAC Guard tests passed!');






