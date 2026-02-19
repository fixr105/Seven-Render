#!/usr/bin/env tsx
/**
 * Fetch Loan Products via GET /webhook/loanproducts and print full schema.
 * Use: npx tsx scripts/fetch-loan-products-schema.ts
 */
import 'dotenv/config';
import { n8nClient } from '../src/services/airtable/n8nClient.js';

async function main() {
  console.log('\n=== FETCHING LOAN PRODUCTS (GET /webhook/loanproducts) ===\n');
  try {
    const products = await n8nClient.fetchTable('Loan Products', false);
    console.log(`Fetched ${(products as any[]).length} records.\n`);

    // Collect all unique keys across all products
    const allKeys = new Set<string>();
    (products as any[]).forEach((p) => Object.keys(p).forEach((k) => allKeys.add(k)));
    const sortedKeys = Array.from(allKeys).sort();

    console.log('=== ALL COLUMNS (schema) ===');
    sortedKeys.forEach((k) => console.log('  -', k));
    console.log('');

    // Print each product with its key fields
    (products as any[]).forEach((p, i) => {
      const productId = p['Product ID'] || p.productId || p.id || '?';
      const productName = p['Product Name'] || p.productName || '?';
      console.log(`--- Product ${i + 1}: ${productName} (${productId}) ---`);
      sortedKeys.forEach((k) => {
        const v = p[k];
        if (v != null && String(v).trim() !== '') {
          const display = String(v).length > 80 ? String(v).slice(0, 77) + '...' : String(v);
          console.log(`  ${k}: ${display}`);
        }
      });
      console.log('');
    });

    // Summary: Section and Field keys (form config)
    const sectionKeys = sortedKeys.filter((k) => /^Section\s+\d+[A-Za-z]?(\s|$|[–-])/i.test(k) || /^Section\s+\d+$/i.test(k));
    const fieldKeys = sortedKeys.filter((k) => /^Field\s+\d+[A-Za-z]?(\.\d+)?$/i.test(k));
    console.log('=== FORM CONFIG KEYS ===');
    console.log('Section keys:', sectionKeys.length, '|', sectionKeys.slice(0, 15).join(', '), sectionKeys.length > 15 ? '...' : '');
    console.log('Field keys:', fieldKeys.length, '|', fieldKeys.slice(0, 20).join(', '), fieldKeys.length > 20 ? '...' : '');
    console.log('\nDone.');
  } catch (e: any) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
