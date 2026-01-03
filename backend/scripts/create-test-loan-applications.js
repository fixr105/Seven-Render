/**
 * Script to create and validate test loan applications
 * 
 * This script:
 * 1. Creates loan applications via POST to /webhook/loanapplications
 * 2. Validates creation using GET requests
 * 3. Tests different combinations of Clients & Products
 * 
 * Usage: node backend/scripts/create-test-loan-applications.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_POST_LOAN_APPLICATIONS_URL = `${N8N_BASE_URL}/webhook/loanapplications`;
const N8N_GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;

// Test loan applications to create
const testApplications = [
  {
    "Application ID": "APP-001",
    "Client ID": "CL001",
    "Loan Product ID": "LP009",
    "KAM Assigned": "USER-1767430961949-q6p42lakm", // Jaishali's user ID from earlier
    "Loan Amount Requested": 500000,
    "Tenure (months)": 24,
    "Interest Rate (%)": 15.0,
    "Status": "New",
    "Submitted By": "Test Client",
    "Submission Date": "2026-01-03",
    "Notes": "Test application for RBF-EV"
  },
  {
    "Application ID": "APP-002",
    "Client ID": "CL002",
    "Loan Product ID": "LP010",
    "KAM Assigned": "USER-1767430961949-q6p42lakm",
    "Loan Amount Requested": 750000,
    "Tenure (months)": 36,
    "Interest Rate (%)": 14.5,
    "Status": "New",
    "Submitted By": "Test Client",
    "Submission Date": "2026-01-03",
    "Notes": "Test application for Revenue Based Finance"
  },
  {
    "Application ID": "APP-003",
    "Client ID": "CL003",
    "Loan Product ID": "LP011",
    "KAM Assigned": "USER-1767430961949-q6p42lakm",
    "Loan Amount Requested": 1000000,
    "Tenure (months)": 48,
    "Interest Rate (%)": 16.0,
    "Status": "New",
    "Submitted By": "Test Client",
    "Submission Date": "2026-01-03",
    "Notes": "Test application for MoneyMultiplier"
  },
  {
    "Application ID": "APP-004",
    "Client ID": "CL004",
    "Loan Product ID": "LP012",
    "KAM Assigned": "USER-1767430961949-q6p42lakm",
    "Loan Amount Requested": 5000000,
    "Tenure (months)": 240,
    "Interest Rate (%)": 8.5,
    "Status": "New",
    "Submitted By": "Test Client",
    "Submission Date": "2026-01-03",
    "Notes": "Test application for Home Loan"
  }
];

/**
 * Generate File ID from Application ID
 */
function generateFileId(applicationId) {
  // Format: SF + timestamp + random
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `SF${timestamp.toString().slice(-8)}${random}`;
}

/**
 * Create a loan application
 */
