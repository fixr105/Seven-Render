/**
 * Script to auto-create Commission Ledger entries on Loan Approval/Disbursement
 * 
 * This script:
 * 1. Fetches Admin Activity Log entries with status "Approved" or "Disbursed"
 * 2. For each matching entry, extracts loan application details
 * 3. Calculates commission (1.5% default, or from client's Commission Rate)
 * 4. POSTs to Commission Ledger
 * 5. Optionally logs the commission trigger to Admin Activity Log
 * 
 * Usage: node backend/scripts/auto-create-commission-ledger.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
// Note: If your n8n webhook path is different, update this URL
// Try both paths: adminactivity (standard) and adminactivitylog (if configured differently)
const N8N_GET_ADMIN_ACTIVITY_LOG_URL = `${N8N_BASE_URL}/webhook/adminactivitylog`;
const N8N_GET_ADMIN_ACTIVITY_LOG_URL_ALT = `${N8N_BASE_URL}/webhook/adminactivity`;
const N8N_GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const N8N_GET_CLIENTS_URL = `${N8N_BASE_URL}/webhook/client`;
const N8N_POST_COMMISSION_LEDGER_URL = `${N8N_BASE_URL}/webhook/commisionledger`;
const N8N_POST_ADMIN_ACTIVITY_LOG_URL = `${N8N_BASE_URL}/webhook/POSTLOG`;

// Default commission rate (1.5%)
const DEFAULT_COMMISSION_RATE = 1.5;

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
 * Fetch all Admin Activity Log entries
 * Note: The GET endpoint may not support query parameters, so we filter client-side
 */
