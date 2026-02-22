/**
 * Backfill Commission Ledger for disbursed applications
 *
 * Creates Commission Ledger entries for Loan Applications that are already
 * marked "disbursed" in Airtable but have no corresponding Commission Ledger row
 * (e.g. marked disbursed before commission automation or outside the app).
 *
 * - Fetches Loan Application, Commission Ledger, and Clients tables via n8n webhooks
 * - Finds applications with Status = disbursed
 * - For each, checks if a ledger entry exists with matching Loan File
 * - For missing entries: uses client Commission Rate, computes commission (same formula
 *   as commission.service), creates one Commission Ledger record (Payout or Payin)
 *
 * Usage: node backend/scripts/backfill-commission-ledger.js
 * Requires: N8N_BASE_URL (or default), webhooks for loanapplication, commisionledger, client, COMISSIONLEDGER POST
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const N8N_GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const N8N_GET_COMMISSION_LEDGER_URL = `${N8N_BASE_URL}/webhook/commisionledger`;
const N8N_GET_CLIENTS_URL = `${N8N_BASE_URL}/webhook/client`;
const N8N_POST_COMMISSION_LEDGER_URL = `${N8N_BASE_URL}/webhook/COMISSIONLEDGER`;

const DEFAULT_COMMISSION_RATE = 1.5;

function getField(record, fieldName) {
  if (record.fields && record.fields[fieldName] !== undefined) return record.fields[fieldName];
  if (record[fieldName] !== undefined) return record[fieldName];
  const lower = fieldName.toLowerCase();
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === lower) return record[key];
  }
  if (record.fields) {
    for (const key of Object.keys(record.fields)) {
      if (key.toLowerCase() === lower) return record.fields[key];
    }
  }
  return null;
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && data.records && Array.isArray(data.records)) return data.records;
  return [];
}

async function fetchJson(url, label) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`   ${label}: ${res.status} ${res.statusText}`);
      return [];
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    const json = JSON.parse(text);
    return asArray(json);
  } catch (e) {
    console.error(`   ${label}: ${e.message}`);
    return [];
  }
}

function getCommissionRate(clientId, clients) {
  if (!clientId) return DEFAULT_COMMISSION_RATE;
  const client = clients.find((c) => {
    const id = getField(c, 'id') || getField(c, 'Client ID');
    return id === clientId;
  });
  if (!client) return DEFAULT_COMMISSION_RATE;
  const rate = getField(client, 'Commission Rate');
  if (rate == null || rate === '') return DEFAULT_COMMISSION_RATE;
  const num = parseFloat(String(rate).trim());
  return Number.isFinite(num) ? num : DEFAULT_COMMISSION_RATE;
}

function getDisbursedAmount(app) {
  const v =
    getField(app, 'Approved Loan Amount') ||
    getField(app, 'Disbursed Amount') ||
    getField(app, 'Loan Amount Requested') ||
    getField(app, 'Loan Amount') ||
    getField(app, 'Amount');
  if (v == null || v === '') return null;
  const num = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function getEntryDate(app) {
  const v = getField(app, 'Last Updated') || getField(app, 'Updated At') || getField(app, 'Date');
  if (typeof v === 'string' && v.includes('T')) return v.split('T')[0];
  if (typeof v === 'string') return v;
  return new Date().toISOString().split('T')[0];
}

async function main() {
  console.log('\nBackfill Commission Ledger');
  console.log('Fetching Loan Applications, Commission Ledger, and Clients...\n');

  const [applications, ledgerEntries, clients] = await Promise.all([
    fetchJson(N8N_GET_LOAN_APPLICATION_URL, 'Loan Application'),
    fetchJson(N8N_GET_COMMISSION_LEDGER_URL, 'Commission Ledger'),
    fetchJson(N8N_GET_CLIENTS_URL, 'Clients'),
  ]);

  const statusNorm = (s) => (s == null ? '' : String(s).trim().toLowerCase());
  const disbursedApps = applications.filter((app) => statusNorm(getField(app, 'Status')) === 'disbursed');

  const ledgerLoanFiles = new Set(
    ledgerEntries.map((e) => getField(e, 'Loan File')).filter(Boolean)
  );

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const app of disbursedApps) {
    const fileId = getField(app, 'File ID') || getField(app, 'Application ID') || app.id;
    const clientId = getField(app, 'Client') || getField(app, 'Client ID');
    if (!fileId) {
      console.warn(`   Skip: no File ID for application ${app.id}`);
      skipped++;
      continue;
    }
    if (ledgerLoanFiles.has(fileId)) {
      skipped++;
      continue;
    }
    if (!clientId) {
      console.warn(`   Skip: no Client for file ${fileId}`);
      skipped++;
      continue;
    }
    const disbursedAmount = getDisbursedAmount(app);
    if (disbursedAmount == null) {
      console.warn(`   Skip: no disbursed amount for file ${fileId}`);
      skipped++;
      continue;
    }

    const commissionRate = getCommissionRate(clientId, clients);
    const commissionAmount = (disbursedAmount * commissionRate) / 100;
    const payoutAmount = commissionAmount >= 0 ? commissionAmount : -Math.abs(commissionAmount);
    const entryType = commissionAmount >= 0 ? 'Payout' : 'Payin';
    const entryDate = getEntryDate(app);
    const ledgerEntryId = `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const ledgerEntry = {
      id: ledgerEntryId,
      'Ledger Entry ID': ledgerEntryId,
      Client: clientId,
      'Loan File': fileId,
      Date: entryDate,
      'Disbursed Amount': disbursedAmount.toString(),
      'Commission Rate': commissionRate.toString(),
      'Payout Amount': payoutAmount.toString(),
      Description: `${entryType} for loan disbursement - ${fileId} (Commission: ${commissionRate}% of ${disbursedAmount})`,
      'Dispute Status': 'None',
      'Payout Request': 'False',
    };

    try {
      const res = await fetch(N8N_POST_COMMISSION_LEDGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ledgerEntry),
      });
      if (res.ok) {
        ledgerLoanFiles.add(fileId);
        created++;
        console.log(`   Created: ${fileId} ${entryType} ${payoutAmount}`);
      } else {
        errors++;
        console.error(`   POST failed for ${fileId}: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      errors++;
      console.error(`   Error for ${fileId}: ${e.message}`);
    }
  }

  console.log('\nDone.');
  console.log(`   Processed: ${disbursedApps.length} disbursed applications`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped (already present or invalid): ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
