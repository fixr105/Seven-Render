/**
 * Script to manage loan application status transitions and log them
 * 
 * This script:
 * 1. Updates loan application status via POST to /webhook/loanapplications
 * 2. Records status changes in Admin Activity Log via POST to /webhook/POSTLOG
 * 3. Validates status updates using GET requests
 * 
 * Usage: node backend/scripts/manage-loan-application-status.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_POST_LOAN_APPLICATIONS_URL = `${N8N_BASE_URL}/webhook/loanapplications`;
const N8N_POST_ADMIN_ACTIVITY_LOG_URL = `${N8N_BASE_URL}/webhook/POSTLOG`;
const N8N_GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const N8N_GET_ADMIN_ACTIVITY_LOG_URL = `${N8N_BASE_URL}/webhook/adminactivity`;

// Test status transitions
const statusTransitions = [
  {
    "File ID": "SF36220522BRY3QF", // APP-001
    "Previous Status": "New",
    "Updated Status": "Under KAM Review",
    "Updated By": "USER-1767430961949-q6p42lakm", // Jaishali (KAM)
    "Updated By Email": "Jaishali",
    "Remarks": "Documents received, forwarded to credit team",
    "Updated At": new Date().toISOString()
  },
  {
    "File ID": "SF36225402KBU7DF", // APP-002
    "Previous Status": "New",
    "Updated Status": "Under KAM Review",
    "Updated By": "USER-1767430961949-q6p42lakm", // Jaishali (KAM)
    "Updated By Email": "Jaishali",
    "Remarks": "Initial review completed, all documents verified",
    "Updated At": new Date().toISOString()
  },
  {
    "File ID": "SF36220522BRY3QF", // APP-001 - Second transition
    "Previous Status": "Under KAM Review",
    "Updated Status": "Under Credit Review",
    "Updated By": "credit@test.com", // Credit Team
    "Updated By Email": "credit@test.com",
    "Remarks": "KAM review passed, forwarded to credit team for assessment",
    "Updated At": new Date().toISOString()
  },
  {
    "File ID": "SF36220522BRY3QF", // APP-001 - Third transition
    "Previous Status": "Under Credit Review",
    "Updated Status": "Approved",
    "Updated By": "credit@test.com", // Credit Team
    "Updated By Email": "credit@test.com",
    "Remarks": "Credit assessment completed, application approved",
    "Updated At": new Date().toISOString()
  }
];

/**
 * Helper to get field value from record (handles different formats)
 */
function getField(record, fieldName) {
  if (record.fields && record.fields[fieldName] !== undefined) {
    return record.fields[fieldName];
  }
  if (record[fieldName] !== undefined) {
    return record[fieldName];
  }
  // Try case variations
  const lowerField = fieldName.toLowerCase();
  for (const key in record) {
    if (key.toLowerCase() === lowerField) {
      return record[key];
    }
  }
  if (record.fields) {
    for (const key in record.fields) {
      if (key.toLowerCase() === lowerField) {
        return record.fields[key];
      }
    }
  }
  return null;
}

/**
 * Fetch current loan application by File ID
 */
async function fetchLoanApplication(fileId) {
  try {
    const response = await fetch(N8N_GET_LOAN_APPLICATION_URL);
    
    if (!response.ok) {
      return null;
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      return null;
    }
    
    const records = Array.isArray(result) ? result : (result.records || [result] || []);
    return records.find(r => {
      const recordFileId = getField(r, 'File ID');
      return recordFileId === fileId;
    });
  } catch (error) {
    return null;
  }
}

/**
 * Update loan application status
 */
