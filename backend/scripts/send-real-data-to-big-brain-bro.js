/**
 * Send real loan application data to the big-brain-bro webhook.
 *
 * The POST body exactly matches n8nClient.postLoanApplication() as used when
 * the AI Generate Summary button is clicked (ai.controller → postLoanApplication).
 * Same keys, order, and value logic.
 *
 * 1. GETs real records from /webhook/loanapplication
 * 2. Picks one record (first by default, or by --index N or --file-id XYZ)
 * 3. POSTs it to https://fixrrahul.app.n8n.cloud/webhook/big-brain-bro
 *
 * Usage:
 *   node backend/scripts/send-real-data-to-big-brain-bro.js
 *   node backend/scripts/send-real-data-to-big-brain-bro.js --index 2
 *   node backend/scripts/send-real-data-to-big-brain-bro.js --file-id SF36220522BRY3QF
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const BIG_BRAIN_BRO_URL = 'https://fixrrahul.app.n8n.cloud/webhook/big-brain-bro';

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

/**
 * Build the exact same payload as n8nClient.postLoanApplication()
 * (Same keys, order, and derivation logic as AI generate-summary POST.)
 */
function buildPayload(record) {
  // Match postLoanApplication Form Data handling exactly:
  // formData = data['Form Data'] || data.formData || '';
  // if (typeof formData === 'object' && formData !== null) formData = JSON.stringify(formData);
  let formData = getField(record, 'Form Data') || getField(record, 'formData') || '';
  if (typeof formData === 'object' && formData !== null) {
    formData = JSON.stringify(formData);
  }

  // Same fields and fallbacks as postLoanApplication (ai.controller passes
  // { ...application, 'AI File Summary', 'Last Updated' } then this shape is sent)
  return {
    id: record.id, // data.id in n8n; no fallback—omit when undefined (JSON.stringify)
    'File ID': getField(record, 'File ID') || getField(record, 'fileId') || '',
    'Client': getField(record, 'Client') || getField(record, 'client') || '',
    'Applicant Name': getField(record, 'Applicant Name') || getField(record, 'applicantName') || '',
    'Loan Product': getField(record, 'Loan Product') || getField(record, 'loanProduct') || '',
    'Requested Loan Amount': getField(record, 'Requested Loan Amount') || getField(record, 'requestedLoanAmount') || '',
    'Documents': getField(record, 'Documents') || getField(record, 'documents') || '',
    'Status': getField(record, 'Status') || getField(record, 'status') || '',
    'Assigned Credit Analyst': getField(record, 'Assigned Credit Analyst') || getField(record, 'assignedCreditAnalyst') || '',
    'Assigned NBFC': getField(record, 'Assigned NBFC') || getField(record, 'assignedNBFC') || '',
    'Lender Decision Status': getField(record, 'Lender Decision Status') || getField(record, 'lenderDecisionStatus') || '',
    'Lender Decision Date': getField(record, 'Lender Decision Date') || getField(record, 'lenderDecisionDate') || '',
    'Lender Decision Remarks': getField(record, 'Lender Decision Remarks') || getField(record, 'lenderDecisionRemarks') || '',
    'Approved Loan Amount': getField(record, 'Approved Loan Amount') || getField(record, 'approvedLoanAmount') || '',
    'AI File Summary': getField(record, 'AI File Summary') || getField(record, 'aiFileSummary') || '',
    'Form Data': formData,
    'Creation Date': getField(record, 'Creation Date') || getField(record, 'creationDate') || '',
    'Submitted Date': getField(record, 'Submitted Date') || getField(record, 'submittedDate') || '',
    'Last Updated': getField(record, 'Last Updated') || getField(record, 'lastUpdated') || '',
    'Asana Task ID': getField(record, 'Asana Task ID') || getField(record, 'asanaTaskId') || '',
    'Asana Task Link': getField(record, 'Asana Task Link') || getField(record, 'asanaTaskLink') || '',
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

async function main() {
  const args = process.argv.slice(2);
  let index = 0;
  let fileId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--index' && args[i + 1] != null) {
      index = parseInt(args[i + 1], 10) || 0;
      i++;
    } else if (args[i] === '--file-id' && args[i + 1] != null) {
      fileId = args[i + 1];
      i++;
    }
  }

  console.log('Fetching real loan applications from', GET_LOAN_APPLICATION_URL);
  const records = await fetchLoanApplications();
  console.log('Fetched', records.length, 'record(s)');

  let record;
  if (fileId) {
    record = records.find((r) => getField(r, 'File ID') === fileId);
    if (!record) {
      console.error('No record with File ID:', fileId);
      process.exit(1);
    }
    console.log('Using record with File ID:', fileId);
  } else {
    if (records.length === 0) {
      console.error('No records to send.');
      process.exit(1);
    }
    index = Math.max(0, Math.min(index, records.length - 1));
    record = records[index];
    console.log('Using record at index', index, '| File ID:', getField(record, 'File ID'));
  }

  const payload = buildPayload(record);
  console.log('\nPOSTing to', BIG_BRAIN_BRO_URL);
  console.log('Payload keys:', Object.keys(payload).join(', '));

  const res = await fetch(BIG_BRAIN_BRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log('Status:', res.status, res.statusText);
  if (text) {
    try {
      console.log('Response:', JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log('Response:', text);
    }
  }

  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