async function createLoanApplication(app, index) {
  const recordId = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const fileId = generateFileId(app['Application ID']);
  
  // Prepare data with exact field names as required by n8n webhook
  const applicationData = {
    id: recordId, // for matching
    'File ID': fileId,
    'Client': app['Client ID'],
    'Applicant Name': app['Submitted By'] || 'Test Applicant',
    'Loan Product': app['Loan Product ID'],
    'Requested Loan Amount': String(app['Loan Amount Requested'] || ''),
    'Documents': '', // Can be populated later
    'Status': app['Status'] || 'New',
    'Assigned Credit Analyst': '', // Will be assigned later
    'Assigned NBFC': '', // Will be assigned later
    'Lender Decision Status': '',
    'Lender Decision Date': '',
    'Lender Decision Remarks': '',
    'Approved Loan Amount': '',
    'AI File Summary': '',
    'Form Data': JSON.stringify({
      'Tenure (months)': app['Tenure (months)'],
      'Interest Rate (%)': app['Interest Rate (%)'],
      'Notes': app['Notes'],
    }),
    'Creation Date': app['Submission Date'] || new Date().toISOString().split('T')[0],
    'Submitted Date': app['Submission Date'] || new Date().toISOString().split('T')[0],
    'Last Updated': new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating Loan Application ${index + 1}/${testApplications.length}: ${app['Application ID']}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Application ID: ${app['Application ID']}`);
  console.log(`   File ID: ${fileId}`);
  console.log(`   Client ID: ${app['Client ID']}`);
  console.log(`   Loan Product ID: ${app['Loan Product ID']}`);
  console.log(`   Loan Amount: ₹${app['Loan Amount Requested'].toLocaleString('en-IN')}`);
  console.log(`   Status: ${app['Status']}`);
  console.log(`   Submitted By: ${app['Submitted By']}`);
  console.log(`\n   Request body:`, JSON.stringify(applicationData, null, 2));
  
  try {
    const response = await fetch(N8N_POST_LOAN_APPLICATIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(applicationData),
    });

    const result = await response.json();
    
    console.log(`\n   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`\n   ✅ Successfully created Loan Application: ${app['Application ID']}`);
      return { 
        success: true, 
        applicationId: app['Application ID'],
        fileId: fileId,
        clientId: app['Client ID'],
        productId: app['Loan Product ID'],
        status: app['Status'],
        result 
      };
    } else {
      console.error(`\n   ❌ Failed to create Loan Application: ${app['Application ID']}`);
      console.error(`   Error: ${JSON.stringify(result, null, 2)}`);
      return { 
        success: false, 
        applicationId: app['Application ID'],
        fileId: fileId,
        error: result 
      };
    }
  } catch (error) {
    console.error(`\n   ❌ Error creating Loan Application: ${app['Application ID']}`, error.message);
    return { 
      success: false, 
      applicationId: app['Application ID'],
      fileId: fileId,
      error: error.message 
    };
  }
}

/**
 * Validate application creation via GET
 */
async function validateApplication(application) {
  console.log(`\n🔍 Validating application: ${application.applicationId}...`);
  
  try {
    // Try to get all applications and filter
    const response = await fetch(N8N_GET_LOAN_APPLICATION_URL);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ Failed to fetch: ${response.status} ${response.statusText}`);
      console.error(`   Response:`, text);
      return { found: false, error: `HTTP ${response.status}` };
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log(`   ⚠️  Empty response from webhook`);
      return { found: false, error: 'Empty response' };
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error(`   ❌ Failed to parse JSON:`, parseError.message);
      return { found: false, error: 'Parse error' };
    }
    
    const records = Array.isArray(result) ? result : (result.records || [result] || []);
    
    // Helper to get field value
    const getField = (record, fieldName) => {
      if (record.fields && record.fields[fieldName] !== undefined) return record.fields[fieldName];
      if (record[fieldName] !== undefined) return record[fieldName];
      return null;
    };
    
    // Find application by File ID
    const foundApp = records.find(r => {
      const fileId = getField(r, 'File ID');
      return fileId === application.fileId;
    });
    
    if (foundApp) {
      console.log(`   ✅ Found application with File ID: ${application.fileId}`);
      console.log(`   Client: ${getField(foundApp, 'Client')}`);
      console.log(`   Loan Product: ${getField(foundApp, 'Loan Product')}`);
      console.log(`   Status: ${getField(foundApp, 'Status')}`);
      console.log(`   Requested Amount: ${getField(foundApp, 'Requested Loan Amount')}`);
      return { found: true, application: foundApp };
    } else {
      console.log(`   ⚠️  Application not found with File ID: ${application.fileId}`);
      console.log(`   Total applications in system: ${records.length}`);
      return { found: false };
    }
  } catch (error) {
    console.error(`   ❌ Error validating:`, error.message);
    return { found: false, error: error.message };
  }
}

/**
 * Validate by Client ID filter
 */
async function validateByClientId(clientId) {
  console.log(`\n🔍 Validating applications for Client: ${clientId}...`);
  
  try {
    const url = `${N8N_GET_LOAN_APPLICATION_URL}?client_id=${clientId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`   ❌ Failed to fetch: ${response.status} ${response.statusText}`);
      return { count: 0, error: `HTTP ${response.status}` };
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return { count: 0 };
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error(`   ❌ Failed to parse JSON:`, parseError.message);
      return { count: 0, error: 'Parse error' };
    }
    
    const records = Array.isArray(result) ? result : (result.records || [result] || []);
    console.log(`   ✅ Found ${records.length} application(s) for Client ${clientId}`);
    
    return { count: records.length, records };
  } catch (error) {
    console.error(`   ❌ Error validating by client:`, error.message);
    return { count: 0, error: error.message };
  }
}