async function updateApplicationStatus(transition, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Status Transition ${index + 1}/${statusTransitions.length}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   File ID: ${transition['File ID']}`);
  console.log(`   Status: ${transition['Previous Status']} → ${transition['Updated Status']}`);
  console.log(`   Updated By: ${transition['Updated By Email']}`);
  console.log(`   Remarks: ${transition['Remarks']}`);
  
  // Step 1: Fetch current application
  console.log(`\n📥 Fetching current application...`);
  const currentApp = await fetchLoanApplication(transition['File ID']);
  
  if (!currentApp) {
    console.error(`   ❌ Application not found with File ID: ${transition['File ID']}`);
    return { success: false, error: 'Application not found' };
  }
  
  const currentStatus = getField(currentApp, 'Status');
  console.log(`   ✅ Found application. Current Status: ${currentStatus}`);
  
  if (currentStatus !== transition['Previous Status']) {
    console.warn(`   ⚠️  Status mismatch! Expected "${transition['Previous Status']}", but current is "${currentStatus}"`);
    console.warn(`   Proceeding anyway...`);
  }
  
  // Step 2: Update application status
  const recordId = currentApp.id || `APP-${Date.now()}`;
  const updateData = {
    id: recordId, // Use existing record ID for matching
    'File ID': transition['File ID'],
    'Client': getField(currentApp, 'Client') || '',
    'Applicant Name': getField(currentApp, 'Applicant Name') || '',
    'Loan Product': getField(currentApp, 'Loan Product') || '',
    'Requested Loan Amount': getField(currentApp, 'Requested Loan Amount') || '',
    'Documents': getField(currentApp, 'Documents') || '',
    'Status': transition['Updated Status'], // Update status
    'Assigned Credit Analyst': getField(currentApp, 'Assigned Credit Analyst') || '',
    'Assigned NBFC': getField(currentApp, 'Assigned NBFC') || '',
    'Lender Decision Status': getField(currentApp, 'Lender Decision Status') || '',
    'Lender Decision Date': getField(currentApp, 'Lender Decision Date') || '',
    'Lender Decision Remarks': getField(currentApp, 'Lender Decision Remarks') || '',
    'Approved Loan Amount': getField(currentApp, 'Approved Loan Amount') || '',
    'AI File Summary': getField(currentApp, 'AI File Summary') || '',
    'Form Data': getField(currentApp, 'Form Data') || '',
    'Creation Date': getField(currentApp, 'Creation Date') || '',
    'Submitted Date': getField(currentApp, 'Submitted Date') || '',
    'Last Updated': transition['Updated At'],
  };

  console.log(`\n📝 Updating application status...`);
  console.log(`   Request body:`, JSON.stringify(updateData, null, 2));
  
  try {
    const response = await fetch(N8N_POST_LOAN_APPLICATIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const result = await response.json();
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      console.error(`   ❌ Failed to update application status`);
      return { success: false, error: result };
    }
    
    console.log(`   ✅ Application status updated successfully`);
    
    // Step 3: Log to Admin Activity Log
    const activityLogId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const activityLogData = {
      id: activityLogId,
      'Activity ID': activityLogId,
      Timestamp: transition['Updated At'],
      'Performed By': transition['Updated By Email'],
      'Action Type': 'status_change',
      'Description/Details': `Status changed from ${transition['Previous Status']} to ${transition['Updated Status']}${transition['Remarks'] ? ': ' + transition['Remarks'] : ''}`,
      'Target Entity': 'loan_application',
      // Additional fields that might be needed
      'Reference Type': 'Loan Application',
      'Reference ID': transition['File ID'],
      'Previous Status': transition['Previous Status'],
      'Updated Status': transition['Updated Status'],
      'Remarks': transition['Remarks'] || '',
    };

    console.log(`\n📝 Logging status change to Admin Activity Log...`);
    console.log(`   Request body:`, JSON.stringify(activityLogData, null, 2));
    
    const logResponse = await fetch(N8N_POST_ADMIN_ACTIVITY_LOG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activityLogData),
    });

    const logResult = await logResponse.json();
    
    console.log(`   Response status: ${logResponse.status} ${logResponse.statusText}`);
    console.log(`   Response body:`, JSON.stringify(logResult, null, 2));
    
    if (logResponse.ok) {
      console.log(`   ✅ Status change logged successfully`);
      return { 
        success: true, 
        fileId: transition['File ID'],
        previousStatus: transition['Previous Status'],
        updatedStatus: transition['Updated Status'],
        result 
      };
    } else {
      console.error(`   ⚠️  Failed to log status change (but application was updated)`);
      return { 
        success: true, // Application update succeeded
        fileId: transition['File ID'],
        previousStatus: transition['Previous Status'],
        updatedStatus: transition['Updated Status'],
        logError: logResult 
      };
    }
  } catch (error) {
    console.error(`   ❌ Error updating application status:`, error.message);
    return { 
      success: false, 
      fileId: transition['File ID'],
      error: error.message 
    };
  }
}

/**
 * Validate status update by fetching application
 */
async function validateStatusUpdate(fileId, expectedStatus) {
  console.log(`\n🔍 Validating status update for File ID: ${fileId}...`);
  
  const app = await fetchLoanApplication(fileId);
  
  if (!app) {
    console.log(`   ❌ Application not found`);
    return { valid: false, error: 'Not found' };
  }
  
  const currentStatus = getField(app, 'Status');
  const lastUpdated = getField(app, 'Last Updated');
  
  console.log(`   Current Status: ${currentStatus}`);
  console.log(`   Expected Status: ${expectedStatus}`);
  console.log(`   Last Updated: ${lastUpdated}`);
  
  if (currentStatus === expectedStatus) {
    console.log(`   ✅ Status update validated successfully`);
    return { valid: true, status: currentStatus, lastUpdated };
  } else {
    console.log(`   ❌ Status mismatch! Expected "${expectedStatus}", got "${currentStatus}"`);
    return { valid: false, expected: expectedStatus, actual: currentStatus };
  }
}

/**
 * Fetch Admin Activity Log entries for a reference
 */
async function fetchActivityLogs(referenceId, updatedStatus = null) {
  console.log(`\n🔍 Fetching Admin Activity Log entries...`);
  if (referenceId) {
    console.log(`   Reference ID: ${referenceId}`);
  }
  if (updatedStatus) {
    console.log(`   Filter by Status: ${updatedStatus}`);
  }
  
  try {
    // Fetch all logs (webhook might not support query params, so we'll filter client-side)
    const url = N8N_GET_ADMIN_ACTIVITY_LOG_URL;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ Failed to fetch: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        console.log(`   ℹ️  Webhook might not support query parameters. Fetching all logs and filtering client-side...`);
      }
      return { count: 0, error: `HTTP ${response.status}` };
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log(`   ⚠️  Empty response from webhook`);
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
    
    console.log(`   📊 Total log entries fetched: ${records.length}`);
    
    // Filter by reference if needed (webhook doesn't support query params, so filter client-side)
    let filteredRecords = records;
    if (referenceId) {
      filteredRecords = records.filter(r => {
        const refId = getField(r, 'Reference ID') || getField(r, 'Related File ID') || getField(r, 'Related File');
        return refId === referenceId;
      });
      console.log(`   🔍 Filtered by Reference ID "${referenceId}": ${filteredRecords.length} entries`);
    }
    if (updatedStatus) {
      const beforeFilter = filteredRecords.length;
      filteredRecords = filteredRecords.filter(r => {
        const status = getField(r, 'Updated Status') || getField(r, 'Status');
        const description = getField(r, 'Description/Details') || getField(r, 'Description') || '';
        // Also check description for status mentions
        return status === updatedStatus || description.includes(`to ${updatedStatus}`);
      });
      console.log(`   🔍 Filtered by Status "${updatedStatus}": ${filteredRecords.length} entries (from ${beforeFilter})`);
    }
    
    console.log(`   ✅ Found ${filteredRecords.length} log entry/entries`);
    
    if (filteredRecords.length > 0) {
      filteredRecords.slice(0, 10).forEach((record, idx) => { // Show first 10 entries
        console.log(`\n   Entry ${idx + 1}:`);
        console.log(`      Activity ID: ${getField(record, 'Activity ID') || 'N/A'}`);
        console.log(`      Timestamp: ${getField(record, 'Timestamp') || 'N/A'}`);
        console.log(`      Performed By: ${getField(record, 'Performed By') || 'N/A'}`);
        console.log(`      Action Type: ${getField(record, 'Action Type') || 'N/A'}`);
        console.log(`      Description: ${(getField(record, 'Description/Details') || getField(record, 'Description') || 'N/A').substring(0, 100)}${(getField(record, 'Description/Details') || getField(record, 'Description') || '').length > 100 ? '...' : ''}`);
        const prevStatus = getField(record, 'Previous Status');
        const updatedStatus = getField(record, 'Updated Status');
        if (prevStatus || updatedStatus) {
          console.log(`      Status Change: ${prevStatus || 'N/A'} → ${updatedStatus || 'N/A'}`);
        }
      });
      if (filteredRecords.length > 10) {
        console.log(`\n   ... and ${filteredRecords.length - 10} more entries`);
      }
    } else {
      console.log(`   ⚠️  No matching log entries found`);
    }
    
    return { count: filteredRecords.length, records: filteredRecords };
  } catch (error) {
    console.error(`   ❌ Error fetching activity logs:`, error.message);
    return { count: 0, error: error.message };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting loan application status management script...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);
  console.log(`📋 Status transitions to process: ${statusTransitions.length}\n`);
  
  const results = {
    successful: [],
    failed: [],
  };

  // Step 1: Process status transitions
  console.log(`${'='.repeat(60)}`);
  console.log('STATUS TRANSITION PHASE');
  console.log(`${'='.repeat(60)}\n`);
  
  for (let i = 0; i < statusTransitions.length; i++) {
    const transition = statusTransitions[i];
    const result = await updateApplicationStatus(transition, i);
    
    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }
    
    // Rate limiting: Wait 1 second between requests (except for the last one)
    if (i < statusTransitions.length - 1) {
      console.log(`\n   ⏳ Waiting 1 second before next transition...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Step 2: Validate status updates
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('VALIDATION PHASE');
  console.log(`${'='.repeat(60)}\n`);
  
  const validationResults = {
    validated: [],
    failed: [],
  };

  // Validate each successful transition
  // Group by fileId to get the final status for each file
  const finalStatuses = {};
  for (const result of results.successful) {
    finalStatuses[result.fileId] = result.updatedStatus;
  }
  
  // Validate final status for each unique file
  for (const [fileId, finalStatus] of Object.entries(finalStatuses)) {
    const validation = await validateStatusUpdate(fileId, finalStatus);
    const result = results.successful.find(r => r.fileId === fileId && r.updatedStatus === finalStatus);
    if (validation.valid) {
      validationResults.validated.push(result);
    } else {
      validationResults.failed.push({ ...result, validation });
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 3: Fetch activity logs for one application
  const testFileId = statusTransitions[0]['File ID'];
  await fetchActivityLogs(testFileId);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Fetch logs filtered by status
  await fetchActivityLogs(null, 'Approved');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 4: Print summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`✅ Successfully processed: ${results.successful.length} status transitions`);
  results.successful.forEach(r => {
    console.log(`   - ${r.fileId}: ${r.previousStatus} → ${r.updatedStatus}`);
  });
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed to process: ${results.failed.length} status transitions`);
    results.failed.forEach(r => {
      console.log(`   - ${r.fileId || 'Unknown'}`);
      if (r.error) {
        console.log(`     Error: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`);
      }
    });
  }
  
  console.log(`\n🔍 Validation Results:`);
  console.log(`   ✅ Validated: ${validationResults.validated.length} transitions`);
  if (validationResults.failed.length > 0) {
    console.log(`   ❌ Validation failed: ${validationResults.failed.length} transitions`);
    validationResults.failed.forEach(r => {
      console.log(`      - ${r.fileId}: Expected "${r.validation.expected}", got "${r.validation.actual}"`);
    });
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
  
  // Exit with appropriate code
  if (results.failed.length > 0 || validationResults.failed.length > 0) {
    console.log('⚠️  Some operations failed. Please check the logs above.');
    process.exit(1);
  } else {
    console.log('✅ All status transitions processed and validated successfully!');
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

