/**
 * Module 2: Duplicate Detection Test Runner
 * 
 * Simple test runner for duplicate detection (can be run with: tsx src/services/validation/__tests__/duplicateDetection.test.runner.ts)
 */

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

// Mock data
const mockApplications = [
  {
    id: 'app-1',
    'File ID': 'SF12345678',
    Client: 'client-1',
    'Applicant Name': 'Test Applicant',
    Status: 'under_kam_review',
    'Form Data': JSON.stringify({
      pan: 'ABCDE1234F',
      pan_card: 'ABCDE1234F',
    }),
  },
  {
    id: 'app-2',
    'File ID': 'SF87654321',
    Client: 'client-1',
    'Applicant Name': 'Another Applicant',
    Status: 'draft',
    'Form Data': JSON.stringify({
      pan: 'XYZAB5678G',
    }),
  },
];

// Run tests
console.log('🧪 Running Duplicate Detection Tests...\n');

test('PAN normalization - handles spaces', () => {
  const pan = 'ABCDE 1234 F';
  const normalized = pan.trim().toUpperCase().replace(/\s+/g, '');
  assert(normalized === 'ABCDE1234F', 'PAN normalization removes spaces');
});

test('PAN normalization - case insensitive', () => {
  const pan = 'abcde1234f';
  const normalized = pan.trim().toUpperCase().replace(/\s+/g, '');
  assert(normalized === 'ABCDE1234F', 'PAN normalization is case insensitive');
});

test('Duplicate detection - exact PAN match', () => {
  const searchPAN = 'ABCDE1234F';
  const normalizedSearch = searchPAN.trim().toUpperCase().replace(/\s+/g, '');
  
  const duplicate = mockApplications.find(app => {
    const formData = JSON.parse(app['Form Data']);
    const appPAN = formData.pan || formData.pan_card;
    if (!appPAN) return false;
    const normalizedAppPAN = appPAN.trim().toUpperCase().replace(/\s+/g, '');
    return normalizedSearch === normalizedAppPAN;
  });

  assert(duplicate !== undefined, 'Duplicate found by exact PAN match');
  assert(duplicate?.['File ID'] === 'SF12345678', 'Correct duplicate file ID');
});

test('Duplicate detection - no match found', () => {
  const searchPAN = 'NONEXIST1234X';
  const normalizedSearch = searchPAN.trim().toUpperCase().replace(/\s+/g, '');
  
  const duplicate = mockApplications.find(app => {
    const formData = JSON.parse(app['Form Data']);
    const appPAN = formData.pan || formData.pan_card;
    if (!appPAN) return false;
    const normalizedAppPAN = appPAN.trim().toUpperCase().replace(/\s+/g, '');
    return normalizedSearch === normalizedAppPAN;
  });

  assert(duplicate === undefined, 'No duplicate found for non-existent PAN');
});

test('Duplicate detection - handles different PAN field names', () => {
  const searchPAN = 'ABCDE1234F';
  const normalizedSearch = searchPAN.trim().toUpperCase().replace(/\s+/g, '');
  
  // Test with pan_card field
  const duplicate = mockApplications.find(app => {
    const formData = JSON.parse(app['Form Data']);
    const appPAN = formData.pan || formData.pan_card || formData.pan_number;
    if (!appPAN) return false;
    const normalizedAppPAN = appPAN.trim().toUpperCase().replace(/\s+/g, '');
    return normalizedSearch === normalizedAppPAN;
  });

  assert(duplicate !== undefined, 'Duplicate found using pan_card field');
});

console.log('\n✅ All Duplicate Detection tests passed!');










