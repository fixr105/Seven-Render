/**
 * Test AI Summary Generation Flow
 * 
 * Tests the complete flow:
 * 1. Generate AI summary via POST /api/loan-applications/:id/generate-summary
 * 2. Verify big-brain-bro integration
 * 3. Check summary is saved to Airtable
 * 4. Validate response format
 * 
 * Usage:
 *   node backend/scripts/test-ai-summary-generation.js [application-id]
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Test credentials (use a KAM or Credit user)
const TEST_USERNAME = process.env.E2E_KAM_USERNAME || 'Sagar@gmail.com';
const TEST_PASSWORD = process.env.E2E_KAM_PASSWORD || 'pass@123';

let authToken = null;

/**
 * Login and get auth token
 */
async function login() {
  console.log('\n🔐 Logging in...');
  console.log(`   Username: ${TEST_USERNAME}`);
  
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  authToken = data.token || data.data?.token;
  
  if (!authToken) {
    throw new Error('No token received from login');
  }
  
  console.log('   ✅ Login successful');
  return authToken;
}

/**
 * Get list of applications
 */
async function getApplications() {
  console.log('\n📋 Fetching applications...');
  
  const response = await fetch(`${API_BASE_URL}/api/loan-applications`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch applications: ${response.status}`);
  }

  const data = await response.json();
  const applications = data.data || data;
  
  console.log(`   ✅ Found ${applications.length} application(s)`);
  return applications;
}

/**
 * Get a specific application
 */
async function getApplication(id) {
  console.log(`\n📄 Fetching application ${id}...`);
  
  const response = await fetch(`${API_BASE_URL}/api/loan-applications/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch application: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Generate AI summary
 */
async function generateSummary(applicationId) {
  console.log(`\n🤖 Generating AI summary for application ${applicationId}...`);
  console.log(`   Using big-brain-bro: ${process.env.N8N_BIG_BRAIN_BRO_URL || 'NOT SET'}`);
  
  const startTime = Date.now();
  
  const response = await fetch(`${API_BASE_URL}/api/loan-applications/${applicationId}/generate-summary`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  const duration = Date.now() - startTime;
  console.log(`   ⏱️  Request took ${duration}ms`);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      const text = await response.text();
      errorData = { error: text };
    }
    throw new Error(`Failed to generate summary: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Verify summary was saved
 */
async function verifySummarySaved(applicationId) {
  console.log(`\n✅ Verifying summary was saved to Airtable...`);
  
  const app = await getApplication(applicationId);
  const summary = app.aiFileSummary || app['AI File Summary'] || null;
  
  if (summary) {
    console.log(`   ✅ Summary found in Airtable (${summary.length} characters)`);
    console.log(`   Preview: ${summary.substring(0, 100)}...`);
    return true;
  } else {
    console.log(`   ❌ Summary not found in Airtable`);
    return false;
  }
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('🧪 AI Summary Generation Test');
    console.log('='.repeat(60));
    console.log(`API Base: ${API_BASE_URL}`);
    console.log(`N8N Base: ${N8N_BASE_URL}`);

    // Step 1: Login
    await login();

    // Step 2: Get applications
    const applications = await getApplications();
    
    if (applications.length === 0) {
      console.error('\n❌ No applications found. Cannot test.');
      process.exit(1);
    }

    // Step 3: Select application (use provided ID or first one)
    const appId = process.argv[2] || applications[0].id;
    const application = applications.find(app => app.id === appId) || applications[0];
    
    console.log(`\n📌 Using application:`);
    console.log(`   ID: ${application.id}`);
    console.log(`   File ID: ${application.fileId || application['File ID'] || 'N/A'}`);
    console.log(`   Status: ${application.status || application.Status || 'N/A'}`);
    console.log(`   Current AI Summary: ${(application.aiFileSummary || application['AI File Summary'] || '').substring(0, 50) || 'None'}...`);

    // Step 4: Generate summary
    const summaryResult = await generateSummary(application.id);
    
    console.log(`\n📊 Summary Result:`);
    console.log(`   Summary length: ${summaryResult.summary?.length || 0} characters`);
    console.log(`   Has structured data: ${!!summaryResult.structured}`);
    if (summaryResult.structured) {
      console.log(`   - Applicant Profile: ${summaryResult.structured.applicantProfile?.substring(0, 50) || 'N/A'}...`);
      console.log(`   - Loan Details: ${summaryResult.structured.loanDetails?.substring(0, 50) || 'N/A'}...`);
      console.log(`   - Strengths: ${summaryResult.structured.strengths?.length || 0} items`);
      console.log(`   - Risks: ${summaryResult.structured.risks?.length || 0} items`);
    }
    console.log(`\n   Full Summary Preview:`);
    console.log(`   ${(summaryResult.summary || '').substring(0, 300)}...`);

    // Step 5: Verify saved
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for Airtable sync
    const saved = await verifySummarySaved(application.id);

    // Step 6: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Test Summary');
    console.log('='.repeat(60));
    console.log(`✅ Login: Success`);
    console.log(`✅ Applications fetched: ${applications.length}`);
    console.log(`✅ Summary generated: ${summaryResult.summary ? 'Yes' : 'No'}`);
    console.log(`✅ Summary saved to Airtable: ${saved ? 'Yes' : 'No'}`);
    console.log(`✅ Summary length: ${summaryResult.summary?.length || 0} characters`);
    
    if (summaryResult.summary && saved) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
