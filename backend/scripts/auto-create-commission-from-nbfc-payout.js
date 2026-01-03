/**
 * Script to auto-create Commission Ledger entries based on NBFC Payout rates
 * 
 * This script:
 * 1. Loads Commission Payout Table from Excel file (WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx)
 * 2. Monitors Admin Activity Log for "Approved" or "Disbursed" status
 * 3. For each matching entry, fetches loan details
 * 4. Looks up payout rate from Excel based on NBFC Partner
 * 5. Calculates commission as 50% of payout rate
 * 6. POSTs to Commission Ledger
 * 
 * Usage: 
 *   node backend/scripts/auto-create-commission-from-nbfc-payout.js [path/to/PAYOUT-1.xlsx]
 * 
 * If no path is provided, it will look for the file in:
 *   - backend/data/WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx
 *   - ./WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_GET_ADMIN_ACTIVITY_LOG_URL = `${N8N_BASE_URL}/webhook/adminactivitylog`;
const N8N_GET_ADMIN_ACTIVITY_LOG_URL_ALT = `${N8N_BASE_URL}/webhook/adminactivity`;
const N8N_GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const N8N_GET_CLIENTS_URL = `${N8N_BASE_URL}/webhook/client`;
const N8N_GET_NBFC_PARTNERS_URL = `${N8N_BASE_URL}/webhook/nbfcpartners`;
const N8N_POST_COMMISSION_LEDGER_URL = `${N8N_BASE_URL}/webhook/commisionledger`;
const N8N_POST_ADMIN_ACTIVITY_LOG_URL = `${N8N_BASE_URL}/webhook/POSTLOG`;

// Default commission rate if NBFC not found (0.5%)
const DEFAULT_COMMISSION_RATE = 0.5;

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
 * Normalize NBFC name for matching (remove extra spaces, convert to lowercase, etc.)
 */
function normalizeNBFCName(name) {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/\./g, ''); // Remove dots
}

/**
 * Fuzzy match NBFC names
 */
function fuzzyMatchNBFC(excelName, systemName) {
  const normalizedExcel = normalizeNBFCName(excelName);
  const normalizedSystem = normalizeNBFCName(systemName);
  
  // Exact match after normalization
  if (normalizedExcel === normalizedSystem) {
    return true;
  }
  
  // Check if one contains the other (for variations like "RU Loans FSPL" vs "RuLoans FSPL")
  if (normalizedExcel.includes(normalizedSystem) || normalizedSystem.includes(normalizedExcel)) {
    return true;
  }
  
  // Check for common variations
  const excelWords = normalizedExcel.split(' ');
  const systemWords = normalizedSystem.split(' ');
  
  // If at least 2 words match, consider it a match
  const matchingWords = excelWords.filter(word => 
    systemWords.some(sysWord => sysWord.includes(word) || word.includes(sysWord))
  );
  
  return matchingWords.length >= 2;
}

/**
 * Load Commission Payout Table from Excel file
 * 
 * Expected format:
 * - Column A: NBFC Name (e.g., "RU Loans FSPL")
 * - Column C: Payout Rate (e.g., 0.0200 = 2%)
 */
function loadPayoutTable(excelPath) {
  try {
    console.log(`\n📊 Loading Commission Payout Table from: ${excelPath}`);
    
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length === 0) {
      throw new Error('Excel file is empty');
    }
    
    // Find header row (look for "NBFC Name" or similar in first row)
    let headerRow = 0;
    const firstRow = data[0] || [];
    const hasHeader = firstRow.some(cell => 
      cell && cell.toString().toLowerCase().includes('nbfc')
    );
    
    if (!hasHeader && data.length > 1) {
      headerRow = 0; // Assume first row is header
    }
    
    // Extract data (Column A = index 0, Column C = index 2)
    const payoutMap = new Map();
    
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 3) continue;
      
      const nbfcName = row[0]?.toString().trim(); // Column A
      const payoutRate = row[2]; // Column C
      
      if (!nbfcName) continue;
      
      // Parse payout rate
      let rate = null;
      if (typeof payoutRate === 'number') {
        rate = payoutRate;
      } else if (typeof payoutRate === 'string') {
        rate = parseFloat(payoutRate.trim());
      }
      
      if (isNaN(rate) || rate < 0) {
        console.warn(`   ⚠️  Invalid payout rate for ${nbfcName}: ${payoutRate}`);
        continue;
      }
      
      // Store normalized name for matching
      const normalizedName = normalizeNBFCName(nbfcName);
      payoutMap.set(normalizedName, {
        originalName: nbfcName,
        payoutRate: rate,
        commissionRate: rate * 0.5, // 50% of payout rate
      });
      
      console.log(`   ✅ ${nbfcName}: Payout Rate ${(rate * 100).toFixed(2)}% → Commission Rate ${(rate * 0.5 * 100).toFixed(2)}%`);
    }
    
    console.log(`\n   📋 Loaded ${payoutMap.size} NBFC payout rates`);
    return payoutMap;
  } catch (error) {
    console.error(`   ❌ Error loading Excel file:`, error.message);
    throw error;
  }
}