/**
 * Validate by Status filter
 */
async function validateByStatus(status) {
  console.log(`\n🔍 Validating applications with Status: ${status}...`);
  
  try {
    const url = `${N8N_GET_LOAN_APPLICATION_URL}?status=${status}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`   ❌ Failed to fetch: ${response.status} ${response.statusText}`);
      return { count: 0, error: `HTTP ${response.status}` };
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return { count: 0 };
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error(`   ❌ Failed to parse JSON:`, parseError.message);
      return { count: 0, error: 'Parse error' };
    }
    
    const records = Array.isArray(result) ? result : (result.records || [result] || []);
    console.log(`   ✅ Found ${records.length} application(s) with Status "${status}"`);
    
    return { count: records.length, records };
  } catch (error) {
    console.error(`   ❌ Error validating by status:`, error.message);
    return { count: 0, error: error.message };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting loan application creation and validation script...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);
  console.log(`📋 Loan Applications to create: ${testApplications.length}\n`);
  
  const results = {
    successful: [],
    failed: [],
  };

  // Step 1: Create loan applications
  console.log(`${'='.repeat(60)}`);
  console.log('CREATION PHASE');
  console.log(`${'='.repeat(60)}\n`);
  
  for (let i = 0; i < testApplications.length; i++) {
    const app = testApplications[i];
    const result = await createLoanApplication(app, i);
    
    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }
    
    // Rate limiting: Wait 1 second between requests (except for the last one)
    if (i < testApplications.length - 1) {
      console.log(`\n   ⏳ Waiting 1 second before next request...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Step 2: Validate applications
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('VALIDATION PHASE');
  console.log(`${'='.repeat(60)}\n`);
  
  const validationResults = {
    validated: [],
    notFound: [],
  };

  // Validate each created application
  for (const app of results.successful) {
    const validation = await validateApplication(app);
    if (validation.found) {
      validationResults.validated.push(app);
    } else {
      validationResults.notFound.push(app);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Validate by Client ID
  const uniqueClientIds = [...new Set(results.successful.map(a => a.clientId))];
  for (const clientId of uniqueClientIds) {
    await validateByClientId(clientId);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Validate by Status
  await validateByStatus('New');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 3: Print summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`✅ Successfully created: ${results.successful.length} loan applications`);
  results.successful.forEach(r => {
    console.log(`   - ${r.applicationId} (File ID: ${r.fileId})`);
    console.log(`     Client: ${r.clientId}, Product: ${r.productId}, Status: ${r.status}`);
  });
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed to create: ${results.failed.length} loan applications`);
    results.failed.forEach(r => {
      console.log(`   - ${r.applicationId}`);
      if (r.error) {
        console.log(`     Error: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`);
      }
    });
  }
  
  console.log(`\n🔍 Validation Results:`);
  console.log(`   ✅ Validated: ${validationResults.validated.length} applications`);
  if (validationResults.notFound.length > 0) {
    console.log(`   ⚠️  Not found: ${validationResults.notFound.length} applications`);
    validationResults.notFound.forEach(r => {
      console.log(`      - ${r.applicationId} (File ID: ${r.fileId})`);
    });
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
  
  // Exit with appropriate code
  if (results.failed.length > 0 || validationResults.notFound.length > 0) {
    console.log('⚠️  Some operations failed or could not be validated. Please check the logs above.');
    process.exit(1);
  } else {
    console.log('✅ All loan applications created and validated successfully!');
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

