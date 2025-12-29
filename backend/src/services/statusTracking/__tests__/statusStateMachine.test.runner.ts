/**
 * Module 3: Status State Machine Test Runner
 * 
 * Simple test runner for status state machine (can be run with: tsx src/services/statusTracking/__tests__/statusStateMachine.test.runner.ts)
 */

import { LoanStatus, UserRole } from '../../../config/constants.js';
import {
  isValidTransition,
  getAllowedNextStatuses,
  validateTransition,
  getStatusDisplayName,
  getStatusColor,
} from '../statusStateMachine.js';

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

// Run tests
console.log('🧪 Running Status State Machine Tests...\n');

test('isValidTransition - CLIENT can submit draft', () => {
  assert(
    isValidTransition(LoanStatus.DRAFT, LoanStatus.UNDER_KAM_REVIEW, UserRole.CLIENT),
    'CLIENT can transition DRAFT → UNDER_KAM_REVIEW'
  );
});

test('isValidTransition - CLIENT cannot forward to credit', () => {
  assert(
    !isValidTransition(LoanStatus.UNDER_KAM_REVIEW, LoanStatus.PENDING_CREDIT_REVIEW, UserRole.CLIENT),
    'CLIENT cannot transition to PENDING_CREDIT_REVIEW'
  );
});

test('isValidTransition - KAM can forward to credit', () => {
  assert(
    isValidTransition(LoanStatus.UNDER_KAM_REVIEW, LoanStatus.PENDING_CREDIT_REVIEW, UserRole.KAM),
    'KAM can transition UNDER_KAM_REVIEW → PENDING_CREDIT_REVIEW'
  );
});

test('isValidTransition - Invalid transition blocked', () => {
  assert(
    !isValidTransition(LoanStatus.DRAFT, LoanStatus.APPROVED, UserRole.CLIENT),
    'Invalid transition DRAFT → APPROVED is blocked'
  );
});

test('getAllowedNextStatuses - CLIENT from DRAFT', () => {
  const allowed = getAllowedNextStatuses(LoanStatus.DRAFT, UserRole.CLIENT);
  assert(
    allowed.includes(LoanStatus.UNDER_KAM_REVIEW),
    'CLIENT can submit draft'
  );
  assert(
    allowed.includes(LoanStatus.WITHDRAWN),
    'CLIENT can withdraw draft'
  );
});

test('getAllowedNextStatuses - KAM from UNDER_KAM_REVIEW', () => {
  const allowed = getAllowedNextStatuses(LoanStatus.UNDER_KAM_REVIEW, UserRole.KAM);
  assert(
    allowed.includes(LoanStatus.QUERY_WITH_CLIENT),
    'KAM can raise query'
  );
  assert(
    allowed.includes(LoanStatus.PENDING_CREDIT_REVIEW),
    'KAM can forward to credit'
  );
});

test('validateTransition - throws on invalid transition', () => {
  try {
    validateTransition(LoanStatus.DRAFT, LoanStatus.APPROVED, UserRole.CLIENT);
    throw new Error('Should have thrown');
  } catch (error: any) {
    assert(
      error.message.includes('Invalid status transition'),
      'validateTransition throws error for invalid transition'
    );
  }
});

test('getStatusDisplayName - returns display name', () => {
  assert(
    getStatusDisplayName(LoanStatus.DRAFT) === 'Draft',
    'getStatusDisplayName returns correct display name'
  );
  assert(
    getStatusDisplayName(LoanStatus.UNDER_KAM_REVIEW) === 'Under KAM Review',
    'getStatusDisplayName handles underscores'
  );
});

test('getStatusColor - returns correct color', () => {
  assert(
    getStatusColor(LoanStatus.APPROVED) === 'success',
    'APPROVED status returns success color'
  );
  assert(
    getStatusColor(LoanStatus.REJECTED) === 'error',
    'REJECTED status returns error color'
  );
  assert(
    getStatusColor(LoanStatus.QUERY_WITH_CLIENT) === 'warning',
    'QUERY_WITH_CLIENT returns warning color'
  );
});

console.log('\n✅ All Status State Machine tests passed!');