/**
 * Find payout rate for an NBFC name
 */
function findPayoutRate(nbfcName, payoutMap, systemNBFCs) {
  if (!nbfcName) {
    return null;
  }
  
  // First, try exact match with normalized names
  const normalizedName = normalizeNBFCName(nbfcName);
  if (payoutMap.has(normalizedName)) {
    return payoutMap.get(normalizedName);
  }
  
  // Try fuzzy matching with Excel names
  for (const [excelNormalized, payoutData] of payoutMap.entries()) {
    if (fuzzyMatchNBFC(payoutData.originalName, nbfcName)) {
      console.log(`   🔍 Matched "${nbfcName}" to Excel entry "${payoutData.originalName}"`);
      return payoutData;
    }
  }
  
  // Try fuzzy matching with system NBFC names
  for (const systemNBFC of systemNBFCs) {
    const systemName = getField(systemNBFC, 'Lender Name');
    if (fuzzyMatchNBFC(systemName, nbfcName)) {
      // Now try to match the system name to Excel
      for (const [excelNormalized, payoutData] of payoutMap.entries()) {
        if (fuzzyMatchNBFC(payoutData.originalName, systemName)) {
          console.log(`   🔍 Matched "${nbfcName}" (system: "${systemName}") to Excel entry "${payoutData.originalName}"`);
          return payoutData;
        }
      }
    }
  }
  
  return null;
}

/**
 * Fetch all Admin Activity Log entries
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
 * Fetch all NBFC Partners
 */
