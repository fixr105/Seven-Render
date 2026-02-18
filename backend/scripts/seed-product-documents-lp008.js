#!/usr/bin/env node
/**
 * Seed Product Documents for LP008 (Credit Card).
 * Run: cd backend && node scripts/seed-product-documents-lp008.js
 *
 * Requires N8N_BASE_URL (default: https://fixrrahul.app.n8n.cloud).
 * POSTs to /webhook/productdocument.
 */
import 'dotenv/config';
import fetch from 'node-fetch';

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const URL = `${N8N_BASE_URL}/webhook/productdocument`;

const LP008_DOCUMENTS = [
  { 'Product ID': 'LP008', 'Record Title': 'Applicant Name', 'Display Order': 1, 'Is Required': true },
  { 'Product ID': 'LP008', 'Record Title': 'PAN Card', 'Display Order': 2, 'Is Required': true },
  { 'Product ID': 'LP008', 'Record Title': 'Aadhaar', 'Display Order': 3, 'Is Required': true },
  { 'Product ID': 'LP008', 'Record Title': 'Bank Statement', 'Display Order': 4, 'Is Required': true },
  { 'Product ID': 'LP008', 'Record Title': 'Income Proof', 'Display Order': 5, 'Is Required': false },
];

async function main() {
  console.log('\nSeeding Product Documents for LP008 (Credit Card)...\n');
  console.log(`URL: ${URL}\n`);

  let created = 0;
  let failed = 0;

  for (let i = 0; i < LP008_DOCUMENTS.length; i++) {
    const doc = LP008_DOCUMENTS[i];
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`  OK: ${doc['Record Title']} (${doc['Display Order']})`);
        created++;
      } else {
        console.error(`  FAIL: ${doc['Record Title']} - ${res.status}`, data);
        failed++;
      }
    } catch (e) {
      console.error(`  ERROR: ${doc['Record Title']} -`, e.message);
      failed++;
    }
    if (i < LP008_DOCUMENTS.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nDone: ${created} created, ${failed} failed.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
