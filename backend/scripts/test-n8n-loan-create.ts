#!/usr/bin/env tsx
/**
 * Direct n8n loan application create test (no Express middleware).
 *
 * Usage:
 *   cd backend && npx tsx scripts/test-n8n-loan-create.ts
 *
 * Env:
 *   N8N_BASE_URL              - default https://fixrrahul.app.n8n.cloud
 *   TEST_CLIENT_ID            - Airtable client id (optional; fetched from GET /webhook/client if unset)
 *   TEST_LOAN_PRODUCT_ID      - optional product id for payload
 */

import fetch from 'node-fetch';

const N8N_BASE_URL = (process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud').replace(/\/$/, '');
const POST_URL = `${N8N_BASE_URL}/webhook/loanapplications1`;
const GET_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const GET_CLIENTS_URL = `${N8N_BASE_URL}/webhook/client`;

function buildPayload(options: {
  fileId: string;
  clientId: string;
  productId?: string;
  clientSubmissionId: string;
}): Record<string, string> {
  const formData = JSON.stringify({
    applicantName: 'n8n Direct Test Applicant',
    requestedLoanAmount: '100000',
    'field-1': 'Sample text',
    Notes: 'Direct n8n webhook test',
  });
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  return {
    'File ID': options.fileId,
    Client: options.clientId,
    'Applicant Name': 'n8n Direct Test Applicant',
    'Loan Product': options.productId || '',
    'Requested Loan Amount': '100000',
    Documents: '',
    Status: 'draft',
    'Assigned Credit Analyst': '',
    'Assigned NBFC': '',
    'Lender Decision Status': '',
    'Lender Decision Date': '',
    'Lender Decision Remarks': '',
    'Approved Loan Amount': '',
    'AI File Summary': '',
    'Creation Date': today,
    'Submitted Date': '',
    'Last Updated': now,
    'Asana Task ID': '',
    'Asana Task Link': '',
    'KAM ID': '',
    'Mobile Number': '',
    'Email Id': '',
    'Type of Purchase': '',
    Remarks: '',
    'Form Data': formData,
    'Form Config Version': '',
    'Needs Attention': '',
    'Validation Warnings': '',
    'Client Submission ID': options.clientSubmissionId,
    MD: '',
  };
}

async function fetchFirstClientId(): Promise<string | null> {
  const res = await fetch(GET_CLIENTS_URL, { method: 'GET' });
  if (!res.ok) {
    console.error('GET clients failed:', res.status, await res.text());
    return null;
  }
  const text = await res.text();
  let rows: unknown[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) rows = parsed;
    else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { data?: unknown[] }).data)) {
      rows = (parsed as { data: unknown[] }).data;
    }
  } catch {
    console.error('Could not parse clients response:', text.slice(0, 300));
    return null;
  }
  if (rows.length === 0) return null;
  const first = rows[0] as Record<string, unknown>;
  return String(first['Client ID'] || first.clientId || first.id || '').trim() || null;
}

function extractApplications(body: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
      if (Array.isArray(obj.records)) return obj.records as Record<string, unknown>[];
    }
  } catch {
    // ignore
  }
  return [];
}

async function waitForRecord(fileId: string, maxAttempts = 6): Promise<Record<string, unknown> | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(GET_URL, { method: 'GET' });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`GET attempt ${attempt}: HTTP ${res.status}`);
    } else {
      const apps = extractApplications(text);
      const found = apps.find((app) => String(app['File ID'] || app.fileId || '').trim() === fileId);
      if (found) return found;
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

async function main(): Promise<void> {
  console.log('POST_URL:', POST_URL);
  console.log('GET_URL:', GET_URL);

  let clientId = process.env.TEST_CLIENT_ID?.trim() || '';
  if (!clientId) {
    clientId = (await fetchFirstClientId()) || '';
  }
  if (!clientId) {
    console.error('Set TEST_CLIENT_ID or ensure GET /webhook/client returns rows.');
    process.exit(1);
  }
  console.log('Using Client:', clientId);

  const timestamp = Date.now().toString(36).toUpperCase();
  const fileId = `SF${timestamp.slice(-8)}`;
  const clientSubmissionId = `test-${Date.now()}`;
  const payload = buildPayload({
    fileId,
    clientId,
    productId: process.env.TEST_LOAN_PRODUCT_ID?.trim(),
    clientSubmissionId,
  });

  console.log('\n--- POST loanapplications ---');
  const postRes = await fetch(POST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const postText = await postRes.text();
  console.log('POST status:', postRes.status, postRes.statusText);
  console.log('POST body:', postText.slice(0, 500) || '(empty)');

  if (!postRes.ok) {
    console.error('FAIL: POST returned non-2xx');
    process.exit(1);
  }

  if (postText.trim() === '') {
    console.warn(
      'WARN: POST returned empty body. Import docs/N8N_LOAN_APPLICATION_CREATE_FIX.md workflow (upsert by File ID).'
    );
  }

  console.log('\n--- GET loanapplication (verify persistence) ---');
  const found = await waitForRecord(fileId);
  if (!found) {
    console.error(`FAIL: File ID ${fileId} not found after GET retries`);
    console.error('See docs/N8N_LOAN_APPLICATION_CREATE_FIX.md — re-import SEVEN-DASHBOARD(2).json with File ID upsert.');
    process.exit(1);
  }

  const status = String(found.Status || found.status || '').trim();
  console.log('Found record:', {
    fileId,
    status: status || '(empty)',
    id: found.id,
    clientSubmissionId: found['Client Submission ID'] || found.clientSubmissionId,
  });

  console.log('\nOK: n8n POST + GET persistence verified.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