async function fetchNBFCPartners() {
  try {
    const response = await fetch(N8N_GET_NBFC_PARTNERS_URL);
    
    if (!response.ok) {
      console.warn(`   ⚠️  Failed to fetch NBFC Partners`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }
    
    let partners;
    try {
      partners = JSON.parse(text);
    } catch (e) {
      return [];
    }
    
    // Handle both array and object with records array
    if (!Array.isArray(partners)) {
      if (partners.records && Array.isArray(partners.records)) {
        partners = partners.records;
      } else {
        return [];
      }
    }
    
    return partners;
  } catch (error) {
    console.warn(`   ⚠️  Error fetching NBFC Partners:`, error.message);
    return [];
  }
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
async function createCommissionEntry(activityLog, loanApp, payoutMap, systemNBFCs) {
  try {
    const referenceId = getField(activityLog, 'Reference ID') || getField(activityLog, 'Reference ID');
    const fileId = getField(loanApp, 'File ID') || getField(loanApp, 'Application ID');
    const clientId = getField(loanApp, 'Client') || getField(loanApp, 'Client ID');
    const loanProductId = getField(loanApp, 'Loan Product') || getField(loanApp, 'Loan Product ID');
    const kamId = getField(loanApp, 'KAM Assigned') || getField(loanApp, 'KAM ID');
    const nbfcPartner = getField(loanApp, 'Assigned NBFC') || getField(loanApp, 'NBFC Partner');
    
    // Get loan amount - try multiple field names
    let loanAmount = getField(loanApp, 'Approved Loan Amount') ||
                     getField(loanApp, 'Loan Amount Requested') || 
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
    
    // Look up payout rate from Excel
    let commissionRate = DEFAULT_COMMISSION_RATE;
    let payoutData = null;
    
    if (nbfcPartner) {
      payoutData = findPayoutRate(nbfcPartner, payoutMap, systemNBFCs);
      if (payoutData) {
        commissionRate = payoutData.commissionRate * 100; // Convert to percentage
        console.log(`   💰 Found payout rate for "${nbfcPartner}": ${(payoutData.payoutRate * 100).toFixed(2)}% → Commission: ${commissionRate.toFixed(2)}%`);
      } else {
        console.warn(`   ⚠️  NBFC Partner "${nbfcPartner}" not found in payout table, using default rate: ${DEFAULT_COMMISSION_RATE}%`);
      }
    } else {
      console.warn(`   ⚠️  No NBFC Partner assigned, using default rate: ${DEFAULT_COMMISSION_RATE}%`);
    }
    
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
      'Description': `${entryType} for loan ${fileId} - Commission: ${commissionRate.toFixed(2)}% of ₹${loanAmount.toLocaleString('en-IN')}${nbfcPartner ? ` (NBFC: ${nbfcPartner})` : ''}`,
      'Dispute Status': 'None',
      'Payout Request': 'False',
    };
    
    console.log(`\n💰 Creating commission ledger entry...`);
    console.log(`   Ledger Entry ID: ${ledgerEntryId}`);
    console.log(`   Loan File: ${fileId}`);
    console.log(`   Client: ${clientId}`);
    console.log(`   NBFC Partner: ${nbfcPartner || 'N/A'}`);
    console.log(`   Loan Amount: ₹${loanAmount.toLocaleString('en-IN')}`);
    console.log(`   Commission Rate: ${commissionRate.toFixed(2)}%${payoutData ? ` (from ${(payoutData.payoutRate * 100).toFixed(2)}% payout rate)` : ' (default)'}`);
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
        'Description/Details': `Auto-generated commission ledger entry (${entryType}) for loan ${fileId}: ₹${commissionAmount.toLocaleString('en-IN')} at ${commissionRate.toFixed(2)}%${nbfcPartner ? ` (NBFC: ${nbfcPartner})` : ''}`,
        'Target Entity': 'commission_ledger',
        'Reference Type': 'Commission Trigger',
        'Reference ID': ledgerEntryId,
        'Remarks': `Auto-generated on loan ${getField(activityLog, 'Updated Status').toLowerCase()}${payoutData ? ` (from ${(payoutData.payoutRate * 100).toFixed(2)}% NBFC payout rate)` : ''}`,
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
        nbfcPartner,
        payoutData,
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
 * Find Excel file path
 */
function findExcelFile(providedPath) {
  if (providedPath) {
    return providedPath;
  }
  
  // Try common locations
  const possiblePaths = [
    join(__dirname, 'data', 'WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx'),
    join(__dirname, '..', 'WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx'),
    join(process.cwd(), 'WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx'),
    join(process.cwd(), 'backend', 'data', 'WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx'),
  ];
  
  for (const path of possiblePaths) {
    try {
      readFileSync(path); // Check if file exists
      return path;
    } catch (e) {
      // File doesn't exist, try next
    }
  }
  
  return null;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Auto-Create Commission from NBFC Payout Script');
  console.log('==================================================\n');
  
  // Step 1: Load Excel file
  const excelPath = findExcelFile(process.argv[2]);
  
  if (!excelPath) {
    console.error('❌ Excel file not found!');
    console.error('\nPlease provide the path to WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx:');
    console.error('  node backend/scripts/auto-create-commission-from-nbfc-payout.js [path/to/PAYOUT-1.xlsx]');
    console.error('\nOr place the file in one of these locations:');
    console.error('  - backend/data/WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx');
    console.error('  - ./WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx');
    process.exit(1);
  }
  
  let payoutMap;
  try {
    payoutMap = loadPayoutTable(excelPath);
  } catch (error) {
    console.error(`\n❌ Failed to load payout table:`, error.message);
    process.exit(1);
  }
  
  if (payoutMap.size === 0) {
    console.error('\n❌ No payout rates found in Excel file!');
    process.exit(1);
  }
  
  // Step 2: Fetch NBFC Partners for name matching
  console.log(`\n👥 Fetching NBFC Partners from system...`);
  const systemNBFCs = await fetchNBFCPartners();
  console.log(`   ✅ Fetched ${systemNBFCs.length} NBFC Partners`);
  
  // Step 3: Fetch Admin Activity Log entries
  const allLogs = await fetchAdminActivityLogs();
  
  if (allLogs.length === 0) {
    console.log('⚠️  No Admin Activity Log entries found. Exiting.');
    return;
  }
  
  // Step 4: Filter by status "Approved" or "Disbursed"
  const triggerStatuses = ['Approved', 'Disbursed'];
  const matchingLogs = filterByStatus(allLogs, triggerStatuses);
  
  console.log(`\n📊 Found ${matchingLogs.length} activity log entries with status: ${triggerStatuses.join(' or ')}`);
  
  if (matchingLogs.length === 0) {
    console.log('⚠️  No matching activity log entries found. Exiting.');
    return;
  }
  
  // Step 5: Process each matching activity log entry
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
    
    // Step 6: Fetch loan application details
    console.log(`\n📄 Fetching loan application: ${referenceId}...`);
    const loanApp = await fetchLoanApplication(referenceId);
    
    if (!loanApp) {
      console.log(`   ❌ Loan application not found`);
      results.push({ success: false, error: 'Loan application not found', referenceId });
      continue;
    }
    
    const fileId = getField(loanApp, 'File ID') || getField(loanApp, 'Application ID');
    const clientId = getField(loanApp, 'Client') || getField(loanApp, 'Client ID');
    const nbfcPartner = getField(loanApp, 'Assigned NBFC') || getField(loanApp, 'NBFC Partner');
    
    console.log(`   ✅ Found loan application: ${fileId}`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   NBFC Partner: ${nbfcPartner || 'Not assigned'}`);
    
    // Step 7: Create commission ledger entry
    const result = await createCommissionEntry(log, loanApp, payoutMap, systemNBFCs);
    results.push({ ...result, referenceId, fileId, clientId, nbfcPartner });
    
    // Rate limiting: wait 1 second between requests
    if (i < matchingLogs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Step 8: Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success && !r.skipped);
  const skipped = results.filter(r => r.skipped);
  
  console.log(`\n✅ Successful: ${successful.length}`);
  successful.forEach(r => {
    const rateInfo = r.payoutData 
      ? `(${(r.payoutData.payoutRate * 100).toFixed(2)}% payout → ${r.commissionRate.toFixed(2)}% commission)`
      : `(default ${r.commissionRate.toFixed(2)}%)`;
    console.log(`   - ${r.fileId}: ₹${r.commissionAmount?.toLocaleString('en-IN')} ${rateInfo} - ${r.nbfcPartner || 'No NBFC'}`);
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

