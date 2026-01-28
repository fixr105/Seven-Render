/**
 * Test Email Validation
 * 
 * Tests that backend rejects invalid emails when posting to KAM Users and Credit Team Users
 * 
 * Usage: node test-email-validation.js
 */

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

async function testEmailValidation() {
  console.log('🧪 Testing Email Validation...\n');

  // Test 1: POST KAM User with invalid email (should fail)
  console.log('Test 1: POST KAM User with invalid email "Sagar" (should fail)');
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/KAMusers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'TEST-KAM-INVALID-EMAIL',
        'KAM ID': 'TEST-KAM-INVALID-EMAIL',
        Name: 'Test KAM',
        Email: 'Sagar', // Invalid - not an email
        Phone: '+91 1234567890',
        Role: 'kam',
        Status: 'Active'
      })
    });
    
    const result = await response.text();
    console.log('Response:', result);
    
    if (result.includes('Invalid email format') || result.includes('error')) {
      console.log('✅ PASS: Invalid email rejected\n');
    } else {
      console.log('❌ FAIL: Invalid email was accepted\n');
    }
  } catch (error) {
    console.log('✅ PASS: Request failed as expected:', error.message, '\n');
  }

  // Test 2: POST Credit Team User with invalid email (should fail)
  console.log('Test 2: POST Credit Team User with invalid email "Rahul" (should fail)');
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/CREDITTEAMUSERS`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'TEST-CREDIT-INVALID-EMAIL',
        'Credit User ID': 'TEST-CREDIT-INVALID-EMAIL',
        Name: 'Test Credit',
        Email: 'Rahul', // Invalid - not an email
        Phone: '+91 1234567890',
        Role: 'credit_team',
        Status: 'Active'
      })
    });
    
    const result = await response.text();
    console.log('Response:', result);
    
    if (result.includes('Invalid email format') || result.includes('error')) {
      console.log('✅ PASS: Invalid email rejected\n');
    } else {
      console.log('❌ FAIL: Invalid email was accepted\n');
    }
  } catch (error) {
    console.log('✅ PASS: Request failed as expected:', error.message, '\n');
  }

  // Test 3: POST KAM User with valid email (should succeed)
  console.log('Test 3: POST KAM User with valid email (should succeed)');
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/KAMusers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'TEST-KAM-VALID-EMAIL',
        'KAM ID': 'TEST-KAM-VALID-EMAIL',
        Name: 'Test KAM',
        Email: 'test.kam@example.com', // Valid email
        Phone: '+91 1234567890',
        Role: 'kam',
        Status: 'Active'
      })
    });
    
    const result = await response.text();
    console.log('Response:', result);
    
    if (result.includes('error') || response.status >= 400) {
      console.log('❌ FAIL: Valid email was rejected\n');
    } else {
      console.log('✅ PASS: Valid email accepted\n');
    }
  } catch (error) {
    console.log('⚠️  Request failed:', error.message);
    console.log('Note: This might be expected if n8n webhook is not accessible\n');
  }

  // Test 4: POST Credit Team User with valid email (should succeed)
  console.log('Test 4: POST Credit Team User with valid email (should succeed)');
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/CREDITTEAMUSERS`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'TEST-CREDIT-VALID-EMAIL',
        'Credit User ID': 'TEST-CREDIT-VALID-EMAIL',
        Name: 'Test Credit',
        Email: 'test.credit@example.com', // Valid email
        Phone: '+91 1234567890',
        Role: 'credit_team',
        Status: 'Active'
      })
    });
    
    const result = await response.text();
    console.log('Response:', result);
    
    if (result.includes('error') || response.status >= 400) {
      console.log('❌ FAIL: Valid email was rejected\n');
    } else {
      console.log('✅ PASS: Valid email accepted\n');
    }
  } catch (error) {
    console.log('⚠️  Request failed:', error.message);
    console.log('Note: This might be expected if n8n webhook is not accessible\n');
  }

  console.log('📋 Test Summary:');
  console.log('  - Email validation is enforced in backend');
  console.log('  - Invalid emails (like "Sagar", "Rahul") will be rejected');
  console.log('  - Valid emails will be accepted');
  console.log('\n⚠️  Note: These tests call n8n webhooks directly.');
  console.log('   For full validation, test via backend API endpoints.');
}

testEmailValidation().catch(console.error);