async function fetchAdminActivityLogs() {
  try {
    console.log(`\n📋 Fetching Admin Activity Log entries...`);
    let response = await fetch(N8N_GET_ADMIN_ACTIVITY_LOG_URL);
    
    // Try alternate path if first one fails
    if (!response.ok && response.status === 404) {
      console.log(`   ⚠️  Primary endpoint returned 404, trying alternate path...`);
      response = await fetch(N8N_GET_ADMIN_ACTIVITY_LOG_URL_ALT);
    }
    
    if (!response.ok) {
      console.error(`   ❌ Failed to fetch Admin Activity Log: ${response.status} ${response.statusText}`);
      console.error(`   💡 Make sure the Admin Activity Log GET webhook is configured in n8n`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log(`   ⚠️  Empty response from Admin Activity Log webhook`);
      return [];
    }
    
    let logs;
    try {
      logs = JSON.parse(text);
    } catch (e) {
      console.error(`   ❌ Failed to parse Admin Activity Log response:`, e.message);
      console.error(`   Response text:`, text.substring(0, 200));
      return [];
    }
    
    // Handle both array and object with records array
    if (!Array.isArray(logs)) {
      if (logs.records && Array.isArray(logs.records)) {
        logs = logs.records;
      } else {
        console.error(`   ❌ Unexpected Admin Activity Log response format`);
        return [];
      }
    }
    
    console.log(`   ✅ Fetched ${logs.length} Admin Activity Log entries`);
    return logs;
  } catch (error) {
    console.error(`   ❌ Error fetching Admin Activity Log:`, error.message);
    return [];
  }
}

/**
 * Filter Admin Activity Log entries by status
 */
function filterByStatus(logs, statuses) {
  return logs.filter(log => {
    const updatedStatus = getField(log, 'Updated Status');
    return updatedStatus && statuses.includes(updatedStatus);
  });
}

/**
 * Fetch loan application by File ID
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
    
    let applications;
    try {
      applications = JSON.parse(text);
    } catch (e) {
      return null;
    }
    
    // Handle both array and object with records array
    if (!Array.isArray(applications)) {
      if (applications.records && Array.isArray(applications.records)) {
        applications = applications.records;
      } else {
        return null;
      }
    }
    
    // Find application by File ID
    return applications.find(app => {
      const appFileId = getField(app, 'File ID') || getField(app, 'Application ID');
      return appFileId === fileId;
    }) || null;
  } catch (error) {
    console.error(`   ❌ Error fetching loan application:`, error.message);
    return null;
  }
}

/**
 * Fetch all clients to get commission rates
 */
async function fetchClients() {
  try {
    const response = await fetch(N8N_GET_CLIENTS_URL);
    
    if (!response.ok) {
      console.warn(`   ⚠️  Failed to fetch clients, will use default commission rate`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }
    
    let clients;
    try {
      clients = JSON.parse(text);
    } catch (e) {
      return [];
    }
    
    // Handle both array and object with records array
    if (!Array.isArray(clients)) {
      if (clients.records && Array.isArray(clients.records)) {
        clients = clients.records;
      } else {
        return [];
      }
    }
    
    return clients;
  } catch (error) {
    console.warn(`   ⚠️  Error fetching clients:`, error.message);
    return [];
  }
}

/**
 * Get commission rate for a client
 */
function getCommissionRate(clientId, clients) {
  const client = clients.find(c => {
    const cId = getField(c, 'Client ID') || getField(c, 'id');
    return cId === clientId;
  });
  
  if (client) {
    const rateStr = getField(client, 'Commission Rate');
    if (rateStr) {
      const rate = parseFloat(rateStr.toString().trim());
      if (!isNaN(rate)) {
        return rate;
      }
    }
  }
  
  return DEFAULT_COMMISSION_RATE;
}

/**
 * Check if commission ledger entry already exists for a loan application
 */
async function checkExistingCommissionEntry(loanFileId) {
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/commissionledger`);
    
    if (!response.ok) {
      return false; // Assume no entry exists if we can't check
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return false;
    }
    
    let entries;
    try {
      entries = JSON.parse(text);
    } catch (e) {
      return false;
    }
    
    // Handle both array and object with records array
    if (!Array.isArray(entries)) {
      if (entries.records && Array.isArray(entries.records)) {
        entries = entries.records;
      } else {
        return false;
      }
    }
    
    // Check if entry exists for this loan file
    return entries.some(entry => {
      const entryLoanFile = getField(entry, 'Loan File');
      return entryLoanFile === loanFileId;
    });
  } catch (error) {
    return false; // Assume no entry exists if we can't check
  }
}

/**
 * Create commission ledger entry for a loan application
 */
async function createCommissionEntry(activityLog, loanApp, clients) {
  try {
    const referenceId = getField(activityLog, 'Reference ID') || getField(activityLog, 'Reference ID');
    const fileId = getField(loanApp, 'File ID') || getField(loanApp, 'Application ID');
    const clientId = getField(loanApp, 'Client') || getField(loanApp, 'Client ID');
    const loanProductId = getField(loanApp, 'Loan Product') || getField(loanApp, 'Loan Product ID');
    const kamId = getField(loanApp, 'KAM Assigned') || getField(loanApp, 'KAM ID');
    
    // Get loan amount - try multiple field names
    let loanAmount = getField(loanApp, 'Loan Amount Requested') || 
                     getField(loanApp, 'Loan Amount') || 
                     getField(loanApp, 'Disbursed Amount') ||
                     getField(loanApp, 'Amount');
    
    if (!loanAmount) {
      console.error(`   ❌ Loan amount not found for application ${fileId}`);
      return { success: false, error: 'Loan amount not found' };
    }
    
    // Convert to number
    loanAmount = parseFloat(loanAmount.toString().replace(/[^\d.-]/g, ''));
    if (isNaN(loanAmount) || loanAmount <= 0) {
      console.error(`   ❌ Invalid loan amount: ${loanAmount}`);
      return { success: false, error: 'Invalid loan amount' };
    }
    
    // Get commission rate
    const commissionRate = getCommissionRate(clientId, clients);
    
    // Calculate commission
    const commissionAmount = (loanAmount * commissionRate) / 100;
    
    // Determine entry type (Payout if positive, Payin if negative)
    const entryType = commissionAmount >= 0 ? 'Payout' : 'Payin';
    const payoutAmount = commissionAmount >= 0 ? commissionAmount : -Math.abs(commissionAmount);
    
    // Check if entry already exists
    const exists = await checkExistingCommissionEntry(fileId);
    if (exists) {
      console.log(`   ⚠️  Commission ledger entry already exists for ${fileId}, skipping...`);
      return { success: false, error: 'Entry already exists', skipped: true };
    }
    
    // Create ledger entry ID
    const ledgerEntryId = `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get date from activity log or use current date
    const updatedAt = getField(activityLog, 'Updated At') || 
                      getField(activityLog, 'Timestamp') || 
                      new Date().toISOString();
    const entryDate = updatedAt.split('T')[0]; // Extract date part
    
    // Create commission ledger entry
    const ledgerEntry = {
      id: ledgerEntryId,
      'Ledger Entry ID': ledgerEntryId,
      'Client': clientId,
      'Loan File': fileId,
      'Date': entryDate,
      'Disbursed Amount': loanAmount.toString(),
      'Commission Rate': commissionRate.toString(),
      'Payout Amount': payoutAmount.toString(),
      'Description': `${entryType} for loan ${fileId} - Commission: ${commissionRate}% of ₹${loanAmount.toLocaleString('en-IN')}`,
      'Dispute Status': 'None',
      'Payout Request': 'False',
    };
    
    console.log(`\n💰 Creating commission ledger entry...`);
    console.log(`   Ledger Entry ID: ${ledgerEntryId}`);
    console.log(`   Loan File: ${fileId}`);
    console.log(`   Client: ${clientId}`);
    console.log(`   Loan Amount: ₹${loanAmount.toLocaleString('en-IN')}`);
    console.log(`   Commission Rate: ${commissionRate}%`);
    console.log(`   Commission Amount: ₹${commissionAmount.toLocaleString('en-IN')}`);
    console.log(`   Entry Type: ${entryType}`);
    console.log(`   Payout Amount: ₹${payoutAmount.toLocaleString('en-IN')}`);
    console.log(`   Request body:`, JSON.stringify(ledgerEntry, null, 2));
    
    const response = await fetch(N8N_POST_COMMISSION_LEDGER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ledgerEntry),
    });
    
    const result = await response.json();
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`   ✅ Commission ledger entry created successfully`);
      
      // Optionally log commission trigger to Admin Activity Log
      const activityLogId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const commissionLogData = {
        id: activityLogId,
        'Activity ID': activityLogId,
        'Timestamp': new Date().toISOString(),
        'Performed By': 'System',
        'Action Type': 'commission_trigger',
        'Description/Details': `Auto-generated commission ledger entry (${entryType}) for loan ${fileId}: ₹${commissionAmount.toLocaleString('en-IN')} at ${commissionRate}%`,
        'Target Entity': 'commission_ledger',
        'Reference Type': 'Commission Trigger',
        'Reference ID': ledgerEntryId,
        'Remarks': `Auto-generated on loan ${getField(activityLog, 'Updated Status').toLowerCase()}`,
      };
      
      // Log commission trigger (non-blocking)
      fetch(N8N_POST_ADMIN_ACTIVITY_LOG_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commissionLogData),
      }).catch(err => {
        console.warn(`   ⚠️  Failed to log commission trigger:`, err.message);
      });
      
      return {
        success: true,
        ledgerEntryId,
        loanFileId: fileId,
        clientId,
        loanAmount,
        commissionRate,
        commissionAmount,
        payoutAmount,
        entryType,
      };
    } else {
      console.error(`   ❌ Failed to create commission ledger entry`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error(`   ❌ Error creating commission entry:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Auto-Create Commission Ledger Script');
  console.log('=====================================\n');
  
  // Step 1: Fetch Admin Activity Log entries
  const allLogs = await fetchAdminActivityLogs();
  
  if (allLogs.length === 0) {
    console.log('⚠️  No Admin Activity Log entries found. Exiting.');
    return;
  }
  
  // Step 2: Filter by status "Approved" or "Disbursed"
  const triggerStatuses = ['Approved', 'Disbursed'];
  const matchingLogs = filterByStatus(allLogs, triggerStatuses);
  
  console.log(`\n📊 Found ${matchingLogs.length} activity log entries with status: ${triggerStatuses.join(' or ')}`);
  
  if (matchingLogs.length === 0) {
    console.log('⚠️  No matching activity log entries found. Exiting.');
    return;
  }
  
  // Step 3: Fetch clients for commission rates
  console.log(`\n👥 Fetching clients for commission rates...`);
  const clients = await fetchClients();
  console.log(`   ✅ Fetched ${clients.length} clients`);
  
  // Step 4: Process each matching activity log entry
  const results = [];
  
  for (let i = 0; i < matchingLogs.length; i++) {
    const log = matchingLogs[i];
    const referenceId = getField(log, 'Reference ID');
    const updatedStatus = getField(log, 'Updated Status');
    const updatedAt = getField(log, 'Updated At') || getField(log, 'Timestamp');
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing entry ${i + 1}/${matchingLogs.length}`);
    console.log(`Reference ID: ${referenceId}`);
    console.log(`Updated Status: ${updatedStatus}`);
    console.log(`Updated At: ${updatedAt}`);
    
    if (!referenceId) {
      console.log(`   ⚠️  Skipping: No Reference ID found`);
      results.push({ success: false, error: 'No Reference ID', log });
      continue;
    }
    
    // Step 5: Fetch loan application details
    console.log(`\n📄 Fetching loan application: ${referenceId}...`);
    const loanApp = await fetchLoanApplication(referenceId);
    
    if (!loanApp) {
      console.log(`   ❌ Loan application not found`);
      results.push({ success: false, error: 'Loan application not found', referenceId });
      continue;
    }
    
    const fileId = getField(loanApp, 'File ID') || getField(loanApp, 'Application ID');
    const clientId = getField(loanApp, 'Client') || getField(loanApp, 'Client ID');
    
    console.log(`   ✅ Found loan application: ${fileId}`);
    console.log(`   Client ID: ${clientId}`);
    
    // Step 6: Create commission ledger entry
    const result = await createCommissionEntry(log, loanApp, clients);
    results.push({ ...result, referenceId, fileId, clientId });
    
    // Rate limiting: wait 1 second between requests
    if (i < matchingLogs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Step 7: Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success && !r.skipped);
  const skipped = results.filter(r => r.skipped);
  
  console.log(`\n✅ Successful: ${successful.length}`);
  successful.forEach(r => {
    console.log(`   - ${r.fileId}: ₹${r.commissionAmount?.toLocaleString('en-IN')} (${r.entryType})`);
  });
  
  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped (already exists): ${skipped.length}`);
    skipped.forEach(r => {
      console.log(`   - ${r.fileId || r.referenceId}`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.fileId || r.referenceId}: ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log(`\n✨ Script completed!\n`);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

