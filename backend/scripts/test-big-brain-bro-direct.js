/**
 * Direct test of big-brain-bro integration
 * 
 * Tests the big-brain-bro webhook directly with real application data
 * (same as what the AI summary generation would send)
 * 
 * Usage:
 *   node backend/scripts/test-big-brain-bro-direct.js [file-id]
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const BIG_BRAIN_BRO_URL = process.env.N8N_BIG_BRAIN_BRO_URL || `${N8N_BASE_URL}/webhook/big-brain-bro`;

function getField(record, fieldName) {
  if (record.fields && record[fieldName] === undefined && record.fields[fieldName] !== undefined) {
    return record.fields[fieldName];
  }
  if (record[fieldName] !== undefined) {
    return record[fieldName];
  }
  const lower = fieldName.toLowerCase();
  for (const k of Object.keys(record)) {
    if (k.toLowerCase() === lower) return record[k];
  }
  if (record.fields) {
    for (const k of Object.keys(record.fields)) {
      if (k.toLowerCase() === lower) return record.fields[k];
    }
  }
  return '';
}

function buildLoanApplicationPayload(data) {
  let formData = data['Form Data'] || data.formData || '';
  if (typeof formData === 'object' && formData !== null) {
    formData = JSON.stringify(formData);
  }
  return {
    id: data.id,
    'File ID': data['File ID'] || data.fileId || '',
    'Client': data['Client'] || data.client || '',
    'Applicant Name': data['Applicant Name'] || data.applicantName || '',
    'Loan Product': data['Loan Product'] || data.loanProduct || '',
    'Requested Loan Amount': data['Requested Loan Amount'] || data.requestedLoanAmount || '',
    'Documents': data['Documents'] || data.documents || '',
    'Status': data['Status'] || data.status || '',
    'Assigned Credit Analyst': data['Assigned Credit Analyst'] || data.assignedCreditAnalyst || '',
    'Assigned NBFC': data['Assigned NBFC'] || data.assignedNBFC || '',
    'Lender Decision Status': data['Lender Decision Status'] || data.lenderDecisionStatus || '',
    'Lender Decision Date': data['Lender Decision Date'] || data.lenderDecisionDate || '',
    'Lender Decision Remarks': data['Lender Decision Remarks'] || data.lenderDecisionRemarks || '',
    'Approved Loan Amount': data['Approved Loan Amount'] || data.approvedLoanAmount || '',
    'AI File Summary': data['AI File Summary'] || data.aiFileSummary || '',
    'Form Data': formData,
    'Creation Date': data['Creation Date'] || data.creationDate || '',
    'Submitted Date': data['Submitted Date'] || data.submittedDate || '',
    'Last Updated': data['Last Updated'] || data.lastUpdated || '',
    'Asana Task ID': data['Asana Task ID'] || data.asanaTaskId || '',
    'Asana Task Link': data['Asana Task Link'] || data.asanaTaskLink || '',
  };
}

async function fetchLoanApplications() {
  const res = await fetch(GET_LOAN_APPLICATION_URL, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET loanapplication failed: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : raw?.records ?? (raw && !Array.isArray(raw) ? [raw] : []);
  return list;
}

async function testBigBrainBro(application) {
  console.log('\n🤖 Testing big-brain-bro webhook...');
  console.log(`   URL: ${BIG_BRAIN_BRO_URL}`);
  console.log(`   File ID: ${getField(application, 'File ID')}`);
  
  const payload = buildLoanApplicationPayload(application);
  console.log(`   Payload keys: ${Object.keys(payload).length} fields`);
  
  const startTime = Date.now();
  
  const res = await fetch(BIG_BRAIN_BRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  const duration = Date.now() - startTime;
  console.log(`   ⏱️  Response time: ${duration}ms`);
  console.log(`   Status: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`big-brain-bro failed: ${res.status} - ${text.substring(0, 200)}`);
  }
  
  // Try to parse JSON, handle empty or invalid responses
  let result;
  const text = await res.text();
  
  if (!text || text.trim() === '') {
    throw new Error('big-brain-bro returned empty response');
  }
  
  try {
    result = JSON.parse(text);
  } catch (parseError) {
    // If not JSON, treat as plain text
    console.log(`   ⚠️  Response is not JSON, treating as plain text`);
    result = text;
  }
  
  console.log(`   Response type: ${Array.isArray(result) ? 'array' : typeof result}`);
  
  // Parse response
  const output =
    (Array.isArray(result) && result[0]?.output) ? result[0].output
    : (typeof result?.output === 'string') ? result.output
    : (typeof result === 'string') ? result
    : '';
  
  if (!output || typeof output !== 'string') {
    console.log(`   Response data: ${JSON.stringify(result).substring(0, 300)}`);
    throw new Error(`Invalid response format: expected string output`);
  }
  
  console.log(`   ✅ Output received: ${output.length} characters`);
  console.log(`\n   Summary Preview:`);
  console.log(`   ${output.substring(0, 400)}...`);
  
  return output;
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('🧪 Big-Brain-Bro Direct Integration Test');
    console.log('='.repeat(60));
    console.log(`N8N Base: ${N8N_BASE_URL}`);
    console.log(`Big-Brain-Bro: ${BIG_BRAIN_BRO_URL}`);
    
    // Fetch applications
    console.log('\n📥 Fetching loan applications...');
    const records = await fetchLoanApplications();
    console.log(`   ✅ Fetched ${records.length} record(s)`);
    
    if (records.length === 0) {
      console.error('\n❌ No applications found');
      process.exit(1);
    }
    
    // Select application
    const fileId = process.argv[2];
    let record;
    
    if (fileId) {
      record = records.find((r) => getField(r, 'File ID') === fileId);
      if (!record) {
        console.error(`❌ No record with File ID: ${fileId}`);
        process.exit(1);
      }
      console.log(`\n📌 Using application with File ID: ${fileId}`);
    } else {
      record = records[0];
      console.log(`\n📌 Using first application (File ID: ${getField(record, 'File ID')})`);
    }
    
    // Test big-brain-bro
    const summary = await testBigBrainBro(record);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Test Summary');
    console.log('='.repeat(60));
    console.log(`✅ Applications fetched: ${records.length}`);
    console.log(`✅ big-brain-bro webhook: Success`);
    console.log(`✅ Summary received: ${summary.length} characters`);
    console.log(`✅ Summary format: Valid`);
    
    console.log('\n🎉 All tests passed!');
    console.log('\n💡 To test the full API flow, start the backend server and run:');
    console.log('   node backend/scripts/test-ai-summary-generation.js');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
