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
  normalizeToCanonicalStatus,
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

// --- Administrative close (Credit/Admin can close from any non-closed status) ---

test('isValidTransition - CREDIT can transition DRAFT → CLOSED', () => {
  assert(
    isValidTransition(LoanStatus.DRAFT, LoanStatus.CLOSED, UserRole.CREDIT),
    'CREDIT can transition DRAFT → CLOSED (administrative close)'
  );
});

test('validateTransition - CREDIT can transition DRAFT → CLOSED', () => {
  validateTransition(LoanStatus.DRAFT, LoanStatus.CLOSED, UserRole.CREDIT);
  console.log('   validateTransition did not throw');
});

test('isValidTransition - CREDIT can transition UNDER_KAM_REVIEW → CLOSED', () => {
  assert(
    isValidTransition(LoanStatus.UNDER_KAM_REVIEW, LoanStatus.CLOSED, UserRole.CREDIT),
    'CREDIT can transition UNDER_KAM_REVIEW → CLOSED (administrative close)'
  );
});

test('getAllowedNextStatuses - CREDIT from DRAFT includes CLOSED', () => {
  const allowed = getAllowedNextStatuses(LoanStatus.DRAFT, UserRole.CREDIT);
  assert(
    allowed.includes(LoanStatus.CLOSED),
    'getAllowedNextStatuses(DRAFT, CREDIT) includes CLOSED'
  );
});

test('isValidTransition - CLIENT cannot transition DRAFT → CLOSED', () => {
  assert(
    !isValidTransition(LoanStatus.DRAFT, LoanStatus.CLOSED, UserRole.CLIENT),
    'CLIENT cannot transition DRAFT → CLOSED'
  );
});

test('validateTransition - CLIENT cannot transition DRAFT → CLOSED', () => {
  try {
    validateTransition(LoanStatus.DRAFT, LoanStatus.CLOSED, UserRole.CLIENT);
    throw new Error('Should have thrown');
  } catch (error: any) {
    assert(
      error.message.includes('Invalid status transition'),
      'validateTransition throws for CLIENT DRAFT → CLOSED'
    );
  }
});

test('normalizeToCanonicalStatus - pending_kam_review → under_kam_review', () => {
  const out = normalizeToCanonicalStatus('pending_kam_review');
  assert(out === LoanStatus.UNDER_KAM_REVIEW, 'pending_kam_review normalizes to UNDER_KAM_REVIEW');
});

test('normalizeToCanonicalStatus - kam_query_raised → query_with_client', () => {
  const out = normalizeToCanonicalStatus('kam_query_raised');
  assert(out === LoanStatus.QUERY_WITH_CLIENT, 'kam_query_raised normalizes to QUERY_WITH_CLIENT');
});

test('isValidTransition - CREDIT can transition PENDING_CREDIT_REVIEW → SENT_TO_NBFC', () => {
  assert(
    isValidTransition(LoanStatus.PENDING_CREDIT_REVIEW, LoanStatus.SENT_TO_NBFC, UserRole.CREDIT),
    'CREDIT can transition PENDING_CREDIT_REVIEW → SENT_TO_NBFC'
  );
});

test('getAllowedNextStatuses - CREDIT from PENDING_CREDIT_REVIEW includes SENT_TO_NBFC', () => {
  const allowed = getAllowedNextStatuses(LoanStatus.PENDING_CREDIT_REVIEW, UserRole.CREDIT);
  assert(
    allowed.includes(LoanStatus.SENT_TO_NBFC),
    'getAllowedNextStatuses(PENDING_CREDIT_REVIEW, CREDIT) includes SENT_TO_NBFC'
  );
});

test('normalizeToCanonicalStatus - Pending Credit Review with spaces', () => {
  const out = normalizeToCanonicalStatus('Pending Credit Review');
  assert(out === LoanStatus.PENDING_CREDIT_REVIEW, 'Pending Credit Review normalizes to PENDING_CREDIT_REVIEW');
});

console.log('\n✅ All Status State Machine tests passed!');










